'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  File as FileIcon,
  FileArchive,
  Folder,
  FolderOpen,
  FolderPlus,
  Link2,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { zip } from 'fflate';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  ArchiveError,
  MAX_BATCH_BYTES,
  buildTree,
  buildZipSync,
  crcHex,
  dedupePaths,
  downloadName,
  extractEntry,
  flattenTree,
  formatDate,
  formatFormat,
  formatRatio,
  hexDump,
  imageMime,
  normalizeEntryPath,
  parseArchive,
  prepareZip,
  previewText,
  safePath,
  summarize,
  type ArchiveEntry,
  type NewZipFile,
  type ParsedArchive,
  type TreeNode,
  type ZipLevel,
} from './logic';

const MAX_INPUT_BYTES = 1024 * 1024 * 1024;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toBlob(data: Uint8Array, type = 'application/octet-stream'): Blob {
  return new Blob([data as unknown as BlobPart], { type });
}

function zipAsync(files: NewZipFile[], level: ZipLevel, store: boolean): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(prepareZip(files, level, store), { level }, (err, out) => {
      if (err) reject(err);
      else resolve(out);
    });
  });
}

function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info'; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          : 'border-border bg-muted/40 text-muted-foreground'
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fixed-row virtual list (sticky header inside the scroller)          */
/* ------------------------------------------------------------------ */

function VirtualList({
  count,
  rowHeight,
  height,
  header,
  minWidth,
  resetKey,
  renderRow,
}: {
  count: number;
  rowHeight: number;
  height: number;
  header?: ReactNode;
  minWidth?: number;
  resetKey?: string;
  renderRow: (index: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    setTop(0);
  }, [resetKey]);
  const start = Math.max(0, Math.floor(top / rowHeight) - 8);
  const end = Math.min(count, Math.ceil((top + height) / rowHeight) + 8);
  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) rows.push(renderRow(i));
  return (
    <div ref={ref} style={{ maxHeight: height }} className="overflow-auto" onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div style={{ minWidth }}>
        {header}
        <div style={{ height: count * rowHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: start * rowHeight, left: 0, right: 0 }}>{rows}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Extract / view                                                      */
/* ------------------------------------------------------------------ */

type PreviewState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'text'; text: string; truncated: boolean; crcOk: boolean | null }
  | { kind: 'image'; url: string; crcOk: boolean | null }
  | { kind: 'binary'; dump: string; crcOk: boolean | null };

interface DisplayRow {
  key: string;
  depth: number;
  node: TreeNode | null;
  entry: ArchiveEntry | null;
  isDir: boolean;
  label: string;
}

const COLS = 'grid grid-cols-[1.75rem_minmax(14rem,1fr)_5.25rem_5.25rem_4rem_8.5rem_5.5rem_4.5rem] items-center gap-x-2';
const ROW_H = 30;

function stripExt(name: string): string {
  return name.replace(/\.(tar\.gz|tgz|tar|gz|zip|jar|war|apk|aab|docx|xlsx|pptx|odt|ods|odp|epub|vsix|xpi|crx)$/i, '') || 'archive';
}

function makeSampleZip(): Uint8Array {
  const enc = new TextEncoder();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" rx="10" fill="#4f46e5"/><text x="80" y="55" font-family="sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#fff">ZIP</text></svg>';
  const now = Date.now();
  const f = (path: string, text: string, ago = 0): NewZipFile => ({ path, data: enc.encode(text), mtime: now - ago * 86_400_000 });
  return buildZipSync(
    [
      f('README.md', '# Sample project\n\nThis archive was generated in your browser.\n\n- `src/` holds the code\n- `data/` holds a CSV\n', 3),
      f('src/index.ts', "import { add } from './utils/math';\n\nconsole.log(add(2, 3));\n", 2),
      f('src/utils/math.ts', 'export const add = (a: number, b: number) => a + b;\nexport const mul = (a: number, b: number) => a * b;\n', 2),
      f('data/people.csv', 'id,name,city\n1,Ada,London\n2,Linus,Helsinki\n3,Grace,New York\n', 10),
      f('assets/logo.svg', svg, 30),
      f('docs/notes.txt', 'Highly compressible text. '.repeat(400), 1),
    ],
    6,
    true
  );
}

