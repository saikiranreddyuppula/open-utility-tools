'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardPaste, FileUp, ShieldCheck, Wand2, X } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  CATEGORY_LABELS,
  DEFAULT_API_KEY_NAMES,
  DEFAULT_SANITIZE_OPTIONS,
  DEFAULT_SENSITIVE_NAMES,
  TYPE_LABELS,
  buildSampleHar,
  buildView,
  computeInsights,
  entryDetail,
  parseHar,
  prettyBody,
  previewContent,
  sanitizeHar,
  statusClassOf,
  summarizeHar,
  type Category,
  type HarFile,
  type HarSummary,
  type Insights,
  type ResourceType,
  type Row,
  type SanitizeOptions,
  type SanitizeReport,
  type SortKey,
  type StatusClass,
} from './logic';

const ROW_H = 26;
const TABLE_H = 520;
const MAX_FILE = 600 * 1024 * 1024;
const TYPE_ORDER: ResourceType[] = ['xhr', 'js', 'css', 'img', 'doc', 'font', 'other'];
const STATUS_ORDER: StatusClass[] = ['2xx', '3xx', '4xx', '5xx', 'failed'];

const SEG_COLORS: Record<string, string> = {
  blocked: '#9ca3af',
  dns: '#14b8a6',
  connect: '#f59e0b',
  ssl: '#a855f7',
  send: '#60a5fa',
  wait: '#22c55e',
  receive: '#2563eb',
};
const SEG_LABELS: Record<string, string> = {
  blocked: 'Blocked',
  dns: 'DNS',
  connect: 'Connect',
  ssl: 'SSL/TLS',
  send: 'Send',
  wait: 'Wait (TTFB)',
  receive: 'Receive',
};

const COLS = '40px 60px 52px minmax(130px,1fr) minmax(180px,2fr) 66px 74px 74px 74px 240px';

function fmtMs(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}
function fmtSize(n: number): string {
  return n < 0 ? '—' : formatBytes(n, n < 1024 ? 0 : 1);
}
function statusTone(r: Row): string {
  if (r.failed || r.status >= 500) return 'text-destructive';
  if (r.status >= 400) return 'text-warning';
  if (r.status >= 300) return 'text-sky-600 dark:text-sky-400';
  return 'text-success';
}
function parseList(s: string): string[] {
  return s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
}
function baseName(name: string): string {
  return name.replace(/\.(har|json)$/i, '') || 'capture';
}

function Waterfall({ row, span, marks }: { row: Row; span: number; marks: { at: number; color: string }[] }) {
  if (span <= 0) return null;
  let x = row.start;
  return (
    <div className="relative h-3 w-full">
      {marks.map((m, i) => (
        <span key={i} className="absolute inset-y-[-6px] w-px" style={{ left: `${(m.at / span) * 100}%`, background: m.color }} />
      ))}
      {row.segs.map((s, i) => {
        const left = (x / span) * 100;
        const width = Math.max(0.35, (s.ms / span) * 100);
        x += s.ms;
        return <span key={i} className="absolute top-0.5 h-2 rounded-[1px]" style={{ left: `${Math.min(left, 99.6)}%`, width: `${Math.min(width, 100 - left)}%`, background: SEG_COLORS[s.key] }} />;
      })}
    </div>
  );
}

