'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Cpu,
  Database,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  HardDrive,
  Loader2,
  Search,
  Type,
} from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  EntropyAccumulator,
  asciiChar,
  checkExtension,
  describeEntropy,
  detectFileType,
  findPattern,
  formatOffset,
  hex2,
  inspectBytes,
  parseBase64Input,
  parseHexInput,
  parseOffset,
  toBase64,
  toCArray,
  toHexString,
  type Category,
  type Detection,
  type EntropyResult,
  type ReadAt,
} from './logic';

const ROW_H = 20;
const VIS = 22;
const COPY_LIMIT = 4 * 1024 * 1024;
const AUTO_ENTROPY_LIMIT = 48 * 1024 * 1024;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const SAMPLE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAJnRFWHRDb21tZW50AE9wZW4gVXRpbGl0eSBUb29scyBzYW1wbGUgZmlsZeO/F2UAAABOSURBVHjaY2RgaBBgYCcesTAIsDMw/GRg4COShGjgY2B4zcDAzsBAmA23gVgSbgPEmPMwBtxUdHE0PxBm090PyGg6NkF88cA+Gg9k+wEAa5VZLWHX+o4AAAAASUVORK5CYII=';

interface Source {
  id: number;
  blob: Blob;
  size: number;
  name: string;
  kind: 'file' | 'hex' | 'base64' | 'sample';
}

const readOf = (blob: Blob): ReadAt => async (offset, length) => new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'ok' }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'warn' ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      )}
    >
      {tone === 'warn' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />}
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

const CATEGORY_ICON: Record<Category, typeof FileIcon> = {
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  document: FileText,
  executable: Cpu,
  font: Type,
  database: Database,
  text: FileCode,
  data: Binary,
  disk: HardDrive,
  other: FileIcon,
};

/* ------------------------------------------------------------------ */
/* Hex grid                                                            */
/* ------------------------------------------------------------------ */

interface HexWindow {
  srcId: number;
  start: number;
  bytes: Uint8Array;
}

function byteClass(b: number): string {
  if (b === 0) return 'text-muted-foreground/50';
  if (b < 0x20 || b === 0x7f) return 'text-violet-700 dark:text-violet-300';
  if (b >= 0x80) return 'text-sky-700 dark:text-sky-300';
  return '';
}