function ExtractTab() {
  const [arc, setArc] = useState<ParsedArchive | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'table'>('tree');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [active, setActive] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'none' });
  const urlRef = useRef<string | null>(null);

  const clearUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);
  useEffect(() => clearUrl, [clearUrl]);

  const loadSeq = useRef(0);
  const load = useCallback(
    async (name: string, data: Uint8Array, autoOpen?: string) => {
      const seq = ++loadSeq.current;
      setError(null);
      setNotice(null);
      setBusy('Reading archive…');
      await tick();
      if (seq !== loadSeq.current) return;
      try {
        const a = parseArchive(data, name);
        clearUrl();
        setArc(a);
        setFileName(name);
        setSelected(new Set());
        setActive(autoOpen ? (a.entries.find((e) => e.path === autoOpen)?.index ?? null) : null);
        setPreview({ kind: 'none' });
        setFilter('');
        // expand the first level by default
        const first = new Set<string>();
        for (const e of a.entries) {
          const slash = e.path.indexOf('/');
          if (slash > 0 && first.size < 20) first.add(e.path.slice(0, slash));
        }
        setExpanded(first);
      } catch (e) {
        setArc(null);
        setError(errMsg(e));
      } finally {
        if (seq === loadSeq.current) setBusy(null);
      }
    },
    [clearUrl]
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      if (f.size > MAX_INPUT_BYTES) {
        setError(`File is ${formatBytes(f.size)} - the limit is ${formatBytes(MAX_INPUT_BYTES)} in the browser.`);
        return;
      }
      setBusy('Loading file…');
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        await load(f.name, buf);
      } catch (e) {
        setBusy(null);
        setError(errMsg(e));
      }
    },
    [load]
  );

  const loadSample = useCallback(() => {
    void load('sample-project.zip', makeSampleZip(), 'README.md');
  }, [load]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const tree = useMemo(() => (arc ? buildTree(arc.entries) : null), [arc]);
  const summary = useMemo(() => (arc ? summarize(arc) : null), [arc]);

  const filesUnder = useRef<Map<string, number[]>>(new Map());
  useEffect(() => {
    filesUnder.current = new Map();
  }, [arc]);
  const collect = useCallback((n: TreeNode): number[] => {
    const hit = filesUnder.current.get(n.path);
    if (hit) return hit;
    const out: number[] = [];
    const walk = (x: TreeNode) => {
      if (!x.isDir) {
        if (x.entry) out.push(x.entry.index);
      } else for (const c of x.children) walk(c);
    };
    walk(n);
    filesUnder.current.set(n.path, out);
    return out;
  }, []);

  const q = filter.trim().toLowerCase();
  const rows = useMemo<DisplayRow[]>(() => {
    if (!arc || !tree) return [];
    if (view === 'tree') {
      return flattenTree(tree, expanded, q).map((r) => ({
        key: `${r.node.isDir ? 'd' : 'f'}:${r.node.path}`,
        depth: r.depth,
        node: r.node,
        entry: r.node.entry,
        isDir: r.node.isDir,
        label: r.node.name,
      }));
    }
    const list = q ? arc.entries.filter((e) => e.path.toLowerCase().includes(q)) : arc.entries;
    return list.map((e) => ({ key: `e:${e.index}`, depth: 0, node: null, entry: e, isDir: e.isDir, label: e.path }));
  }, [arc, tree, view, expanded, q]);

  const visibleFiles = useMemo(() => {
    if (!arc) return [] as ArchiveEntry[];
    return arc.entries.filter((e) => !e.isDir && (!q || e.path.toLowerCase().includes(q)));
  }, [arc, q]);

  const toggleSelect = useCallback(
    (ids: number[], on: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const i of ids) {
          if (on) next.add(i);
          else next.delete(i);
        }
        return next;
      });
    },
    []
  );

  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((e) => selected.has(e.index));

  /* ---- preview ---- */
  useEffect(() => {
    clearUrl();
    if (!arc || active === null) {
      setPreview({ kind: 'none' });
      return;
    }
    const e = arc.entries[active];
    if (!e) return;
    let cancelled = false;
    setPreview({ kind: 'loading' });
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const r = extractEntry(arc, e);
        if (cancelled) return;
        const img = imageMime(e.path);
        if (img && r.data.length > 0) {
          const url = URL.createObjectURL(toBlob(r.data, img));
          urlRef.current = url;
          setPreview({ kind: 'image', url, crcOk: r.crcOk });
          return;
        }
        const p = previewText(r.data);
        if (p.kind === 'text') setPreview({ kind: 'text', text: p.text, truncated: p.truncated, crcOk: r.crcOk });
        else setPreview({ kind: 'binary', dump: hexDump(r.data, 256), crcOk: r.crcOk });
      } catch (err) {
        setPreview({ kind: 'error', message: errMsg(err) });
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [arc, active, clearUrl]);

  const downloadOne = useCallback(
    async (e: ArchiveEntry) => {
      if (!arc) return;
      setError(null);
      setBusy(`Inflating ${e.path}…`);
      await tick();
      try {
        const r = extractEntry(arc, e);
        triggerDownload(toBlob(r.data), downloadName(e.path));
      } catch (err) {
        setError(errMsg(err));
      } finally {
        setBusy(null);
      }
    },
    [arc]
  );

  const exportEntries = useCallback(
    async (list: ArchiveEntry[], outName: string) => {
      if (!arc) return;
      setError(null);
      setNotice(null);
      const total = list.reduce((s, e) => s + (e.isDir ? 0 : e.size), 0);
      if (total > MAX_BATCH_BYTES) {
        setError(`These entries add up to ${formatBytes(total)} uncompressed - more than the ${formatBytes(MAX_BATCH_BYTES)} the browser can safely repack. Select fewer entries.`);
        return;
      }
      setBusy('Extracting…');
      const files: NewZipFile[] = [];
      const skipped: string[] = [];
      let unsafe = 0;
      try {
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e) continue;
          if (i % 25 === 0) {
            setBusy(`Extracting ${i + 1} / ${list.length}…`);
            await tick();
          }
          const sp = safePath(e.path);
          if (sp === '') continue;
          if (sp !== e.path) unsafe++;
          const mtime = e.modified ? e.modified.getTime() : Date.now();
          if (e.isDir) {
            files.push({ path: sp, data: new Uint8Array(0), mtime, dir: true });
            continue;
          }
          if (e.kind === 'symlink' || e.kind === 'hardlink' || e.kind === 'other') {
            skipped.push(`${e.path}: ${e.kind} skipped`);
            continue;
          }
          try {
            files.push({ path: sp, data: extractEntry(arc, e).data, mtime });
          } catch (err) {
            skipped.push(`${e.path}: ${err instanceof ArchiveError ? err.message : errMsg(err)}`);
          }
        }
        setBusy('Compressing…');
        await tick();
        const out = await zipAsync(files, 6, true);
        triggerDownload(toBlob(out, 'application/zip'), outName);
        const parts = [`Created ${outName} with ${files.filter((f) => !f.dir).length} files (${formatBytes(out.length)}).`];
        if (unsafe) parts.push(`${unsafe} unsafe path${unsafe === 1 ? '' : 's'} sanitised (absolute roots and ".." removed).`);
        if (skipped.length) parts.push(`Skipped ${skipped.length}: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '; …' : ''}`);
        setNotice(parts.join(' '));
      } catch (err) {
        setError(errMsg(err));
      } finally {
        setBusy(null);
      }
    },
    [arc]
  );

  const base = stripExt(fileName);
  const allZipName = arc?.format === 'zip' ? `${base}-repacked.zip` : `${base}.zip`;

  const header = (
    <div className={cn(COLS, 'sticky top-0 z-10 h-8 border-b bg-muted px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground')}>
      <Checkbox
        checked={allVisibleSelected}
        onCheckedChange={(c) => toggleSelect(visibleFiles.map((e) => e.index), c === true)}
        aria-label="Select all files"
        disabled={visibleFiles.length === 0}
      />
      <span>Path</span>
      <span className="text-right">Size</span>
      <span className="text-right">Packed</span>
      <span className="text-right">Ratio</span>
      <span>Modified</span>
      <span>CRC-32</span>
      <span className="text-right">Flags</span>
    </div>
  );

  const renderRow = (i: number): ReactNode => {
    const r = rows[i];
    if (!r) return null;
    const e = r.entry;
    const isActive = e !== null && !r.isDir && active === e.index;
    let checked: boolean | 'indeterminate' = false;
    let ids: number[] = [];
    if (r.isDir && r.node) {
      ids = collect(r.node);
      const n = ids.reduce((c, id) => c + (selected.has(id) ? 1 : 0), 0);
      checked = ids.length > 0 && n === ids.length ? true : n > 0 ? 'indeterminate' : false;
    } else if (e) {
      ids = [e.index];
      checked = selected.has(e.index);
    }
    const open = r.node ? expanded.has(r.node.path) || q !== '' : false;
    const dirName = view === 'table' && e ? e.path.slice(0, e.path.length - (e.path.split('/').pop() ?? '').length) : '';
    const leaf = view === 'table' && e ? (e.path.split('/').pop() ?? e.path) : r.label;
    return (
      <div
        key={r.key}
        style={{ height: ROW_H }}
        data-testid="archive-row"
        data-path={e?.path ?? r.node?.path ?? ''}
        className={cn(COLS, 'border-b px-2 text-xs hover:bg-accent/40', isActive && 'bg-primary/10')}
        onClick={() => {
          if (r.isDir && r.node && view === 'tree') {
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(r.node!.path)) next.delete(r.node!.path);
              else next.add(r.node!.path);
              return next;
            });
          } else if (e && !r.isDir) setActive(e.index);
        }}
      >
        <span onClick={(ev) => ev.stopPropagation()} className="flex items-center">
          {ids.length > 0 ? <Checkbox checked={checked} onCheckedChange={(c) => toggleSelect(ids, c === true)} aria-label={`Select ${r.label}`} /> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: view === 'tree' ? r.depth * 16 : 0 }} title={e?.path ?? r.node?.path}>
          {view === 'tree' && r.isDir ? (
            <>
              {open ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
              {open ? <FolderOpen className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" /> : <Folder className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
            </>
          ) : view === 'tree' ? (
            <>
              <span className="size-3.5 shrink-0" />
              {e?.kind === 'symlink' || e?.kind === 'hardlink' ? <Link2 className="size-3.5 shrink-0 text-muted-foreground" /> : <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />}
            </>
          ) : r.isDir ? (
            <Folder className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 truncate font-mono">
            {dirName && <span className="text-muted-foreground">{dirName}</span>}
            <span className={cn(r.isDir && 'font-semibold', e?.unsafe && 'text-destructive')}>{leaf}</span>
            {e?.kind === 'symlink' || e?.kind === 'hardlink' ? <span className="text-muted-foreground"> → {e.linkTarget ?? ''}</span> : null}
          </span>
        </span>
        <span className="text-right font-mono tabular">{r.isDir ? (r.node ? formatBytes(r.node.size) : '') : e ? formatBytes(e.size) : ''}</span>
        <span className="text-right font-mono tabular text-muted-foreground">{e && !r.isDir && e.compressedSize !== null ? formatBytes(e.compressedSize) : ''}</span>
        <span className={cn('text-right font-mono tabular text-muted-foreground', e?.suspicious && 'font-semibold text-destructive')}>{e && !r.isDir ? formatRatio(e) : ''}</span>
        <span className="font-mono tabular text-muted-foreground">{e ? formatDate(e.modified) : ''}</span>
        <span className="font-mono tabular text-muted-foreground">{e && !r.isDir ? crcHex(e.crc32) : ''}</span>
        <span className="flex items-center justify-end gap-1">
          {e?.encrypted && <Lock className="size-3.5 text-destructive" aria-label="encrypted" />}
          {e?.unsafe && <ShieldAlert className="size-3.5 text-destructive" aria-label="unsafe path" />}
          {e?.suspicious && <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" aria-label="extreme compression ratio" />}
          {e && !r.isDir && e.kind === 'file' && (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={`Download ${downloadName(e.path)}`}
              aria-label={`Download ${e.path}`}
              onClick={(ev) => {
                ev.stopPropagation();
                void downloadOne(e);
              }}
            >
              <Download className="size-3.5" />
            </button>
          )}
        </span>
      </div>
    );
  };

  const activeEntry = arc && active !== null ? (arc.entries[active] ?? null) : null;
  const selectedList = useMemo(() => (arc ? arc.entries.filter((e) => selected.has(e.index)) : []), [arc, selected]);
  const selectedBytes = selectedList.reduce((s, e) => s + e.size, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-3" data-testid="extract-drop">
        <FileDropzone
          onFiles={onFiles}
          label={arc ? fileName : 'Drop a ZIP, JAR, APK, DOCX, EPUB, TAR, TGZ or GZ file'}
          hint={arc ? `${formatBytes(arc.fileSize)} · click or drop to replace` : 'stays on your device · password-protected, RAR and 7z are not supported'}
          compact={!!arc}
          className="min-w-[16rem] flex-1"
        />
        <Button variant="secondary" size="sm" className="self-center" onClick={loadSample} disabled={!!busy}>
          <FileArchive className="size-3.5" /> Load sample archive
        </Button>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" /> {busy}
        </div>
      )}
      <ErrorBanner error={error} />
      {notice && <Notice tone="info">{notice}</Notice>}

      {arc && summary && tree && (
        <>
          {summary.unsafe > 0 && (
            <Notice>
              <strong>{summary.unsafe}</strong> {summary.unsafe === 1 ? 'entry has' : 'entries have'} an unsafe path (absolute or containing <code className="font-mono">../</code>) - the classic
              &ldquo;zip-slip&rdquo; trick. Never extract this archive with a tool that trusts these paths. Downloads from here are sanitised.
            </Notice>
          )}
          {summary.suspicious > 0 && (
            <Notice>
              <strong>{summary.suspicious}</strong> {summary.suspicious === 1 ? 'entry has' : 'entries have'} an extreme compression ratio (possible zip bomb). Nothing is inflated until you open or download it, and entries
              declaring more than 500 MB are refused.
            </Notice>
          )}
          {summary.encrypted > 0 && (
            <Notice tone="info">
              {summary.encrypted} {summary.encrypted === 1 ? 'entry is' : 'entries are'} password-protected - they are listed, but password-protected entries aren&apos;t supported.
            </Notice>
          )}
          {arc.warnings.map((w, i) => (
            <Notice key={i} tone="info">
              {w}
            </Notice>
          ))}

          <Panel>
            <PanelHeader title={`${formatFormat(arc.format)} · ${arc.entries.length.toLocaleString('en-US')} entries`}>
              <Button
                variant="ghost"
                size="sm"
                disabled={selectedList.length === 0 || !!busy}
                onClick={() => void exportEntries(selectedList, `${base}-selected.zip`)}
                data-testid="download-selected"
              >
                <Download className="size-3.5" /> Selected ({selectedList.length})
              </Button>
              <Button variant="secondary" size="sm" disabled={!!busy || arc.entries.length === 0} onClick={() => void exportEntries(arc.entries, allZipName)} data-testid="download-all">
                <Download className="size-3.5" /> Download all as ZIP
              </Button>
            </PanelHeader>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by path…" className="h-7 w-56" aria-label="Filter entries" />
              <Tabs value={view} onValueChange={(v) => setView(v as 'tree' | 'table')}>
                <TabsList>
                  <TabsTrigger value="tree">Tree</TabsTrigger>
                  <TabsTrigger value="table">Flat list</TabsTrigger>
                </TabsList>
              </Tabs>
              {view === 'tree' && !q && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const all = new Set<string>();
                      for (const e of arc.entries) {
                        const parts = e.path.split('/');
                        for (let i = 1; i < parts.length; i++) all.add(parts.slice(0, i).join('/'));
                        if (e.isDir) all.add(e.path);
                      }
                      setExpanded(all);
                    }}
                  >
                    Expand all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
                    Collapse all
                  </Button>
                </>
              )}
              <span className="ml-auto text-2xs text-muted-foreground">{q ? `${visibleFiles.length.toLocaleString('en-US')} matching files` : ''}</span>
            </div>
            {rows.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">{arc.entries.length === 0 ? 'This archive is empty.' : 'No entries match the filter.'}</div>
            ) : (
              <VirtualList count={rows.length} rowHeight={ROW_H} height={ROW_H * 12 + 32} header={header} minWidth={860} resetKey={`${view}|${q}`} renderRow={renderRow} />
            )}
            <StatBar
              items={[
                `${summary.files.toLocaleString('en-US')} files`,
                `${summary.dirs.toLocaleString('en-US')} folders`,
                summary.other > 0 && `${summary.other} links/other`,
                `${formatBytes(summary.totalSize)} uncompressed`,
                summary.totalCompressed !== null && `${formatBytes(summary.totalCompressed)} compressed`,
                summary.ratio !== null && `${summary.ratio.toFixed(1)}:1 overall`,
                arc.zip64 && 'ZIP64',
                selectedList.length > 0 && `${selectedList.length} selected (${formatBytes(selectedBytes)})`,
              ]}
            />
            {arc.comment && <div className="border-t px-3 py-1.5 text-2xs text-muted-foreground">Archive comment: {arc.comment.slice(0, 300)}</div>}
          </Panel>

          <Panel>
            <PanelHeader title={activeEntry ? `Preview · ${activeEntry.path}` : 'Preview'}>
              {activeEntry && preview.kind === 'text' && <CopyButton value={preview.text} />}
              {activeEntry && activeEntry.kind === 'file' && (
                <Button variant="ghost" size="sm" onClick={() => void downloadOne(activeEntry)} disabled={!!busy}>
                  <Download className="size-3.5" /> Download
                </Button>
              )}
            </PanelHeader>
            <div className="min-h-28 p-3" data-testid="preview-pane">
              {preview.kind === 'none' && <p className="text-xs text-muted-foreground">Click a file to preview it - text (first 64 KB) and images are shown inline.</p>}
              {preview.kind === 'loading' && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Inflating…
                </p>
              )}
              {preview.kind === 'error' && <ErrorBanner error={preview.message} />}
              {preview.kind === 'text' && (
                <>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 font-mono text-xs" data-testid="preview-text">
                    {preview.text || '(empty file)'}
                  </pre>
                  {preview.truncated && <p className="mt-1 text-2xs text-muted-foreground">Showing the first 64 KB. Download the entry for the rest.</p>}
                </>
              )}
              {preview.kind === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={activeEntry?.path ?? 'preview'} className="max-h-80 max-w-full rounded-md border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]" data-testid="preview-image" />
              )}
              {preview.kind === 'binary' && (
                <>
                  <p className="mb-1 text-2xs text-muted-foreground">Binary file - first 256 bytes:</p>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-2xs" data-testid="preview-hex">
                    {preview.dump}
                  </pre>
                </>
              )}
              {(preview.kind === 'text' || preview.kind === 'image' || preview.kind === 'binary') && preview.crcOk === false && (
                <p className="mt-2 text-xs font-medium text-destructive">CRC-32 mismatch - this entry is corrupt.</p>
              )}
              {(preview.kind === 'text' || preview.kind === 'image' || preview.kind === 'binary') && preview.crcOk === true && (
                <p className="mt-2 text-2xs text-muted-foreground" data-testid="crc-ok">
                  CRC-32 verified.
                </p>
              )}
            </div>
          </Panel>
        </>
      )}

      <p className="text-2xs text-muted-foreground">
        Reads ZIP-based files (zip, jar, apk, docx, xlsx, epub…), tar, tar.gz / tgz and gz; entries are inflated on demand. Stored and Deflate are supported - password-protected entries, bzip2, LZMA, RAR and 7z are not.
        Dates are shown as stored (ZIP stores local time without a time zone). Nothing is uploaded.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