function KV({ rows, empty }: { rows: { name: string; value: string }[]; empty?: string }) {
  if (rows.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">{empty ?? 'None.'}</p>;
  return (
    <div className="divide-y">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-x-3 px-3 py-1 text-xs">
          <span className="break-all font-mono font-semibold text-muted-foreground">{r.name}</span>
          <span className="break-all font-mono">{r.value === '' ? <span className="text-muted-foreground">(empty)</span> : r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, count, children, open = true }: { title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="border-b last:border-b-0">
      <summary className="flex cursor-pointer select-none items-center gap-2 bg-muted/30 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {count !== undefined && <Badge variant="muted">{count}</Badge>}
      </summary>
      {children}
    </details>
  );
}

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function HarViewerSanitizerTool() {
  const [harData, setHarData] = useState<HarFile | null>(null);
  const [summary, setSummary] = useState<HarSummary | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [tab, setTab] = useState('requests');

  // viewer state
  const [filterText, setFilterText] = useState('');
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [statuses, setStatuses] = useState<StatusClass[]>([]);
  const [sort, setSort] = useState<SortKey>('i');
  const [desc, setDesc] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawerTab, setDrawerTab] = useState('headers');

  // sanitizer state
  const [opts, setOpts] = useState<SanitizeOptions>(DEFAULT_SANITIZE_OPTIONS);
  const [apiKeyText, setApiKeyText] = useState(DEFAULT_API_KEY_NAMES.join(', '));
  const [sensitiveText, setSensitiveText] = useState(DEFAULT_SENSITIVE_NAMES.join(', '));
  const [pretty, setPretty] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string; report: SanitizeReport; bytes: number; verified: string } | null>(null);
  const [sanitizeError, setSanitizeError] = useState<string | null>(null);

  const rows = useMemo(() => summary?.rows ?? [], [summary]);
  const view = useMemo(
    () => (summary ? buildView(summary.rows, { text: filterText, types, statuses, sort, desc }) : []),
    [summary, filterText, types, statuses, sort, desc]
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [view]);

  const marks = useMemo(() => {
    const out: { at: number; color: string }[] = [];
    const p = summary?.pages[0];
    if (p) {
      if (p.onContentLoad >= 0) out.push({ at: p.started + p.onContentLoad, color: '#3b82f6' });
      if (p.onLoad >= 0) out.push({ at: p.started + p.onLoad, color: '#ef4444' });
    }
    return out;
  }, [summary]);

  const selEntry = selected !== null ? harData?.log.entries[selected] : undefined;
  const detail = useMemo(() => (selEntry && typeof selEntry === 'object' ? entryDetail(selEntry as Record<string, unknown>) : null), [selEntry]);
  const selRow = selected !== null ? rows[selected] : undefined;
  const content = useMemo(() => {
    const e = selEntry as { response?: { content?: unknown } } | undefined;
    return e ? previewContent(e.response?.content, selRow?.size) : null;
  }, [selEntry, selRow]);

  const reset = useCallback(() => {
    setHarData(null);
    setSummary(null);
    setInsights(null);
    setFileInfo(null);
    setSelected(null);
    setResult(null);
    setError(null);
    setSanitizeError(null);
    setFilterText('');
    setTypes([]);
    setStatuses([]);
    setSort('i');
    setDesc(false);
  }, []);

  const adopt = useCallback(async (har: HarFile, name: string, size: number) => {
    setLoading('Indexing requests…');
    await new Promise((r) => setTimeout(r, 15));
    const s = summarizeHar(har);
    const ins = computeInsights(har, s);
    setHarData(har);
    setSummary(s);
    setInsights(ins);
    setFileInfo({ name, size });
    setSelected(null);
    setResult(null);
    setSanitizeError(null);
    setFilterText('');
    setTypes([]);
    setStatuses([]);
    setSort('i');
    setDesc(false);
    setTab('requests');
    setLoading(null);
  }, []);

  const loadText = useCallback(
    async (text: string, name: string) => {
      setError(null);
      setLoading('Parsing JSON…');
      await new Promise((r) => setTimeout(r, 15));
      const parsed = parseHar(text);
      if (!parsed.ok) {
        setLoading(null);
        setError(parsed.error);
        return;
      }
      await adopt(parsed.har, name, text.length);
    },
    [adopt]
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      if (f.size > MAX_FILE) {
        setError(`File too large (${formatBytes(f.size)}); the limit is ${formatBytes(MAX_FILE)}.`);
        return;
      }
      setError(null);
      setLoading(`Reading ${formatBytes(f.size)}…`);
      try {
        const text = await f.text();
        await loadText(text, f.name);
      } catch (e) {
        setLoading(null);
        setError(e instanceof Error ? `Could not read the file: ${e.message}` : 'Could not read the file.');
      }
    },
    [loadText]
  );

  const loadSample = useCallback(async () => {
    setError(null);
    const har = buildSampleHar();
    await adopt(har, 'sample-capture.har', JSON.stringify(har).length);
  }, [adopt]);

  const toggleType = (t: ResourceType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const toggleStatus = (s: StatusClass) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const setSortKey = (k: SortKey) => {
    if (sort === k) setDesc((d) => !d);
    else {
      setSort(k);
      setDesc(k === 'size' || k === 'time');
    }
  };

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => (c[r.type] = (c[r.type] ?? 0) + 1));
    return c;
  }, [rows]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => {
      const k = statusClassOf(r);
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 6);
  const last = Math.min(view.length, Math.ceil((scrollTop + TABLE_H) / ROW_H) + 6);
  const span = summary?.span ?? 0;

  const openRow = (i: number) => {
    setSelected(i);
    setDrawerTab('headers');
  };
  const goToRow = (i: number) => {
    setTab('requests');
    openRow(i);
  };

  const onTableKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Escape') return;
    if (e.key === 'Escape') {
      setSelected(null);
      return;
    }
    e.preventDefault();
    const pos = selected === null ? -1 : view.indexOf(selected);
    const next = Math.min(view.length - 1, Math.max(0, pos + (e.key === 'ArrowDown' ? 1 : -1)));
    const idx = view[next];
    if (idx !== undefined) {
      openRow(idx);
      const el = scrollRef.current;
      if (el) {
        const top = next * ROW_H;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + ROW_H > el.scrollTop + TABLE_H - ROW_H) el.scrollTop = top - TABLE_H + ROW_H * 2;
      }
    }
  };

  // --- sanitizer ---
  const runSanitize = useCallback(async () => {
    const har = harData;
    if (!har || !fileInfo) return;
    setRunning(true);
    setSanitizeError(null);
    setResult(null);
    setProgress(0);
    const options: SanitizeOptions = { ...opts, apiKeyNames: parseList(apiKeyText), sensitiveNames: parseList(sensitiveText) };
    try {
      const r = await sanitizeHar(har, options, {
        pretty: pretty && fileInfo.size < 40 * 1024 * 1024,
        tick: async (done, total) => {
          setProgress(Math.round((done / Math.max(1, total)) * 100));
          await new Promise((res) => setTimeout(res, 0));
        },
      });
      let verified = 'Re-scan skipped for files over 40 MB.';
      if (r.bytes < 40 * 1024 * 1024) {
        await new Promise((res) => setTimeout(res, 0));
        const again = parseHar(r.chunks.join(''));
        if (again.ok) {
          const second = await sanitizeHar(again.har, options);
          verified = second.report.total === 0 ? 'Valid HAR JSON. Re-scan of the output found 0 remaining matches.' : `Re-scan found ${second.report.total} more match${second.report.total === 1 ? '' : 'es'} (see the report).`;
          if (second.report.total > 0) r.report.counts = second.report.counts;
        } else verified = 'Warning: the output could not be re-parsed.';
      }
      const blob = new Blob(r.chunks, { type: 'application/json' });
      setResult({ blob, name: `${baseName(fileInfo.name)}-sanitized.har`, report: r.report, bytes: r.bytes, verified });
    } catch (e) {
      setSanitizeError(e instanceof Error ? e.message : 'Sanitising failed.');
    } finally {
      setRunning(false);
    }
  }, [opts, apiKeyText, sensitiveText, pretty, fileInfo, harData]);

  const setOpt = <K extends keyof SanitizeOptions>(k: K, v: SanitizeOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const loaded = summary && insights && fileInfo;

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {!loaded && (
        <Panel>
          <PanelHeader title="Open a HAR file">
            <Button variant="ghost" size="sm" onClick={() => void loadSample()}>
              <Wand2 /> Load sample
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasteOpen((o) => !o)}>
              <ClipboardPaste /> Paste JSON
            </Button>
          </PanelHeader>
          <div className="space-y-3 p-3">
            <FileDropzone
              onFiles={(f) => void onFiles(f)}
              accept=".har,.json,application/json"
              label="Drop a .har file here"
              hint="or click to browse · up to ~600 MB · parsed in your browser, never uploaded"
              disabled={loading !== null}
            />
            {pasteOpen && (
              <div className="space-y-2">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder='{"log": {"version": "1.2", "entries": [ … ]}}'
                  rows={8}
                  spellCheck={false}
                  className="min-h-36 font-mono text-xs"
                  aria-label="HAR JSON"
                />
                <Button size="sm" disabled={!pasteText.trim() || loading !== null} onClick={() => void loadText(pasteText, 'pasted.har')}>
                  Load pasted JSON
                </Button>
              </div>
            )}
            {loading && <p className="text-sm text-muted-foreground">{loading}</p>}
            <p className="text-2xs text-muted-foreground">
              Export one from Chrome/Edge DevTools (Network → ⤓ “Save all as HAR with content”), Firefox (Network → gear → Save All As HAR) or Safari. Everything stays on this device.
            </p>
          </div>
        </Panel>
      )}
      <ErrorBanner error={error} />

      {loaded && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <FileUp className="size-4 text-muted-foreground" />
            <span className="font-mono font-semibold">{fileInfo.name}</span>
            <span className="text-muted-foreground">{formatBytes(fileInfo.size)}</span>
            <span className="text-muted-foreground">{rows.length.toLocaleString()} requests</span>
            {summary.creator && <span className="text-muted-foreground">{summary.creator}</span>}
            {summary.browser && <span className="text-muted-foreground">· {summary.browser}</span>}
            {summary.version && <Badge variant="muted">HAR {summary.version}</Badge>}
            <div className="ml-auto flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".har,.json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFiles([f]);
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Open another
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X /> Close
              </Button>
            </div>
          </div>
          {loading && <p className="text-sm text-muted-foreground">{loading}</p>}

          <Tabs value={tab} onValueChange={setTab} className="gap-3">
            <TabsList>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="sanitize">
                <ShieldCheck /> Sanitize
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------ requests */}
            <TabsContent value="requests" className="space-y-3">
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Filter" className="min-w-[260px] flex-1">
                    <Input
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="text, status:404, method:post, host:cdn, mime:json, larger:100k, slower:500, -exclude"
                      className="h-8 font-mono text-xs"
                      aria-label="Filter requests"
                    />
                  </Field>
                  {(filterText || types.length > 0 || statuses.length > 0) && (
                    <Button variant="ghost" size="sm" onClick={() => { setFilterText(''); setTypes([]); setStatuses([]); }}>
                      <X /> Clear filters
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Type</span>
                  {TYPE_ORDER.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      aria-pressed={types.includes(t)}
                      className={cn('h-6 rounded-md border px-2 text-xs transition-colors', types.includes(t) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent')}
                    >
                      {TYPE_LABELS[t]} <span className="opacity-70">{typeCounts[t] ?? 0}</span>
                    </button>
                  ))}
                  <span className="ml-3 mr-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      aria-pressed={statuses.includes(s)}
                      className={cn('h-6 rounded-md border px-2 text-xs transition-colors', statuses.includes(s) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent')}
                    >
                      {s} <span className="opacity-70">{statusCounts[s] ?? 0}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                  {Object.keys(SEG_COLORS).map((k) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className="size-2 rounded-[1px]" style={{ background: SEG_COLORS[k] }} />
                      {SEG_LABELS[k]}
                    </span>
                  ))}
                  {marks.length > 0 && (
                    <>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-px bg-blue-500" />DOMContentLoaded</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-px bg-red-500" />Load</span>
                    </>
                  )}
                </div>
              </div>

              <Panel className="relative">
                <div
                  ref={scrollRef}
                  className="overflow-auto outline-none"
                  style={{ height: TABLE_H }}
                  onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
                  onKeyDown={onTableKey}
                  tabIndex={0}
                  role="grid"
                  aria-label="Requests"
                  data-testid="req-table"
                >
                  <div className="sticky top-0 z-10 grid min-w-[1060px] items-center gap-x-2 border-b bg-muted px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: COLS, height: ROW_H + 2 }}>
                    {([
                      ['i', '#'], ['method', 'Method'], ['status', 'Status'], ['host', 'Domain'], ['path', 'Path'], ['type', 'Type'], ['size', 'Size'], ['time', 'Time'], ['start', 'Start'],
                    ] as [SortKey, string][]).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setSortKey(k)} className={cn('flex items-center gap-0.5 text-left uppercase hover:text-foreground', (k === 'size' || k === 'time' || k === 'start') && 'justify-end')}>
                        {label}
                        {sort === k && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                      </button>
                    ))}
                    <span>Waterfall</span>
                  </div>
                  {view.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">{rows.length === 0 ? 'This HAR file contains no requests.' : 'No requests match the current filters.'}</p>
                  ) : (
                    <div className="relative min-w-[1060px]" style={{ height: view.length * ROW_H }}>
                      {view.slice(first, last).map((idx, k) => {
                        const r = rows[idx];
                        if (!r) return null;
                        const sel = selected === idx;
                        return (
                          <div
                            key={idx}
                            role="row"
                            onClick={() => openRow(idx)}
                            data-testid="req-row"
                            className={cn('absolute left-0 right-0 grid cursor-pointer items-center gap-x-2 border-b px-2 font-mono text-xs hover:bg-muted/60', sel && 'bg-primary/10 hover:bg-primary/15', r.failed || r.status >= 400 ? 'text-foreground' : '')}
                            style={{ top: (first + k) * ROW_H, height: ROW_H, gridTemplateColumns: COLS }}
                          >
                            <span className="text-muted-foreground">{r.i + 1}</span>
                            <span className="font-semibold">{r.method}</span>
                            <span className={cn('font-semibold', statusTone(r))} title={r.error ?? `${r.status} ${r.statusText}`}>{r.failed ? 'ERR' : r.status}</span>
                            <span className="truncate" title={r.host}>{r.host}</span>
                            <span className="truncate" title={r.url}>{r.path}</span>
                            <span className="truncate text-muted-foreground" title={r.mime}>{TYPE_LABELS[r.type]}</span>
                            <span className="text-right" title={r.contentSize >= 0 ? `content ${formatBytes(r.contentSize)}` : undefined}>{fmtSize(r.size)}</span>
                            <span className="text-right">{fmtMs(r.time)}</span>
                            <span className="text-right text-muted-foreground">{fmtMs(r.start)}</span>
                            <Waterfall row={r} span={span} marks={marks} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <StatBar
                  items={[
                    `${view.length.toLocaleString()} of ${rows.length.toLocaleString()} requests`,
                    `${formatBytes(view.reduce((n, i) => n + Math.max(0, rows[i]?.size ?? 0), 0))} transferred`,
                    `span ${fmtMs(span)}`,
                    'click a row for details · ↑/↓ to move',
                  ]}
                />

                {selRow && detail && (
                  <div className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l bg-card shadow-xl sm:w-[580px]" data-testid="drawer">
                    <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold">{selRow.method}</span>
                          <span className={cn('font-mono font-bold', statusTone(selRow))}>{selRow.failed ? 'FAILED' : `${selRow.status} ${selRow.statusText}`}</span>
                          <span className="text-muted-foreground">{fmtMs(selRow.time)}</span>
                          <span className="text-muted-foreground">{fmtSize(selRow.size)}</span>
                        </div>
                        <p className="mt-0.5 break-all font-mono text-2xs text-muted-foreground">{selRow.url}</p>
                      </div>
                      <CopyButton value={selRow.url} size="icon-sm" label="Copy URL" />
                      <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Close details">
                        <X />
                      </Button>
                    </div>
                    <Tabs value={drawerTab} onValueChange={setDrawerTab} className="min-h-0 flex-1 gap-0">
                      <div className="overflow-x-auto border-b p-1.5">
                        <TabsList className="w-max">
                          <TabsTrigger value="headers">Headers</TabsTrigger>
                          <TabsTrigger value="params">Params ({detail.query.length})</TabsTrigger>
                          <TabsTrigger value="cookies">Cookies ({detail.requestCookies.length + detail.responseCookies.length})</TabsTrigger>
                          <TabsTrigger value="request">Request</TabsTrigger>
                          <TabsTrigger value="response">Response</TabsTrigger>
                          <TabsTrigger value="timings">Timings</TabsTrigger>
                        </TabsList>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto">
                        <TabsContent value="headers" className="m-0">
                          <Section title="General">
                            <KV rows={detail.general} />
                          </Section>
                          <Section title="Response headers" count={detail.responseHeaders.length}>
                            <KV rows={detail.responseHeaders} />
                          </Section>
                          <Section title="Request headers" count={detail.requestHeaders.length}>
                            <KV rows={detail.requestHeaders} />
                          </Section>
                        </TabsContent>
                        <TabsContent value="params" className="m-0">
                          <KV rows={detail.query} empty="This request has no query parameters." />
                        </TabsContent>
                        <TabsContent value="cookies" className="m-0">
                          {(['Request cookies', 'Response cookies'] as const).map((title, k) => {
                            const list = k === 0 ? detail.requestCookies : detail.responseCookies;
                            return (
                              <Section key={title} title={title} count={list.length}>
                                <KV
                                  rows={list.map((c) => ({
                                    name: String(c.name ?? ''),
                                    value:
                                      String(c.value ?? '') +
                                      Object.entries(c)
                                        .filter(([key]) => !['name', 'value'].includes(key))
                                        .map(([key, v]) => (v === true ? `; ${key}` : `; ${key}=${String(v)}`))
                                        .join(''),
                                  }))}
                                  empty="None."
                                />
                              </Section>
                            );
                          })}
                        </TabsContent>
                        <TabsContent value="request" className="m-0">
                          {detail.post ? (
                            <>
                              <KV rows={[{ name: 'Content-Type', value: detail.post.mimeType }]} />
                              {detail.post.params.length > 0 && (
                                <Section title="Form parameters" count={detail.post.params.length}>
                                  <KV rows={detail.post.params} />
                                </Section>
                              )}
                              {detail.post.text !== undefined && detail.post.text !== '' && (
                                <Section title="Body">
                                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{prettyBody(detail.post.text.slice(0, 200000), detail.post.mimeType).text}</pre>
                                </Section>
                              )}
                            </>
                          ) : (
                            <p className="p-3 text-xs text-muted-foreground">This request has no body.</p>
                          )}
                        </TabsContent>
                        <TabsContent value="response" className="m-0">
                          {content?.kind === 'image' && (
                            <div className="flex justify-center bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={content.dataUrl} alt="Response preview" className="max-h-80 max-w-full rounded border bg-background" />
                            </div>
                          )}
                          {(content?.kind === 'json' || content?.kind === 'text') && (
                            <>
                              <div className="flex items-center gap-2 border-b px-3 py-1 text-2xs text-muted-foreground">
                                {content.kind === 'json' ? 'JSON' : content.mime || 'text'}
                                {content.truncated && <span className="text-warning">· truncated preview</span>}
                                {content.kind === 'text' && content.mime === 'text/html' && <span>· shown as source, never rendered</span>}
                                <span className="ml-auto"><CopyButton value={content.text} size="sm" /></span>
                              </div>
                              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{content.text}</pre>
                            </>
                          )}
                          {content?.kind === 'binary' && <p className="p-3 text-xs text-muted-foreground">Binary content ({content.mime || 'unknown type'}, about {formatBytes(content.size)}). No preview.</p>}
                          {content?.kind === 'empty' && <p className="p-3 text-xs text-muted-foreground">{content.note}</p>}
                        </TabsContent>
                        <TabsContent value="timings" className="m-0 p-3">
                          <div className="space-y-2">
                            {detail.timings.map((t) => {
                              const total = Math.max(selRow.time, 0.0001);
                              const ms = t.key === 'connect' ? Math.max(0, t.ms - (detail.timings.find((x) => x.key === 'ssl')?.ms ?? 0)) : t.ms;
                              return (
                                <div key={t.key} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-[1px]" style={{ background: SEG_COLORS[t.key] }} />
                                    {SEG_LABELS[t.key]}
                                  </span>
                                  <div className="h-2 overflow-hidden rounded bg-muted">
                                    <div className="h-full rounded" style={{ width: `${Math.min(100, (ms / total) * 100)}%`, background: SEG_COLORS[t.key] }} />
                                  </div>
                                  <span className="text-right font-mono">{fmtMs(ms)}</span>
                                </div>
                              );
                            })}
                            <div className="flex justify-between border-t pt-2 text-xs font-semibold">
                              <span>Total</span>
                              <span className="font-mono">{fmtMs(selRow.time)}</span>
                            </div>
                            <p className="text-2xs text-muted-foreground">HAR counts SSL time inside “connect”; it is split out here. -1 values (not applicable) are hidden. Started at +{fmtMs(selRow.start)}.</p>
                          </div>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </div>
                )}
              </Panel>
            </TabsContent>

            {/* ------------------------------------------------ insights */}
            <TabsContent value="insights" className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" data-testid="kpis">
                {[
                  ['Requests', insights.total.toLocaleString()],
                  ['Transferred', formatBytes(insights.transferred)],
                  ['Content size', formatBytes(insights.contentBytes)],
                  ['Load span', fmtMs(insights.span)],
                  ['Page load', summary.pages[0] && summary.pages[0].onLoad >= 0 ? fmtMs(summary.pages[0].onLoad) : 'n/a'],
                  ['Errors', `${insights.errors.length} (${insights.clientErrors} 4xx · ${insights.serverErrors} 5xx · ${insights.failed} failed)`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-card p-3">
                    <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
                    <div className="mt-1 text-sm font-semibold tabular">{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Third-party share" />
                  <div className="space-y-2 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">
                      First party = <code className="font-mono">{insights.firstPartyHost || 'unknown'}</code> and its sibling subdomains.
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular">{insights.total ? Math.round((insights.thirdPartyCount / insights.total) * 100) : 0}%</span>
                      <span className="text-xs text-muted-foreground">of requests ({insights.thirdPartyCount}) and</span>
                      <span className="text-2xl font-semibold tabular">{insights.transferred ? Math.round((insights.thirdPartyBytes / insights.transferred) * 100) : 0}%</span>
                      <span className="text-xs text-muted-foreground">of bytes ({formatBytes(insights.thirdPartyBytes)}) go to third parties</span>
                    </div>
                    <Bar pct={insights.total ? (insights.thirdPartyCount / insights.total) * 100 : 0} className="bg-warning" />
                  </div>
                </Panel>
                <Panel>
                  <PanelHeader title="By type and status" />
                  <div className="space-y-1.5 p-3 text-xs">
                    {insights.byType.map((t) => (
                      <div key={t.type} className="grid grid-cols-[4.5rem_1fr_9rem] items-center gap-2">
                        <span>{TYPE_LABELS[t.type]}</span>
                        <Bar pct={insights.transferred ? (t.bytes / insights.transferred) * 100 : (t.count / insights.total) * 100} />
                        <span className="text-right font-mono text-muted-foreground">{t.count} · {formatBytes(t.bytes)}</span>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-1.5 border-t pt-2">
                      {insights.byStatus.map((s) => (
                        <Badge key={s.cls} variant={s.cls === '2xx' ? 'success' : s.cls === '5xx' || s.cls === 'failed' ? 'destructive' : 'muted'}>{s.cls}: {s.count}</Badge>
                      ))}
                      {insights.protocols.slice(0, 4).map((p) => (
                        <Badge key={p.protocol} variant="outline">{p.protocol}: {p.count}</Badge>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>

              {([
                ['Slowest 10 requests', insights.slowest.map((i) => ({ i, note: fmtMs(rows[i]?.time ?? 0) }))],
                ['Largest 10 responses', insights.largest.map((i) => ({ i, note: formatBytes(Math.max(rows[i]?.size ?? 0, rows[i]?.contentSize ?? 0)) }))],
                ['Errors: 4xx, 5xx and failed', insights.errors.slice(0, 100).map((i) => ({ i, note: rows[i]?.error ?? `${rows[i]?.status ?? ''} ${rows[i]?.statusText ?? ''}`.trim() }))],
                ['Uncompressed text responses (no Content-Encoding)', insights.uncompressed.slice(0, 50).map((u) => ({ i: u.i, note: `${formatBytes(rows[u.i]?.contentSize ?? 0)} · ~${formatBytes(u.saving)} saveable` }))],
                ['Missing or weak caching', insights.missingCache.slice(0, 100).map((m) => ({ i: m.i, note: m.reason }))],
              ] as [string, { i: number; note: string }[]][]).map(([title, list]) => (
                <Panel key={title}>
                  <PanelHeader title={`${title} (${title.startsWith('Errors') ? insights.errors.length : title.startsWith('Uncompressed') ? insights.uncompressed.length : title.startsWith('Missing') ? insights.missingCache.length : list.length})`} />
                  {list.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">Nothing to report.</p>
                  ) : (
                    <div className="max-h-72 divide-y overflow-auto">
                      {list.map(({ i, note }, k) => {
                        const r = rows[i];
                        if (!r) return null;
                        return (
                          <button key={`${i}-${k}`} type="button" onClick={() => goToRow(i)} className="grid w-full grid-cols-[3rem_3rem_1fr_auto] items-center gap-2 px-3 py-1.5 text-left font-mono text-xs hover:bg-muted/50">
                            <span className="font-semibold">{r.method}</span>
                            <span className={cn('font-semibold', statusTone(r))}>{r.failed ? 'ERR' : r.status}</span>
                            <span className="truncate" title={r.url}>{r.host}{r.path}</span>
                            <span className="max-w-[18rem] truncate text-right text-muted-foreground" title={note}>{note}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              ))}

              <Panel>
                <PanelHeader title={`Redirect chains (${insights.redirects.length})`} />
                {insights.redirects.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No redirects.</p>
                ) : (
                  <div className="max-h-72 divide-y overflow-auto">
                    {insights.redirects.slice(0, 50).map((c, k) => (
                      <div key={k} className="space-y-1 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant={c.indices.length > 2 ? 'destructive' : 'muted'}>{c.indices.length - 1} redirect{c.indices.length === 2 ? '' : 's'}</Badge>
                          {c.looped && <Badge variant="destructive">loop</Badge>}
                          <span className="text-muted-foreground">final status {c.finalStatus}</span>
                        </div>
                        <ol className="space-y-0.5 font-mono">
                          {c.indices.map((i) => (
                            <li key={i}>
                              <button type="button" className="text-left hover:underline" onClick={() => goToRow(i)}>
                                <span className={cn('font-semibold', rows[i] ? statusTone(rows[i] as Row) : '')}>{rows[i]?.status}</span> <span className="break-all">{rows[i]?.url}</span>
                              </button>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader title={`Domains (${insights.domains.length})`} />
                <div className="max-h-96 divide-y overflow-auto">
                  {insights.domains.slice(0, 40).map((d) => (
                    <div key={d.host} className="grid grid-cols-[minmax(10rem,1fr)_5rem_minmax(6rem,1fr)_5rem] items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex items-center gap-1.5 truncate font-mono" title={d.host}>
                        {d.host || '(none)'}
                        {!d.firstParty && <Badge variant="outline">3rd party</Badge>}
                      </span>
                      <span className="text-right font-mono">{d.count} req</span>
                      <Bar pct={(d.count / (insights.domains[0]?.count ?? 1)) * 100} className={d.firstParty ? '' : 'bg-warning'} />
                      <span className="text-right font-mono text-muted-foreground">{formatBytes(d.bytes)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            {/* ------------------------------------------------ sanitize */}
            <TabsContent value="sanitize" className="space-y-4">
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Redacts the data in the loaded capture and exports a new <code>.har</code> that keeps the structure intact. Nothing leaves your browser. Automated redaction cannot know every secret in your traffic, so skim the result before you share it.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Panel>
                  <PanelHeader title="Headers and cookies" />
                  <div className="space-y-3 p-3">
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.cookies} onCheckedChange={(c) => setOpt('cookies', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">Cookies</span>
                        <span className="block text-xs text-muted-foreground">Cookie and Set-Cookie headers (names and attributes kept) plus the cookies arrays.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.authorization} onCheckedChange={(c) => setOpt('authorization', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">Authorization headers</span>
                        <span className="block text-xs text-muted-foreground">Authorization and Proxy-Authorization (the scheme, e.g. “Bearer”, is kept).</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.apiKeys} onCheckedChange={(c) => setOpt('apiKeys', c === true)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">API-key style headers</span>
                        <span className="block text-xs text-muted-foreground">Header names, comma or newline separated; <code>*</code> is a wildcard.</span>
                      </span>
                    </label>
                    <Textarea value={apiKeyText} onChange={(e) => setApiKeyText(e.target.value)} rows={3} spellCheck={false} disabled={!opts.apiKeys} className="min-h-16 font-mono text-xs" aria-label="API key header names" />
                    <Button variant="ghost" size="sm" onClick={() => setApiKeyText(DEFAULT_API_KEY_NAMES.join(', '))}>Reset list</Button>
                  </div>
                </Panel>
                <Panel>
                  <PanelHeader title="URLs and bodies" />
                  <div className="space-y-3 p-3">
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.queryParams} onCheckedChange={(c) => setOpt('queryParams', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">Sensitive query parameters</span>
                        <span className="block text-xs text-muted-foreground">In request URLs, queryString, redirects, Referer/Location and URL fragments.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.bodyFields} onCheckedChange={(c) => setOpt('bodyFields', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">Request body fields</span>
                        <span className="block text-xs text-muted-foreground">JSON keys, form parameters and multipart fields with the same names as the list below.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.jsonResponseFields} onCheckedChange={(c) => setOpt('jsonResponseFields', c === true)} disabled={!opts.bodyFields} className="mt-0.5" />
                      <span>
                        <span className="font-medium">Also JSON response fields</span>
                        <span className="block text-xs text-muted-foreground">Catches access_token / refresh_token in token responses.</span>
                      </span>
                    </label>
                    <Field label="Sensitive names (query params and body fields)">
                      <Textarea value={sensitiveText} onChange={(e) => setSensitiveText(e.target.value)} rows={3} spellCheck={false} className="min-h-16 font-mono text-xs" aria-label="Sensitive parameter names" />
                    </Field>
                    <Button variant="ghost" size="sm" onClick={() => setSensitiveText(DEFAULT_SENSITIVE_NAMES.join(', '))}>Reset list</Button>
                  </div>
                </Panel>
                <Panel>
                  <PanelHeader title="Response bodies" />
                  <div className="p-3">
                    <RadioGroup value={opts.responseBodies} onValueChange={(v) => setOpt('responseBodies', v as SanitizeOptions['responseBodies'])} className="gap-2">
                      {([
                        ['none', 'Keep bodies', 'Only the other rules below are applied inside them.'],
                        ['html-json', 'Remove HTML and JSON bodies', 'Pages and API responses are the most likely to contain personal data.'],
                        ['all', 'Remove all bodies', 'Replaces every response body (images and fonts too) with a placeholder.'],
                      ] as const).map(([v, label, hint]) => (
                        <label key={v} className="flex items-start gap-2 text-sm">
                          <RadioGroupItem value={v} className="mt-0.5" />
                          <span>
                            <span className="font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">{hint}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </Panel>
                <Panel>
                  <PanelHeader title="Anywhere in the file" />
                  <div className="space-y-3 p-3">
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.jwt} onCheckedChange={(c) => setOpt('jwt', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">JWT-looking strings</span>
                        <span className="block text-xs text-muted-foreground">Anything shaped like <code>eyJ….….…</code> in URLs, headers, cookies and text bodies.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.emails} onCheckedChange={(c) => setOpt('emails', c === true)} className="mt-0.5" />
                      <span className="font-medium">Email addresses</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={opts.ips} onCheckedChange={(c) => setOpt('ips', c === true)} className="mt-0.5" />
                      <span>
                        <span className="font-medium">IP addresses (v4 and v6)</span>
                        <span className="block text-xs text-muted-foreground">Includes serverIPAddress and X-Forwarded-For; version numbers and User-Agent strings are left alone.</span>
                      </span>
                    </label>
                    <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                      <Field label="Replace with">
                        <Select value={opts.placeholder} onValueChange={(v) => setOpt('placeholder', v as SanitizeOptions['placeholder'])}>
                          <SelectTrigger className="h-8 w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="redacted">[REDACTED]</SelectItem>
                            <SelectItem value="hash">[REDACTED:hash] (stable per value)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <label className="flex items-center gap-2 pb-1 text-xs">
                        <Checkbox checked={pretty} onCheckedChange={(c) => setPretty(c === true)} />
                        <Label className="text-xs">Pretty-print output (files under 40 MB)</Label>
                      </label>
                    </div>
                    {opts.placeholder === 'hash' && (
                      <p className="text-2xs text-muted-foreground">Equal values get the same short hash so you can still see they match. Hashes of guessable values (emails, short IDs) can be brute-forced, so use plain [REDACTED] when in doubt.</p>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void runSanitize()} disabled={running}>
                  <ShieldCheck /> {running ? 'Sanitizing…' : 'Sanitize HAR'}
                </Button>
                {running && (
                  <div className="flex min-w-[200px] flex-1 items-center gap-2">
                    <Progress value={progress} className="h-2" />
                    <span className="font-mono text-xs text-muted-foreground">{progress}%</span>
                  </div>
                )}
              </div>
              <ErrorBanner error={sanitizeError} />

              {result && (
                <Panel data-testid="sanitize-result">
                  <PanelHeader title="Result">
                    <DownloadButton data={result.blob} filename={result.name} mime="application/json" label={`Download ${result.name}`} variant="secondary" />
                  </PanelHeader>
                  <div className="space-y-3 p-3">
                    <p className="flex items-start gap-2 text-sm">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>
                        <span className="font-semibold">{result.report.total.toLocaleString()} value{result.report.total === 1 ? '' : 's'} redacted</span> in {result.report.entriesTouched.toLocaleString()} of {result.report.entries.toLocaleString()} requests · output {formatBytes(result.bytes)}
                        <span className="block text-xs text-muted-foreground">{result.verified}</span>
                      </span>
                    </p>
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-left text-2xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-1.5 font-medium">Category</th>
                            <th className="px-3 py-1.5 text-right font-medium">Values</th>
                            <th className="px-3 py-1.5 font-medium">Names seen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                            <tr key={c} className={result.report.counts[c] === 0 ? 'text-muted-foreground' : ''}>
                              <td className="px-3 py-1.5">{CATEGORY_LABELS[c]}</td>
                              <td className="px-3 py-1.5 text-right font-mono" data-testid={`count-${c}`}>{result.report.counts[c].toLocaleString()}</td>
                              <td className="max-w-[28rem] truncate px-3 py-1.5 font-mono text-2xs" title={result.report.names[c].join(', ')}>{result.report.names[c].slice(0, 12).join(', ')}{result.report.names[c].length > 12 ? ', …' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {result.report.examples.length > 0 && (
                      <details className="rounded-md border text-xs">
                        <summary className="cursor-pointer px-3 py-1.5 font-medium">Where redactions happened (first {result.report.examples.length})</summary>
                        <div className="max-h-64 divide-y overflow-auto border-t">
                          {result.report.examples.map((x, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1 font-mono text-2xs">
                              <Badge variant="muted">{CATEGORY_LABELS[x.category]}</Badge>
                              <span>{x.where}</span>
                              {x.name && <span className="text-muted-foreground">{x.name}</span>}
                              <span className="text-muted-foreground">{x.entry >= 0 ? `request #${x.entry + 1}` : 'page'}</span>
                              <span className="ml-auto">{x.placeholder}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <p className="flex items-start gap-2 text-2xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />
                      Still check for secrets this tool cannot recognise: custom token formats inside bodies, personal names, internal hostnames and unusual header names.
                    </p>
                  </div>
                </Panel>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