function HexGrid({
  src,
  bpr,
  group,
  upper,
  topRow,
  setTopRow,
  sel,
  setSel,
  hit,
  win,
}: {
  src: Source;
  bpr: number;
  group: number;
  upper: boolean;
  topRow: number;
  setTopRow: (fn: (r: number) => number) => void;
  sel: { anchor: number; focus: number } | null;
  setSel: (s: { anchor: number; focus: number } | null) => void;
  hit: { start: number; len: number } | null;
  win: HexWindow | null;
}) {
  const totalRows = Math.max(1, Math.ceil(src.size / bpr));
  const maxTop = Math.max(0, totalRows - VIS);
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'select' | 'thumb'; startY: number; startTop: number } | null>(null);
  const wheelAcc = useRef(0);
  const stateRef = useRef({ topRow, maxTop });
  useEffect(() => {
    stateRef.current = { topRow, maxTop };
  });
  const offW = src.size > 0xffffffff ? 12 : 8;

  const clampRow = useCallback((r: number) => Math.max(0, Math.min(stateRef.current.maxTop, Math.round(r))), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { topRow: t, maxTop: m } = stateRef.current;
      if (m === 0) return;
      const unit = e.deltaMode === 1 ? 1 : e.deltaMode === 2 ? VIS : 1 / ROW_H;
      wheelAcc.current += e.deltaY * unit;
      const rows = Math.trunc(wheelAcc.current);
      if ((e.deltaY < 0 && t === 0) || (e.deltaY > 0 && t >= m)) return;
      e.preventDefault();
      if (rows !== 0) {
        wheelAcc.current -= rows;
        setTopRow((r) => Math.max(0, Math.min(m, r + rows)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setTopRow]);

  const offsetFromTarget = (t: EventTarget | null): number | null => {
    if (!(t instanceof HTMLElement)) return null;
    const el = t.closest<HTMLElement>('[data-o]');
    if (!el) return null;
    const n = Number(el.dataset.o);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    const up = () => {
      if (dragRef.current?.mode === 'select') dragRef.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const ensureVisible = useCallback(
    (off: number) => {
      const row = Math.floor(off / bpr);
      setTopRow((t) => (row < t ? row : row >= t + VIS ? Math.min(stateRef.current.maxTop, row - VIS + 1) : t));
    },
    [bpr, setTopRow]
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const last = src.size - 1;
    const cur = sel ? sel.focus : topRow * bpr;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = cur - 1;
        break;
      case 'ArrowRight':
        next = cur + 1;
        break;
      case 'ArrowUp':
        next = cur - bpr;
        break;
      case 'ArrowDown':
        next = cur + bpr;
        break;
      case 'PageUp':
        next = cur - bpr * (VIS - 1);
        break;
      case 'PageDown':
        next = cur + bpr * (VIS - 1);
        break;
      case 'Home':
        next = e.ctrlKey ? 0 : cur - (cur % bpr);
        break;
      case 'End':
        next = e.ctrlKey ? last : Math.min(last, cur - (cur % bpr) + bpr - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next === null || last < 0) return;
    next = Math.max(0, Math.min(last, next));
    setSel({ anchor: e.shiftKey && sel ? sel.anchor : next, focus: next });
    ensureVisible(next);
  };

  /* custom scrollbar */
  const visRows = Math.min(VIS, totalRows);
  const trackH = visRows * ROW_H;
  const thumbH = Math.max(28, Math.min(trackH, (visRows / totalRows) * trackH));
  const thumbTop = maxTop === 0 ? 0 : (topRow / maxTop) * (trackH - thumbH);

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode: 'thumb', startY: e.clientY, startTop: thumbTop };
  };
  const onThumbMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.mode !== 'thumb') return;
    const span = trackH - thumbH;
    if (span <= 0) return;
    const pos = Math.max(0, Math.min(span, d.startTop + (e.clientY - d.startY)));
    setTopRow(() => clampRow((pos / span) * maxTop));
  };
  const onThumbUp = () => {
    if (dragRef.current?.mode === 'thumb') dragRef.current = null;
  };
  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    setTopRow((r) => clampRow(y < thumbTop ? r - (VIS - 1) : r + (VIS - 1)));
  };

  const lo = sel ? Math.min(sel.anchor, sel.focus) : -1;
  const hi = sel ? Math.max(sel.anchor, sel.focus) : -2;
  const hitLo = hit ? hit.start : -1;
  const hitHi = hit ? hit.start + hit.len - 1 : -2;

  const rows: ReactNode[] = [];
  for (let r = topRow; r < Math.min(totalRows, topRow + VIS); r++) {
    const base = r * bpr;
    const cells: ReactNode[] = [];
    const chars: ReactNode[] = [];
    for (let i = 0; i < bpr; i++) {
      const off = base + i;
      const inFile = off < src.size;
      let b: number | null = null;
      if (inFile && win && win.srcId === src.id) {
        const idx = off - win.start;
        if (idx >= 0 && idx < win.bytes.length) b = win.bytes[idx] ?? null;
      }
      const isSel = off >= lo && off <= hi;
      const isHit = off >= hitLo && off <= hitHi;
      const gap = group > 0 && (i + 1) % group === 0 && i + 1 < bpr;
      if (!inFile) {
        cells.push(<span key={i} className={cn('inline-block w-[3ch]', gap && 'mr-[1ch]')} />);
        chars.push(<span key={i} className="inline-block w-[1ch]" />);
        continue;
      }
      const cls = cn(isHit && !isSel && 'bg-amber-400/40', isSel && 'bg-primary/30 text-foreground');
      cells.push(
        <span key={i} data-o={off} className={cn('inline-block w-[3ch] cursor-default', gap && 'mr-[1ch]', cls, b !== null && !isSel && byteClass(b))}>
          {b === null ? '··' : hex2(b, upper)}
        </span>
      );
      chars.push(
        <span key={i} data-o={off} className={cn('inline-block w-[1ch] cursor-default', cls, b !== null && !isSel && byteClass(b))}>
          {b === null ? '·' : asciiChar(b)}
        </span>
      );
    }
    rows.push(
      <div key={r} style={{ height: ROW_H }} className="flex items-center whitespace-pre leading-5">
        <span className="mr-3 select-none text-muted-foreground">{formatOffset(base, offW)}</span>
        <span className="mr-3">{cells}</span>
        <span className="border-l pl-3">{chars}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <div
        ref={boxRef}
        tabIndex={0}
        role="grid"
        aria-label="Hex view"
        data-testid="hex-grid"
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const o = offsetFromTarget(e.target);
          boxRef.current?.focus();
          if (o === null) return;
          e.preventDefault();
          if (e.shiftKey && sel) setSel({ anchor: sel.anchor, focus: o });
          else setSel({ anchor: o, focus: o });
          dragRef.current = { mode: 'select', startY: e.clientY, startTop: 0 };
        }}
        onMouseOver={(e) => {
          if (dragRef.current?.mode !== 'select' || !sel) return;
          const o = offsetFromTarget(e.target);
          if (o !== null && o !== sel.focus) setSel({ anchor: sel.anchor, focus: o });
        }}
        className="min-w-0 flex-1 select-none overflow-x-auto rounded-md border bg-card px-3 py-0 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        style={{ height: trackH }}
      >
        <div className="w-max">{rows}</div>
      </div>
      <div ref={trackRef} className="relative w-3 shrink-0 select-none rounded bg-muted/60" style={{ height: trackH }} onPointerDown={onTrackDown} data-testid="hex-scrollbar" aria-hidden>
        <div
          className="absolute inset-x-0 cursor-grab rounded bg-foreground/30 hover:bg-foreground/50 active:cursor-grabbing"
          style={{ top: thumbTop, height: thumbH, touchAction: 'none' }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          onPointerCancel={onThumbUp}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entropy                                                             */
/* ------------------------------------------------------------------ */

function entropyColor(e: number): string {
  const t = Math.max(0, Math.min(8, e)) / 8;
  return `hsl(${Math.round(220 - 220 * t)} 72% ${t > 0.45 && t < 0.7 ? 46 : 52}%)`;
}

type EntState = { state: 'idle' } | { state: 'running'; pct: number } | { state: 'done'; result: EntropyResult } | { state: 'error'; message: string };

function EntropyPanel({ ent, size, onRun, onCancel, onJump }: { ent: EntState; size: number; onRun: () => void; onCancel: () => void; onJump: (off: number) => void }) {
  const [showHist, setShowHist] = useState(false);
  return (
    <Panel>
      <PanelHeader title="Entropy">
        {ent.state === 'done' && (
          <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-2xs text-muted-foreground">
            <Switch checked={showHist} onCheckedChange={setShowHist} /> histogram
          </label>
        )}
        {ent.state === 'running' ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onRun} disabled={size === 0}>
            {ent.state === 'done' ? 'Re-analyze' : 'Analyze'}
          </Button>
        )}
      </PanelHeader>
      <div className="space-y-2 p-3 text-xs" data-testid="entropy-panel">
        {ent.state === 'idle' && <p className="text-muted-foreground">{size > AUTO_ENTROPY_LIMIT ? `Large file (${formatBytes(size)}) - click Analyze to read it once and compute entropy.` : size === 0 ? 'Nothing to analyze.' : 'Computing…'}</p>}
        {ent.state === 'running' && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Reading file… {ent.pct}%
          </p>
        )}
        {ent.state === 'error' && <ErrorBanner error={ent.message} />}
        {ent.state === 'done' && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-base font-semibold" data-testid="entropy-value">
                {ent.result.overall.toFixed(3)}
              </span>
              <span className="text-muted-foreground">bits per byte of 8 ({((ent.result.overall / 8) * 100).toFixed(1)}%)</span>
              <span>{describeEntropy(ent.result.overall)}</span>
            </div>
            <div className="flex h-8 w-full overflow-hidden rounded border" data-testid="entropy-bar" role="img" aria-label="Entropy per block">
              {ent.result.blocks.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  title={`0x${(i * ent.result.blockSize).toString(16)} · ${e.toFixed(2)} bits/byte`}
                  className="h-full min-w-px flex-1 cursor-pointer border-0 p-0 hover:opacity-70"
                  style={{ background: entropyColor(e) }}
                  onClick={() => onJump(i * ent.result.blockSize)}
                  aria-label={`Block ${i}: ${e.toFixed(2)} bits per byte`}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-24 rounded" style={{ background: `linear-gradient(to right, ${[0, 2, 4, 6, 8].map(entropyColor).join(',')})` }} /> 0 → 8 bits/byte
              </span>
              <span>
                {ent.result.blocks.length} blocks of {formatBytes(ent.result.blockSize)} · red = likely compressed / encrypted (≥ 7.5) · click a block to jump
              </span>
            </div>
            {showHist && (
              <div className="flex h-20 items-end gap-px rounded border bg-muted/30 p-1" data-testid="histogram" role="img" aria-label="Byte histogram">
                {(() => {
                  const max = Math.max(1, ...ent.result.histogram);
                  return ent.result.histogram.map((c, i) => (
                    <div key={i} title={`0x${hex2(i, true)}: ${c.toLocaleString('en-US')}`} className="min-w-px flex-1 bg-primary/70" style={{ height: `${Math.max(c > 0 ? 2 : 0, (c / max) * 100)}%` }} />
                  ));
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

type InputTab = 'file' | 'hex' | 'base64';

export default function HexViewerTool() {
  const idRef = useRef(1);
  const [src, setSrc] = useState<Source | null>(null);
  const [tab, setTab] = useState<InputTab>('file');
  const [hexText, setHexText] = useState('');
  const [b64Text, setB64Text] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const [bpr, setBpr] = useState(16);
  const [group, setGroup] = useState(8);
  const [upper, setUpper] = useState(false);
  const [topRow, setTopRowState] = useState(0);
  const [sel, setSel] = useState<{ anchor: number; focus: number } | null>(null);
  const [hit, setHit] = useState<{ start: number; len: number } | null>(null);
  const [win, setWin] = useState<HexWindow | null>(null);
  const reqId = useRef(0);
  const winRef = useRef<HexWindow | null>(null);

  const [gotoText, setGotoText] = useState('');
  const [gotoError, setGotoError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'hex' | 'text'>('hex');
  const [matchCase, setMatchCase] = useState(true);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [searching, setSearching] = useState<number | null>(null);
  const searchSignal = useRef<{ cancelled: boolean }>({ cancelled: false });

  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [ent, setEnt] = useState<EntState>({ state: 'idle' });
  const entId = useRef(0);

  const [inspectorBytes, setInspectorBytes] = useState<Uint8Array>(new Uint8Array(0));

  const setTopRow = useCallback((fn: (r: number) => number) => setTopRowState((r) => fn(r)), []);

  /* ---- load sources ---- */
  const open = useCallback((blob: Blob, name: string, kind: Source['kind']) => {
    const id = idRef.current++;
    winRef.current = null;
    setWin(null);
    setSel(null);
    setHit(null);
    setSearchMsg(null);
    setTopRowState(0);
    setDetection(null);
    setEnt({ state: 'idle' });
    setSrc({ id, blob, size: blob.size, name, kind });
  }, []);

  useEffect(() => {
    // realistic prefilled sample: a small PNG with a tEXt chunk
    const bin = atob(SAMPLE_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    open(new Blob([bytes as unknown as BlobPart]), 'sample.png', 'sample');
  }, [open]);

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setInputError(null);
      open(f, f.name, 'file');
    },
    [open]
  );

  const onHexChange = useCallback(
    (text: string) => {
      setHexText(text);
      if (text.trim() === '') {
        setInputError(null);
        return;
      }
      try {
        const bytes = parseHexInput(text);
        setInputError(null);
        open(new Blob([bytes as unknown as BlobPart]), 'pasted-hex.bin', 'hex');
      } catch (e) {
        setInputError(errMsg(e));
      }
    },
    [open]
  );

  const onB64Change = useCallback(
    (text: string) => {
      setB64Text(text);
      if (text.trim() === '') {
        setInputError(null);
        return;
      }
      try {
        const bytes = parseBase64Input(text);
        setInputError(null);
        open(new Blob([bytes as unknown as BlobPart]), 'pasted-base64.bin', 'base64');
      } catch (e) {
        setInputError(errMsg(e));
      }
    },
    [open]
  );

  /* ---- window loading ---- */
  useEffect(() => {
    if (!src) return;
    const need0 = topRow * bpr;
    const need1 = Math.min(src.size, (topRow + VIS) * bpr);
    const w = winRef.current;
    if (w && w.srcId === src.id && w.start <= need0 && w.start + w.bytes.length >= need1) return;
    const start = Math.max(0, (topRow - VIS) * bpr);
    const end = Math.min(src.size, (topRow + 2 * VIS) * bpr);
    const id = ++reqId.current;
    src.blob
      .slice(start, end)
      .arrayBuffer()
      .then((buf) => {
        if (id !== reqId.current) return;
        const next = { srcId: src.id, start, bytes: new Uint8Array(buf) };
        winRef.current = next;
        setWin(next);
      })
      .catch(() => {
        /* the file may have been removed from disk; leave placeholders */
      });
  }, [src, topRow, bpr]);

  /* ---- detection ---- */
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setDetecting(true);
    detectFileType(readOf(src.blob), src.size)
      .then((d) => {
        if (!cancelled) setDetection(d);
      })
      .catch(() => {
        if (!cancelled) setDetection(null);
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  /* ---- entropy ---- */
  const runEntropy = useCallback(async () => {
    if (!src || src.size === 0) return;
    const id = ++entId.current;
    setEnt({ state: 'running', pct: 0 });
    try {
      const acc = new EntropyAccumulator(src.size, 256);
      const CH = 8 * 1024 * 1024;
      for (let o = 0; o < src.size; o += CH) {
        if (id !== entId.current) return;
        const buf = new Uint8Array(await src.blob.slice(o, Math.min(src.size, o + CH)).arrayBuffer());
        acc.push(buf);
        setEnt({ state: 'running', pct: Math.min(99, Math.floor(((o + buf.length) / src.size) * 100)) });
        await tick();
      }
      if (id === entId.current) setEnt({ state: 'done', result: acc.finish() });
    } catch (e) {
      if (id === entId.current) setEnt({ state: 'error', message: errMsg(e) });
    }
  }, [src]);

  const cancelEntropy = useCallback(() => {
    entId.current++;
  }, []);

  useEffect(() => {
    if (src && src.size > 0 && src.size <= AUTO_ENTROPY_LIMIT) void runEntropy();
    return cancelEntropy;
  }, [src, runEntropy, cancelEntropy]);

  /* ---- inspector bytes ---- */
  const selStart = sel ? Math.min(sel.anchor, sel.focus) : null;
  const selEnd = sel ? Math.max(sel.anchor, sel.focus) : null;
  const selLen = selStart !== null && selEnd !== null ? selEnd - selStart + 1 : 0;
  useEffect(() => {
    if (!src || selStart === null) {
      setInspectorBytes(new Uint8Array(0));
      return;
    }
    let cancelled = false;
    src.blob
      .slice(selStart, selStart + 16)
      .arrayBuffer()
      .then((b) => {
        if (!cancelled) setInspectorBytes(new Uint8Array(b));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src, selStart]);
  const inspect = useMemo(() => inspectBytes(inspectorBytes), [inspectorBytes]);

  /* ---- navigation ---- */
  const jumpTo = useCallback(
    (off: number, select = true) => {
      if (!src) return;
      const o = Math.max(0, Math.min(src.size - 1, off));
      const row = Math.floor(o / bpr);
      const maxTop = Math.max(0, Math.ceil(src.size / bpr) - VIS);
      setTopRowState(Math.max(0, Math.min(maxTop, row - 3)));
      if (select) setSel({ anchor: o, focus: o });
    },
    [src, bpr]
  );

  const changeBpr = useCallback(
    (n: number) => {
      const topOff = topRow * bpr;
      setBpr(n);
      setTopRowState(Math.floor(topOff / n));
      if (n < group) setGroup(n);
    },
    [topRow, bpr, group]
  );

  const doGoto = useCallback(() => {
    if (!src) return;
    try {
      const o = parseOffset(gotoText, src.size);
      setGotoError(null);
      jumpTo(o);
    } catch (e) {
      setGotoError(errMsg(e));
    }
  }, [src, gotoText, jumpTo]);

  /* ---- search ---- */
  const runSearch = useCallback(
    async (dir: 1 | -1) => {
      if (!src) return;
      setSearchMsg(null);
      let pattern: Uint8Array;
      try {
        pattern = mode === 'hex' ? parseHexInput(query) : new TextEncoder().encode(query);
      } catch (e) {
        setSearchMsg(errMsg(e));
        return;
      }
      if (pattern.length === 0) {
        setSearchMsg('Enter something to search for.');
        return;
      }
      const signal = { cancelled: false };
      searchSignal.current.cancelled = true;
      searchSignal.current = signal;
      const read = readOf(src.blob);
      const from = hit ? (dir === 1 ? hit.start + 1 : hit.start - 1) : selStart !== null ? (dir === 1 ? selStart + 1 : selStart - 1) : dir === 1 ? topRow * bpr : Math.min(src.size, (topRow + VIS) * bpr);
      setSearching(0);
      try {
        const opts = { ignoreCase: mode === 'text' && !matchCase, signal, onProgress: (pos: number) => setSearching(Math.min(99, Math.floor((pos / Math.max(1, src.size)) * 100))) };
        let r = from < 0 && dir === -1 ? -1 : from >= src.size && dir === 1 ? -1 : await findPattern(read, src.size, pattern, from, dir, opts);
        let wrapped = false;
        if (r === -1 && !signal.cancelled) {
          r = await findPattern(read, src.size, pattern, dir === 1 ? 0 : src.size, dir, opts);
          wrapped = r >= 0;
        }
        if (r === -2 || signal.cancelled) {
          setSearchMsg('Search cancelled.');
        } else if (r < 0) {
          setHit(null);
          setSearchMsg('No matches found.');
        } else {
          setHit({ start: r, len: pattern.length });
          setSel({ anchor: r, focus: r });
          jumpTo(r, false);
          setSearchMsg(`Match at 0x${r.toString(16)} (${r.toLocaleString('en-US')})${wrapped ? ' - wrapped around' : ''}`);
        }
      } catch (e) {
        setSearchMsg(errMsg(e));
      } finally {
        if (searchSignal.current === signal) setSearching(null);
      }
    },
    [src, mode, query, matchCase, hit, selStart, topRow, bpr, jumpTo]
  );

  /* ---- selection export ---- */
  const readSelection = useCallback(async (): Promise<Uint8Array> => {
    if (!src || selStart === null || selEnd === null) return new Uint8Array(0);
    return new Uint8Array(await src.blob.slice(selStart, selEnd + 1).arrayBuffer());
  }, [src, selStart, selEnd]);

  const extCheck = useMemo(() => (detection && src && src.kind === 'file' ? checkExtension(src.name, detection) : null), [detection, src]);
  const totalRows = src ? Math.max(1, Math.ceil(src.size / bpr)) : 1;
  const Icon = detection ? CATEGORY_ICON[detection.category] : FileIcon;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as InputTab)}>
          <TabsList>
            <TabsTrigger value="file">Open file</TabsTrigger>
            <TabsTrigger value="hex">Paste hex</TabsTrigger>
            <TabsTrigger value="base64">Paste Base64</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'file' && (
          <div data-testid="file-drop">
            <FileDropzone
              onFiles={onFiles}
              label={src && src.kind === 'file' ? src.name : 'Drop any file to inspect it'}
              hint={src && src.kind === 'file' ? `${formatBytes(src.size)} · only the visible window is read into memory` : 'multi-GB files are fine - nothing is uploaded'}
              compact
            />
          </div>
        )}
        {tab === 'hex' && (
          <Textarea
            value={hexText}
            onChange={(e) => onHexChange(e.target.value)}
            spellCheck={false}
            placeholder={'7f 45 4c 46 · DE:AD:BE:EF · 0x89, 0x50 · \\x25\\x50\\x44\\x46 · hexdump -C / xxd output'}
            className="max-h-40 min-h-20 font-mono text-xs"
            aria-label="Hex input"
          />
        )}
        {tab === 'base64' && (
          <Textarea
            value={b64Text}
            onChange={(e) => onB64Change(e.target.value)}
            spellCheck={false}
            placeholder="Paste Base64 (standard or URL-safe, optionally a data: URL)"
            className="max-h-40 min-h-20 font-mono text-xs"
            aria-label="Base64 input"
          />
        )}
        <ErrorBanner error={inputError} />
      </div>

      {src && (
        <>
          <OptionsBar>
            <Field label="Bytes per row">
              <Select value={String(bpr)} onValueChange={(v) => changeBpr(Number(v))}>
                <SelectTrigger className="w-24" aria-label="Bytes per row">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="32">32</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Group">
              <Select value={String(group)} onValueChange={(v) => setGroup(Number(v))}>
                <SelectTrigger className="w-24" aria-label="Group size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Toggle label="Uppercase hex" checked={upper} onChange={setUpper} />
            <Field label="Go to offset" hint={gotoError ?? undefined} className="min-w-[10rem]">
              <div className="flex gap-1">
                <Input
                  value={gotoText}
                  onChange={(e) => setGotoText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doGoto()}
                  placeholder="0x1F0 or 496"
                  className={cn('w-32 font-mono', gotoError && 'border-destructive')}
                  aria-label="Go to offset"
                  aria-invalid={!!gotoError}
                />
                <Button variant="secondary" size="sm" className="h-8" onClick={doGoto}>
                  Go
                </Button>
              </div>
            </Field>
            <div className="flex items-end gap-1">
              <Button variant="ghost" size="icon-sm" title="Start of file" aria-label="Start of file" onClick={() => jumpTo(0)}>
                <ChevronsUp className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Page up" aria-label="Page up" onClick={() => setTopRowState((r) => Math.max(0, r - (VIS - 1)))}>
                <ChevronUp className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Page down" aria-label="Page down" onClick={() => setTopRowState((r) => Math.max(0, Math.min(totalRows - VIS, r + (VIS - 1))))}>
                <ChevronDown className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" title="End of file" aria-label="End of file" onClick={() => jumpTo(src.size - 1)}>
                <ChevronsDown className="size-4" />
              </Button>
            </div>
          </OptionsBar>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'hex' | 'text')}>
              <TabsList>
                <TabsTrigger value="hex">Hex bytes</TabsTrigger>
                <TabsTrigger value="text">Text (UTF-8)</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch(e.shiftKey ? -1 : 1)}
              placeholder={mode === 'hex' ? 'e.g. 50 4B 03 04' : 'e.g. PNG'}
              className="min-w-[10rem] flex-1 font-mono"
              aria-label="Search pattern"
            />
            {mode === 'text' && <Toggle label="Match case" checked={matchCase} onChange={setMatchCase} />}
            <Button variant="secondary" size="sm" onClick={() => void runSearch(-1)} disabled={searching !== null} aria-label="Find previous">
              <ChevronUp className="size-3.5" /> Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void runSearch(1)} disabled={searching !== null} aria-label="Find next" data-testid="find-next">
              <Search className="size-3.5" /> Next
            </Button>
            {searching !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  searchSignal.current.cancelled = true;
                }}
              >
                <Loader2 className="size-3.5 animate-spin" /> {searching}% - cancel
              </Button>
            )}
            {searchMsg && (
              <span className="text-xs text-muted-foreground" data-testid="search-msg" role="status">
                {searchMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Panel>
              <PanelHeader title={`${src.name} · ${formatBytes(src.size)}`}>
                <span className="px-2 font-mono text-2xs text-muted-foreground">
                  row {(topRow + 1).toLocaleString('en-US')}–{Math.min(totalRows, topRow + VIS).toLocaleString('en-US')} of {totalRows.toLocaleString('en-US')}
                </span>
              </PanelHeader>
              <div className="p-2">
                {src.size === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">This file is empty (0 bytes).</p>
                ) : (
                  <HexGrid src={src} bpr={bpr} group={group} upper={upper} topRow={topRow} setTopRow={setTopRow} sel={sel} setSel={setSel} hit={hit} win={win} />
                )}
              </div>
              <StatBar
                items={[
                  `${src.size.toLocaleString('en-US')} bytes`,
                  sel && selStart !== null && `selection 0x${selStart.toString(16)}${selLen > 1 ? `–0x${(selEnd ?? selStart).toString(16)}` : ''} (${selLen.toLocaleString('en-US')} byte${selLen === 1 ? '' : 's'})`,
                  'click to select · shift-click or drag for a range · arrow keys · wheel',
                ]}
              />
            </Panel>

            <div className="flex min-w-0 flex-col gap-3">
              <Panel>
                <PanelHeader title="Data inspector" />
                <div className="p-2" data-testid="inspector">
                  {selStart === null ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">Select a byte to decode it as integers, floats, text and timestamps.</p>
                  ) : (
                    <table className="w-full table-fixed border-collapse font-mono text-2xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="w-[34%] py-0.5 pr-1 font-medium"> </th>
                          <th className="py-0.5 pr-1 font-medium">Little-endian</th>
                          <th className="py-0.5 font-medium">Big-endian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspect.map((r) => (
                          <tr key={r.label} className="border-t align-top">
                            <td className="py-0.5 pr-1 text-muted-foreground">{r.label}</td>
                            {r.single ? (
                              <td colSpan={2} className="break-all py-0.5" data-testid={`insp-${r.label}`}>
                                {r.le}
                              </td>
                            ) : (
                              <>
                                <td className="break-all py-0.5 pr-1" data-testid={`insp-${r.label}-le`}>
                                  {r.le}
                                </td>
                                <td className="break-all py-0.5" data-testid={`insp-${r.label}-be`}>
                                  {r.be}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Selection" />
                <div className="flex flex-wrap items-center gap-1 p-2">
                  {selStart === null ? (
                    <p className="px-1 py-1 text-xs text-muted-foreground">Nothing selected.</p>
                  ) : (
                    <>
                      <CopyButton value={async () => toHexString(await readSelection(), upper)} label="Hex" variant="outline" disabled={selLen > COPY_LIMIT} />
                      <CopyButton value={async () => toCArray(await readSelection(), 'data', upper)} label="C array" variant="outline" disabled={selLen > COPY_LIMIT} />
                      <CopyButton value={async () => toBase64(await readSelection())} label="Base64" variant="outline" disabled={selLen > COPY_LIMIT} />
                      <DownloadButton
                        data={() => src.blob.slice(selStart, (selEnd ?? selStart) + 1)}
                        filename={`selection-0x${selStart.toString(16)}-${selLen}.bin`}
                        mime="application/octet-stream"
                        label=".bin"
                        variant="outline"
                      />
                      {selLen > COPY_LIMIT && <span className="basis-full px-1 text-2xs text-muted-foreground">Selection is over 4 MB - copying is disabled, download it as .bin instead.</span>}
                    </>
                  )}
                </div>
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="File type" />
              <div className="space-y-2 p-3" data-testid="type-panel">
                {detecting && !detection && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Detecting…
                  </p>
                )}
                {detection && (
                  <>
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-8 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold" data-testid="detected-name">
                            {detection.name}
                          </span>
                          <Badge variant={detection.confidence === 'high' ? 'default' : 'secondary'} data-testid="detected-confidence">
                            {detection.confidence} confidence
                          </Badge>
                        </div>
                        <dl className="mt-1 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 text-xs">
                          <dt className="text-muted-foreground">MIME</dt>
                          <dd className="flex items-center gap-1 font-mono" data-testid="detected-mime">
                            {detection.mime}
                            <CopyButton value={detection.mime} size="icon-sm" />
                          </dd>
                          <dt className="text-muted-foreground">Extension</dt>
                          <dd className="font-mono" data-testid="detected-ext">
                            {detection.ext ? `.${detection.ext}` : '-'}
                            {detection.exts.length > 1 && <span className="text-muted-foreground"> (also {detection.exts.filter((e) => e !== detection.ext).slice(0, 5).map((e) => `.${e}`).join(' ')})</span>}
                          </dd>
                          <dt className="text-muted-foreground">Category</dt>
                          <dd>{detection.category}</dd>
                        </dl>
                      </div>
                    </div>
                    {detection.details.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-muted-foreground" data-testid="detected-details">
                        {detection.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                    {detection.alternatives.length > 0 && <p className="text-2xs text-muted-foreground">Also matches: {detection.alternatives.join(', ')}</p>}
                    {extCheck?.status === 'mismatch' && <Notice>{extCheck.message}</Notice>}
                    {extCheck?.status === 'match' && <Notice tone="ok">The file extension matches the detected type.</Notice>}
                    {extCheck?.status === 'noext' && <p className="text-2xs text-muted-foreground">{extCheck.message}</p>}
                  </>
                )}
              </div>
            </Panel>
            <EntropyPanel ent={ent} size={src.size} onRun={() => void runEntropy()} onCancel={() => {
                cancelEntropy();
                setEnt({ state: 'idle' });
              }} onJump={(o) => jumpTo(o)} />
          </div>
        </>
      )}

      <p className="text-2xs text-muted-foreground">
        Files are read in small windows with Blob.slice, so very large files stay responsive; type detection checks ~100 signatures plus ZIP / OLE / ISO-BMFF internals, and is a strong hint rather than proof. Entropy of 7.5+ bits per byte
        usually means compressed or encrypted data. 64-bit values use BigInt.
      </p>
    </div>
  );
}