interface NewItem {
  id: number;
  file: File;
  name: string;
}

function baseOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function relPath(f: File): string {
  const r = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
  return r && r !== '' ? r : f.name;
}

function CreateTab() {
  const idRef = useRef(1);
  const dirRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<NewItem[]>([]);
  const [level, setLevel] = useState(6);
  const [store, setStore] = useState(true);
  const [archiveName, setArchiveName] = useState('archive.zip');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; inputBytes: number; count: number; name: string } | null>(null);

  useEffect(() => {
    dirRef.current?.setAttribute('webkitdirectory', '');
  }, []);
  useEffect(() => {
    setResult(null);
  }, [items, level, store]);

  const add = useCallback((files: File[]) => {
    setError(null);
    setItems((prev) => [...prev, ...files.map((f) => ({ id: idRef.current++, file: f, name: relPath(f) }))]);
  }, []);

  const addSamples = useCallback(() => {
    const mk = (path: string, text: string): NewItem => {
      const file = new File([text], baseOf(path), { type: 'text/plain', lastModified: Date.now() - 86_400_000 });
      return { id: idRef.current++, file, name: path };
    };
    setError(null);
    setItems((prev) => [
      ...prev,
      mk('README.md', '# Hello\n\nA tiny sample archive created in the browser.\n'),
      mk('notes/todo.txt', '- buy milk\n- write tests\n- ship it\n'),
      mk('data/example.json', JSON.stringify({ hello: 'world', list: [1, 2, 3] }, null, 2)),
    ]);
  }, []);

  const cleaned = useMemo(() => {
    const norm = items.map((i) => normalizeEntryPath(i.name));
    const unique = dedupePaths(norm.map((n) => n || 'file'));
    return items.map((it, i) => {
      const n = norm[i] ?? '';
      const u = unique[i] ?? n;
      const changed = n !== it.name.trim();
      return { id: it.id, norm: n, final: u, renamed: u !== n, sanitised: changed };
    });
  }, [items]);

  const totalBytes = items.reduce((s, i) => s + i.file.size, 0);

  const build = useCallback(async () => {
    setError(null);
    setNotice(null);
    setResult(null);
    if (items.length === 0) return;
    if (totalBytes > MAX_INPUT_BYTES) {
      setError(`Total input is ${formatBytes(totalBytes)} - the limit is ${formatBytes(MAX_INPUT_BYTES)} in the browser.`);
      return;
    }
    setBusy('Reading files…');
    const files: NewZipFile[] = [];
    const failed: string[] = [];
    let inputBytes = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it) continue;
        if (i % 8 === 0) {
          setBusy(`Reading files ${i + 1} / ${items.length}…`);
          await tick();
        }
        try {
          const data = new Uint8Array(await it.file.arrayBuffer());
          inputBytes += data.length;
          files.push({ path: it.name, data, mtime: it.file.lastModified });
        } catch {
          failed.push(it.name);
        }
      }
      if (files.length === 0) throw new Error('None of the files could be read. Folders must be added with the "Add folder" button.');
      setBusy('Compressing…');
      await tick();
      const out = await zipAsync(files, level as ZipLevel, store);
      const name = (/\.zip$/i.test(archiveName.trim()) ? archiveName.trim() : `${archiveName.trim() || 'archive'}.zip`).replace(/[\\/:*?"<>|]/g, '_');
      setResult({ bytes: out, inputBytes, count: files.length, name });
      if (failed.length) setNotice(`Could not read ${failed.length} item${failed.length === 1 ? '' : 's'} (folders dropped onto the box can't be read - use "Add folder"): ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, [items, totalBytes, level, store, archiveName]);

  const ratioText = result && result.inputBytes > 0 ? `${Math.round((1 - result.bytes.length / result.inputBytes) * 100)}% smaller` : '';

  return (
    <div className="flex flex-col gap-3">
      <div data-testid="create-drop">
        <FileDropzone onFiles={add} multiple label="Drop files to add them" hint="or click to browse · use “Add folder” for whole folders" compact />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => dirRef.current?.click()}>
          <FolderPlus className="size-3.5" /> Add folder
        </Button>
        <input
          ref={dirRef}
          type="file"
          multiple
          className="hidden"
          data-testid="create-folder-input"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            if (list.length) add(list);
            e.target.value = '';
          }}
        />
        <Button variant="ghost" size="sm" onClick={addSamples}>
          <Plus className="size-3.5" /> Add sample files
        </Button>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setItems([])}>
            <Trash2 className="size-3.5" /> Clear all
          </Button>
        )}
      </div>

      <Panel>
        <PanelHeader title={`Files · ${items.length.toLocaleString('en-US')}`} />
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">No files yet. Drop files above or add a folder - paths and modification times are preserved in the archive.</div>
        ) : (
          <VirtualList
            count={items.length}
            rowHeight={40}
            height={40 * 8}
            minWidth={560}
            renderRow={(i) => {
              const it = items[i];
              const c = cleaned[i];
              if (!it || !c) return null;
              return (
                <div key={it.id} style={{ height: 40 }} className="flex items-center gap-2 border-b px-2" data-testid="create-row">
                  <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Input
                      value={it.name}
                      onChange={(e) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                      className={cn('h-7 font-mono text-xs', (c.renamed || c.sanitised) && 'border-amber-500/60')}
                      aria-label={`Name of ${it.file.name}`}
                      title={c.sanitised ? `Will be stored as ${c.final}` : c.renamed ? `Duplicate - will be stored as ${c.final}` : undefined}
                    />
                  </div>
                  {(c.renamed || c.sanitised) && <span className="hidden max-w-[10rem] truncate text-2xs text-amber-700 dark:text-amber-300 sm:inline">→ {c.final}</span>}
                  <span className="w-16 shrink-0 text-right font-mono text-2xs tabular text-muted-foreground">{formatBytes(it.file.size)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${it.name}`} onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            }}
          />
        )}
        <StatBar items={[`${items.length.toLocaleString('en-US')} files`, `${formatBytes(totalBytes)} total`]} />
      </Panel>

      <OptionsBar>
        <Field label="Archive name" className="min-w-[12rem]">
          <Input value={archiveName} onChange={(e) => setArchiveName(e.target.value)} className="font-mono" aria-label="Archive name" />
        </Field>
        <Field label={`Compression level: ${level}${level === 0 ? ' (store)' : level === 6 ? ' (default)' : level === 9 ? ' (smallest)' : level === 1 ? ' (fastest)' : ''}`} className="min-w-[14rem] flex-1">
          <Slider value={[level]} min={0} max={9} step={1} onValueChange={(v) => setLevel(v[0] ?? 6)} aria-label="Compression level" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Switch checked={store} onCheckedChange={setStore} />
          <span>Store already-compressed files (jpg, png, mp4, zip…)</span>
        </label>
        <Button onClick={() => void build()} disabled={items.length === 0 || !!busy} data-testid="create-zip">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
          Create ZIP
        </Button>
      </OptionsBar>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" /> {busy}
        </div>
      )}
      <ErrorBanner error={error} />
      {notice && <Notice>{notice}</Notice>}

      {result && (
        <Panel>
          <PanelHeader title="Result">
            <DownloadButton data={() => toBlob(result.bytes, 'application/zip')} filename={result.name} mime="application/zip" label={`Download ${result.name}`} variant="secondary" />
          </PanelHeader>
          <div className="px-3 py-3 text-sm" data-testid="create-result">
            <span className="font-mono">{result.name}</span> · {result.count} file{result.count === 1 ? '' : 's'} · {formatBytes(result.inputBytes)} → <strong>{formatBytes(result.bytes.length)}</strong>
            {result.inputBytes > 0 && <span className="text-muted-foreground"> ({ratioText}, {(result.inputBytes / Math.max(1, result.bytes.length)).toFixed(2)}:1)</span>}
          </div>
        </Panel>
      )}

      <p className="text-2xs text-muted-foreground">
        Folder structure and modification times are kept (ZIP stores 1980-2099, two-second resolution). Names with ../ or a leading / are cleaned up. Building happens in a background worker; very large selections are limited by browser memory
        (about 1 GB).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function ZipArchiveTool() {
  const [tab, setTab] = useState<'extract' | 'create'>('extract');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'extract' | 'create')} className="gap-3">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="extract">Extract / View</TabsTrigger>
        <TabsTrigger value="create">Create ZIP</TabsTrigger>
      </TabsList>
      <TabsContent value="extract" forceMount className="data-[state=inactive]:hidden">
        <ExtractTab />
      </TabsContent>
      <TabsContent value="create" forceMount className="data-[state=inactive]:hidden">
        <CreateTab />
      </TabsContent>
    </Tabs>
  );
}
