'use client';

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ExternalLink, Eraser, Info, Palette, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';

import {
  RULES,
  SEVERITIES,
  lintDockerfile,
  scoreFindings,
  type Finding,
  type Severity,
} from './logic';

const MAX_CHARS = 300_000;
const LINE_H = 20;
const PAD_Y = 8;

const SAMPLE = `FROM python:latest
MAINTAINER Jane Doe <jane@example.com>

ENV API_TOKEN=abc123

RUN apt-get update
RUN apt-get install -y curl git && pip install flask gunicorn
RUN curl -sSL https://get.example.com/install.sh | sh

ADD . /app
WORKDIR /app

EXPOSE 8000
CMD gunicorn -b 0.0.0.0:8000 app:app
`;

const SEV_STYLE: Record<Severity, { label: string; text: string; bg: string; bar: string; dot: string; ring: string }> = {
  error: {
    label: 'Error',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    bar: 'bg-red-500/15',
    dot: 'bg-red-500',
    ring: 'border-red-500/40',
  },
  warning: {
    label: 'Warning',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    bar: 'bg-amber-500/15',
    dot: 'bg-amber-500',
    ring: 'border-amber-500/40',
  },
  info: {
    label: 'Info',
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    bar: 'bg-sky-500/10',
    dot: 'bg-sky-500',
    ring: 'border-sky-500/40',
  },
  style: {
    label: 'Style',
    text: 'text-muted-foreground',
    bg: 'bg-muted',
    bar: 'bg-muted-foreground/10',
    dot: 'bg-muted-foreground/60',
    ring: 'border-border',
  },
};

const SEV_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2, style: 3 };

function SevIcon({ severity, className }: { severity: Severity; className?: string }) {
  const c = cn('size-4 shrink-0', SEV_STYLE[severity].text, className);
  if (severity === 'error') return <AlertCircle className={c} />;
  if (severity === 'warning') return <AlertTriangle className={c} />;
  if (severity === 'info') return <Info className={c} />;
  return <Palette className={c} />;
}

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  if (grade === 'B') return 'text-lime-600 dark:text-lime-400 border-lime-500/40 bg-lime-500/10';
  if (grade === 'C') return 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10';
  if (grade === 'D') return 'text-orange-600 dark:text-orange-400 border-orange-500/40 bg-orange-500/10';
  return 'text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10';
}

function reportText(findings: Finding[]): string {
  if (findings.length === 0) return 'No findings.';
  return findings
    .map((f) => `Dockerfile:${f.line} ${f.id} [${f.severity}] ${f.message}\n    fix: ${f.hint}`)
    .join('\n');
}

