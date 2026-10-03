'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Eye, EyeOff, FileUp, Loader2, ScanSearch, Sparkles } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  GROUPS,
  MAX_INPUT_CHARS,
  buildSampleText,
  defaultOptions,
  findingsToJson,
  identifyToken,
  redactText,
  scanTextAsync,
  type Confidence,
  type Finding,
  type RedactStyle,
  type RuleGroup,
  type ScanOptions,
  type ScanResult,
  type Severity,
} from './logic';

interface ScanState {
  input: string;
  source: string;
  result: ScanResult;
}

type OutputTab = 'redacted' | 'highlight';

const MAX_ROWS = 600;
const FULL_HIGHLIGHT_LIMIT = 120_000;

const SEVERITY_BADGE: Record<Severity, string> = {
  high: 'border-transparent bg-destructive text-destructive-foreground',
  medium: 'border-transparent bg-warning/30 text-foreground',
  low: 'border-transparent bg-muted text-muted-foreground',
};

const MARK_CLASS: Record<Severity, string> = {
  high: 'bg-destructive/25',
  medium: 'bg-warning/35',
  low: 'bg-primary/20',
};

const CONF_DOT: Record<Confidence, string> = {
  high: 'bg-success',
  medium: 'bg-warning',
  low: 'bg-muted-foreground/50',
};

const exclKey = (f: Finding) => `${f.ruleId}:${f.fingerprint}`;

function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge className={SEVERITY_BADGE[severity]}>{severity}</Badge>;
}

function ConfidenceCell({ confidence }: { confidence: Confidence }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn('size-2 rounded-full', CONF_DOT[confidence])} />
      {confidence}
    </span>
  );
}

function HighlightedSource({
  source,
  findings,
  selectedKey,
  onSelect,
}: {
  source: string;
  findings: Finding[];
  selectedKey: string | null;
  onSelect: (f: Finding) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !selectedKey) return;
    const el = box.querySelector<HTMLElement>(`[data-key="${selectedKey}"]`);
    if (!el) return;
    box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2);
  }, [selectedKey, source]);

  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    const mark = (f: Finding, text: string) => (
      <mark
        key={f.key}
        data-key={f.key}
        onClick={() => onSelect(f)}
        className={cn(
          'cursor-pointer rounded-[3px] px-px text-foreground',
          MARK_CLASS[f.severity],
          selectedKey === f.key && 'ring-2 ring-primary'
        )}
        title={`${f.ruleName} · ${f.severity}`}
      >
        {text}
      </mark>
    );
    if (source.length <= FULL_HIGHLIGHT_LIMIT) {
      let cursor = 0;
      for (const f of findings) {
        if (f.start < cursor) continue;
        if (f.start > cursor) out.push(source.slice(cursor, f.start));
        out.push(mark(f, source.slice(f.start, f.end)));
        cursor = f.end;
      }
      out.push(source.slice(cursor));
      return out;
    }
    // Large input: only show the lines that contain findings.
    const lines = source.split('\n');
    const byLine = new Map<number, Finding[]>();
    for (const f of findings) {
      const arr = byLine.get(f.line) ?? [];
      arr.push(f);
      byLine.set(f.line, arr);
    }
    let shown = 0;
    const lineNos = Array.from(byLine.keys()).sort((a, b) => a - b);
    for (const ln of lineNos) {
      if (shown++ >= 300) {
        out.push(`… ${lineNos.length - 300} more lines with findings`);
        break;
      }
      const text = lines[ln - 1] ?? '';
      const fs = byLine.get(ln) ?? [];
      const parts: React.ReactNode[] = [];
      let cur = 0;
      const base = fs[0] ? fs[0].start - (fs[0].col - 1) : 0;
      for (const f of fs) {
        const s = f.start - base;
        const e = Math.min(f.end - base, text.length);
        if (s < cur) continue;
        if (s > cur) parts.push(text.slice(cur, s).slice(-200));
        parts.push(mark(f, text.slice(s, e).slice(0, 200)));
        cur = e;
      }
      parts.push(text.slice(cur, cur + 200));
      out.push(
        <div key={`l${ln}`} className="flex gap-3">
          <span className="w-12 shrink-0 select-none text-right text-muted-foreground">{ln}</span>
          <span className="min-w-0 whitespace-pre-wrap break-all">{parts}</span>
        </div>
      );
    }
    return out;
  }, [source, findings, selectedKey, onSelect]);

  return (
    <div
      ref={boxRef}
      className="relative h-[24rem] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5"
    >
      {nodes.length === 0 || (findings.length === 0 && source.length === 0) ? (
        <span className="text-muted-foreground">Nothing to show.</span>
      ) : (
        nodes
      )}
    </div>
  );
}

