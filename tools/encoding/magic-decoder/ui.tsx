'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eraser, FileUp, Loader2, Undo2, Wand2 } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  DECODERS,
  MAX_INPUT_BYTES,
  applyDecoder,
  buildExamples,
  bytesToHex,
  confidenceOf,
  identifyInput,
  magicSearchAsync,
  makeInput,
  previewBytes,
  scoreBytes,
  toBytes,
  type Chain,
  type Confidence,
  type DecodeOutput,
  type Score,
  type SearchResult,
} from './logic';

type Mode = 'auto' | 'manual';

interface ManualStep {
  decoderId: string;
  name: string;
  variants: DecodeOutput[];
  variant: number;
}

const CONF_BADGE: Record<Confidence, string> = {
  high: 'border-transparent bg-success/20 text-foreground',
  medium: 'border-transparent bg-warning/30 text-foreground',
  low: 'border-transparent bg-muted text-muted-foreground',
};

const CONF_LABEL: Record<Confidence, string> = { high: 'high', medium: 'medium', low: 'low' };

function oneLine(bytes: Uint8Array, score: Score, max = 110): string {
  if (score.kind === 'text') {
    const t = new TextDecoder().decode(bytes.subarray(0, 600)).replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }
  return `${formatBytes(bytes.length)} · ${bytesToHex(bytes.subarray(0, 12))}${bytes.length > 12 ? '…' : ''}`;
}

function stepTitle(s: { name: string; params?: string }): string {
  return s.params ? `${s.name} (${s.params})` : s.name;
}

function extFor(score: Score): string {
  return score.kind === 'text' ? score.ext ?? 'txt' : score.ext ?? 'bin';
}

function OutputView({
  bytes,
  score,
  maxHeight = 'max-h-56',
  filename,
  showActions = false,
}: {
  bytes: Uint8Array;
  score?: Score;
  maxHeight?: string;
  filename?: string;
  showActions?: boolean;
}) {
  const s = useMemo(() => score ?? scoreBytes(bytes), [bytes, score]);
  const view = useMemo(() => previewBytes(bytes, s), [bytes, s]);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-2xs text-muted-foreground">
          {formatBytes(bytes.length)} · {s.label}
          {view.kind === 'hex' ? ' · hex view' : ''}
        </span>
        {showActions && (
          <span className="ml-auto flex items-center gap-1">
            <CopyButton
              value={() => (view.kind === 'text' ? new TextDecoder().decode(bytes) : bytesToHex(bytes))}
              label={view.kind === 'text' ? 'Copy' : 'Copy hex'}
            />
            <DownloadButton
              data={() => bytes}
              mime={s.mime ?? 'application/octet-stream'}
              filename={filename ?? `decoded.${extFor(s)}`}
              label={view.kind === 'text' ? 'Download' : 'Download file'}
            />
          </span>
        )}
      </div>
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-2 font-mono text-xs leading-5',
          maxHeight
        )}
      >
        {view.text || '(empty)'}
        {view.truncated ? '\n…(preview truncated)' : ''}
      </pre>
    </div>
  );
}

