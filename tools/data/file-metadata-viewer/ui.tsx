'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FileSearch,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';

import { Panel, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  HASH_AUTO_LIMIT,
  allSectionsText,
  analyzeFile,
  fileRows,
  hashBlob,
  hexLines,
  reportToJson,
  sectionToText,
  withHashes,
  type Cat,
  type Finding,
  type Preview,
  type Report,
  type Row,
} from './logic';

interface Entry {
  id: number;
  file: File;
  status: 'pending' | 'working' | 'done' | 'error';
  report: Report | null;
  error: string | null;
  hash: { state: 'idle' | 'running' | 'error'; progress: number; error?: string };
}

const MAX_FILES = 60;

const CAT_ICON: Record<Cat, React.ComponentType<{ className?: string }>> = {
  gps: MapPin,
  person: User,
  company: Building2,
  device: Camera,
  software: Cpu,
  editing: Clock,
  comments: MessageSquare,
  thumbnail: ImageIcon,
  filename: FolderOpen,
  other: Info,
};

const DISPLAYABLE = new Set(['jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif']);

async function pdfFallback(bytes: Uint8Array): Promise<{ info: string; pages: number | null }> {
  const mod = await import('@/lib/wasm/pdf');
  const info = await mod.readMetadata(bytes.slice());
  let pages: number | null = null;
  try {
    pages = await mod.pageCount(bytes.slice());
  } catch {
    pages = null;
  }
  return { info, pages };
}

function jsonText(r: Report): string {
  return JSON.stringify(reportToJson(r), null, 2);
}

// ---------------------------------------------------------------------------
// small building blocks
// ---------------------------------------------------------------------------

