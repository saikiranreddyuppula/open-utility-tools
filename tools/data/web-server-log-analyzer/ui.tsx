'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Loader2, RotateCcw, ShieldAlert, Trash2, X } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';

import {
  DEFAULT_ANALYZE_OPTIONS,
  FORMAT_LABELS,
  LogStore,
  NO_FILTERS,
  analyzeAsync,
  bucketLabel,
  buildFilter,
  compileLogFormat,
  escapeRegex,
  exportRows,
  formatBytesShort,
  formatSeconds,
  formatTime,
  generateSampleLog,
  ingestBlob,
  ingestText,
  matchingRows,
  summaryText,
  warmCaches,
  type Analysis,
  type BuiltFilter,
  type ExportKind,
  type FileStats,
  type Histogram,
  type LatencyStats,
  type LogFilters,
  type LogFormatId,
  type RowView,
  type TopEntry,
} from './logic';

/* ------------------------------------------------------------------ */
/* Constants & small helpers                                           */
/* ------------------------------------------------------------------ */

const MAX_PASTE = 8_000_000;
const MAX_FILES = 40;
const PAGE = 100;

type Tz = 'utc' | 'local';
type FormatChoice = LogFormatId | 'auto';
type Phase = 'idle' | 'reading' | 'indexing';

const FORMAT_CHOICES: { value: FormatChoice; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'combined', label: FORMAT_LABELS.combined },
  { value: 'common', label: FORMAT_LABELS.common },
  { value: 'nginx-timing', label: FORMAT_LABELS['nginx-timing'] },
  { value: 'vhost', label: FORMAT_LABELS.vhost },
  { value: 'json', label: FORMAT_LABELS.json },
  { value: 'logfmt', label: FORMAT_LABELS.logfmt },
  { value: 'alb', label: FORMAT_LABELS.alb },
  { value: 'custom', label: FORMAT_LABELS.custom },
];