export default function MagicDecoderTool() {
  const examples = useMemo(() => buildExamples(), []);
  const [text, setText] = useState<string>(() => examples[0]?.input ?? '');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [steps, setSteps] = useState<ManualStep[]>([]);
  const [manualDecoder, setManualDecoder] = useState('base64');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inputBytes = useMemo(() => fileBytes ?? toBytes(text), [fileBytes, text]);
  const tooBig = inputBytes.length > MAX_INPUT_BYTES;

  useEffect(() => {
    if (mode !== 'auto') return;
    if (inputBytes.length === 0) {
      setResult(null);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      const r = await magicSearchAsync(inputBytes, {}, () => cancelled);
      if (cancelled || !r) return;
      setResult(r);
      setSelected(0);
      setBusy(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputBytes, mode]);

  // Manual pipeline is invalidated when the input changes.
  useEffect(() => {
    setSteps([]);
    setError(null);
  }, [inputBytes]);

  const identify = useMemo(() => (fileBytes ? [] : identifyInput(text)), [fileBytes, text]);
  const fileScore = useMemo(() => (fileBytes ? scoreBytes(fileBytes) : null), [fileBytes]);

  const manualCurrent = useMemo(() => {
    const last = steps[steps.length - 1];
    return last ? (last.variants[last.variant]?.bytes ?? new Uint8Array(0)) : inputBytes;
  }, [steps, inputBytes]);

  const applicable = useMemo(() => {
    if (mode !== 'manual' || manualCurrent.length === 0 || manualCurrent.length > MAX_INPUT_BYTES) return [];
    const inp = makeInput(manualCurrent);
    return DECODERS.filter((d) => {
      try {
        return d.canDecode(inp);
      } catch {
        return false;
      }
    });
  }, [mode, manualCurrent]);

  const runManual = useCallback(
    (id: string) => {
      setError(null);
      try {
        const variants = applyDecoder(id, manualCurrent);
        const d = DECODERS.find((x) => x.id === id);
        setSteps((s) => [...s, { decoderId: id, name: d?.name ?? id, variants, variant: 0 }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Decoding failed.');
      }
    },
    [manualCurrent]
  );

  const loadFile = useCallback(async (file: File) => {
    try {
      const buf = new Uint8Array(await file.slice(0, MAX_INPUT_BYTES + 1).arrayBuffer());
      const inp = makeInput(buf);
      if (inp.text !== null && buf.length <= MAX_INPUT_BYTES) {
        setFileBytes(null);
        setFileName('');
        setText(inp.text);
      } else {
        setFileBytes(buf);
        setFileName(file.name);
      }
    } catch {
      setError(`Could not read ${file.name}.`);
    }
  }, []);

  const chain: Chain | undefined = result?.chains[selected];
  const best = result?.best ?? null;
  const confidentBest = best && best.score.score >= 50 ? best : null;
  const alreadyReadable = result && result.baseline.score >= 70 && (!best || best.score.score <= result.baseline.score + 5);

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="auto">Auto (Magic)</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Examples">
          <Select
            value=""
            onValueChange={(id) => {
              const ex = examples.find((e) => e.id === id);
              if (ex) {
                setFileBytes(null);
                setFileName('');
                setText(ex.input);
              }
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Load an example…" />
            </SelectTrigger>
            <SelectContent>
              {examples.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input">
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} title="Open a text or binary file (up to 2 MB)">
            <FileUp className="size-3.5" /> Open file
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            title="Clear input"
            disabled={!text && !fileBytes}
            onClick={() => {
              setText('');
              setFileBytes(null);
              setFileName('');
            }}
          >
            <Eraser className="size-3.5" />
          </Button>
        </PanelHeader>
        {fileBytes ? (
          <div className="space-y-2 p-3 text-xs">
            <div className="font-medium">
              Using binary file <span className="font-mono">{fileName}</span> ({formatBytes(fileBytes.length)}). Type in the box below to switch back to text input.
            </div>
            <OutputView bytes={fileBytes} score={fileScore ?? undefined} maxHeight="max-h-32" />
          </div>
        ) : null}
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (fileBytes) {
              setFileBytes(null);
              setFileName('');
            }
          }}
          spellCheck={false}
          placeholder="Paste an encoded, obfuscated or unknown blob here…"
          style={{ minHeight: '8rem' }}
          className="resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar
          items={[
            `${inputBytes.length.toLocaleString()} bytes`,
            tooBig && `only the first ${formatBytes(MAX_INPUT_BYTES)} are analysed`,
            mode === 'auto' && result && `${result.explored} decode attempts`,
            mode === 'auto' && result?.timedOut && 'search stopped at the time budget',
          ]}
        />
      </Panel>

      {identify.length > 0 && (
        <Panel>
          <PanelHeader title="Looks like" />
          <div className="flex flex-wrap gap-2 p-3">
            {identify.map((h) => (
              <div key={h.label} className="flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs" title={h.detail}>
                <Badge className={CONF_BADGE[h.confidence]}>{h.confidence}</Badge>
                <div>
                  <div className="font-medium">{h.label}</div>
                  {h.detail && <div className="text-muted-foreground">{h.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {mode === 'auto' ? (
        <Panel>
          <PanelHeader title="Decode chains">
            {busy && (
              <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> searching…
              </span>
            )}
          </PanelHeader>
          {!result || inputBytes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Wand2 className="size-4" /> {inputBytes.length === 0 ? 'Paste something to decode.' : 'Searching…'}
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {alreadyReadable ? (
                <div className="rounded-md border bg-success/10 px-3 py-2 text-xs">
                  The input already looks like readable {result.baseline.label}; no decoding seems necessary.
                </div>
              ) : !confidentBest ? (
                <div className="rounded-md border bg-warning/15 px-3 py-2 text-xs">
                  No confident decoding found. The candidates below are weak guesses: the data may be encrypted, use a custom
                  scheme, or need a key.
                </div>
              ) : null}
              {result.chains.length > 0 && (
                <ul className="grid gap-2" role="listbox" aria-label="Decode chains">
                  {result.chains.map((c, i) => {
                    const conf = confidenceOf(c.score.score);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === selected}
                          onClick={() => setSelected(i)}
                          className={cn(
                            'w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50',
                            i === selected && 'border-primary bg-accent/60'
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-2xs text-muted-foreground">#{i + 1}</span>
                            <Badge className={CONF_BADGE[conf]}>
                              {Math.round(c.score.score)} · {CONF_LABEL[conf]}
                            </Badge>
                            <span className="flex flex-wrap items-center gap-1 text-xs font-medium">
                              {c.steps.map((s, k) => (
                                <span key={k} className="inline-flex items-center gap-1">
                                  {k > 0 && <ArrowRight className="size-3 text-muted-foreground" />}
                                  {stepTitle(s)}
                                </span>
                              ))}
                            </span>
                            <Badge variant="outline" className="ml-auto">{c.score.label}</Badge>
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{oneLine(c.output, c.score)}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {chain && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Chain #{selected + 1}: step by step
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-medium">Input</div>
                      <OutputView bytes={inputBytes} maxHeight="max-h-28" />
                    </div>
                    {chain.steps.map((s, k) => {
                      const last = k === chain.steps.length - 1;
                      return (
                        <div key={k}>
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                            <ArrowRight className="size-3 text-muted-foreground" />
                            Step {k + 1}: {stepTitle(s)}
                            {last && <Badge variant="success">result</Badge>}
                          </div>
                          <OutputView
                            bytes={s.bytes}
                            score={last ? chain.score : undefined}
                            maxHeight={last ? 'max-h-72' : 'max-h-32'}
                            showActions
                            filename={last ? `decoded.${extFor(chain.score)}` : `step-${k + 1}.${extFor(scoreBytes(s.bytes))}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Manual pipeline">
            <Button variant="ghost" size="sm" disabled={steps.length === 0} onClick={() => setSteps((s) => s.slice(0, -1))}>
              <Undo2 className="size-3.5" /> Undo
            </Button>
            <Button variant="ghost" size="sm" disabled={steps.length === 0} onClick={() => setSteps([])}>
              Reset
            </Button>
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Decoder">
                <Select value={manualDecoder} onValueChange={setManualDecoder}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECODERS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button size="sm" onClick={() => runManual(manualDecoder)} disabled={manualCurrent.length === 0}>
                Apply
              </Button>
            </div>
            {applicable.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Applicable to the current data:</span>
                {applicable.map((d) => (
                  <Button key={d.id} variant="outline" size="sm" onClick={() => runManual(d.id)} title={d.description}>
                    {d.name}
                  </Button>
                ))}
              </div>
            )}
            <ErrorBanner error={error} />
            <div>
              <div className="mb-1 text-xs font-medium">Input</div>
              <OutputView bytes={inputBytes} maxHeight="max-h-28" />
            </div>
            {steps.map((s, k) => {
              const out = s.variants[s.variant]?.bytes ?? new Uint8Array(0);
              const last = k === steps.length - 1;
              return (
                <div key={k}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium">
                    <ArrowRight className="size-3 text-muted-foreground" />
                    Step {k + 1}: {stepTitle({ name: s.name, params: s.variants[s.variant]?.params })}
                    {s.variants.length > 1 && last && (
                      <Select
                        value={String(s.variant)}
                        onValueChange={(v) =>
                          setSteps((all) => all.map((x, idx) => (idx === k ? { ...x, variant: Number(v) } : x)))
                        }
                      >
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {s.variants.map((v, vi) => (
                            <SelectItem key={vi} value={String(vi)}>
                              {v.params ?? 'default'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <OutputView bytes={out} maxHeight={last ? 'max-h-72' : 'max-h-32'} showActions={last} />
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <p className="text-2xs text-muted-foreground">
        Heuristic search (depth ≤ 5, beam width 6) scored by readability, known structures and file signatures. It cannot break
        encryption or guess keys; confidence is a hint, not proof. Everything runs locally in your browser, and inputs are
        capped at {formatBytes(MAX_INPUT_BYTES)}.
      </p>
    </div>
  );
}
