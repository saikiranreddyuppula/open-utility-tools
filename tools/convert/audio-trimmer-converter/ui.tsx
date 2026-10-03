'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize2, Play, Square, Download, ZoomIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import {
  computePeaks,
  decodedBytes,
  encodeWav,
  finishSegment,
  formatClock,
  gainToDb,
  makeResamplePlan,
  outputName,
  parseClock,
  peakInRange,
  peaksToColumns,
  prepareSegment,
  resampleRange,
  resampledLength,
  sniffAudio,
  wavFileSize,
  type BitDepth,
  type Channels,
  type Peaks,
} from './logic';

const MAX_FILE_BYTES = 1.5 * 1024 * 1024 * 1024;
const BIG_FILE_BYTES = 150 * 1024 * 1024;
const MEMORY_WARN_BYTES = 600 * 1024 * 1024;
const MIN_SELECTION = 0.001;
const PEAK_BUCKETS = 32768;
const ACCEPT = 'audio/*,video/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm,.mp4,.mov,.mkv,.weba';

interface Loaded {
  name: string;
  size: number;
  channels: Channels;
  sampleRate: number;
  frames: number;
  duration: number;
  peaks: Peaks;
  rateKnown: boolean;
}

interface Range {
  start: number;
  end: number;
}

interface ExportResult {
  url: string;
  name: string;
  bytes: number;
}

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function makeContext(rate: number | null): AudioContext {
  const Ctor = audioCtor();
  if (!Ctor) throw new Error('This browser does not support the Web Audio API.');
  if (rate && rate >= 8000 && rate <= 96000) {
    try {
      return new Ctor({ sampleRate: rate });
    } catch {
      /* fall back to the device rate */
    }
  }
  return new Ctor();
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function numberOr(text: string, fallback: number): number {
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

function tickLabel(t: number, span: number): string {
  if (span >= 120) return formatClock(t).replace(/\.\d+$/, '');
  if (span >= 10) return formatClock(t).replace(/\d\d$/, '');
  return formatClock(t);
}

/* ------------------------------------------------------------------ */

function TimeField({ label, value, onCommit }: { label: string; value: number; onCommit: (seconds: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatClock(value);
  const bad = draft !== null && parseClock(draft) === null;
  const commit = (): void => {
    if (draft !== null) {
      const v = parseClock(draft);
      if (v !== null) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <Field label={label} hint="mm:ss.mmm">
      <Input
        value={shown}
        onFocus={() => setDraft(formatClock(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        aria-label={label}
        aria-invalid={bad || undefined}
        inputMode="decimal"
        className="h-8 w-32 font-mono text-sm"
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 font-mono text-sm"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </Field>
  );
}

function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-xs', disabled && 'cursor-not-allowed opacity-50')}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} />
      <span>{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */

interface WaveformProps {
  audio: Loaded;
  view: Range;
  sel: Range;
  onSel: (r: Range) => void;
  playheadRef: React.RefObject<HTMLDivElement | null>;
}

function Waveform({ audio, view, sel, onSel, playheadRef }: WaveformProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [themeTick, setThemeTick] = useState(0);
  const drag = useRef<{ mode: 'start' | 'end' | 'new'; anchor: number; x0: number; moved: boolean } | null>(null);

  const span = Math.max(1e-6, view.end - view.start);
  const pct = (t: number): number => clamp(((t - view.start) / span) * 100, 0, 100);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const fullView = view.start <= 0 && view.end >= audio.duration - 1e-9;

  const columns = useMemo(() => {
    const cols = Math.max(1, Math.round(width * (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)));
    if (width === 0) return null;
    if (fullView) return peaksToColumns(audio.peaks, cols);
    const a = Math.floor(view.start * audio.sampleRate);
    const b = Math.ceil(view.end * audio.sampleRate);
    return computePeaks(audio.channels, a, b, cols);
  }, [audio, view.start, view.end, width, fullView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || !columns) return;
    const dpr = window.devicePixelRatio || 1;
    const h = box.clientHeight;
    canvas.width = columns.min.length;
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const color = getComputedStyle(box).color;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mid = canvas.height / 2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, Math.floor(mid), canvas.width, Math.max(1, Math.round(dpr)));
    ctx.globalAlpha = 1;
    const amp = mid * 0.94;
    for (let x = 0; x < columns.min.length; x++) {
      const hi = columns.max[x] ?? 0;
      const lo = columns.min[x] ?? 0;
      const y1 = mid - Math.min(1, hi) * amp;
      const y2 = mid - Math.max(-1, lo) * amp;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }, [columns, themeTick]);

  const timeAt = (clientX: number): number => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return view.start;
    return view.start + clamp((clientX - r.left) / r.width, 0, 1) * span;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const xs = (pct(sel.start) / 100) * r.width;
    const xe = (pct(sel.end) / 100) * r.width;
    const t = timeAt(e.clientX);
    let mode: 'start' | 'end' | 'new' = 'new';
    if (Math.abs(x - xs) <= 9 && Math.abs(x - xs) <= Math.abs(x - xe)) mode = 'start';
    else if (Math.abs(x - xe) <= 9) mode = 'end';
    drag.current = { mode, anchor: t, x0: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const t = timeAt(e.clientX);
    if (d.mode === 'start') onSel({ start: Math.min(t, sel.end - MIN_SELECTION), end: sel.end });
    else if (d.mode === 'end') onSel({ start: sel.start, end: Math.max(t, sel.start + MIN_SELECTION) });
    else {
      if (!d.moved && Math.abs(e.clientX - d.x0) < 4) return;
      d.moved = true;
      const a = Math.min(d.anchor, t);
      const b = Math.max(d.anchor, t);
      onSel({ start: a, end: Math.max(b, a + MIN_SELECTION) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const nudge = (which: 'start' | 'end', e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 0.1 : e.altKey ? 1 : 0.01;
    let dir = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') dir = -1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') dir = 1;
    else return;
    e.preventDefault();
    if (which === 'start') onSel({ start: clamp(sel.start + dir * step, 0, sel.end - MIN_SELECTION), end: sel.end });
    else onSel({ start: sel.start, end: clamp(sel.end + dir * step, sel.start + MIN_SELECTION, audio.duration) });
  };

  const tickCount = width > 0 && width < 520 ? 3 : 6;
  const ticks = useMemo(() => Array.from({ length: tickCount }, (_, i) => view.start + (span * i) / (tickCount - 1)), [view.start, span, tickCount]);

  return (
    <div className="select-none">
      <div
        ref={boxRef}
        className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden bg-muted/30 text-primary"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="waveform"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-background/70" style={{ width: `${pct(sel.start)}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 bg-background/70" style={{ width: `${100 - pct(sel.end)}%` }} />
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-primary/40"
          style={{ left: `${pct(sel.start)}%`, width: `${Math.max(0, pct(sel.end) - pct(sel.start))}%` }}
        />
        {(['start', 'end'] as const).map((which) => {
          const t = which === 'start' ? sel.start : sel.end;
          const visible = t >= view.start && t <= view.end;
          return (
            <div
              key={which}
              role="slider"
              tabIndex={0}
              aria-label={which === 'start' ? 'Selection start' : 'Selection end'}
              aria-valuemin={0}
              aria-valuemax={audio.duration}
              aria-valuenow={t}
              aria-valuetext={formatClock(t)}
              onKeyDown={(e) => nudge(which, e)}
              className={cn('group absolute inset-y-0 w-0 outline-none', !visible && 'hidden')}
              style={{ left: `${pct(t)}%` }}
            >
              <span className="pointer-events-none absolute inset-y-0 -left-px w-0.5 bg-primary" />
              <span
                className={cn(
                  'pointer-events-none absolute top-0 h-5 w-3 rounded-sm bg-primary shadow group-focus-visible:ring-2 group-focus-visible:ring-ring',
                  which === 'start' ? 'left-0 rounded-l-none' : 'right-0 rounded-r-none'
                )}
                style={which === 'end' ? { transform: 'translateX(1px)' } : undefined}
              />
            </div>
          );
        })}
        <div ref={playheadRef} className="pointer-events-none absolute inset-y-0 hidden w-px bg-foreground" data-testid="playhead" />
      </div>
      <div className="flex justify-between px-1 pt-1 font-mono text-2xs text-muted-foreground tabular">
        {ticks.map((t, i) => (
          <span key={i}>{tickLabel(t, span)}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const RATES = ['keep', '48000', '44100', '22050', '16000', '8000'];

export default function AudioTrimmerTool() {
  const [audio, setAudio] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sel, setSel] = useState<Range>({ start: 0, end: 0 });
  const [view, setView] = useState<Range>({ start: 0, end: 0 });

  const [fadeIn, setFadeIn] = useState('0');
  const [fadeOut, setFadeOut] = useState('0');
  const [gainDb, setGainDb] = useState('0');
  const [normalize, setNormalize] = useState(false);
  const [mono, setMono] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [rate, setRate] = useState('keep');
  const [depth, setDepth] = useState<BitDepth>(16);
  const [dither, setDither] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [peak, setPeak] = useState<number | null>(null);

  const playheadRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; raf: number } | null>(null);
  const runId = useRef(0);

  /* ---- playback ---- */
  const stopPlayback = useCallback(() => {
    const p = playRef.current;
    playRef.current = null;
    if (p) {
      cancelAnimationFrame(p.raf);
      p.src.onended = null;
      try {
        p.src.stop();
      } catch {
        /* already stopped */
      }
      void p.ctx.close().catch(() => undefined);
    }
    if (playheadRef.current) playheadRef.current.style.display = 'none';
    setPlaying(false);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result]
  );

  /* ---- loading ---- */
  const loadFile = useCallback(
    async (file: File) => {
      stopPlayback();
      const myRun = ++runId.current;
      setError(null);
      setNotice(null);
      setResult(null);
      setPeak(null);
      if (file.size > MAX_FILE_BYTES) {
        setError(`This file is ${formatBytes(file.size)}. Files over ${formatBytes(MAX_FILE_BYTES)} cannot be decoded in the browser.`);
        return;
      }
      setLoading(true);
      let ctx: AudioContext | null = null;
      try {
        const bytes = await file.arrayBuffer();
        const sniffed = sniffAudio(new Uint8Array(bytes));
        ctx = makeContext(sniffed.sampleRate);
        const buf = await ctx.decodeAudioData(bytes);
        if (myRun !== runId.current) return;
        const channels: Channels = [];
        for (let i = 0; i < buf.numberOfChannels; i++) channels.push(buf.getChannelData(i));
        const frames = buf.length;
        if (frames === 0) throw new Error('The file decoded to zero samples.');
        const loaded: Loaded = {
          name: file.name,
          size: file.size,
          channels,
          sampleRate: buf.sampleRate,
          frames,
          duration: buf.duration,
          peaks: computePeaks(channels, 0, frames, PEAK_BUCKETS),
          rateKnown: sniffed.sampleRate !== null && Math.abs(sniffed.sampleRate - buf.sampleRate) < 1,
        };
        const notes: string[] = [];
        if (decodedBytes(frames, channels.length) > MEMORY_WARN_BYTES) {
          notes.push(
            `Decoded audio takes about ${formatBytes(decodedBytes(frames, channels.length))} of memory (duration × sample rate × channels × 4 bytes). Very long files can be slow or fail on low-memory devices.`
          );
        } else if (file.size > BIG_FILE_BYTES) {
          notes.push('Large file: processing may take a while.');
        }
        setNotice(notes.length ? notes.join(' ') : null);
        setAudio(loaded);
        setSel({ start: 0, end: loaded.duration });
        setView({ start: 0, end: loaded.duration });
      } catch (e) {
        if (myRun !== runId.current) return;
        const msg = e instanceof Error && e.message ? e.message : 'unknown error';
        setAudio(null);
        setError(
          `Could not decode "${file.name}". The browser may not support this codec or the file may be damaged (${msg}). MP3, WAV, OGG/Opus, FLAC and WebM usually work; AAC/M4A support depends on the browser.`
        );
      } finally {
        if (ctx) void ctx.close().catch(() => undefined);
        if (myRun === runId.current) setLoading(false);
      }
    },
    [stopPlayback]
  );

  /* ---- selection ---- */
  const setSelection = useCallback(
    (r: Range) => {
      if (!audio) return;
      const a = clamp(r.start, 0, audio.duration - MIN_SELECTION);
      const b = clamp(r.end, a + MIN_SELECTION, audio.duration);
      setSel({ start: a, end: b });
    },
    [audio]
  );

  const zoomToSelection = useCallback(() => {
    if (!audio) return;
    const pad = (sel.end - sel.start) * 0.05;
    setView({ start: clamp(sel.start - pad, 0, audio.duration), end: clamp(sel.end + pad, 0, audio.duration) });
  }, [audio, sel]);

  /* ---- derived output info ---- */
  const startFrame = audio ? Math.round(sel.start * audio.sampleRate) : 0;
  const endFrame = audio ? Math.min(audio.frames, Math.max(startFrame + 1, Math.round(sel.end * audio.sampleRate))) : 0;
  const targetRate = audio ? (rate === 'keep' ? audio.sampleRate : Number(rate)) : 44100;
  const outFrames = audio ? (targetRate === audio.sampleRate ? endFrame - startFrame : resampledLength(endFrame - startFrame, audio.sampleRate, targetRate)) : 0;
  const outChannels = audio ? (mono ? 1 : audio.channels.length) : 0;
  const outBytes = audio ? wavFileSize(outFrames, outChannels, depth) : 0;
  const gainValue = numberOr(gainDb, 0);

  // Peak of the (mono-mixed) selection, debounced so dragging stays smooth.
  useEffect(() => {
    if (!audio) return;
    const a = startFrame;
    const b = endFrame;
    const h = setTimeout(() => setPeak(peakInRange(audio.channels, a, b, mono)), 200);
    return () => clearTimeout(h);
  }, [audio, startFrame, endFrame, mono]);

  const gainInfo = useMemo(() => {
    if (peak === null) return null;
    if (peak === 0) return { text: 'Selection is silent.', clip: false };
    const peakDb = gainToDb(peak);
    if (normalize) return { text: `Peak ${peakDb.toFixed(1)} dBFS → −1.0 dBFS (${(-1 - peakDb >= 0 ? '+' : '')}${(-1 - peakDb).toFixed(1)} dB)`, clip: false };
    const after = peakDb + gainValue;
    return {
      text: `Peak ${peakDb.toFixed(1)} dBFS${gainValue !== 0 ? ` → ${after.toFixed(1)} dBFS` : ''}`,
      clip: after > 0.0001 && depth !== 32,
    };
  }, [peak, normalize, gainValue, depth]);

  /* ---- playback start ---- */
  const startPlayback = useCallback(async () => {
    if (!audio) return;
    stopPlayback();
    setError(null);
    try {
      const seg = prepareSegment(audio.channels, { startFrame, endFrame, mono, reverse });
      finishSegment(seg, audio.sampleRate, {
        fadeInMs: Math.max(0, numberOr(fadeIn, 0)),
        fadeOutMs: Math.max(0, numberOr(fadeOut, 0)),
        normalize,
        normalizeDb: -1,
        gainDb: gainValue,
      });
      const ctx = makeContext(null);
      const buffer = ctx.createBuffer(seg.length, seg[0]?.length ?? 1, audio.sampleRate);
      seg.forEach((c, i) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, i));
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      if (ctx.state === 'suspended') await ctx.resume();
      const t0 = ctx.currentTime;
      const dur = buffer.duration;
      const entry = { ctx, src, raf: 0 };
      playRef.current = entry;
      const head = playheadRef.current;
      const frame = (): void => {
        if (playRef.current !== entry) return;
        const el = Math.min(dur, ctx.currentTime - t0);
        const t = reverse ? sel.end - el : sel.start + el;
        if (head) {
          const p = ((t - view.start) / Math.max(1e-6, view.end - view.start)) * 100;
          head.style.display = p >= 0 && p <= 100 ? 'block' : 'none';
          head.style.left = `${p}%`;
        }
        entry.raf = requestAnimationFrame(frame);
      };
      src.onended = () => {
        if (playRef.current === entry) stopPlayback();
      };
      src.start();
      setPlaying(true);
      entry.raf = requestAnimationFrame(frame);
    } catch (e) {
      stopPlayback();
      setError(e instanceof Error ? e.message : 'Playback failed.');
    }
  }, [audio, startFrame, endFrame, mono, reverse, fadeIn, fadeOut, normalize, gainValue, sel, view, stopPlayback]);

  /* ---- export ---- */
  const exportWav = useCallback(async () => {
    if (!audio) return;
    stopPlayback();
    setError(null);
    setBusy(true);
    setProgress('Preparing…');
    try {
      await tick();
      let seg = prepareSegment(audio.channels, { startFrame, endFrame, mono, reverse });
      if (targetRate !== audio.sampleRate) {
        const plan = makeResamplePlan(audio.sampleRate, targetRate);
        const total = resampledLength(seg[0]?.length ?? 0, audio.sampleRate, targetRate);
        const out: Channels = [];
        const CHUNK = 262144;
        for (let c = 0; c < seg.length; c++) {
          const input = seg[c] ?? new Float32Array(0);
          const dest = new Float32Array(total);
          for (let s = 0; s < total; s += CHUNK) {
            resampleRange(plan, input, s, Math.min(total, s + CHUNK), dest);
            setProgress(`Resampling… ${Math.round(((c + s / total) / seg.length) * 100)}%`);
            await tick();
          }
          out.push(dest);
        }
        seg = out;
      }
      setProgress('Encoding WAV…');
      await tick();
      finishSegment(seg, targetRate, {
        fadeInMs: Math.max(0, numberOr(fadeIn, 0)),
        fadeOutMs: Math.max(0, numberOr(fadeOut, 0)),
        normalize,
        normalizeDb: -1,
        gainDb: gainValue,
      });
      const wav = encodeWav(seg, targetRate, depth, { dither: dither && depth === 16 });
      const blob = new Blob([wav as unknown as BlobPart], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const name = outputName(audio.name);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setResult({ url, name, bytes: wav.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [audio, startFrame, endFrame, mono, reverse, targetRate, fadeIn, fadeOut, normalize, gainValue, depth, dither, stopPlayback]);

  const selDuration = sel.end - sel.start;
  const exportTooBig = outBytes > 2 * 1024 * 1024 * 1024;

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        compact={!!audio}
        onFiles={(f) => {
          const file = f[0];
          if (file) void loadFile(file);
        }}
        accept={ACCEPT}
        label={audio ? audio.name : 'Drop an audio or video file'}
        hint={
          audio
            ? `${formatClock(audio.duration)} · ${audio.channels.length} ch · ${audio.sampleRate} Hz · ${formatBytes(audio.size)}. Drop another file to replace it.`
            : 'MP3, WAV, OGG, Opus, M4A/AAC, FLAC, WebM or a video file (its audio track is extracted)'
        }
        disabled={loading}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Decoding audio…
        </div>
      )}
      <ErrorBanner error={error} />
      {notice && <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{notice}</p>}

      {audio && (
        <>
          <Panel>
            <PanelHeader title="Waveform">
              <Button variant="ghost" size="sm" onClick={() => setSelection({ start: 0, end: audio.duration })}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={zoomToSelection} title="Zoom the waveform to the selection">
                <ZoomIn className="size-3.5" /> <span className="hidden sm:inline">Zoom to selection</span>
                <span className="sm:hidden">Zoom</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView({ start: 0, end: audio.duration })}
                disabled={view.start <= 0 && view.end >= audio.duration - 1e-9}
              >
                <Maximize2 className="size-3.5" /> <span className="hidden sm:inline">Full view</span>
                <span className="sm:hidden">Full</span>
              </Button>
            </PanelHeader>
            <Waveform audio={audio} view={view} sel={sel} onSel={setSelection} playheadRef={playheadRef} />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-t bg-muted/20 p-3">
              <TimeField label="Start" value={sel.start} onCommit={(v) => setSelection({ start: v, end: Math.max(sel.end, v + MIN_SELECTION) })} />
              <TimeField label="End" value={sel.end} onCommit={(v) => setSelection({ start: Math.min(sel.start, v - MIN_SELECTION), end: v })} />
              <Field label="Selection">
                <div className="flex h-8 items-center font-mono text-sm tabular">{formatClock(selDuration)}</div>
              </Field>
              <div className="ml-auto flex items-center gap-2">
                {playing ? (
                  <Button size="sm" variant="secondary" onClick={stopPlayback}>
                    <Square className="size-3.5" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void startPlayback()}>
                    <Play className="size-3.5" /> Play selection
                  </Button>
                )}
              </div>
            </div>
            <StatBar className="h-auto min-h-7 py-1" items={['Drag on the waveform to select', 'drag handles to adjust', 'arrow keys nudge a focused handle (Shift ×10, Alt ×100)']} />
          </Panel>

          <OptionsBar>
            <NumberField label="Fade in" value={fadeIn} onChange={setFadeIn} min={0} max={60000} step={50} suffix="ms" />
            <NumberField label="Fade out" value={fadeOut} onChange={setFadeOut} min={0} max={60000} step={50} suffix="ms" />
            <NumberField label="Gain" value={gainDb} onChange={setGainDb} min={-60} max={40} step={0.5} suffix="dB" disabled={normalize} />
            <Field label="Level">
              <div className="flex h-8 items-center">
                <Check checked={normalize} onChange={setNormalize}>Normalize to −1 dBFS</Check>
              </div>
            </Field>
            <Field label="Channels / order">
              <div className="flex h-8 items-center gap-4">
                <Check checked={mono} onChange={setMono} disabled={audio.channels.length < 2}>Mono</Check>
                <Check checked={reverse} onChange={setReverse}>Reverse</Check>
              </div>
            </Field>
            <Field label="Sample rate">
              <Select value={rate} onValueChange={setRate}>
                <SelectTrigger size="sm" className="w-36" aria-label="Sample rate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATES.map((r) => (
                    <SelectItem key={r} value={r}>{r === 'keep' ? `Keep (${audio.sampleRate} Hz)` : `${r} Hz`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="WAV format">
              <Tabs value={String(depth)} onValueChange={(v) => setDepth(Number(v) as BitDepth)}>
                <TabsList>
                  <TabsTrigger value="16">16-bit</TabsTrigger>
                  <TabsTrigger value="24">24-bit</TabsTrigger>
                  <TabsTrigger value="32">32-bit float</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Dither">
              <div className="flex h-8 items-center">
                <Check checked={dither} onChange={setDither} disabled={depth !== 16}>TPDF (16-bit only)</Check>
              </div>
            </Field>
          </OptionsBar>

          <Panel>
            <PanelHeader title="Export">
              {result && (
                <a
                  href={result.url}
                  download={result.name}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-primary hover:underline"
                >
                  <Download className="size-3.5" /> Download again ({formatBytes(result.bytes)})
                </a>
              )}
              <Button size="sm" onClick={() => void exportWav()} disabled={busy || exportTooBig}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                {busy ? (progress ?? 'Working…') : 'Export WAV'}
              </Button>
            </PanelHeader>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4" data-testid="export-info">
              {[
                ['Duration', formatClock(outFrames / targetRate)],
                ['Channels', outChannels === 1 ? 'Mono' : outChannels === 2 ? 'Stereo' : `${outChannels} ch`],
                ['Sample rate', `${targetRate} Hz`],
                ['Output size', formatBytes(outBytes)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-2xs uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="font-mono text-sm tabular">{v}</div>
                </div>
              ))}
            </div>
            {gainInfo && (
              <p className={cn('px-3 pb-2 font-mono text-xs', gainInfo.clip ? 'text-destructive' : 'text-muted-foreground')}>
                {gainInfo.text}
                {gainInfo.clip ? ' — this will clip. Lower the gain, use Normalize, or export 32-bit float.' : ''}
              </p>
            )}
            {exportTooBig && <p className="px-3 pb-2 text-xs text-destructive">The output would be over 2 GB. Select a shorter range or lower the sample rate.</p>}
            <p className="border-t px-3 py-2 text-2xs text-muted-foreground">
              Exports WAV (lossless). MP3/AAC encoding isn&apos;t available in the browser without large codecs.{' '}
              {audio.rateKnown
                ? `Decoded at the file's own ${audio.sampleRate} Hz.`
                : `Decoded at ${audio.sampleRate} Hz (the file's native rate could not be read, so the browser may have resampled it).`}{' '}
              Resampling uses a windowed-sinc filter. Fades are linear; the first and last sample are silent.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