function BlobImg({ data, mime, alt, className }: { data: Uint8Array; mime: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([data as unknown as BlobPart], { type: mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, mime]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}

function FileImg({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setFailed(false);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} onError={() => setFailed(true)} className="max-h-40 max-w-full rounded border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:12px_12px] object-contain" />
  );
}

function RowView({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const { k, v } = row;
  const long = v.length > 300 || v.split('\n').length > 6;
  const shown = long && !open ? `${v.split('\n').slice(0, 6).join('\n').slice(0, 300)}…` : v;
  const isLink = /^https:\/\/www\.openstreetmap\.org\/\?mlat=/.test(v);
  const isMismatch = v.startsWith('MISMATCH:');
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 px-3 py-1.5 sm:grid-cols-[minmax(8rem,13rem)_1fr]">
      <div className="break-words text-xs font-medium text-muted-foreground">{k}</div>
      <div className={cn('min-w-0 whitespace-pre-wrap break-words font-mono text-xs', isMismatch && 'font-semibold text-amber-600 dark:text-amber-400')}>
        {isLink ? (
          <a href={v} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            {v}
          </a>
        ) : (
          shown
        )}
        {long && (
          <button type="button" onClick={() => setOpen(!open)} className="ml-2 font-sans text-2xs text-primary hover:underline">
            {open ? 'show less' : `show all (${v.length.toLocaleString('en-US')} chars)`}
          </button>
        )}
      </div>
    </div>
  );
}

interface Signal {
  n: number;
  open: boolean;
}

function SectionBlock({
  id,
  title,
  rows,
  note,
  raw,
  defaultOpen,
  signal,
  extra,
}: {
  id: string;
  title: string;
  rows: Row[];
  note?: string;
  raw?: { label: string; text: string };
  defaultOpen: boolean;
  signal: Signal;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rawOpen, setRawOpen] = useState(false);
  useEffect(() => {
    if (signal.n > 0) setOpen(signal.open);
  }, [signal]);
  return (
    <section data-section={id} className="border-b last:border-b-0">
      <div className="flex items-center gap-1 bg-muted/40 pr-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-xs font-semibold">{title}</span>
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">{rows.length}</span>
        </button>
        <CopyButton value={() => sectionToText({ title, rows })} label={`Copy ${title}`} size="icon-sm" />
      </div>
      {open && (
        <div>
          {note && <p className="px-3 pt-2 text-2xs text-muted-foreground">{note}</p>}
          {extra}
          <div className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <RowView key={`${r.k}-${i}`} row={r} />
            ))}
          </div>
          {raw && (
            <div className="border-t px-3 py-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setRawOpen(!rawOpen)} className="text-2xs font-medium text-primary hover:underline">
                  {rawOpen ? 'Hide' : 'Show'} {raw.label.toLowerCase()} ({raw.text.length.toLocaleString('en-US')} chars)
                </button>
                <CopyButton value={raw.text} size="icon-sm" label={`Copy ${raw.label}`} />
              </div>
              {rawOpen && <pre className="mt-2 max-h-72 overflow-auto rounded border bg-muted/30 p-2 font-mono text-2xs leading-relaxed">{raw.text}</pre>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Sensitive({ report }: { report: Report }) {
  const [all, setAll] = useState(false);
  const findings = report.findings;
  const counts = useMemo(() => {
    const m = new Map<Cat, number>();
    for (const f of findings) m.set(f.cat, (m.get(f.cat) ?? 0) + 1);
    return m;
  }, [findings]);
  const ordered = useMemo(() => {
    const out: Finding[] = [];
    for (const c of CATEGORY_ORDER) for (const f of findings) if (f.cat === c) out.push(f);
    return out;
  }, [findings]);
  const isImage = report.detected?.kind === 'image' && ['jpeg', 'png', 'webp', 'tiff', 'heic', 'avif', 'gif'].includes(report.detected.id);
  if (findings.length === 0) {
    return (
      <div className="flex items-start gap-2 border-b bg-success/5 px-3 py-2.5 text-xs">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <div>
          <span className="font-semibold">No obvious personal metadata found.</span>{' '}
          <span className="text-muted-foreground">No GPS position, author, device serial, editing history or comments were detected in the parts of this file that were read.</span>
        </div>
      </div>
    );
  }
  const shown = all ? ordered : ordered.slice(0, 10);
  return (
    <div data-testid="sensitive" className="border-b bg-amber-500/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pt-2.5">
        <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold">Sensitive metadata found ({findings.length})</h3>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => {
            const Icon = CAT_ICON[c];
            return (
              <Badge key={c} variant="outline" className="gap-1 border-amber-500/40 font-normal">
                <Icon className="size-3" />
                {CATEGORY_LABEL[c]} · {counts.get(c)}
              </Badge>
            );
          })}
        </div>
      </div>
      <ul className="divide-y divide-amber-500/15 px-1 pb-1 pt-1.5">
        {shown.map((f, i) => {
          const Icon = CAT_ICON[f.cat];
          return (
            <li key={`${f.cat}-${f.label}-${i}`} className="grid grid-cols-[1.25rem_1fr] gap-x-2 px-2 py-1.5 text-xs sm:grid-cols-[1.25rem_minmax(8rem,16rem)_1fr]">
              <Icon className="mt-0.5 size-3.5 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0 break-words font-medium">{f.label}</span>
              <span className="col-span-2 min-w-0 break-words font-mono sm:col-span-1">{f.value.length > 240 ? `${f.value.slice(0, 240)}…` : f.value}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2.5 text-2xs text-muted-foreground">
        {ordered.length > 10 && (
          <button type="button" onClick={() => setAll(!all)} className="font-medium text-primary hover:underline">
            {all ? 'Show fewer' : `Show all ${ordered.length}`}
          </button>
        )}
        {isImage && (
          <span>
            Remove it with the{' '}
            <Link className="text-primary underline underline-offset-2" href="/tools/image-metadata-remover/">
              Image Metadata Remover
            </Link>
            .
          </span>
        )}
        {!isImage && (
          <span>
            Tip: sharing a copy exported from the original app (or a screenshot) usually drops this data. Raw bytes:{' '}
            <Link className="text-primary underline underline-offset-2" href="/tools/hex-viewer-file-type-detector/">
              Hex Viewer
            </Link>
            .
          </span>
        )}
      </div>
    </div>
  );
}

function PreviewStrip({ file, report }: { file: File; report: Report }) {
  const det = report.detected;
  const showFile = det !== null && DISPLAYABLE.has(det.id) && file.size < 60 * 1024 * 1024;
  const previews: Preview[] = report.previews;
  if (!showFile && previews.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-4 border-b px-3 py-3">
      {showFile && (
        <figure className="space-y-1">
          <FileImg file={file} alt={`Preview of ${file.name}`} />
          <figcaption className="text-2xs text-muted-foreground">The file itself</figcaption>
        </figure>
      )}
      {previews.map((p, i) => (
        <figure key={`${p.label}-${i}`} className="space-y-1">
          <BlobImg data={p.data} mime={p.mime} alt={p.label} className="max-h-32 max-w-[14rem] rounded border object-contain" />
          <figcaption className="max-w-[18rem] text-2xs text-muted-foreground">
            {p.label} · {formatBytes(p.data.length)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function HexPeek({ hex, signal }: { hex: string; signal: Signal }) {
  const lines = useMemo(() => hexLines(hex), [hex]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (signal.n > 0) setOpen(signal.open);
  }, [signal]);
  if (lines.length === 0) return null;
  return (
    <section className="border-b last:border-b-0" data-section="hex">
      <div className="flex items-center gap-1 bg-muted/40 pr-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left">
          {open ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-xs font-semibold">First 64 bytes (hex)</span>
        </button>
        <CopyButton value={lines.join('\n')} label="Copy hex" size="icon-sm" />
      </div>
      {open && <pre className="overflow-x-auto px-3 py-2 font-mono text-2xs leading-relaxed" data-testid="hexpeek">{lines.join('\n')}</pre>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// card for one file
// ---------------------------------------------------------------------------

function FileCard({ entry, onHash, onRemove }: { entry: Entry; onHash: (id: number) => void; onRemove: (id: number) => void }) {
  const [signal, setSignal] = useState<Signal>({ n: 0, open: true });
  const report = entry.report;
  const rows = useMemo(() => (report ? fileRows(report) : []), [report]);

  if (entry.status === 'pending' || entry.status === 'working' || !report) {
    return (
      <Panel>
        <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
          {entry.status === 'error' ? (
            <ErrorBanner error={`Could not analyse ${entry.file.name}: ${entry.error ?? 'unknown error'}`} className="w-full" />
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" />
              {entry.status === 'pending' ? 'Waiting…' : `Reading ${entry.file.name}…`}
            </>
          )}
        </div>
      </Panel>
    );
  }

  const hashExtra =
    !report.hashes ? (
      <div className="px-3 pt-2">
        {entry.hash.state === 'running' ? (
          <div className="flex items-center gap-2 text-2xs text-muted-foreground" role="status">
            <Loader2 className="size-3 animate-spin" />
            Hashing… {Math.round(entry.hash.progress * 100)}%
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary" style={{ width: `${Math.round(entry.hash.progress * 100)}%` }} />
            </span>
          </div>
        ) : entry.hash.state === 'error' ? (
          <p className="text-2xs text-destructive">Hashing failed: {entry.hash.error}</p>
        ) : entry.file.size > HASH_AUTO_LIMIT ? (
          <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            <Button size="sm" variant="secondary" onClick={() => onHash(entry.id)}>
              Compute SHA-256 &amp; SHA-1
            </Button>
            Large file ({formatBytes(entry.file.size)}): hashing reads the whole file in 8 MiB slices, so it is optional.
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground">Computing hashes…</p>
        )}
      </div>
    ) : null;

  const warn = report.extensionWarning;
  return (
    <Panel data-testid="file-card" data-file={entry.file.name}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/40 px-3 py-2.5">
        <FileSearch className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={entry.file.name}>
            {entry.file.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-2xs text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              {report.detected ? report.detected.name : report.file.size === 0 ? 'Empty file' : 'Unknown type'}
            </Badge>
            <span className="font-mono">{formatBytes(report.file.size)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => setSignal((s) => ({ n: s.n + 1, open: true }))}>
            Expand all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSignal((s) => ({ n: s.n + 1, open: false }))}>
            Collapse all
          </Button>
          <CopyButton value={() => jsonText(report)} label="Copy all as JSON" />
          <DownloadButton data={() => jsonText(report)} filename={`${entry.file.name}.metadata.json`} mime="application/json" label="Download JSON" />
          <Button size="icon-sm" variant="ghost" onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.file.name}`} title="Remove">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {warn && (
        <div role="alert" className="flex items-start gap-2 border-b bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <span className="font-semibold">Extension mismatch.</span> {warn}
          </span>
        </div>
      )}

      <Sensitive report={report} />
      <PreviewStrip file={entry.file} report={report} />

      {(report.errors.length > 0 || report.notes.length > 0) && (
        <div className="space-y-1 border-b px-3 py-2">
          {report.errors.map((e, i) => (
            <p key={`e${i}`} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span className="break-words">{e}</span>
            </p>
          ))}
          {report.notes.map((n, i) => (
            <p key={`n${i}`} className="flex items-start gap-1.5 text-2xs text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              <span className="break-words">{n}</span>
            </p>
          ))}
        </div>
      )}

      <div>
        <SectionBlock id="file" title="File" rows={rows} defaultOpen signal={signal} extra={hashExtra} />
        {report.sections.map((s, i) => (
          <SectionBlock key={s.id} id={s.id} title={s.title} rows={s.rows} note={s.note} raw={s.raw} defaultOpen={!s.collapsed && i < 12} signal={signal} />
        ))}
        <HexPeek hex={report.head64} signal={signal} />
      </div>
      <StatBar
        items={[
          report.detected ? report.detected.name : 'unknown type',
          `${report.sections.length + 1} section${report.sections.length === 0 ? '' : 's'}`,
          `${report.findings.length} sensitive item${report.findings.length === 1 ? '' : 's'}`,
          report.errors.length > 0 && `${report.errors.length} parse warning${report.errors.length === 1 ? '' : 's'}`,
        ]}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// main component
// ---------------------------------------------------------------------------

export default function FileMetadataViewerTool() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const nextId = useRef(1);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = useCallback((id: number, p: Partial<Entry> | ((e: Entry) => Partial<Entry>)) => {
    if (!alive.current) return;
    const next = entriesRef.current.map((e) => (e.id === id ? { ...e, ...(typeof p === 'function' ? p(e) : p) } : e));
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const runHash = useCallback(
    async (id: number, file: File): Promise<void> => {
      patch(id, { hash: { state: 'running', progress: 0 } });
      try {
        const h = await hashBlob(file, { onProgress: (f) => patch(id, { hash: { state: 'running', progress: f } }) });
        patch(id, (e) => ({ report: e.report ? withHashes(e.report, h) : e.report, hash: { state: 'idle', progress: 1 } }));
      } catch (e) {
        patch(id, { hash: { state: 'error', progress: 0, error: e instanceof Error ? e.message : String(e) } });
      }
    },
    [patch]
  );

  // sequential processing queue keeps the page responsive with many files
  useEffect(() => {
    if (busy.current) return;
    const next = entries.find((e) => e.status === 'pending');
    if (!next) return;
    busy.current = true;
    patch(next.id, { status: 'working' });
    void (async () => {
      try {
        const report = await analyzeFile(next.file, { pdfFallback });
        patch(next.id, { status: 'done', report });
        if (next.file.size <= HASH_AUTO_LIMIT) await runHash(next.id, next.file);
      } catch (e) {
        patch(next.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
      } finally {
        busy.current = false;
        // wake the effect for the next queued file
        if (alive.current) setEntries([...entriesRef.current]);
      }
    })();
  }, [entries, patch, runHash]);

  const onFiles = useCallback((files: File[]) => {
    const list = entriesRef.current;
    const room = MAX_FILES - list.length;
    const seen = new Set(list.map((e) => `${e.file.name}|${e.file.size}|${e.file.lastModified}`));
    const fresh: Entry[] = [];
    let dupes = 0;
    let overflow = 0;
    for (const f of files) {
      const key = `${f.name}|${f.size}|${f.lastModified}`;
      if (seen.has(key)) {
        dupes++;
        continue;
      }
      if (fresh.length >= Math.max(0, room)) {
        overflow++;
        continue;
      }
      seen.add(key);
      fresh.push({ id: nextId.current++, file: f, status: 'pending', report: null, error: null, hash: { state: 'idle', progress: 0 } });
    }
    const msgs: string[] = [];
    if (overflow > 0) msgs.push(`Only ${MAX_FILES} files can be open at once; ${overflow} were skipped.`);
    if (dupes > 0) msgs.push(`${dupes} file${dupes === 1 ? ' is' : 's are'} already open and ${dupes === 1 ? 'was' : 'were'} skipped.`);
    setNotice(msgs.length > 0 ? msgs.join(' ') : null);
    const first = fresh[0];
    if (first) {
      const next = [...list, ...fresh];
      entriesRef.current = next;
      setEntries(next);
      setActiveId((cur) => cur ?? first.id);
    }
  }, []);

  const remove = useCallback((id: number) => {
    const list = entriesRef.current;
    const idx = list.findIndex((e) => e.id === id);
    const out = list.filter((e) => e.id !== id);
    entriesRef.current = out;
    setEntries(out);
    setActiveId((cur) => (cur === id ? (out[Math.min(idx, out.length - 1)]?.id ?? null) : cur));
  }, []);

  const clear = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
    setActiveId(null);
    setNotice(null);
  }, []);

  const active = entries.find((e) => e.id === activeId) ?? entries[0] ?? null;

  const allJson = useCallback((): string => {
    const o: Record<string, unknown> = {};
    for (const e of entries) {
      if (!e.report) continue;
      let key = e.file.name;
      let n = 2;
      while (key in o) key = `${e.file.name} (${n++})`;
      o[key] = reportToJson(e.report);
    }
    return JSON.stringify(o, null, 2);
  }, [entries]);

  return (
    <div className="space-y-4">
      <FileDropzone
        multiple
        onFiles={onFiles}
        label={entries.length > 0 ? 'Drop more files, or click to add' : 'Drop one or more files here'}
        hint="Any file type · read locally in your browser · nothing is uploaded"
        compact={entries.length > 0}
      />
      {notice && <ErrorBanner error={notice} />}

      {entries.length === 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">What it reads</p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <li><b className="text-foreground">Photos:</b> JPEG, PNG/APNG, WebP, GIF, TIFF/RAW, HEIC, AVIF, BMP, ICO, PSD — EXIF, GPS, XMP, IPTC, ICC, thumbnails.</li>
            <li><b className="text-foreground">Documents:</b> PDF, DOCX/XLSX/PPTX, ODT/ODS/ODP, EPUB, legacy DOC/XLS/PPT — authors, editing time, comments, tracked changes.</li>
            <li><b className="text-foreground">Audio:</b> MP3 (ID3v1/v2), FLAC, Ogg Vorbis/Opus, WAV (INFO, bext), AIFF, M4A, AAC — tags and cover art.</li>
            <li><b className="text-foreground">Video:</b> MP4, MOV, 3GP, MKV, WebM — codecs, tracks, creation dates, GPS location atoms.</li>
            <li><b className="text-foreground">Fonts:</b> TTF, OTF, WOFF — names, designer, licence, embedding permissions. <b className="text-foreground">Archives:</b> ZIP, GZIP, TAR, 7z, RAR.</li>
            <li><b className="text-foreground">Programs &amp; data:</b> ELF, PE/EXE, Mach-O, WASM, Java class, SQLite, SVG, HTML, XML/GPX, JSON, CSV.</li>
          </ul>
          <p>
            Every file also gets its real type from magic bytes (with an extension-mismatch warning), SHA-256 and SHA-1, entropy, text encoding and a hex peek. Limits: WOFF2 is Brotli-compressed
            (header only), 7z/RAR contents and encrypted PDFs are not decoded.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Open files" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {entries.map((e) => {
                const isActive = active?.id === e.id;
                const findings = e.report?.findings.length ?? 0;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex max-w-full items-center overflow-hidden rounded-md border text-xs',
                      isActive ? 'border-primary bg-accent' : 'bg-card hover:bg-accent/50'
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveId(e.id)}
                      className="flex min-w-0 max-w-[16rem] items-center gap-1.5 px-2.5 py-1.5"
                      title={e.file.name}
                    >
                      {e.status === 'working' || e.status === 'pending' ? (
                        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
                      ) : e.report?.extensionWarning ? (
                        <AlertTriangle className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : findings > 0 ? (
                        <ShieldAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <ShieldCheck className="size-3 shrink-0 text-success" />
                      )}
                      <span className="truncate">{e.file.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      aria-label={`Remove ${e.file.name}`}
                      className="border-l px-1.5 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-0.5">
              {entries.length > 1 && <DownloadButton data={allJson} filename="file-metadata.json" mime="application/json" label="Download JSON (all)" disabled={!entries.some((e) => e.report)} />}
              {entries.length > 1 && <CopyButton value={allJson} label="Copy JSON (all)" disabled={!entries.some((e) => e.report)} />}
              <Button size="sm" variant="ghost" onClick={clear}>
                <Trash2 className="size-3.5" /> Clear
              </Button>
            </div>
          </div>
          {active && <FileCard key={active.id} entry={active} onHash={(id) => void runHash(id, active.file)} onRemove={remove} />}
          {active?.report && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-2xs text-muted-foreground">
                Only headers and metadata blocks are read, never uploaded. WOFF2 is Brotli-compressed (header only); 7z/RAR contents and encrypted PDF strings are not decoded. A clean result is not a guarantee: steganography and
                vendor-specific MakerNotes are not analysed.
              </p>
              <CopyButton value={() => allSectionsText(active.report as Report)} label="Copy everything as text" variant="outline" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
