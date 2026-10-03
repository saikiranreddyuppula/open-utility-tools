'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  CopyPlus,
  FileText,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  isEncrypted,
  mergePdfs,
  pageCount,
  pageInfo,
  reorderPages,
  type PdfPageInfo,
} from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import {
  detectPaperSize,
  formatOrder,
  identityOrder,
  interleaveOrder,
  interleaveSteps,
  oddThenEven,
  orientationOf,
  parseOrder,
  ptToIn,
  ptToMm,
} from './logic';

const MAX_FILE_BYTES = 300 * 1024 * 1024;

interface PdfDoc {
  name: string;
  size: number;
  bytes: Uint8Array;
  total: number;
  infos: PdfPageInfo[];
}

interface Item {
  uid: number;
  page: number;
}

interface Built {
  bytes: Uint8Array;
  pages: number;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const baseName = (name: string): string => name.replace(/\.pdf$/i, '') || 'document';

/** Read a PDF, count its pages and (when available) read per-page geometry. */
async function loadDoc(file: File): Promise<PdfDoc> {
  if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
    throw new Error('Please choose a PDF file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (${formatBytes(file.size)}). Limit is ${formatBytes(MAX_FILE_BYTES)}.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let encrypted = false;
  try {
    encrypted = await isEncrypted(bytes.slice());
  } catch {
    encrypted = false;
  }
  if (encrypted) {
    throw new Error('This PDF is encrypted. Unlock it first (Protect & Unlock PDF), then organize its pages.');
  }
  let infos: PdfPageInfo[] = [];
  let total: number;
  try {
    infos = await pageInfo(bytes.slice());
    total = infos.length;
  } catch {
    total = await pageCount(bytes.slice());
  }
  if (total < 1) throw new Error('This PDF has no pages.');
  return { name: file.name, size: file.size, bytes, total, infos };
}

/* ------------------------------------------------------------------ */
/* Page card                                                           */
/* ------------------------------------------------------------------ */

interface CardProps {
  item: Item;
  index: number;
  count: number;
  info: PdfPageInfo | undefined;
  isCopy: boolean;
  selected: boolean;
  dragging: boolean;
  insertBefore: boolean;
  insertAfter: boolean;
  onToggle: (uid: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOverCard: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
}

const PageCard = memo(function PageCard(p: CardProps) {
  const { item, index, count, info } = p;
  const w = info?.width ?? 595;
  const h = info?.height ?? 842;
  const scale = 76 / Math.max(w, h);
  const boxW = Math.max(28, Math.round(w * scale));
  const boxH = Math.max(28, Math.round(h * scale));
  const orient = info ? orientationOf(info.width, info.height) : null;
  const paper = info ? detectPaperSize(info.width, info.height) : null;

  return (
    <div
      role="listitem"
      data-uid={item.uid}
      data-page={item.page}
      draggable
      onDragStart={(e) => p.onDragStart(e, index)}
      onDragOver={(e) => p.onDragOverCard(e, index)}
      onDragEnd={p.onDragEnd}
      className={cn(
        'relative flex cursor-grab flex-col gap-1.5 rounded-lg border bg-card p-2 transition-shadow active:cursor-grabbing',
        p.selected && 'ring-2 ring-primary',
        p.dragging && 'opacity-40'
      )}
    >
      {p.insertBefore && <span className="absolute -left-[7px] inset-y-1 w-[3px] rounded bg-primary" />}
      {p.insertAfter && <span className="absolute -right-[7px] inset-y-1 w-[3px] rounded bg-primary" />}

      <div className="flex items-center justify-between gap-1">
        <label className="flex cursor-pointer items-center gap-1 text-2xs text-muted-foreground">
          <input
            type="checkbox"
            checked={p.selected}
            onChange={() => p.onToggle(item.uid)}
            aria-label={`Select position ${index + 1}`}
            className="size-3.5 accent-primary"
          />
          <span className="font-mono tabular">#{index + 1}</span>
        </label>
        {p.isCopy && (
          <span className="rounded bg-muted px-1 py-px font-mono text-2xs text-muted-foreground">copy</span>
        )}
      </div>

      <div className="flex h-[84px] items-center justify-center">
        <div
          className="flex items-center justify-center rounded-[3px] border bg-background shadow-sm"
          style={{ width: boxW, height: boxH }}
          title={`Original page ${item.page}`}
        >
          <span className="font-mono text-lg font-semibold tabular">{item.page}</span>
        </div>
      </div>

      <div className="flex min-h-[2.1rem] flex-col items-center gap-px text-center font-mono text-2xs leading-tight text-muted-foreground tabular">
        {info ? (
          <>
            <span className="flex items-center gap-1">
              {orient === 'landscape' ? (
                <RectangleHorizontal className="size-3" />
              ) : (
                <RectangleVertical className="size-3" />
              )}
              {paper ? `${paper} · ` : ''}
              {orient}
              {info.rotate ? ` · ↻${info.rotate}°` : ''}
            </span>
            <span>
              {ptToMm(info.width).toFixed(0)}×{ptToMm(info.height).toFixed(0)} mm
            </span>
            <span>
              {ptToIn(info.width).toFixed(2)}×{ptToIn(info.height).toFixed(2)} in
            </span>
          </>
        ) : (
          <span>page {item.page}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="icon-sm"
          variant="ghost"
          data-act="left"
          aria-label={`Move position ${index + 1} left`}
          title="Move left"
          disabled={index === 0}
          onClick={() => p.onMove(index, -1)}
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          data-act="dup"
          aria-label={`Duplicate page ${item.page}`}
          title="Duplicate"
          onClick={() => p.onDuplicate(index)}
        >
          <CopyPlus className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          data-act="remove"
          aria-label={`Remove position ${index + 1}`}
          title="Remove"
          disabled={count <= 1}
          onClick={() => p.onRemove(index)}
        >
          <X className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          data-act="right"
          aria-label={`Move position ${index + 1} right`}
          title="Move right"
          disabled={index === count - 1}
          onClick={() => p.onMove(index, 1)}
        >
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Reorder pane                                                        */
/* ------------------------------------------------------------------ */

function ReorderPane() {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [expr, setExpr] = useState('');
  const [exprError, setExprError] = useState<string | null>(null);
  const [history, setHistory] = useState<Item[][]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [result, setResult] = useState<Built | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uidRef = useRef(1);
  const loadSeq = useRef(0);
  const lastSource = useRef<'grid' | 'expr'>('grid');
  const dragRef = useRef<number | null>(null);
  const insertRef = useRef<number | null>(null);
  const focusReq = useRef<{ uid: number; act: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const makeItems = useCallback((pages: number[]): Item[] => pages.map((page) => ({ uid: uidRef.current++, page })), []);

  const commit = useCallback(
    (next: Item[], source: 'grid' | 'expr', keepSelection = false) => {
      const prev = itemsRef.current;
      if (!(source === 'expr' && lastSource.current === 'expr')) {
        setHistory((h) => [...h.slice(-49), prev]);
      }
      lastSource.current = source;
      itemsRef.current = next;
      setItems(next);
      if (source === 'grid') {
        setExpr(formatOrder(next.map((i) => i.page)));
        setExprError(null);
      }
      if (!keepSelection) setSelected(new Set());
      else setSelected((s) => new Set([...s].filter((uid) => next.some((i) => i.uid === uid))));
      setResult(null);
      setError(null);
    },
    []
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const seq = ++loadSeq.current;
      setLoading(true);
      setError(null);
      try {
        const d = await loadDoc(file);
        if (seq !== loadSeq.current) return;
        const fresh = makeItems(identityOrder(d.total));
        setDoc(d);
        setItems(fresh);
        setExpr(formatOrder(identityOrder(d.total)));
        setExprError(null);
        setHistory([]);
        setSelected(new Set());
        setResult(null);
        lastSource.current = 'grid';
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(errMsg(e));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [makeItems]
  );

  // Restore keyboard focus on the same button after a card moved.
  useEffect(() => {
    const req = focusReq.current;
    if (!req) return;
    focusReq.current = null;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-uid="${req.uid}"] [data-act="${req.act}"]:not([disabled])`);
    if (el) el.focus();
    else gridRef.current?.querySelector<HTMLElement>(`[data-uid="${req.uid}"] button:not([disabled])`)?.focus();
  }, [items]);

  const onExprChange = (text: string) => {
    setExpr(text);
    if (!doc) return;
    const r = parseOrder(text, doc.total);
    if (!r.ok) {
      setExprError(r.error);
      return;
    }
    setExprError(null);
    const current = itemsRef.current.map((i) => i.page);
    if (current.length === r.order.length && current.every((p, i) => p === r.order[i])) return;
    commit(makeItems(r.order), 'expr');
  };

  const moveItem = useCallback(
    (from: number, at: number) => {
      const cur = itemsRef.current;
      if (at === from || at === from + 1) return;
      const next = cur.slice();
      const moved = next.splice(from, 1)[0];
      if (!moved) return;
      next.splice(at > from ? at - 1 : at, 0, moved);
      commit(next, 'grid', true);
    },
    [commit]
  );

  const onMove = useCallback(
    (index: number, delta: -1 | 1) => {
      const cur = itemsRef.current;
      const j = index + delta;
      const a = cur[index];
      if (!a || j < 0 || j >= cur.length) return;
      const next = cur.slice();
      next.splice(index, 1);
      next.splice(j, 0, a);
      focusReq.current = { uid: a.uid, act: delta < 0 ? 'left' : 'right' };
      commit(next, 'grid', true);
    },
    [commit]
  );

  const onDuplicate = useCallback(
    (index: number) => {
      const cur = itemsRef.current;
      const a = cur[index];
      if (!a || cur.length >= 5000) return;
      const next = cur.slice();
      next.splice(index + 1, 0, { uid: uidRef.current++, page: a.page });
      commit(next, 'grid', true);
    },
    [commit]
  );

  const onRemove = useCallback(
    (index: number) => {
      const cur = itemsRef.current;
      if (cur.length <= 1) return;
      commit(cur.filter((_, i) => i !== index), 'grid', true);
    },
    [commit]
  );

  const onToggle = useCallback((uid: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }, []);

  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Styling the source synchronously can cancel the drag in Chromium.
    setTimeout(() => setDragIndex(dragRef.current), 0);
  }, []);

  const onDragOverCard = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const at = index + (e.clientX > rect.left + rect.width / 2 ? 1 : 0);
    if (insertRef.current !== at) {
      insertRef.current = at;
      setInsertAt(at);
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    insertRef.current = null;
    setDragIndex(null);
    setInsertAt(null);
  }, []);

  const onGridDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const from = dragRef.current;
      const at = insertRef.current;
      endDrag();
      if (from !== null && at !== null) moveItem(from, at);
    },
    [endDrag, moveItem]
  );

  /* quick actions */
  const reverse = () => commit(itemsRef.current.slice().reverse(), 'grid', true);
  const oddEven = () => commit(oddThenEven(itemsRef.current), 'grid', true);
  const moveSelected = (where: 'start' | 'end') => {
    const cur = itemsRef.current;
    const sel = cur.filter((i) => selected.has(i.uid));
    const rest = cur.filter((i) => !selected.has(i.uid));
    if (sel.length === 0) return;
    commit(where === 'start' ? [...sel, ...rest] : [...rest, ...sel], 'grid', true);
  };
  const removeSelected = () => {
    const rest = itemsRef.current.filter((i) => !selected.has(i.uid));
    if (rest.length === 0 || rest.length === itemsRef.current.length) return;
    commit(rest, 'grid');
  };
  const duplicateSelected = () => {
    const cur = itemsRef.current;
    if (selected.size === 0) return;
    const next = cur.flatMap((i) => (selected.has(i.uid) ? [i, { uid: uidRef.current++, page: i.page }] : [i]));
    if (next.length > 5000) return;
    commit(next, 'grid', true);
  };
  const restore = () => {
    if (!doc) return;
    commit(makeItems(identityOrder(doc.total)), 'grid');
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setItems(prev);
    setExpr(formatOrder(prev.map((i) => i.page)));
    setExprError(null);
    setSelected(new Set());
    setResult(null);
    lastSource.current = 'grid';
  };

  const build = useCallback(async () => {
    if (!doc || items.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const order = items.map((i) => i.page).join(',');
      const out = await reorderPages(doc.bytes.slice(), order);
      let pages = items.length;
      try {
        pages = await pageCount(out.slice());
      } catch {
        /* keep the expected count */
      }
      setResult({ bytes: out, pages });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [doc, items]);

  const copyCounts = useMemo(() => {
    const seen = new Map<number, number>();
    return items.map((i) => {
      const n = seen.get(i.page) ?? 0;
      seen.set(i.page, n + 1);
      return n > 0;
    });
  }, [items]);

  const isIdentity = doc ? items.length === doc.total && items.every((it, i) => it.page === i + 1) : true;
  const removedCount = doc ? doc.total - new Set(items.map((i) => i.page)).size : 0;
  const hasSel = selected.size > 0;

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => void onFiles(f)}
        accept="application/pdf,.pdf"
        label={doc ? doc.name : 'Drop a PDF'}
        hint={
          loading
            ? 'reading…'
            : doc
              ? `${doc.total} page${doc.total === 1 ? '' : 's'} · ${formatBytes(doc.size)} · drop another to replace`
              : 'click to browse · nothing leaves your browser'
        }
        compact={!!doc}
        disabled={loading}
      />

      <ErrorBanner error={error} />

      {doc && (
        <>
          <OptionsBar>
            <Field
              label="Page order"
              hint="e.g. 3,1,2 · 2-5 · 5-1 · 1,1,2 · odd · even · rev · last · -1"
              className="min-w-[240px] flex-1"
            >
              <Input
                value={expr}
                onChange={(e) => onExprChange(e.target.value)}
                className="font-mono"
                spellCheck={false}
                aria-label="Page order"
                aria-invalid={!!exprError}
              />
              {exprError && <span className="text-2xs text-destructive">{exprError}</span>}
            </Field>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={reverse}>
                <ArrowLeftRight className="size-3.5" /> Reverse
              </Button>
              <Button size="sm" variant="outline" onClick={oddEven} title="Positions 1,3,5… first, then 2,4,6…">
                Odd, then even
              </Button>
              <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0}>
                <Undo2 className="size-3.5" /> Undo
              </Button>
              <Button size="sm" variant="outline" onClick={restore} disabled={isIdentity}>
                <RotateCcw className="size-3.5" /> Restore
              </Button>
            </div>
          </OptionsBar>

          <Panel>
            <PanelHeader title={`Pages · ${items.length} in output`} />
            <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(hasSel ? new Set() : new Set(items.map((i) => i.uid)))}
              >
                {hasSel ? `Clear (${selected.size})` : 'Select all'}
              </Button>
              <Button size="sm" variant="ghost" disabled={!hasSel} onClick={() => moveSelected('start')}>
                <ArrowLeftToLine className="size-3.5" /> To start
              </Button>
              <Button size="sm" variant="ghost" disabled={!hasSel} onClick={() => moveSelected('end')}>
                <ArrowRightToLine className="size-3.5" /> To end
              </Button>
              <Button size="sm" variant="ghost" disabled={!hasSel} onClick={duplicateSelected}>
                <CopyPlus className="size-3.5" /> Duplicate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasSel || selected.size >= items.length}
                onClick={removeSelected}
              >
                <X className="size-3.5" /> Remove
              </Button>
            </div>
            <div
              ref={gridRef}
              role="list"
              aria-label="Pages in output order"
              className="grid max-h-[640px] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              onDragOver={(e) => {
                if (dragRef.current !== null) e.preventDefault();
              }}
              onDrop={onGridDrop}
            >
              {items.map((it, i) => (
                <PageCard
                  key={it.uid}
                  item={it}
                  index={i}
                  count={items.length}
                  info={doc.infos[it.page - 1]}
                  isCopy={copyCounts[i] ?? false}
                  selected={selected.has(it.uid)}
                  dragging={dragIndex === i}
                  insertBefore={dragIndex !== null && insertAt === i && insertAt !== dragIndex && insertAt !== dragIndex + 1}
                  insertAfter={
                    dragIndex !== null &&
                    i === items.length - 1 &&
                    insertAt === items.length &&
                    insertAt !== dragIndex + 1
                  }
                  onToggle={onToggle}
                  onMove={onMove}
                  onDuplicate={onDuplicate}
                  onRemove={onRemove}
                  onDragStart={onDragStart}
                  onDragOverCard={onDragOverCard}
                  onDragEnd={endDrag}
                />
              ))}
            </div>
            <StatBar
              className="h-auto min-h-7 py-1"
              items={[
                `${doc.total} → ${items.length} pages`,
                removedCount > 0 && `${removedCount} removed`,
                `source ${formatBytes(doc.size)}`,
              ]}
            />
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void build()} disabled={busy || items.length === 0 || !!exprError}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
              Create PDF
            </Button>
            <span className="text-2xs text-muted-foreground">
              Drag cards (or use the arrows) to reorder. Pages are copied as-is — nothing is re-rendered.
            </span>
          </div>

          {result && (
            <Panel>
              <PanelHeader title="Result">
                <DownloadButton
                  data={() => result.bytes}
                  filename={`${baseName(doc.name)}-organized.pdf`}
                  mime="application/pdf"
                  label="Download PDF"
                  variant="secondary"
                />
              </PanelHeader>
              <StatBar
                className="h-auto min-h-7 py-1"
                items={[
                  `${result.pages} page${result.pages === 1 ? '' : 's'}`,
                  formatBytes(result.bytes.length),
                  `${baseName(doc.name)}-organized.pdf`,
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interleave pane                                                     */
/* ------------------------------------------------------------------ */

function Slot({
  label,
  hint,
  doc,
  loading,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  doc: PdfDoc | null;
  loading: boolean;
  onFile: (f: File[]) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {doc && (
          <Button size="sm" variant="ghost" onClick={onClear} className="h-6 px-1.5 text-2xs">
            <X className="size-3" /> Remove
          </Button>
        )}
      </div>
      <FileDropzone
        onFiles={onFile}
        accept="application/pdf,.pdf"
        label={doc ? doc.name : 'Drop a PDF'}
        hint={
          loading
            ? 'reading…'
            : doc
              ? `${doc.total} page${doc.total === 1 ? '' : 's'} · ${formatBytes(doc.size)}`
              : hint
        }
        compact
        disabled={loading}
      />
    </div>
  );
}

function InterleavePane() {
  const [docA, setDocA] = useState<PdfDoc | null>(null);
  const [docB, setDocB] = useState<PdfDoc | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [reverseB, setReverseB] = useState(true);
  const [result, setResult] = useState<Built | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqA = useRef(0);
  const seqB = useRef(0);

  const load = useCallback(async (which: 'A' | 'B', files: File[]) => {
    const file = files[0];
    if (!file) return;
    const seqRef = which === 'A' ? seqA : seqB;
    const setDoc = which === 'A' ? setDocA : setDocB;
    const setLoading = which === 'A' ? setLoadingA : setLoadingB;
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const d = await loadDoc(file);
      if (seq !== seqRef.current) return;
      setDoc(d);
      setResult(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(`${which === 'A' ? 'Fronts' : 'Backs'}: ${errMsg(e)}`);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  const steps = useMemo(
    () => (docA && docB ? interleaveSteps(docA.total, docB.total, reverseB) : []),
    [docA, docB, reverseB]
  );

  const build = useCallback(async () => {
    if (!docA || !docB) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const merged = await mergePdfs([docA.bytes.slice(), docB.bytes.slice()]);
      const order = interleaveOrder(docA.total, docB.total, reverseB).join(',');
      const out = await reorderPages(merged, order);
      let pages = docA.total + docB.total;
      try {
        pages = await pageCount(out.slice());
      } catch {
        /* keep the expected count */
      }
      setResult({ bytes: out, pages });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [docA, docB, reverseB]);

  const diff = docA && docB ? docA.total - docB.total : 0;
  const shown = steps.slice(0, 40);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Slot
          label="PDF A · fronts (odd pages)"
          hint="the scan of the front sides"
          doc={docA}
          loading={loadingA}
          onFile={(f) => void load('A', f)}
          onClear={() => {
            setDocA(null);
            setResult(null);
          }}
        />
        <Slot
          label="PDF B · backs (even pages)"
          hint="the scan of the back sides"
          doc={docB}
          loading={loadingB}
          onFile={(f) => void load('B', f)}
          onClear={() => {
            setDocB(null);
            setResult(null);
          }}
        />
      </div>

      <ErrorBanner error={error} />

      <OptionsBar>
        <Field
          label="Reverse B"
          hint="Turn on when the backs were scanned from the flipped stack, so they come out last-to-first."
          className="max-w-md flex-1"
        >
          <div className="flex items-center gap-2">
            <Switch
              checked={reverseB}
              onCheckedChange={(v) => {
                setReverseB(v);
                setResult(null);
              }}
              aria-label="Reverse B"
            />
            <span className="text-xs">{reverseB ? 'Backs in reverse order' : 'Backs in normal order'}</span>
          </div>
        </Field>
        <div className="flex items-end">
          <Button size="sm" onClick={() => void build()} disabled={!docA || !docB || busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Interleave
          </Button>
        </div>
      </OptionsBar>

      {docA && docB && (
        <Panel>
          <PanelHeader title="Resulting order" />
          <div className="p-3 font-mono text-xs leading-relaxed tabular">
            {shown.map((s, i) => (
              <span key={i}>
                <span className={cn('inline-block', s.src === 'A' ? 'text-foreground' : 'text-primary')}>
                  {s.src}
                  {s.page}
                </span>{' '}
              </span>
            ))}
            {steps.length > shown.length && <span className="text-muted-foreground">… +{steps.length - shown.length} more</span>}
          </div>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={[
              `${docA.total} + ${docB.total} = ${docA.total + docB.total} pages`,
              diff !== 0 &&
                `${diff > 0 ? 'A' : 'B'} has ${Math.abs(diff)} extra page${Math.abs(diff) === 1 ? '' : 's'} — appended at the end`,
            ]}
          />
        </Panel>
      )}

      {result && docA && (
        <Panel>
          <PanelHeader title="Result">
            <DownloadButton
              data={() => result.bytes}
              filename={`${baseName(docA.name)}-interleaved.pdf`}
              mime="application/pdf"
              label="Download PDF"
              variant="secondary"
            />
          </PanelHeader>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={[
              `${result.pages} page${result.pages === 1 ? '' : 's'}`,
              formatBytes(result.bytes.length),
              `${baseName(docA.name)}-interleaved.pdf`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Mode = 'reorder' | 'interleave';

export default function PdfOrganizePagesTool() {
  const [mode, setMode] = useState<Mode>('reorder');
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="reorder">Reorder pages</TabsTrigger>
          <TabsTrigger value="interleave">Interleave two PDFs</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className={mode === 'reorder' ? 'contents' : 'hidden'}>
        <ReorderPane />
      </div>
      <div className={mode === 'interleave' ? 'contents' : 'hidden'}>
        <InterleavePane />
      </div>
      <p className="text-2xs text-muted-foreground">
        Runs entirely in your browser. Pages are copied, not re-rendered, so quality is unchanged. Page cards show
        size and orientation only — there is no page preview.
      </p>
    </div>
  );
}