const CUSTOM_EXAMPLES: { label: string; value: string }[] = [
  {
    label: 'nginx combined + timings',
    value: '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for" $request_time $upstream_response_time',
  },
  { label: 'Apache combined + %D', value: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i" %D' },
  { label: 'ISO time, pipe separated', value: '$time_iso8601|$remote_addr|$request_method|$request_uri|$status|$body_bytes_sent|$request_time' },
];

const fmtInt = (n: number): string => n.toLocaleString('en-US');

function pct(n: number, total: number): string {
  if (total <= 0) return '0%';
  const p = (n / total) * 100;
  return `${p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}

function compact(n: number): string {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

function niceMax(v: number): number {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

function toInputValue(ms: number | null, tz: Tz): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, '0');
  return tz === 'utc'
    ? `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fromInputValue(v: string, tz: Tz): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  const t = tz === 'utc' ? Date.UTC(y, mo - 1, d, h, mi, s) : new Date(y, mo - 1, d, h, mi, s).getTime();
  return Number.isFinite(t) ? t : null;
}

function statusTone(status: number): string {
  if (status >= 500) return 'text-destructive';
  if (status >= 400) return 'text-warning';
  if (status >= 300) return 'text-primary';
  if (status >= 200) return 'text-success';
  return 'text-muted-foreground';
}

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

interface Source {
  id: number;
  kind: 'file' | 'paste';
  name: string;
  size: number;
  file: File | null;
  text: string;
  version: number;
}

interface PlanItem {
  source: Source;
  format: FormatChoice;
}

function keyOf(p: PlanItem, customText: string): string {
  const s = p.source;
  return `${s.id}|${s.kind}|${s.version}|${s.size}|${p.format}|${p.format === 'custom' ? customText : ''}`;
}

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border bg-card px-3 py-2">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-xl font-semibold tabular', tone)}>{value}</span>
      {sub && <span className="truncate font-mono text-2xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

interface Segment {
  label: string;
  count: number;
  className: string;
}

function SegmentBar({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label} ${fmtInt(s.count)}`).join(', ')}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.label} className={s.className} style={{ width: `${(s.count / Math.max(1, total)) * 100}%` }} title={`${s.label}: ${fmtInt(s.count)} (${pct(s.count, total)})`} />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
            <span className={cn('size-2.5 rounded-sm', s.className)} />
            {s.label}
            <span className="text-foreground tabular">{fmtInt(s.count)}</span>
            <span className="tabular">({pct(s.count, total)})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface Column {
  label: string;
  cell: (e: TopEntry) => string;
  className?: string;
}

function RankTable({
  title,
  rows,
  columns,
  barValue,
  onPick,
  isPicked,
  hint,
  keyClass,
  keyLabel,
  children,
}: {
  title: string;
  keyLabel?: string;
  rows: TopEntry[];
  columns: Column[];
  barValue: (e: TopEntry) => number;
  onPick?: (e: TopEntry) => void;
  isPicked?: (e: TopEntry) => boolean;
  hint?: string;
  keyClass?: (e: TopEntry) => string;
  children?: React.ReactNode;
}) {
  const max = rows.reduce((m, r) => Math.max(m, barValue(r)), 0);
  return (
    <Panel className="min-w-0">
      <PanelHeader title={title}>{children}</PanelHeader>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Nothing to show.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          <li className="flex items-center gap-3 bg-muted/20 px-3 py-1 text-2xs uppercase tracking-wide text-muted-foreground" aria-hidden="true">
            <span className="min-w-0 flex-1 truncate">{keyLabel ?? ''}</span>
            {columns.map((c) => (
              <span key={c.label} className={cn('shrink-0 text-right', c.className)}>
                {c.label}
              </span>
            ))}
          </li>
          {rows.map((r, i) => {
            const picked = isPicked?.(r) ?? false;
            const inner = (
              <>
                <span
                  className={cn('pointer-events-none absolute inset-y-0 left-0', picked ? 'bg-primary/25' : 'bg-primary/10')}
                  style={{ width: `${max > 0 ? (barValue(r) / max) * 100 : 0}%` }}
                />
                <span className={cn('relative min-w-0 flex-1 truncate font-mono text-xs', keyClass?.(r))} title={r.key}>
                  {r.key === '' ? '(none)' : r.key}
                </span>
                {columns.map((c) => (
                  <span key={c.label} className={cn('relative shrink-0 text-right font-mono text-xs tabular text-muted-foreground first:text-foreground', c.className)} title={c.label}>
                    {c.cell(r)}
                  </span>
                ))}
              </>
            );
            return (
              <li key={`${i}-${r.key}`} className="relative">
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(r)}
                    aria-pressed={picked}
                    title="Click to filter"
                    className="relative flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                  >
                    {inner}
                  </button>
                ) : (
                  <div className="relative flex w-full items-center gap-3 px-3 py-1.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hint && <p className="border-t bg-muted/30 px-3 py-1 text-2xs text-muted-foreground">{hint}</p>}
    </Panel>
  );
}

function countCols(total: number, withBytes = false): Column[] {
  const cols: Column[] = [
    { label: 'Requests', cell: (e) => fmtInt(e.count), className: 'min-w-[3.5rem]' },
    { label: 'Share', cell: (e) => pct(e.count, total), className: 'w-10' },
  ];
  if (withBytes) cols.push({ label: 'Bytes', cell: (e) => (e.bytes === undefined ? '' : formatBytesShort(e.bytes)), className: 'min-w-[4.5rem]' });
  return cols;
}

/* ---- histogram ---- */

function HistogramChart({ h, tz, onPick }: { h: Histogram; tz: Tz; onPick: (from: number, to: number) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, width);
  const H = 190;
  const m = { l: 44, r: 8, t: 10, b: 24 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const nb = h.buckets.length;
  let max = 0;
  for (const b of h.buckets) if (b.total > max) max = b.total;
  const top = niceMax(max);
  const bw = iw / nb;
  const gap = bw > 6 ? 1 : 0;
  const y = (v: number): number => m.t + ih * (1 - v / top);
  const rangeMs = h.size * nb;
  const label = (ms: number): string => {
    const t = formatTime(ms, tz);
    if (h.size >= 86_400_000) return t.slice(5, 10);
    if (rangeMs >= 2 * 86_400_000) return t.slice(5, 16);
    return h.size < 60_000 ? t.slice(11, 19) : t.slice(11, 16);
  };
  const nTicks = Math.min(nb, Math.max(2, Math.floor(iw / 120)));
  const ticks: number[] = [];
  for (let t = 0; t < nTicks; t++) ticks.push(nTicks === 1 ? 0 : Math.round((t * (nb - 1)) / (nTicks - 1)));
  const uniqTicks = ticks.filter((v, i) => ticks.indexOf(v) === i);
  const hb = hover !== null ? h.buckets[hover] : undefined;

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <div className="min-h-5 font-mono text-2xs text-muted-foreground" aria-live="polite">
        {hb && hover !== null ? (
          <>
            <span className="text-foreground">
              {formatTime(h.start + hover * h.size, tz)} – {formatTime(h.start + (hover + 1) * h.size, tz).slice(11)}
            </span>
            {` · ${fmtInt(hb.total)} requests · `}
            <span className="text-success">2xx {fmtInt(hb.c2)}</span> · <span className="text-primary">3xx {fmtInt(hb.c3)}</span> · <span className="text-warning">4xx {fmtInt(hb.c4)}</span> ·{' '}
            <span className="text-destructive">5xx {fmtInt(hb.c5)}</span>
          </>
        ) : (
          <>Bucket size {bucketLabel(h.size)} · {nb} buckets · click a bar to filter to that window</>
        )}
      </div>
      <svg width={W} height={H} role="img" aria-label={`Requests over time, ${nb} buckets of ${bucketLabel(h.size)}`} className="block max-w-full select-none">
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '3 3'} />
            <text x={m.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} className="fill-muted-foreground" fontFamily="ui-monospace, monospace">
              {compact(v)}
            </text>
          </g>
        ))}
        {h.buckets.map((b, i) => {
          const x = m.l + i * bw;
          const w = Math.max(1, bw - gap);
          let acc = 0;
          const seg = (n: number, cls: string, k: string) => {
            if (n <= 0) return null;
            const y0 = y(acc + n);
            const hgt = y(acc) - y0;
            acc += n;
            return <rect key={k} x={x} y={y0} width={w} height={Math.max(0.5, hgt)} className={cls} />;
          };
          const other = Math.max(0, b.total - b.c2 - b.c3 - b.c4 - b.c5);
          return (
            <g key={i} opacity={hover !== null && hover !== i ? 0.55 : 1}>
              {seg(b.c2, 'fill-success', 'a')}
              {seg(b.c3, 'fill-primary', 'b')}
              {seg(b.c4, 'fill-warning', 'c')}
              {seg(b.c5, 'fill-destructive', 'd')}
              {seg(other, 'fill-muted-foreground', 'e')}
              <rect
                x={x}
                y={m.t}
                width={Math.max(1, bw)}
                height={ih}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(h.start + i * h.size, h.start + (i + 1) * h.size - 1)}
                data-bucket={i}
              >
                <title>{`${formatTime(h.start + i * h.size, tz)}: ${fmtInt(b.total)} requests`}</title>
              </rect>
            </g>
          );
        })}
        {uniqTicks.map((idx, k) => (
          <text
            key={idx}
            x={m.l + idx * bw + bw / 2}
            y={H - 8}
            textAnchor={k === 0 && uniqTicks.length > 1 ? 'start' : k === uniqTicks.length - 1 && uniqTicks.length > 1 ? 'end' : 'middle'}
            fontSize={10}
            className="fill-muted-foreground"
            fontFamily="ui-monospace, monospace"
          >
            {label(h.start + idx * h.size)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ---- latency ---- */

function LatencyCard({ title, stats }: { title: string; stats: LatencyStats }) {
  const items: [string, number][] = [
    ['min', stats.min],
    ['avg', stats.avg],
    ['p50', stats.p50],
    ['p90', stats.p90],
    ['p95', stats.p95],
    ['p99', stats.p99],
    ['max', stats.max],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium">{title}</span>
        <span className="font-mono text-2xs text-muted-foreground">{fmtInt(stats.count)} requests</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {items.map(([k, v]) => (
          <div key={k} className={cn('rounded-md border px-2 py-1', k === 'p95' || k === 'p99' ? 'bg-muted/40' : 'bg-card')}>
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="font-mono text-xs font-semibold tabular">{formatSeconds(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- request tables ---- */

function RequestsTable({ rows, tz, files, highlight }: { rows: RowView[]; tz: Tz; files: FileStats[]; highlight?: 'rt' | 'bytes' }) {
  const multi = files.length > 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead>
          <tr className="border-b bg-muted/30 text-2xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1 font-medium">{multi ? 'File:line' : 'Line'}</th>
            <th className="px-2 py-1 font-medium">Time</th>
            <th className="px-2 py-1 font-medium">IP</th>
            <th className="px-2 py-1 font-medium">Request</th>
            <th className="px-2 py-1 text-right font-medium">Status</th>
            <th className={cn('px-2 py-1 text-right font-medium', highlight === 'bytes' && 'text-foreground')}>Bytes</th>
            <th className={cn('px-2 py-1 text-right font-medium', highlight === 'rt' && 'text-foreground')}>Time taken</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((r) => (
            <tr key={`${r.file}:${r.line}`} className="border-b last:border-0 hover:bg-accent/30">
              <td className="whitespace-nowrap px-2 py-1 text-muted-foreground tabular">{multi ? `${r.file + 1}:${r.line}` : r.line}</td>
              <td className="whitespace-nowrap px-2 py-1 text-muted-foreground tabular">{formatTime(r.time, tz)}</td>
              <td className="whitespace-nowrap px-2 py-1">{r.ip}</td>
              <td className="max-w-[28rem] px-2 py-1">
                <div className="truncate" title={`${r.method} ${r.uri}\n${r.ua}`}>
                  <span className="text-muted-foreground">{r.method}</span> {r.uri}
                </div>
              </td>
              <td className={cn('px-2 py-1 text-right tabular', statusTone(r.status))}>{r.status === 0 ? '–' : r.status}</td>
              <td className={cn('whitespace-nowrap px-2 py-1 text-right tabular', highlight === 'bytes' ? 'font-semibold' : 'text-muted-foreground')}>{formatBytesShort(r.bytes)}</td>
              <td className={cn('whitespace-nowrap px-2 py-1 text-right tabular', highlight === 'rt' ? 'font-semibold' : 'text-muted-foreground')}>{Number.isNaN(r.rt) ? '–' : formatSeconds(r.rt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- security ---- */

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function SecurityPanel({ a, tz, onFilter, current, onPickIp }: { a: Analysis; tz: Tz; onFilter: (id: string) => void; current: string; onPickIp: (ip: string) => void }) {
  const findings = [...a.security].sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || y.requests - x.requests);
  return (
    <Panel>
      <PanelHeader title="Security heuristics">
        {a.suspiciousRequests > 0 && (
          <Button variant={current === 'any' ? 'secondary' : 'ghost'} size="sm" onClick={() => onFilter(current === 'any' ? '' : 'any')}>
            <ShieldAlert className="size-3.5" /> {current === 'any' ? 'Showing suspicious' : 'Show all suspicious'}
          </Button>
        )}
      </PanelHeader>
      <div className="flex flex-col gap-3 p-3">
        {findings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No injection, traversal, scanner or probe patterns matched the {fmtInt(a.total)} requests in view.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono text-foreground tabular">{fmtInt(a.suspiciousRequests)}</span> of {fmtInt(a.total)} requests ({pct(a.suspiciousRequests, a.total)}) match at least one pattern.
            </p>
            <ul className="grid gap-2 lg:grid-cols-2">
              {findings.map((f) => (
                <li key={f.id} className="flex min-w-0 flex-col gap-1.5 rounded-md border bg-card p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'outline' : 'muted'} className={cn(f.severity === 'medium' && 'border-warning/50 text-warning')}>
                      {f.severity}
                    </Badge>
                    <span className="text-sm font-medium">{f.label}</span>
                    <Button variant={current === f.id ? 'secondary' : 'ghost'} size="sm" className="ml-auto h-6" onClick={() => onFilter(current === f.id ? '' : f.id)}>
                      {current === f.id ? 'Showing' : 'Show requests'}
                    </Button>
                  </div>
                  <div className="font-mono text-2xs text-muted-foreground">
                    <span className="text-foreground tabular">{fmtInt(f.requests)}</span> requests from <span className="text-foreground tabular">{fmtInt(f.uniqueIps)}</span> IP{f.uniqueIps === 1 ? '' : 's'}
                  </div>
                  <p className="text-2xs text-muted-foreground">{f.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {f.topIps.map((ip) => (
                      <button
                        key={ip.key}
                        type="button"
                        onClick={() => onPickIp(ip.key)}
                        title="Filter to this IP"
                        className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-2xs hover:bg-accent"
                      >
                        {ip.key} <span className="text-muted-foreground">×{fmtInt(ip.count)}</span>
                      </button>
                    ))}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {f.topUris.slice(0, 3).map((u) => (
                      <li key={u.key} className="truncate font-mono text-2xs text-muted-foreground" title={u.key}>
                        <span className="tabular text-foreground">{fmtInt(u.count)}×</span> {u.key}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
        {(a.notFoundIps.length > 0 || a.rateIps.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {a.notFoundIps.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Scanning: many 404 responses per IP</span>
                <ul className="flex flex-col gap-0.5">
                  {a.notFoundIps.slice(0, 6).map((e) => (
                    <li key={e.key}>
                      <button type="button" onClick={() => onPickIp(e.key)} className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-accent/40" title="Filter to this IP">
                        <span className="min-w-0 flex-1 truncate">{e.key}</span>
                        <span className="text-warning tabular">{fmtInt(e.count)} × 404</span>
                        <span className="text-2xs text-muted-foreground tabular">{pct(e.count, e.bytes ?? e.count)} of its requests</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.rateIps.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Burst: most requests from one IP in a minute</span>
                <ul className="flex flex-col gap-0.5">
                  {a.rateIps.slice(0, 6).map((e) => (
                    <li key={e.key}>
                      <button type="button" onClick={() => onPickIp(e.key)} className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-accent/40" title="Filter to this IP">
                        <span className="min-w-0 flex-1 truncate">{e.key}</span>
                        <span className="tabular">{fmtInt(e.count)} / min</span>
                        <span className="text-2xs text-muted-foreground tabular">{formatTime(e.extra ?? NaN, tz).slice(5, 16)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="text-2xs text-muted-foreground">
          Pattern matching on the logged request line and user agent, nothing more: it cannot see request bodies or headers, and a match does not mean the attack worked. Check the status code and response size of each hit.
        </p>
      </div>
    </Panel>
  );
}

/* ---- sources ---- */

function SourceRow({
  plan,
  stats,
  detectedLabel,
  error,
  onFormat,
  onRemove,
  customReady,
}: {
  plan: PlanItem;
  stats: FileStats | undefined;
  detectedLabel: string | null;
  error: string | null;
  onFormat: (f: FormatChoice) => void;
  onRemove: () => void;
  customReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const s = plan.source;
  const unparsed = stats?.unparsed ?? 0;
  const noFormat = stats !== undefined && stats.format === null && plan.format === 'auto';
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 max-w-[18rem] truncate text-sm font-medium" title={s.name}>
          {s.name}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{s.kind === 'file' ? formatBytes(s.size) : `${fmtInt(s.size)} chars`}</span>
        {stats && (
          <span className="font-mono text-2xs text-muted-foreground tabular">
            {fmtInt(stats.lines)} lines · <span className="text-foreground">{fmtInt(stats.parsed)}</span> requests
          </span>
        )}
        {detectedLabel && plan.format === 'auto' && <Badge variant="muted">detected: {detectedLabel}</Badge>}
        {stats?.truncated && <Badge variant="outline" className="border-warning/50 text-warning">truncated</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Select value={plan.format} onValueChange={(v) => onFormat(v as FormatChoice)}>
            <SelectTrigger className="h-7 w-[13.5rem] text-xs" aria-label={`Log format for ${s.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_CHOICES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {s.kind === 'file' && (
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.name}`} onClick={onRemove}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {error && <ErrorBanner error={error} />}
      {noFormat && <p className="text-xs text-warning">The format of this file was not recognised. Pick a format above or describe it with a custom log_format.</p>}
      {plan.format === 'custom' && !customReady && <p className="text-xs text-warning">Enter a valid custom log_format below to parse this file.</p>}
      {unparsed > 0 && stats && (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex w-fit items-center gap-1 text-xs text-warning hover:underline" aria-expanded={open}>
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {fmtInt(unparsed)} line{unparsed === 1 ? '' : 's'} could not be parsed ({pct(unparsed, stats.parsed + unparsed)})
          </button>
          {open && (
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-auto rounded-md border bg-muted/20 p-2 font-mono text-2xs">
              {stats.samples.map((x) => (
                <li key={x.line} className="flex gap-2">
                  <span className="shrink-0 text-muted-foreground tabular">{x.line}</span>
                  <span className="min-w-0 break-all">{x.text}</span>
                </li>
              ))}
              {unparsed > stats.samples.length && <li className="text-muted-foreground">… and {fmtInt(unparsed - stats.samples.length)} more</li>}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Main tool                                                           */
/* ------------------------------------------------------------------ */

export default function WebServerLogAnalyzerTool() {
  const storeRef = useRef<LogStore | null>(null);

  /* input */
  const [pasteText, setPasteText] = useState('');
  const [pasteCommitted, setPasteCommitted] = useState({ text: '', version: 0 });
  const [isSample, setIsSample] = useState(false);
  const [files, setFiles] = useState<{ id: number; file: File }[]>([]);
  const nextId = useRef(1);
  const [formats, setFormats] = useState<Record<number, FormatChoice>>({});
  const [defaultFormat, setDefaultFormat] = useState<FormatChoice>('auto');
  const [customText, setCustomText] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* ingest state */
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<{ index: number; count: number; name: string; bytes: number; total: number; lines: number } | null>(null);
  const [indexProgress, setIndexProgress] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [fileStats, setFileStats] = useState<FileStats[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [hasXff, setHasXff] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const runRef = useRef(0);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const doneRef = useRef<string[]>([]);

  /* view state */
  const [tz, setTz] = useState<Tz>('utc');
  const [topN, setTopN] = useState(10);
  const [filters, setFilters] = useState<LogFilters>(NO_FILTERS);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<{ filter: BuiltFilter; store: LogStore } | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const analysisRun = useRef(0);
  const [rowCount, setRowCount] = useState(PAGE);
  const [rows, setRows] = useState<{ rows: RowView[]; more: boolean }>({ rows: [], more: false });

  /* sample on first load */
  useEffect(() => {
    const sample = generateSampleLog({ lines: 2500, format: 'timing', seed: 7 });
    setPasteText(sample);
    setPasteCommitted({ text: sample, version: 1 });
    setIsSample(true);
  }, []);

  /* debounce typing / pasting */
  useEffect(() => {
    if (pasteText === pasteCommitted.text) return;
    const t = setTimeout(() => setPasteCommitted((c) => ({ text: pasteText, version: c.version + 1 })), 600);
    return () => clearTimeout(t);
  }, [pasteText, pasteCommitted.text]);

  /* cancel everything on unmount */
  useEffect(
    () => () => {
      runRef.current = -1;
      analysisRun.current = -1;
    },
    []
  );

  const plan = useMemo<PlanItem[]>(() => {
    const out: PlanItem[] = files.map((f) => ({
      source: { id: f.id, kind: 'file', name: f.file.name, size: f.file.size, file: f.file, text: '', version: f.file.lastModified },
      format: formats[f.id] ?? defaultFormat,
    }));
    if (pasteCommitted.text.trim() !== '') {
      out.push({
        source: { id: 0, kind: 'paste', name: isSample ? 'Sample log' : 'Pasted text', size: pasteCommitted.text.length, file: null, text: pasteCommitted.text, version: pasteCommitted.version },
        format: formats[0] ?? defaultFormat,
      });
    }
    return out;
  }, [files, formats, defaultFormat, pasteCommitted, isSample]);

  const customResult = useMemo(() => (customText.trim() === '' ? null : compileLogFormat(customText)), [customText]);
  const customFormat = customResult && customResult.ok ? customResult.format : null;
  const usesCustom = plan.some((p) => p.format === 'custom');

  /* ---- ingestion (incremental: only new / changed trailing sources are parsed) ---- */
  useEffect(() => {
    const run = ++runRef.current;
    const isCancelled = (): boolean => runRef.current !== run;
    const keys = plan.map((p) => keyOf(p, customText));
    chainRef.current = chainRef.current
      .then(async () => {
        if (isCancelled()) return;
        if (!storeRef.current) storeRef.current = new LogStore();
        const store = storeRef.current;
        const done = doneRef.current;
        let p = 0;
        while (p < done.length && p < keys.length && done[p] === keys[p]) p++;
        done.length = p;
        store.truncate(p);
        if (p < keys.length) {
          setPhase('reading');
          const newErrors: Record<string, string> = {};
          let lastUi = 0;
          for (let k = p; k < plan.length; k++) {
            const item = plan[k] as PlanItem;
            const name = item.source.name;
            const base = { index: k, count: plan.length, name };
            setProgress({ ...base, bytes: 0, total: item.source.size, lines: 0 });
            const onProgress = (pr: { bytes: number; total: number; lines: number }): void => {
              const now = Date.now();
              if (now - lastUi < 90) return;
              lastUi = now;
              setProgress({ ...base, bytes: pr.bytes, total: pr.total, lines: pr.lines });
            };
            try {
              const stats = item.source.file
                ? await ingestBlob(item.source.file, name, store, k, item.format, customFormat, onProgress, isCancelled)
                : await ingestText(item.source.text, store, k, name, item.format, customFormat, onProgress, isCancelled);
              if (stats === null) return;
            } catch (e) {
              if (isCancelled()) return;
              newErrors[keys[k] as string] = e instanceof Error ? e.message : `Could not read ${name}.`;
            }
            if (isCancelled()) return;
            done.push(keys[k] as string);
            setFileStats(store.files.map((f) => ({ ...f })));
            setTotalRows(store.n);
          }
          setErrors(newErrors);
          setProgress(null);
          setPhase('indexing');
          setIndexProgress(0);
          const ok = await warmCaches(store, (f) => setIndexProgress(f), isCancelled);
          if (!ok || isCancelled()) return;
        } else {
          setFileStats(store.files.map((f) => ({ ...f })));
          setTotalRows(store.n);
        }
        let xff = false;
        for (let i = 0; i < store.n; i++) {
          if ((store.xff[i] as number) >= 0) {
            xff = true;
            break;
          }
        }
        setHasXff(xff);
        setPhase('idle');
        if (p < keys.length || keys.length === 0) setDataVersion((v) => v + 1);
      })
      .catch((e: unknown) => {
        if (runRef.current !== run) return;
        setNotice(e instanceof Error ? e.message : 'Something went wrong while reading the logs.');
        setPhase('idle');
        setProgress(null);
      });
  }, [plan, customText, customFormat]);

  /* ---- analysis (debounced; re-run when data or filters change) ---- */
  useEffect(() => {
    if (phase !== 'idle') return;
    const store = storeRef.current;
    if (!store) return;
    const run = ++analysisRun.current;
    const t = setTimeout(
      async () => {
        if (store.n === 0) {
          setAnalysis(null);
          setActive(null);
          setFilterError(null);
          setRows({ rows: [], more: false });
          return;
        }
        const built = buildFilter(store, filters);
        setFilterError(built.error);
        if (built.error) return;
        setAnalyzing(true);
        setAnalysisProgress(0);
        try {
          const a = await analyzeAsync(store, built, { ...DEFAULT_ANALYZE_OPTIONS, topN, useXff: filters.useXff }, (f) => setAnalysisProgress(f), () => run !== analysisRun.current);
          if (!a || run !== analysisRun.current) return;
          setAnalysis(a);
          setActive({ filter: built, store });
          setRowCount(PAGE);
          setRows(matchingRows(store, built, 0, PAGE));
        } finally {
          if (run === analysisRun.current) setAnalyzing(false);
        }
      },
      dataVersion === 0 ? 0 : 220
    );
    return () => clearTimeout(t);
  }, [dataVersion, phase, filters, topN]);

  const showMoreRows = useCallback(() => {
    if (!active) return;
    const next = rowCount + PAGE * 2;
    setRowCount(next);
    setRows(matchingRows(active.store, active.filter, 0, next));
  }, [active, rowCount]);

  /* ---- actions ---- */
  const addFiles = useCallback(
    (list: File[]) => {
      if (list.length === 0) return;
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        setNotice(`At most ${MAX_FILES} files can be analysed together.`);
        return;
      }
      const picked = list.slice(0, room);
      setNotice(picked.length < list.length ? `Only the first ${picked.length} of ${list.length} files were added (limit ${MAX_FILES}).` : null);
      const entries = picked.map((file) => ({ id: nextId.current++, file }));
      if (isSample) {
        setPasteText('');
        setPasteCommitted((c) => ({ text: '', version: c.version + 1 }));
        setIsSample(false);
      }
      setFiles((prev) => [...prev, ...entries]);
    },
    [files.length, isSample]
  );

  const loadSample = useCallback(() => {
    const sample = generateSampleLog({ lines: 2500, format: 'timing', seed: 7 });
    setPasteText(sample);
    setPasteCommitted((c) => ({ text: sample, version: c.version + 1 }));
    setIsSample(true);
    setNotice(null);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setFormats({});
    setPasteText('');
    setPasteCommitted((c) => ({ text: '', version: c.version + 1 }));
    setIsSample(false);
    setFilters(NO_FILTERS);
    setNotice(null);
  }, []);

  const setFilter = useCallback((patch: Partial<LogFilters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const resetFilters = useCallback(() => setFilters((f) => ({ ...NO_FILTERS, useXff: f.useXff })), []);

  const busy = phase !== 'idle';
  const filterActive = active?.filter.active ?? false;
  const customReady = customFormat !== null;
  const anyData = totalRows > 0;
  const detectedLabel = (k: number): string | null => {
    const f = fileStats[k];
    if (!f || !f.format) return null;
    return FORMAT_LABELS[f.format];
  };
  const a = analysis;
  const dim = busy || analyzing;
  const exportTo = (kind: ExportKind) => async () => {
    if (!active) return '';
    const r = await exportRows(active.store, active.filter, kind);
    return r.blob;
  };

  const pickPath = (path: string): void => setFilter({ path: filters.path === `^${escapeRegex(path)}(\\?|$)` ? '' : `^${escapeRegex(path)}(\\?|$)` });
  const pickIp = (ip: string): void => setFilter({ ip: filters.ip === ip ? '' : ip });

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------- input ---------------- */}
      <Panel
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            addFiles(Array.from(e.dataTransfer.files));
          }
        }}
      >
        <PanelHeader title="Log files">
          <Button variant="ghost" size="sm" onClick={loadSample}>
            Load sample
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={files.length === 0 && pasteText === ''}>
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </PanelHeader>
        <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <FileDropzone
            compact
            multiple
            onFiles={addFiles}
            accept=".log,.txt,.gz,.json,.jsonl,.ndjson,.out,.access,text/plain,application/gzip,application/json"
            label="Drop log files here, or click to browse"
            hint="Streamed in your browser: 50 MB is quick, 200 MB works. .gz files are decompressed on the fly. Nothing is uploaded."
            className="min-h-[9rem]"
          />
          <Textarea
            value={pasteText}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > MAX_PASTE) {
                setPasteText(v.slice(0, MAX_PASTE));
                setNotice(`Pasted text is limited to ${formatBytes(MAX_PASTE)}: drop the file instead for larger logs.`);
              } else {
                setPasteText(v);
              }
              setIsSample(false);
            }}
            spellCheck={false}
            wrap="off"
            placeholder="…or paste log lines here (nginx / Apache access logs, JSON lines, logfmt, AWS ALB)"
            aria-label="Pasted log lines"
            className="field-sizing-fixed h-36 resize-y bg-transparent px-3 py-2 font-mono text-xs leading-5 dark:bg-transparent lg:h-auto lg:min-h-[9rem]"
          />
        </div>
        {notice && <ErrorBanner error={notice} className="mx-3 mb-3" />}
        {plan.length > 0 && (
          <ul className="flex flex-col divide-y border-t">
            {plan.map((p, k) => (
              <SourceRow
                key={p.source.id}
                plan={p}
                stats={fileStats[k]}
                detectedLabel={detectedLabel(k)}
                error={errors[keyOf(p, customText)] ?? null}
                customReady={customReady}
                onFormat={(f) => setFormats((prev) => ({ ...prev, [p.source.id]: f }))}
                onRemove={() => {
                  setFiles((prev) => prev.filter((x) => x.id !== p.source.id));
                  setFormats((prev) => {
                    const next = { ...prev };
                    delete next[p.source.id];
                    return next;
                  });
                }}
              />
            ))}
          </ul>
        )}
        {busy && (
          <div className="flex flex-col gap-1 border-t px-3 py-2" role="status">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {phase === 'reading' && progress
                ? `Reading ${progress.name} (${progress.index + 1}/${progress.count}): ${progress.total > 0 ? `${formatBytes(progress.bytes)} of ${formatBytes(progress.total)}, ` : ''}${fmtInt(progress.lines)} lines`
                : phase === 'indexing'
                  ? 'Classifying user agents and request paths…'
                  : 'Working…'}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((phase === 'indexing' ? indexProgress : progress && progress.total > 0 ? progress.bytes / progress.total : 0) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <StatBar
          items={[
            plan.length === 0 ? 'no input yet' : `${plan.length} source${plan.length === 1 ? '' : 's'}`,
            anyData ? `${fmtInt(totalRows)} requests parsed` : null,
            fileStats.some((f) => f.unparsed > 0) ? `${fmtInt(fileStats.reduce((s, f) => s + f.unparsed, 0))} lines not parsed` : null,
          ]}
        />
      </Panel>

      <OptionsBar>
        <Field label="Log format (all sources)">
          <Select
            value={defaultFormat}
            onValueChange={(v) => {
              setDefaultFormat(v as FormatChoice);
              setFormats({});
              if (v === 'custom') setCustomOpen(true);
            }}
          >
            <SelectTrigger className="h-8 w-[15rem] text-xs" aria-label="Log format for all sources">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_CHOICES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Times shown in">
          <Tabs value={tz} onValueChange={(v) => setTz(v as Tz)}>
            <TabsList>
              <TabsTrigger value="utc">UTC</TabsTrigger>
              <TabsTrigger value="local">Local</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Rows per table">
          <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
            <SelectTrigger className="h-8 w-[5.5rem] text-xs" aria-label="Rows per table">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Custom log_format">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCustomOpen((o) => !o)} aria-expanded={customOpen}>
            {customOpen || usesCustom ? 'Hide editor' : 'Define format'}
          </Button>
        </Field>
      </OptionsBar>

      {(customOpen || usesCustom) && (
        <Panel>
          <PanelHeader title="Custom log_format">
            {CUSTOM_EXAMPLES.map((ex) => (
              <Button
                key={ex.label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomText(ex.value);
                }}
              >
                {ex.label}
              </Button>
            ))}
          </PanelHeader>
          <div className="flex flex-col gap-2 p-3">
            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              spellCheck={false}
              wrap="soft"
              placeholder={'Paste your nginx log_format (…$remote_addr … $status …) or Apache LogFormat ("%h %l %u %t \\"%r\\" %>s %b") here'}
              aria-label="Custom log format"
              className="field-sizing-fixed h-20 resize-y font-mono text-xs leading-5"
            />
            {customResult && !customResult.ok && <ErrorBanner error={customResult.error} />}
            {customFormat && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="success">{customFormat.syntax === 'nginx' ? 'nginx syntax' : 'Apache syntax'}</Badge>
                <span className="text-muted-foreground">captures:</span>
                {customFormat.fields.map((f) => (
                  <Badge key={f} variant="muted" className="font-mono">
                    {f}
                  </Badge>
                ))}
                {customFormat.ignored.length > 0 && <span className="text-muted-foreground">· skipped: {customFormat.ignored.join(', ')}</span>}
                {!usesCustom && <span className="text-muted-foreground">· choose “Custom log_format” as the format to use it</span>}
              </div>
            )}
            <p className="text-2xs text-muted-foreground">
              Variables are matched in order, so the format must describe every field of a line. nginx <code className="font-mono">log_format name '…';</code> statements and Apache <code className="font-mono">LogFormat "…" name</code> lines can be pasted as they are. Understood: remote address, user, time, request, status,
              bytes, referer, user agent, request / upstream time, X-Forwarded-For, host. Other variables are matched and skipped.
            </p>
          </div>
        </Panel>
      )}

      {/* ---------------- results ---------------- */}
      {!anyData && !busy && plan.length > 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No requests could be parsed from this input. Check the format selector, or define a custom log_format.
        </div>
      )}
      {!anyData && !busy && plan.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">Drop an access log, paste some lines or load the sample to see traffic, errors, latency and suspicious requests.</div>
      )}

      {anyData && (
        <div className={cn('flex flex-col gap-3 transition-opacity', dim && 'opacity-60')} aria-busy={dim}>
          {/* filters */}
          <Panel>
            <PanelHeader title="Filters">
              {filterActive && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
              )}
            </PanelHeader>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Status" hint="404, 5xx, 400-499, >=500, !200">
                <Input value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} placeholder="e.g. 5xx, 404" className="font-mono text-xs" aria-label="Status filter" spellCheck={false} />
              </Field>
              <Field label="Client IP" hint="1.2.3.4, 10.0.0.0/8, 192.168.*, !x">
                <Input value={filters.ip} onChange={(e) => setFilter({ ip: e.target.value })} placeholder="e.g. 203.0.113.0/24" className="font-mono text-xs" aria-label="IP filter" spellCheck={false} />
              </Field>
              <Field label="Path (regex)" hint="matches path and query, case-insensitive">
                <Input value={filters.path} onChange={(e) => setFilter({ path: e.target.value })} placeholder="e.g. ^/api/|\.php$" className="font-mono text-xs" aria-label="Path regular expression" spellCheck={false} />
              </Field>
              <Field label="Method" hint="GET, POST …">
                <Input value={filters.method} onChange={(e) => setFilter({ method: e.target.value })} placeholder="e.g. POST" className="font-mono text-xs" aria-label="Method filter" spellCheck={false} />
              </Field>
              <Field label={`From (${tz === 'utc' ? 'UTC' : 'local'})`}>
                <Input type="datetime-local" step={1} value={toInputValue(filters.from, tz)} onChange={(e) => setFilter({ from: fromInputValue(e.target.value, tz) })} className="font-mono text-xs" aria-label="From time" />
              </Field>
              <Field label={`To (${tz === 'utc' ? 'UTC' : 'local'})`}>
                <Input
                  type="datetime-local"
                  step={1}
                  value={toInputValue(filters.to, tz)}
                  onChange={(e) => {
                    const t = fromInputValue(e.target.value, tz);
                    setFilter({ to: t === null ? null : t + 999 });
                  }}
                  className="font-mono text-xs"
                  aria-label="To time"
                />
              </Field>
              <Field label="Traffic">
                <Select value={filters.audience} onValueChange={(v) => setFilter({ audience: v as LogFilters['audience'] })}>
                  <SelectTrigger className="h-8 w-full text-xs" aria-label="Traffic type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All traffic</SelectItem>
                    <SelectItem value="humans">Browsers only</SelectItem>
                    <SelectItem value="bots">Bots, tools and unknown agents</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Client IP from X-Forwarded-For" hint={hasXff ? 'uses the first address when logged' : 'no X-Forwarded-For in this log'}>
                <Switch checked={filters.useXff} onCheckedChange={(c) => setFilter({ useXff: c })} disabled={!hasXff} aria-label="Use X-Forwarded-For as client IP" />
              </Field>
            </div>
            <ErrorBanner error={filterError} className="mx-3 mb-3" />
            <StatBar
              items={[
                a ? `${fmtInt(a.total)} of ${fmtInt(totalRows)} requests match` : 'analysing…',
                filters.security !== '' ? `security: ${filters.security}` : null,
                filters.from !== null || filters.to !== null ? 'time window set' : null,
                analyzing ? `computing ${Math.round(analysisProgress * 100)}%` : null,
              ]}
            />
          </Panel>

          {a && a.total === 0 && <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">No requests match these filters.</div>}

          {a && a.total > 0 && (
            <>
              {/* headline */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</span>
                  <CopyButton value={() => summaryText(a, tz)} label="Copy summary" variant="outline" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <StatCard label="Requests" value={fmtInt(a.total)} sub={a.withTime > 0 ? `${((a.total / Math.max(1, (a.lastTime - a.firstTime) / 1000)) || 0).toFixed(1)} req/s avg` : undefined} />
                  <StatCard label="Unique IPs" value={fmtInt(a.uniqueIps)} />
                  <StatCard label="Transferred" value={formatBytesShort(a.bytes)} sub={`${formatBytesShort(a.bytes / a.total)} per request`} />
                  <StatCard
                    label="Time range"
                    value={a.withTime > 0 ? formatTime(a.firstTime, tz).slice(0, 10) : '–'}
                    sub={a.withTime > 0 ? `${formatTime(a.firstTime, tz).slice(11)} → ${formatTime(a.lastTime, tz).slice(0, 10) === formatTime(a.firstTime, tz).slice(0, 10) ? '' : formatTime(a.lastTime, tz).slice(0, 10) + ' '}${formatTime(a.lastTime, tz).slice(11)}` : 'no timestamps'}
                  />
                  <StatCard
                    label="Errors"
                    value={pct(a.statusClass.c4 + a.statusClass.c5, a.total)}
                    sub={`${fmtInt(a.statusClass.c4)} client · ${fmtInt(a.statusClass.c5)} server`}
                    tone={a.statusClass.c5 > 0 ? 'text-destructive' : a.statusClass.c4 > 0 ? 'text-warning' : 'text-success'}
                  />
                </div>
              </div>

              <Panel>
                <PanelHeader title="Status classes" />
                <div className="p-3">
                  <SegmentBar
                    total={a.total}
                    segments={[
                      { label: '2xx', count: a.statusClass.c2, className: 'bg-success' },
                      { label: '3xx', count: a.statusClass.c3, className: 'bg-primary' },
                      { label: '4xx', count: a.statusClass.c4, className: 'bg-warning' },
                      { label: '5xx', count: a.statusClass.c5, className: 'bg-destructive' },
                      { label: 'other', count: a.statusClass.c1 + a.statusClass.other, className: 'bg-muted-foreground' },
                    ]}
                  />
                </div>
              </Panel>

              {a.histogram && (
                <Panel>
                  <PanelHeader title="Requests over time">
                    {(filters.from !== null || filters.to !== null) && (
                      <Button variant="ghost" size="sm" onClick={() => setFilter({ from: null, to: null })}>
                        <X className="size-3.5" /> Clear time window
                      </Button>
                    )}
                  </PanelHeader>
                  <div className="p-3">
                    <HistogramChart h={a.histogram} tz={tz} onPick={(from, to) => setFilter({ from, to })} />
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" />2xx</span>
                      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />3xx</span>
                      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" />4xx</span>
                      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-destructive" />5xx</span>
                    </div>
                  </div>
                </Panel>
              )}

              {/* top lists */}
              <div className="grid gap-3 lg:grid-cols-2">
                <RankTable
                  title="Top client IPs"
                  keyLabel="Address"
                  rows={a.topIps}
                  columns={countCols(a.total, true)}
                  barValue={(e) => e.count}
                  onPick={(e) => pickIp(e.key)}
                  isPicked={(e) => filters.ip === e.key}
                  hint="Click a row to filter. Addresses behind a proxy show the proxy unless you switch on X-Forwarded-For."
                />
                <RankTable
                  title="Top paths"
                  keyLabel="Path"
                  rows={a.topPaths}
                  columns={countCols(a.total, true)}
                  barValue={(e) => e.count}
                  onPick={(e) => pickPath(e.key)}
                  isPicked={(e) => filters.path === `^${escapeRegex(e.key)}(\\?|$)`}
                  hint="Query strings are stripped when counting."
                />
                <RankTable
                  title="Status codes"
                  keyLabel="Code"
                  rows={a.statusCodes.slice(0, topN)}
                  columns={countCols(a.total)}
                  barValue={(e) => e.count}
                  onPick={(e) => setFilter({ status: filters.status === e.key ? '' : e.key })}
                  isPicked={(e) => filters.status === e.key}
                  keyClass={(e) => statusTone(Number(e.key))}
                />
                <RankTable
                  title="HTTP methods"
                  keyLabel="Method"
                  rows={a.methods}
                  columns={countCols(a.total)}
                  barValue={(e) => e.count}
                  onPick={(e) => setFilter({ method: filters.method === e.key ? '' : e.key })}
                  isPicked={(e) => filters.method.toUpperCase() === e.key}
                />
                <RankTable title="Top user agents" keyLabel="User agent" rows={a.topUas} columns={countCols(a.total)} barValue={(e) => e.count} />
                <RankTable title="Top referrers" keyLabel="Referrer" rows={a.topReferrers} columns={countCols(a.total)} barValue={(e) => e.count} hint="Requests without a referrer are left out." />
                {a.vhosts.length > 1 && <RankTable title="Virtual hosts" rows={a.vhosts} columns={countCols(a.total)} barValue={(e) => e.count} />}
              </div>

              {/* audience */}
              <Panel>
                <PanelHeader title="Bots vs humans">
                  <Button variant={filters.audience === 'humans' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter({ audience: filters.audience === 'humans' ? 'all' : 'humans' })}>
                    Browsers only
                  </Button>
                  <Button variant={filters.audience === 'bots' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter({ audience: filters.audience === 'bots' ? 'all' : 'bots' })}>
                    Bots only
                  </Button>
                </PanelHeader>
                <div className="flex flex-col gap-3 p-3">
                  <SegmentBar
                    total={a.total}
                    segments={[
                      { label: 'Browsers', count: a.audience.human, className: 'bg-primary' },
                      { label: 'Crawlers & bots', count: a.audience.bot, className: 'bg-warning' },
                      { label: 'HTTP tools & scanners', count: a.audience.tool, className: 'bg-destructive' },
                      { label: 'Other agents', count: a.audience.other, className: 'bg-muted-foreground' },
                      { label: 'No user agent', count: a.audience.empty, className: 'bg-border' },
                    ]}
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <RankTable title="Top bots & tools" keyLabel="Name" rows={a.topBots} columns={countCols(a.total)} barValue={(e) => e.count} />
                    <RankTable title="Top browsers" keyLabel="Browser" rows={a.topBrowsers} columns={countCols(a.total)} barValue={(e) => e.count} />
                  </div>
                  <p className="text-2xs text-muted-foreground">Classified from the User-Agent text only. Anyone can fake it, so treat this as a rough guide.</p>
                </div>
              </Panel>

              {/* latency */}
              {(a.latency || a.upstream) && (
                <Panel>
                  <PanelHeader title="Response time" />
                  <div className="flex flex-col gap-4 p-3">
                    {a.latency && <LatencyCard title="Request time" stats={a.latency} />}
                    {a.upstream && <LatencyCard title="Upstream response time" stats={a.upstream} />}
                    <p className="text-2xs text-muted-foreground">Percentiles use linear interpolation between closest ranks. Times are stored with 32-bit precision.</p>
                  </div>
                </Panel>
              )}
              {a.slowestPaths.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <RankTable
                    title="Slowest paths (average)"
                    keyLabel="Path"
                    rows={a.slowestPaths}
                    columns={[
                      { label: 'Average', cell: (e) => formatSeconds(e.extra ?? NaN), className: 'min-w-[4.5rem]' },
                      { label: 'Max', cell: (e) => formatSeconds(e.extra2 ?? NaN), className: 'min-w-[4.5rem]' },
                      { label: 'Requests', cell: (e) => `${fmtInt(e.count)}×`, className: 'min-w-[3rem]' },
                    ]}
                    barValue={(e) => e.extra ?? 0}
                    onPick={(e) => pickPath(e.key)}
                    isPicked={(e) => filters.path === `^${escapeRegex(e.key)}(\\?|$)`}
                    hint="Paths with at least two timed requests."
                  />
                  <RankTable
                    title="Most bytes served by path"
                    keyLabel="Path"
                    rows={a.topBytesPaths}
                    columns={[
                      { label: 'Bytes', cell: (e) => formatBytesShort(e.bytes ?? 0), className: 'min-w-[4.5rem]' },
                      { label: 'Requests', cell: (e) => `${fmtInt(e.count)}×`, className: 'min-w-[3rem]' },
                    ]}
                    barValue={(e) => e.bytes ?? 0}
                    onPick={(e) => pickPath(e.key)}
                    isPicked={(e) => filters.path === `^${escapeRegex(e.key)}(\\?|$)`}
                  />
                </div>
              )}
              {(a.slowestRequests.length > 0 || a.largestRequests.length > 0) && (
                <div className="grid gap-3">
                  {a.slowestRequests.length > 0 && (
                    <Panel>
                      <PanelHeader title="Slowest requests" />
                      <RequestsTable rows={a.slowestRequests} tz={tz} files={fileStats} highlight="rt" />
                    </Panel>
                  )}
                  {a.largestRequests.length > 0 && (
                    <Panel>
                      <PanelHeader title="Largest responses" />
                      <RequestsTable rows={a.largestRequests} tz={tz} files={fileStats} highlight="bytes" />
                    </Panel>
                  )}
                </div>
              )}

              {/* errors */}
              {(a.errorPaths4xx.length > 0 || a.errorPaths5xx.length > 0) && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {a.errorPaths4xx.length > 0 && (
                    <RankTable
                      title="Client errors (4xx) by path"
                      keyLabel="Status and path"
                      rows={a.errorPaths4xx}
                      columns={[{ label: 'Requests', cell: (e) => fmtInt(e.count), className: 'min-w-[3.5rem]' }]}
                      barValue={(e) => e.count}
                      onPick={(e) => {
                        const [st, ...rest] = e.key.split(' ');
                        setFilter({ status: st ?? '', path: `^${escapeRegex(rest.join(' '))}(\\?|$)` });
                      }}
                      keyClass={() => 'text-warning'}
                    />
                  )}
                  {a.errorPaths5xx.length > 0 && (
                    <RankTable
                      title="Server errors (5xx) by path"
                      keyLabel="Status and path"
                      rows={a.errorPaths5xx}
                      columns={[{ label: 'Requests', cell: (e) => fmtInt(e.count), className: 'min-w-[3.5rem]' }]}
                      barValue={(e) => e.count}
                      onPick={(e) => {
                        const [st, ...rest] = e.key.split(' ');
                        setFilter({ status: st ?? '', path: `^${escapeRegex(rest.join(' '))}(\\?|$)` });
                      }}
                      keyClass={() => 'text-destructive'}
                    />
                  )}
                </div>
              )}
              {(a.samples4xx.length > 0 || a.samples5xx.length > 0) && (
                <div className="grid gap-3">
                  {a.samples5xx.length > 0 && (
                    <Panel>
                      <PanelHeader title="Sample 5xx requests (first 10)" />
                      <RequestsTable rows={a.samples5xx} tz={tz} files={fileStats} highlight="rt" />
                    </Panel>
                  )}
                  {a.samples4xx.length > 0 && (
                    <Panel>
                      <PanelHeader title="Sample 4xx requests (first 10)" />
                      <RequestsTable rows={a.samples4xx} tz={tz} files={fileStats} />
                    </Panel>
                  )}
                </div>
              )}

              <SecurityPanel a={a} tz={tz} current={filters.security} onFilter={(id) => setFilter({ security: id })} onPickIp={pickIp} />

              {/* matching rows + export */}
              <Panel>
                <PanelHeader title={`Matching requests (${fmtInt(a.total)})`}>
                  <DownloadButton data={exportTo('csv')} filename="filtered-requests.csv" mime="text/csv" label="CSV" variant="ghost" disabled={busy || !active} />
                  <DownloadButton data={exportTo('json')} filename="filtered-requests.json" mime="application/json" label="JSON" variant="ghost" disabled={busy || !active} />
                  <DownloadButton data={exportTo('ndjson')} filename="filtered-requests.ndjson" mime="application/x-ndjson" label="NDJSON" variant="ghost" disabled={busy || !active} />
                </PanelHeader>
                <RequestsTable rows={rows.rows} tz={tz} files={fileStats} />
                <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-2">
                  <span className="font-mono text-2xs text-muted-foreground">
                    showing {fmtInt(rows.rows.length)} of {fmtInt(a.total)}
                  </span>
                  {rows.more && (
                    <Button variant="outline" size="sm" onClick={showMoreRows}>
                      Show {PAGE * 2} more
                    </Button>
                  )}
                  <span className="ml-auto text-2xs text-muted-foreground">Exports contain every matching request ({fmtInt(a.total)}), not just the rows shown. Times are exported as ISO-8601 UTC.</span>
                </div>
              </Panel>
            </>
          )}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Everything runs in your browser: files are read as a stream and never uploaded. Up to {fmtInt(3_000_000)} requests are kept in memory (about 100 bytes each plus the distinct strings); lines over 32 KB are skipped. Supported: nginx and Apache common / combined / vhost / timing
        formats, custom log_format, JSON lines, logfmt and AWS ALB logs. Status classes, rankings and percentiles reflect the current filters.
      </p>
    </div>
  );
}