export default function DockerfileLinter() {
  const [text, setText] = useState(SAMPLE);
  const [enabled, setEnabled] = useState<Record<Severity, boolean>>({ error: true, warning: true, info: true, style: true });
  const [ignoreText, setIgnoreText] = useState('');
  const [active, setActive] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const deferred = useDeferredValue(text);

  const ignoreRules = useMemo(
    () => ignoreText.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
    [ignoreText]
  );

  const tooBig = deferred.length > MAX_CHARS;
  const result = useMemo(
    () => (tooBig ? null : lintDockerfile(deferred, { ignoreRules })),
    [deferred, ignoreRules, tooBig]
  );

  const shown = useMemo(() => (result ? result.findings.filter((f) => enabled[f.severity]) : []), [result, enabled]);
  const summary = useMemo(() => scoreFindings(shown), [shown]);

  const lineCount = useMemo(() => text.split('\n').length, [text]);
  // only the line numbers around the viewport are rendered (a Dockerfile can be long)
  const firstVisible = Math.min(lineCount, Math.max(1, Math.floor(scrollTop / LINE_H) - 20));
  const lastVisible = Math.min(lineCount, firstVisible + 90);

  // worst severity per line, for gutter dots and line tints
  const lineSev = useMemo(() => {
    const m = new Map<number, Severity>();
    for (const f of shown) {
      const cur = m.get(f.line);
      if (!cur || SEV_RANK[f.severity] < SEV_RANK[cur]) m.set(f.line, f.severity);
    }
    return m;
  }, [shown]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = ta.scrollTop;
    setScrollTop(ta.scrollTop);
  }, []);

  const jumpTo = useCallback((line: number) => {
    const ta = taRef.current;
    setActive(line);
    if (!ta) return;
    const lines = ta.value.split('\n');
    let start = 0;
    for (let k = 0; k < line - 1 && k < lines.length; k++) start += (lines[k]?.length ?? 0) + 1;
    const end = start + (lines[line - 1]?.length ?? 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    ta.scrollTop = Math.max(0, (line - 1) * LINE_H - ta.clientHeight / 2 + LINE_H);
    syncScroll();
    ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [syncScroll]);

  const focusFindings = useCallback((line: number) => {
    setActive(line);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const onUpload = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_CHARS * 2) {
      setUploadError('That file is too large for a Dockerfile.');
      return;
    }
    try {
      setText(await file.text());
      setActive(null);
    } catch {
      setUploadError('Could not read that file.');
    }
  };

  const toggle = (s: Severity) => setEnabled((e) => ({ ...e, [s]: !e[s] }));

  const hasInput = text.trim() !== '';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Show severities">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severity filters">
            {SEVERITIES.map((s) => {
              const n = result ? result.counts[s] : 0;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={enabled[s]}
                  onClick={() => toggle(s)}
                  data-testid={`sev-${s}`}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    enabled[s] ? cn(SEV_STYLE[s].bg, SEV_STYLE[s].ring, SEV_STYLE[s].text) : 'border-dashed text-muted-foreground line-through opacity-70'
                  )}
                >
                  <SevIcon severity={s} className="size-3.5" />
                  {SEV_STYLE[s].label}
                  <span className="font-mono tabular">{n}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Ignore rules" hint="Comma separated, e.g. DL3008, DL3059" className="min-w-[220px] flex-1">
          <Input
            value={ignoreText}
            onChange={(e) => setIgnoreText(e.target.value)}
            placeholder="DL3008, OUT011"
            spellCheck={false}
            className="font-mono"
            aria-label="Rule IDs to ignore"
          />
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ---------------- editor ---------------- */}
        <Panel>
          <PanelHeader title="Dockerfile">
            <Button variant="ghost" size="sm" onClick={() => { setText(SAMPLE); setActive(null); }} title="Load sample">
              Sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => uploadRef.current?.click()} title="Open a Dockerfile">
              <Upload className="size-3.5" />
              Upload
            </Button>
            <input
              ref={uploadRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
            <Button variant="ghost" size="icon-sm" onClick={() => { setText(''); setActive(null); }} disabled={!text} title="Clear">
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          <div className="relative flex h-[34rem] overflow-hidden" data-testid="editor">
            {/* gutter */}
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="w-14 shrink-0 select-none overflow-hidden border-r bg-muted/30 font-mono text-[12px] text-muted-foreground"
              style={{ paddingTop: PAD_Y, paddingBottom: PAD_Y + 16 }}
            >
              <div className="relative" style={{ height: lineCount * LINE_H }}>
                {Array.from({ length: Math.max(0, lastVisible - firstVisible + 1) }, (_, k) => {
                  const n = firstVisible + k;
                  const sev = lineSev.get(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      tabIndex={-1}
                      data-gutter-line={n}
                      onClick={() => sev && focusFindings(n)}
                      className={cn(
                        'absolute inset-x-0 flex items-center justify-end gap-1.5 pr-2 text-right tabular-nums',
                        sev ? 'cursor-pointer font-medium' : 'cursor-default',
                        active === n && 'text-foreground'
                      )}
                      style={{ top: (n - 1) * LINE_H, height: LINE_H }}
                    >
                      {sev && <span className={cn('size-1.5 rounded-full', SEV_STYLE[sev].dot)} />}
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* line tints behind the text */}
            <div ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-14 right-0 overflow-hidden">
              <div className="relative" style={{ height: lineCount * LINE_H + PAD_Y * 2 + 16 }}>
                {Array.from(lineSev.entries()).map(([n, sev]) => (
                  <div
                    key={n}
                    className={cn('absolute inset-x-0', SEV_STYLE[sev].bar)}
                    style={{ top: PAD_Y + (n - 1) * LINE_H, height: LINE_H }}
                  />
                ))}
                {active !== null && (
                  <div
                    className="absolute inset-x-0 border-y border-primary/50 bg-primary/10"
                    style={{ top: PAD_Y + (active - 1) * LINE_H, height: LINE_H }}
                  />
                )}
              </div>
            </div>
            <Textarea
              ref={taRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setActive(null); }}
              onScroll={syncScroll}
              placeholder="Paste your Dockerfile here…"
              spellCheck={false}
              wrap="off"
              aria-label="Dockerfile"
              className="relative z-10 h-full min-h-0 flex-1 resize-none field-sizing-fixed rounded-none border-0 bg-transparent px-3 font-mono text-[13px] shadow-none focus-visible:ring-0 dark:bg-transparent"
              style={{ lineHeight: `${LINE_H}px`, paddingTop: PAD_Y, paddingBottom: PAD_Y, whiteSpace: 'pre', overflow: 'auto' }}
            />
          </div>
          <StatBar
            items={[
              `${lineCount.toLocaleString()} lines`,
              result && `${result.instructions} instructions`,
              result && `${result.stages} stage${result.stages === 1 ? '' : 's'}`,
            ]}
          />
        </Panel>

        {/* ---------------- findings ---------------- */}
        <Panel>
          <PanelHeader title={`Findings${hasInput ? ` (${shown.length})` : ''}`}>
            <CopyButton value={() => reportText(shown)} label="Copy report" disabled={shown.length === 0} />
            <DownloadButton
              data={() => JSON.stringify({ score: summary.score, grade: summary.grade, counts: summary.counts, findings: shown }, null, 2)}
              filename="dockerfile-lint.json"
              mime="application/json"
              label="JSON"
              disabled={shown.length === 0}
            />
          </PanelHeader>

          {tooBig ? (
            <div className="p-3">
              <ErrorBanner error={`Dockerfile is too large (${text.length.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}).`} />
            </div>
          ) : !hasInput ? (
            <div className="flex h-[34rem] items-center justify-center p-6 text-sm text-muted-foreground">
              Paste a Dockerfile on the left to lint it.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 border-b p-3" data-testid="summary">
                <div
                  className={cn('flex size-14 shrink-0 items-center justify-center rounded-lg border text-2xl font-semibold', gradeColor(summary.grade))}
                  aria-label={`Grade ${summary.grade}`}
                  data-testid="grade"
                >
                  {summary.grade}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-semibold tabular" data-testid="score">{summary.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {SEVERITIES.map((s) => (
                      <span key={s} className={cn('font-mono tabular', SEV_STYLE[s].text)}>
                        {summary.counts[s]} {SEV_STYLE[s].label.toLowerCase()}
                        {summary.counts[s] === 1 ? '' : s === 'info' || s === 'style' ? '' : 's'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div ref={listRef} className="max-h-[27.5rem] min-h-[10rem] flex-1 divide-y overflow-auto" data-testid="findings">
                {shown.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {result && result.findings.length > 0
                      ? 'All findings are hidden by the severity filters.'
                      : 'No findings. This Dockerfile follows the checked best practices.'}
                  </div>
                )}
                {shown.map((f, k) => (
                  <div
                    key={`${f.id}-${f.line}-${k}`}
                    data-line={f.line}
                    data-rule={f.id}
                    className={cn('flex gap-2.5 px-3 py-2.5', active === f.line && 'bg-primary/5')}
                  >
                    <SevIcon severity={f.severity} className="mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => jumpTo(f.line)}
                          className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted"
                          title={`Jump to line ${f.line}`}
                          data-testid="jump"
                        >
                          L{f.line}
                        </button>
                        {/^DL\d+$/.test(f.id) ? (
                          <a
                            href={`https://github.com/hadolint/hadolint/wiki/${f.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn('inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold hover:underline', SEV_STYLE[f.severity].text)}
                            title="Open the rule description (opens github.com)"
                          >
                            {f.id}
                            <ExternalLink className="size-2.5" />
                          </a>
                        ) : (
                          <span className={cn('font-mono text-[11px] font-semibold', SEV_STYLE[f.severity].text)}>{f.id}</span>
                        )}
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.severity}</span>
                      </div>
                      <button type="button" onClick={() => jumpTo(f.line)} className="block w-full text-left text-sm leading-snug hover:underline">
                        {f.message}
                      </button>
                      <p className="text-xs leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground/70">Fix: </span>
                        {f.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <StatBar
                items={[
                  `${shown.length} finding${shown.length === 1 ? '' : 's'}`,
                  result && result.suppressed.length > 0 && `${result.suppressed.length} ignored`,
                ]}
              />
            </>
          )}
        </Panel>
      </div>

      <ErrorBanner error={uploadError} />

      {result && result.suppressed.length > 0 && (
        <details className="rounded-lg border bg-card text-sm">
          <summary className="cursor-pointer px-3 py-2 font-medium">Ignored findings ({result.suppressed.length})</summary>
          <div className="divide-y border-t">
            {result.suppressed.map((f, k) => (
              <div key={`${f.id}-${f.line}-${k}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
                <span className="font-mono text-muted-foreground">L{f.line}</span>
                <span className="font-mono font-semibold">{f.id}</span>
                <span className="text-muted-foreground">{f.message}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="rounded-lg border bg-card text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium">Rules checked ({RULES.length})</summary>
        <div className="grid gap-x-6 border-t p-3 sm:grid-cols-2" data-testid="rule-list">
          {RULES.map((r) => (
            <div key={r.id} className="flex items-baseline gap-2 py-0.5 text-xs">
              <span className={cn('w-14 shrink-0 font-mono font-semibold', SEV_STYLE[r.severity].text)}>{r.id}</span>
              <span className="text-muted-foreground">{r.title}</span>
            </div>
          ))}
        </div>
      </details>

      <p className="text-xs text-muted-foreground">
        Hadolint-compatible rule IDs (DLxxxx) plus extra checks (OUTxxx). Suppress a rule for the next instruction with{' '}
        <code className="font-mono">{'# hadolint ignore=DL3008,DL3015'}</code> or for the whole file with{' '}
        <code className="font-mono">{'# hadolint global ignore=DL3059'}</code>. Score = 100 − 12 per error − 6 per warning − 1.5 per info − 0.5 per style
        finding (only the severities you show count). Analysis is static: shell commands are
        parsed heuristically (no variable expansion, no ShellCheck rules), and nothing leaves your browser.
      </p>
    </div>
  );
}