export default function SecretScannerRedactorTool() {
  const [text, setText] = useState<string>(() => buildSampleText());
  const [groups, setGroups] = useState<Record<RuleGroup, boolean>>(() => defaultOptions().groups);
  const [entropy, setEntropy] = useState(3);
  const [minLength, setMinLength] = useState(8);
  const [minConfidence, setMinConfidence] = useState<Confidence>('low');
  const [hidePlaceholders, setHidePlaceholders] = useState(true);
  const [style, setStyle] = useState<RedactStyle>('label');
  const [tab, setTab] = useState<OutputTab>('redacted');
  const [scan, setScan] = useState<ScanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [reveal, setReveal] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const options = useMemo<ScanOptions>(
    () => ({ groups, entropyThreshold: entropy, minLength, hidePlaceholders, minConfidence }),
    [groups, entropy, minLength, hidePlaceholders, minConfidence]
  );

  useEffect(() => {
    if (!text) {
      setScan(null);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(
      async () => {
        const result = await scanTextAsync(text, options, () => cancelled);
        if (cancelled || !result) return;
        const source = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
        setScan({ input: text, source, result });
        setBusy(false);
      },
      text.length > 200_000 ? 400 : 150
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, options]);

  const findings = useMemo(() => scan?.result.findings ?? [], [scan]);

  const included = useMemo(() => findings.filter((f) => !excluded.has(exclKey(f))), [findings, excluded]);

  const redacted = useMemo(
    () => (scan ? redactText(scan.source, included, style) : null),
    [scan, included, style]
  );

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const f of findings) c[f.severity]++;
    return c;
  }, [findings]);

  const uniqueSecrets = useMemo(() => new Set(findings.map((f) => f.value)).size, [findings]);

  const identified = useMemo(() => (tokenInput.trim() ? identifyToken(tokenInput) : null), [tokenInput]);

  const focusInText = useCallback(
    (f: Finding) => {
      const ta = taRef.current;
      if (!ta || !scan || scan.input !== text) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(f.start, f.end);
      const cs = getComputedStyle(ta);
      const lh = parseFloat(cs.lineHeight) || 20;
      let charW = 7.2;
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (ctx) {
          ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
          charW = ctx.measureText('0').width || charW;
        }
      } catch {
        /* canvas unavailable: keep the estimate */
      }
      ta.scrollTop = Math.max(0, (f.line - 1) * lh - ta.clientHeight / 2 + lh);
      ta.scrollLeft = Math.max(0, (f.col - 1) * charW - ta.clientWidth / 2);
    },
    [scan, text]
  );

  const selectFinding = useCallback(
    (f: Finding) => {
      setSelectedKey(f.key);
      focusInText(f);
    },
    [focusInText]
  );

  const toggleGroup = (id: RuleGroup, on: boolean) => setGroups((g) => ({ ...g, [id]: on }));

  const toggleExcluded = (f: Finding, redact: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (redact) next.delete(exclKey(f));
      else next.add(exclKey(f));
      return next;
    });

  const loadFile = useCallback(async (file: File) => {
    try {
      const limit = MAX_INPUT_CHARS + 4096;
      const chunk = file.size > limit ? file.slice(0, limit) : file;
      const content = await chunk.text();
      setText(content);
      setFileNote(
        file.size > limit
          ? `${file.name}: only the first ${formatBytes(limit)} of ${formatBytes(file.size)} were loaded.`
          : `${file.name} · ${formatBytes(file.size)}`
      );
    } catch {
      setFileNote(`Could not read ${file.name}.`);
    }
  }, []);

  const visibleRows = showAll ? findings : findings.slice(0, MAX_ROWS);
  const stale = scan !== null && scan.input !== text;

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label="Rule groups" className="min-w-[260px] flex-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {GROUPS.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-1.5 text-xs"
                title={g.description}
              >
                <Checkbox checked={groups[g.id]} onCheckedChange={(c) => toggleGroup(g.id, c === true)} />
                {g.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label={`Generic entropy ≥ ${entropy.toFixed(1)}`} className="w-44" hint="bits per character">
          <Slider value={[entropy]} min={0} max={5} step={0.1} onValueChange={(v) => setEntropy(v[0] ?? 3)} />
        </Field>
        <Field label={`Generic min length ${minLength}`} className="w-36">
          <Slider value={[minLength]} min={4} max={32} step={1} onValueChange={(v) => setMinLength(v[0] ?? 8)} />
        </Field>
        <Field label="Min confidence">
          <Select value={minConfidence} onValueChange={(v) => setMinConfidence(v as Confidence)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Show all</SelectItem>
              <SelectItem value="medium">Medium+</SelectItem>
              <SelectItem value="high">High only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ignore placeholders">
          <Switch checked={hidePlaceholders} onCheckedChange={setHidePlaceholders} aria-label="Ignore placeholders" />
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* INPUT */}
        <Panel
          className={cn('relative', dragging && 'ring-2 ring-primary')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
        >
          <PanelHeader title="Input">
            <Button variant="ghost" size="sm" onClick={() => setText(buildSampleText())} title="Load a synthetic sample">
              <Sparkles className="size-3.5" /> Sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} title="Open a text file (or drop one here)">
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
              onClick={() => {
                setText('');
                setFileNote(null);
              }}
              disabled={!text}
              title="Clear input"
            >
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          <Textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileNote(null);
            }}
            wrap="off"
            spellCheck={false}
            placeholder="Paste code, logs, a diff, a config or a .env file here (or drop a file)…"
            style={{ height: '24rem' }}
            className="field-sizing-fixed resize-y whitespace-pre rounded-none border-0 bg-transparent font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-sm font-medium">
              Drop a file to scan it
            </div>
          )}
          <StatBar
            items={[
              `${text.length.toLocaleString()} chars`,
              `${text ? text.split('\n').length.toLocaleString() : 0} lines`,
              fileNote,
              text.length > MAX_INPUT_CHARS && `only the first ${MAX_INPUT_CHARS.toLocaleString()} chars are scanned`,
            ]}
          />
        </Panel>

        {/* OUTPUT */}
        <Panel>
          <PanelHeader title={tab === 'redacted' ? 'Redacted copy' : 'Highlighted source'}>
            <Tabs value={tab} onValueChange={(v) => setTab(v as OutputTab)}>
              <TabsList className="h-7">
                <TabsTrigger value="redacted" className="h-6 px-2">Redacted</TabsTrigger>
                <TabsTrigger value="highlight" className="h-6 px-2">Highlighted</TabsTrigger>
              </TabsList>
            </Tabs>
            <CopyButton value={() => redacted?.text ?? ''} disabled={!redacted} size="icon-sm" label="Copy redacted text" />
            <DownloadButton
              data={() => redacted?.text ?? ''}
              filename="redacted.txt"
              disabled={!redacted}
              size="icon-sm"
              label="Download redacted text"
            />
          </PanelHeader>
          {tab === 'redacted' ? (
            <Textarea
              value={redacted?.text ?? ''}
              readOnly
              wrap="off"
              spellCheck={false}
              placeholder="The redacted copy appears here…"
              style={{ height: '24rem' }}
              className="field-sizing-fixed resize-y whitespace-pre rounded-none border-0 bg-transparent font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          ) : (
            <HighlightedSource
              source={scan?.source ?? ''}
              findings={findings}
              selectedKey={selectedKey}
              onSelect={selectFinding}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-3 py-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Style</span>
            <Tabs value={style} onValueChange={(v) => setStyle(v as RedactStyle)}>
              <TabsList className="h-7">
                <TabsTrigger value="label" className="h-6 px-2 font-mono text-2xs">[REDACTED:id]</TabsTrigger>
                <TabsTrigger value="partial" className="h-6 px-2 font-mono text-2xs">AKIA****MPLE</TabsTrigger>
                <TabsTrigger value="hash" className="h-6 px-2 font-mono text-2xs">&lt;secret-1a2b&gt;</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <StatBar
            items={[
              redacted ? `${redacted.replaced} redacted` : '0 redacted',
              redacted ? `${redacted.uniqueSecrets} unique value${redacted.uniqueSecrets === 1 ? '' : 's'}` : null,
              redacted ? `${redacted.text.length.toLocaleString()} chars` : null,
            ]}
          />
        </Panel>
      </div>

      {/* FINDINGS */}
      <Panel>
        <PanelHeader title="Findings">
          {busy && (
            <span className="mr-2 inline-flex items-center gap-1 text-2xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> scanning…
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setReveal((r) => !r)} disabled={findings.length === 0}>
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {reveal ? 'Hide values' : 'Show values'}
          </Button>
          <DownloadButton
            data={() => (scan ? findingsToJson(scan.result, options) : '')}
            filename="secret-findings.json"
            mime="application/json"
            label="Findings JSON"
            disabled={!scan || findings.length === 0}
          />
        </PanelHeader>

        {scan && scan.result.truncated && (
          <div className="border-b bg-warning/15 px-3 py-2 text-xs">
            Input is larger than {MAX_INPUT_CHARS.toLocaleString()} characters: only the first{' '}
            {scan.result.charsScanned.toLocaleString()} were scanned and are included in the redacted copy.
          </div>
        )}
        {scan && scan.result.findingsCapped && (
          <div className="border-b bg-warning/15 px-3 py-2 text-xs">
            More findings exist than can be listed; showing the first {findings.length.toLocaleString()}.
          </div>
        )}

        {findings.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <ScanSearch className="size-4" />
            {!text
              ? 'Paste something to scan.'
              : busy
                ? 'Scanning…'
                : 'No secrets matched the enabled rules. That is not proof the text is safe: review it before sharing.'}
          </div>
        ) : (
          <div className={cn('max-h-[28rem] overflow-auto', stale && 'opacity-60')}>
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-muted/80 text-2xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-10 px-2 py-1.5 font-medium" title="Redact this value (every occurrence)">Redact</th>
                  <th className="w-20 px-2 py-1.5 font-medium">Severity</th>
                  <th className="px-2 py-1.5 font-medium">Rule</th>
                  <th className="w-20 px-2 py-1.5 font-medium">Line:col</th>
                  <th className="px-2 py-1.5 font-medium">Preview</th>
                  <th className="w-20 px-2 py-1.5 font-medium">Confidence</th>
                  <th className="px-2 py-1.5 font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.map((f) => (
                  <tr
                    key={f.key}
                    tabIndex={0}
                    onClick={() => selectFinding(f)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') selectFinding(f);
                    }}
                    className={cn(
                      'cursor-pointer align-top outline-none hover:bg-accent/50 focus-visible:bg-accent/60',
                      selectedKey === f.key && 'bg-accent'
                    )}
                  >
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!excluded.has(exclKey(f))}
                        onCheckedChange={(c) => toggleExcluded(f, c === true)}
                        aria-label={`Redact ${f.ruleName} at line ${f.line}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{f.ruleName}</div>
                      <div className="font-mono text-2xs text-muted-foreground">{f.ruleId}</div>
                    </td>
                    <td className="px-2 py-1.5 font-mono tabular">
                      {f.line}:{f.col}
                    </td>
                    <td className="max-w-[18rem] px-2 py-1.5 font-mono">
                      <span className="break-all">{reveal ? (f.value.length > 160 ? `${f.value.slice(0, 160)}…` : f.value) : f.preview}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <ConfidenceCell confidence={f.confidence} />
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      <div>{f.why}</div>
                      {f.notes.length > 0 && <div className="mt-0.5 text-foreground/80">{f.notes.join(' · ')}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showAll && findings.length > MAX_ROWS && (
              <div className="border-t p-2 text-center">
                <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                  Show all {findings.length.toLocaleString()} findings
                </Button>
              </div>
            )}
          </div>
        )}
        <StatBar
          items={[
            `${findings.length.toLocaleString()} finding${findings.length === 1 ? '' : 's'}`,
            `${counts.high} high`,
            `${counts.medium} medium`,
            `${counts.low} low`,
            `${uniqueSecrets} unique value${uniqueSecrets === 1 ? '' : 's'}`,
            scan ? `${scan.result.linesScanned.toLocaleString()} lines scanned` : null,
          ]}
        />
      </Panel>

      {/* QUICK IDENTIFY */}
      <Panel>
        <PanelHeader title="What is this token?" />
        <div className="space-y-3 p-3">
          <Input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste a single key or token to identify its type, e.g. ghp_…, AKIA…, xoxb-…, sk-ant-…"
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
          />
          {identified && (
            <div className="space-y-2 text-xs">
              {identified.matches.length > 0 ? (
                identified.matches.map((m) => (
                  <div key={m.key} className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/30 p-2">
                    <SeverityBadge severity={m.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {m.ruleName} <span className="font-mono text-2xs text-muted-foreground">{m.ruleId}</span>
                      </div>
                      <div className="text-muted-foreground">{m.why}</div>
                      {m.notes.length > 0 && <div className="mt-0.5">{m.notes.join(' · ')}</div>}
                    </div>
                    <ConfidenceCell confidence={m.confidence} />
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-muted/30 p-2 text-muted-foreground">
                  No known token pattern matched.
                  {identified.hints.map((h) => (
                    <div key={h} className="mt-1 text-foreground/80">{h}</div>
                  ))}
                </div>
              )}
              <div className="font-mono text-2xs text-muted-foreground">
                {identified.length} chars · {identified.charset} · entropy {identified.entropy.toFixed(2)} bits/char
              </div>
            </div>
          )}
        </div>
      </Panel>

      <p className="text-2xs text-muted-foreground">
        Pattern-based: it finds what it has rules for and can miss custom or obfuscated secrets, so review the text before
        sharing. <strong className="text-foreground">Always rotate any real secret that was exposed.</strong> Everything runs
        locally in your browser; nothing is uploaded. Inputs over {MAX_INPUT_CHARS.toLocaleString()} characters are truncated.
        The findings JSON contains masked previews and fingerprints, never raw values.
      </p>
    </div>
  );
}
