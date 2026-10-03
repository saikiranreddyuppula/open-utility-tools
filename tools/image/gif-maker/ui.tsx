'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Film,
  GripVertical,
  Images,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/download';
import { arrangeFrames, encodeGif, fitRect, gifBudget, readGifInfo, type FitMode, type GifFrame } from './logic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Source = 'images' | 'video';
type LoopMode = 'forever' | 'once' | 'times';
type PaletteMode = 'local' | 'global';

interface ImgItem {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
  w: number;
  h: number;
  size: number;
  /** per-frame delay override in ms; null = use the default delay. */
  delayMs: number | null;
  sample?: boolean;
}

interface VideoSrc {
  name: string;
  url: string;
  duration: number;
  w: number;
  h: number;
  size: number;
}

interface GifResult {
  url: string;
  bytes: Uint8Array;
  frames: number;
  /** frames dropped because they were identical to the previous one (their delay was merged). */
  merged: number;
  w: number;
  h: number;
  durationMs: number;
  loop: string;
  sig: string;
  encodeMs: number;
}

const MIN_DELAY = 20;
const MAX_VIDEO_FRAMES = 300;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Image / video helpers
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

let idCounter = 0;

async function itemFromBlob(blob: Blob, name: string, delayMs: number | null, sample = false): Promise<ImgItem> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width || 300;
    const h = img.naturalHeight || img.height || 150;
    return { id: `f${idCounter++}`, name, url, img, w, h, size: blob.size, delayMs, sample };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** A looping bouncing-ball animation so the tool shows something immediately. */
async function makeSampleItems(): Promise<ImgItem[]> {
  const N = 14;
  const W = 320;
  const H = 200;
  const items: ImgItem[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    const hue = 205 + 25 * Math.sin(t * Math.PI * 2);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsl(${hue}, 85%, 72%)`);
    g.addColorStop(1, `hsl(${hue + 20}, 70%, 38%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const ground = H - 36;
    ctx.fillStyle = 'rgba(20, 30, 60, 0.35)';
    ctx.fillRect(0, ground + 18, W, H - ground);
    const bounce = Math.abs(Math.sin(t * Math.PI * 2 * 2 + 0.45));
    const x = W / 2 + 85 * Math.sin(t * Math.PI * 2);
    const y = ground - 18 - bounce * 95;
    const squash = 1 - Math.max(0, 0.18 - bounce) * 1.2;
    ctx.fillStyle = `rgba(10, 15, 40, ${0.28 - bounce * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, ground + 20, 26 - bounce * 8, 6 - bounce * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const rg = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, 26);
    rg.addColorStop(0, '#fff3b0');
    rg.addColorStop(0.35, '#ffb703');
    rg.addColorStop(1, '#d9480f');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(x, y + (1 - squash) * 26, 26 / squash ** 0.5, 26 * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('GIF', 14, 28);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Could not create the sample frames.');
    items.push(await itemFromBlob(blob, `sample-${String(i + 1).padStart(2, '0')}.png`, 70, true));
  }
  return items;
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  W: number,
  H: number,
  fit: FitMode,
  bg: string,
  transparent: boolean
): void {
  ctx.clearRect(0, 0, W, H);
  if (!transparent) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }
  const r = fitRect(sw, sh, W, H, fit);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, r.dx, r.dy, r.dw, r.dh);
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeEventListener('seeked', done);
      resolve();
    };
    const timer = setTimeout(done, 3000); // some browsers never fire `seeked`; do not hang
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

async function sampleVideoFrames(
  src: VideoSrc,
  start: number,
  fps: number,
  count: number,
  W: number,
  H: number,
  fit: FitMode,
  bg: string,
  transparent: boolean,
  onProgress: (done: number) => void,
  cancelled: () => boolean
): Promise<Uint8ClampedArray[]> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = src.url;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out while loading the video.')), 20000);
    v.onloadeddata = () => {
      clearTimeout(timer);
      resolve();
    };
    v.onerror = () => {
      clearTimeout(timer);
      reject(new Error('This browser could not decode the video. Try an MP4 (H.264) or WebM file.'));
    };
    v.load();
  });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  const frames: Uint8ClampedArray[] = [];
  try {
    for (let i = 0; i < count; i++) {
      if (cancelled()) throw new Error('cancelled');
      const t = Math.max(0, Math.min(start + i / fps, (v.duration || src.duration) - 0.04));
      await seekTo(v, t);
      paintFrame(ctx, v, v.videoWidth || src.w, v.videoHeight || src.h, W, H, fit, bg, transparent);
      frames.push(ctx.getImageData(0, 0, W, H).data);
      onProgress(i + 1);
      if (i % 3 === 2) await tick();
    }
  } finally {
    v.removeAttribute('src');
    v.load();
  }
  return frames;
}

function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GifMakerTool() {
  const [source, setSource] = useState<Source>('images');
  const [items, setItems] = useState<ImgItem[]>([]);
  const [delayMs, setDelayMs] = useState(200);
  const [video, setVideo] = useState<VideoSrc | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(3);
  const [fps, setFps] = useState(12);

  const [width, setWidth] = useState(480);
  const [fit, setFit] = useState<FitMode>('contain');
  const [bg, setBg] = useState('#ffffff');
  const [transparentBg, setTransparentBg] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('forever');
  const [loopTimes, setLoopTimes] = useState(3);
  const [pingpong, setPingpong] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [dither, setDither] = useState(true);
  const [quality, setQuality] = useState(10);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('local');
  const [optimize, setOptimize] = useState(true);

  const [result, setResult] = useState<GifResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runId = useRef(0);
  const cancelRef = useRef(false);
  const resultUrl = useRef<string | null>(null);
  const itemsRef = useRef<ImgItem[]>([]);
  const videoUrlRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const generateRef = useRef<((override?: ImgItem[]) => Promise<void>) | null>(null);
  const didInit = useRef(false);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Release every object URL and stop any running job when the tool unmounts.
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      for (const it of itemsRef.current) URL.revokeObjectURL(it.url);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  // ---- derived values ----
  const arrangedCount = useMemo(() => {
    const base =
      source === 'images'
        ? items.length
        : video
          ? Math.max(1, Math.floor(Math.max(0, end - start) * fps + 1e-6) + 1)
          : 0;
    return arrangeFrames(base, { reverse, pingpong }).length;
  }, [source, items.length, video, start, end, fps, reverse, pingpong]);

  const outH = useMemo(() => {
    if (source === 'images') {
      const f = items[0];
      return f ? Math.max(1, Math.round((width * f.h) / f.w)) : Math.round(width * 0.625);
    }
    return video ? Math.max(1, Math.round((width * video.h) / video.w)) : Math.round(width * 0.5625);
  }, [source, items, video, width]);

  const budget = useMemo(() => gifBudget(width, outH, arrangedCount), [width, outH, arrangedCount]);

  const totalMs = useMemo(() => {
    if (source === 'video') return (arrangedCount * 1000) / fps;
    const order = arrangeFrames(items.length, { reverse, pingpong });
    return order.reduce((s, i) => s + (items[i]?.delayMs ?? delayMs), 0);
  }, [source, arrangedCount, fps, items, reverse, pingpong, delayMs]);

  const buildSig = useCallback(
    (list: ImgItem[]) =>
      JSON.stringify([
        source,
        source === 'images' ? list.map((i) => [i.id, i.delayMs]) : [video?.url, start, end, fps],
        delayMs, width, fit, bg, transparentBg, loopMode, loopTimes, pingpong, reverse, dither, quality, paletteMode, optimize,
      ]),
    [source, video, start, end, fps, delayMs, width, fit, bg, transparentBg, loopMode, loopTimes, pingpong, reverse, dither, quality, paletteMode, optimize]
  );
  const sig = useMemo(() => buildSig(items), [buildSig, items]);
  const stale = !!result && result.sig !== sig;

  // ---- GIF creation ----
  const generate = useCallback(
    async (override?: ImgItem[]) => {
      const myRun = ++runId.current;
      cancelRef.current = false;
      setError(null);
      setNotice(null);
      setBusy(true);
      setProgress({ label: 'Preparing frames', done: 0, total: 1 });
      const cancelled = () => cancelRef.current || myRun !== runId.current;
      try {
        const W = Math.max(16, Math.min(1920, Math.round(width)));
        let H = 0;
        let raw: GifFrame[] = [];

        if (source === 'images') {
          const list = override ?? items;
          if (list.length === 0) throw new Error('Add at least one image first.');
          const first = list[0]!;
          H = Math.max(1, Math.round((W * first.h) / first.w));
          const order = arrangeFrames(list.length, { reverse, pingpong });
          const b = gifBudget(W, H, order.length);
          if (b.level === 'block') throw new Error(b.message ?? 'Too many pixels.');
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas is not available in this browser.');
          const cache = new Map<number, Uint8ClampedArray>();
          let done = 0;
          const unique = new Set(order).size;
          for (const idx of order) {
            if (cancelled()) throw new Error('cancelled');
            if (cache.has(idx)) continue;
            const it = list[idx]!;
            paintFrame(ctx, it.img, it.w, it.h, W, H, fit, bg, transparentBg);
            cache.set(idx, ctx.getImageData(0, 0, W, H).data);
            setProgress({ label: 'Preparing frames', done: ++done, total: unique });
            if (done % 2 === 0) await tick();
          }
          raw = order.map((idx) => ({
            data: cache.get(idx)!,
            delayMs: Math.max(MIN_DELAY, list[idx]!.delayMs ?? delayMs),
          }));
        } else {
          if (!video) throw new Error('Choose a video file first.');
          if (!(fps >= 1)) throw new Error('Frame rate must be at least 1.');
          if (!(end > start)) throw new Error('The end time must be after the start time.');
          H = Math.max(1, Math.round((W * video.h) / video.w));
          const count = Math.floor((end - start) * fps + 1e-6) + 1;
          if (count > MAX_VIDEO_FRAMES) {
            throw new Error(
              `${count} frames is too many (limit ${MAX_VIDEO_FRAMES}). Shorten the clip or lower the frame rate.`
            );
          }
          const b = gifBudget(W, H, arrangeFrames(count, { reverse, pingpong }).length);
          if (b.level === 'block') throw new Error(b.message ?? 'Too many pixels.');
          const frames = await sampleVideoFrames(
            video, start, fps, count, W, H, fit, bg, transparentBg,
            (d) => setProgress({ label: 'Capturing frames', done: d, total: count }),
            cancelled
          );
          const order = arrangeFrames(frames.length, { reverse, pingpong });
          raw = order.map((idx) => ({ data: frames[idx]!, delayMs: 1000 / fps }));
        }

        if (cancelled()) throw new Error('cancelled');
        setProgress({ label: 'Encoding', done: 0, total: raw.length });
        const t0 = performance.now();
        const bytes = await encodeGif(raw, {
          width: W,
          height: H,
          loop: loopMode === 'forever' ? 0 : loopMode === 'once' ? 1 : Math.max(2, loopTimes),
          dither,
          sampleStep: Math.max(1, 11 - quality),
          palette: paletteMode,
          optimize,
          transparent: transparentBg,
          onProgress: (d, t) => {
            if (!cancelled()) setProgress({ label: 'Encoding', done: d, total: t });
          },
          shouldCancel: cancelled,
        });
        const encodeMs = performance.now() - t0;
        if (cancelled()) throw new Error('cancelled');

        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'image/gif' }));
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = url;
        const durationMs = raw.reduce((s, f) => s + f.delayMs, 0);
        let written = raw.length;
        try {
          written = readGifInfo(bytes).frames;
        } catch {
          /* keep the input count */
        }
        setResult({
          url,
          bytes,
          frames: written,
          merged: Math.max(0, raw.length - written),
          w: W,
          h: H,
          durationMs,
          loop: loopMode === 'forever' ? 'loops forever' : loopMode === 'once' ? 'plays once' : `plays ${Math.max(2, loopTimes)} times`,
          sig: buildSig(override ?? items),
          encodeMs,
        });
        if (bytes.length > 8 * 1024 * 1024) {
          setNotice(
            `This GIF is ${formatBytes(bytes.length)}. Many sites cap GIF uploads at 8–10 MB. Try a smaller width, fewer frames, a shared palette, or turn dithering off.`
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'cancelled') setError(msg);
        else setNotice('Cancelled.');
      } finally {
        if (myRun === runId.current) {
          setBusy(false);
          setProgress(null);
        }
      }
    },
    [source, items, video, start, end, fps, width, fit, bg, transparentBg, loopMode, loopTimes, pingpong, reverse, dither, quality, paletteMode, optimize, delayMs, buildSig]
  );

  useEffect(() => {
    generateRef.current = generate;
  }, [generate]);

  // Start with a sample animation already rendered.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void (async () => {
      try {
        const sample = await makeSampleItems();
        setItems(sample);
        await generateRef.current?.(sample);
      } catch {
        /* the sample is optional */
      }
    })();
  }, []);

  // ---- item management ----
  const addFiles = useCallback(async (files: File[]) => {
    setError(null);
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const skipped = files.length - imgs.length;
    const added: ImgItem[] = [];
    const failed: string[] = [];
    for (const f of imgs) {
      try {
        added.push(await itemFromBlob(f, f.name, null));
      } catch {
        failed.push(f.name);
      }
    }
    if (added.length > 0) {
      setItems((prev) => {
        // Dropping real files replaces the demo animation.
        const keep = prev.filter((p) => !p.sample);
        if (keep.length !== prev.length) for (const p of prev) if (p.sample) URL.revokeObjectURL(p.url);
        return [...keep, ...added];
      });
    }
    const problems: string[] = [];
    if (skipped > 0) problems.push(`Skipped ${skipped} non-image file${skipped === 1 ? '' : 's'}.`);
    if (failed.length > 0) problems.push(`Could not read: ${failed.join(', ')}.`);
    if (problems.length > 0) setError(problems.join(' '));
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const t = prev.find((i) => i.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearItems = () => {
    setItems((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return [];
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setItems((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      return next;
    });
  };

  const setItemDelay = (id: string, v: string) => {
    const n = v.trim() === '' ? null : Number(v);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, delayMs: n === null || !Number.isFinite(n) ? null : Math.max(0, n) } : i))
    );
  };

  const loadSample = async () => {
    setError(null);
    try {
      const sample = await makeSampleItems();
      setItems((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.url);
        return sample;
      });
      void generate(sample);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- video ----
  const loadVideoFile = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('video/')) {
      setError('That does not look like a video file. Choose an MP4, WebM or MOV clip.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const meta = await new Promise<{ duration: number; w: number; h: number }>((resolve, reject) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        const timer = setTimeout(() => reject(new Error('Timed out reading the video.')), 15000);
        v.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve({ duration: v.duration, w: v.videoWidth, h: v.videoHeight });
        };
        v.onerror = () => {
          clearTimeout(timer);
          reject(new Error('This browser could not read that video. Try an MP4 (H.264) or WebM file.'));
        };
        v.src = url;
      });
      if (!Number.isFinite(meta.duration) || meta.duration <= 0 || !meta.w || !meta.h) {
        throw new Error('Could not determine the length or size of that video.');
      }
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = url;
      setVideo({ name: file.name, url, duration: meta.duration, w: meta.w, h: meta.h, size: file.size });
      setStart(0);
      setEnd(Math.min(3, Math.round(meta.duration * 10) / 10));
    } catch (e) {
      URL.revokeObjectURL(url);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const clampTime = (v: number, max: number) => (Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);

  // ---- render ----
  const fpsFrames = video ? Math.floor(Math.max(0, end - start) * fps + 1e-6) + 1 : 0;
  const canCreate = source === 'images' ? items.length > 0 : !!video;
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
        <TabsList>
          <TabsTrigger value="images">
            <Images className="size-3.5" /> Images
          </TabsTrigger>
          <TabsTrigger value="video">
            <Film className="size-3.5" /> Video clip
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <ErrorBanner error={error} />}

      {source === 'images' ? (
        <>
          <FileDropzone
            onFiles={(f) => void addFiles(f)}
            accept="image/*"
            multiple
            label="Drop images (frames)"
            hint="PNG, JPG, WebP, BMP, SVG · each image is one frame · animated GIFs contribute their first frame"
            compact
          />
          <Panel>
            <PanelHeader title={`${items.length} frame${items.length === 1 ? '' : 's'}`}>
              {items.length > 1 && <span className="px-1 text-2xs text-muted-foreground">drag to reorder</span>}
              <Button size="sm" variant="ghost" onClick={() => void loadSample()}>
                <Sparkles className="size-3.5" /> Sample
              </Button>
              <Button size="sm" variant="ghost" onClick={clearItems} disabled={items.length === 0}>
                <Trash2 className="size-3.5" /> Clear
              </Button>
            </PanelHeader>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Add two or more images to make an animation, or click Sample.
              </p>
            ) : (
              <div className="max-h-[360px] divide-y overflow-auto">
                {items.map((it, i) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(i);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overIndex !== i) setOverIndex(i);
                    }}
                    onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null) reorder(dragIndex, i);
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    className={cn(
                      'flex flex-wrap items-center gap-2 px-3 py-2 transition-colors',
                      dragIndex === i && 'opacity-50',
                      overIndex === i && dragIndex !== null && dragIndex !== i && 'bg-accent/60'
                    )}
                  >
                    <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                    <span className="w-5 text-right font-mono text-2xs text-muted-foreground tabular">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt="" draggable={false} className="size-10 shrink-0 rounded border object-cover" />
                    <span className="min-w-0 flex-1 basis-32 truncate text-xs" title={it.name}>
                      {it.name}
                    </span>
                    <span className="hidden font-mono text-2xs text-muted-foreground sm:inline">
                      {it.w}×{it.h}
                    </span>
                    <label className="flex items-center gap-1 text-2xs text-muted-foreground">
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        inputMode="numeric"
                        value={it.delayMs ?? ''}
                        placeholder={String(delayMs)}
                        onChange={(e) => setItemDelay(it.id, e.target.value)}
                        className="h-7 w-20 px-2 font-mono text-xs"
                        aria-label={`Delay for frame ${i + 1} in milliseconds`}
                      />
                      ms
                    </label>
                    <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => removeItem(it.id)} aria-label="Remove frame">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <StatBar
              className="h-auto min-h-7 py-1"
              items={[
                `${items.length} source frame${items.length === 1 ? '' : 's'}`,
                arrangedCount !== items.length && `${arrangedCount} in the animation`,
                `${fmtSeconds(totalMs)} per loop`,
              ]}
            />
          </Panel>
        </>
      ) : (
        <>
          <FileDropzone
            onFiles={(f) => void loadVideoFile(f)}
            accept="video/*"
            label={video ? 'Drop another video to replace it' : 'Drop a video clip'}
            hint="MP4, WebM or MOV · decoded locally by your browser · keep it short"
            compact={!!video}
          />
          {video && (
            <Panel>
              <PanelHeader title={video.name}>
                <span className="px-1 font-mono text-2xs text-muted-foreground">
                  {video.w}×{video.h} · {fmtSeconds(video.duration * 1000)} · {formatBytes(video.size)}
                </span>
              </PanelHeader>
              <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <video
                  ref={previewRef}
                  src={video.url}
                  controls
                  muted
                  playsInline
                  className="max-h-56 w-full rounded-md border bg-black"
                />
                <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2">
                  <Field label="Start (seconds)">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={video.duration}
                        step={0.1}
                        value={start}
                        onChange={(e) => setStart(clampTime(Number(e.target.value), video.duration))}
                        className="font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        title="Use the playhead position"
                        onClick={() => setStart(Math.round((previewRef.current?.currentTime ?? 0) * 10) / 10)}
                      >
                        Now
                      </Button>
                    </div>
                  </Field>
                  <Field label="End (seconds)">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={video.duration}
                        step={0.1}
                        value={end}
                        onChange={(e) => setEnd(clampTime(Number(e.target.value), video.duration))}
                        className="font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        title="Use the playhead position"
                        onClick={() => setEnd(Math.round((previewRef.current?.currentTime ?? 0) * 10) / 10)}
                      >
                        Now
                      </Button>
                    </div>
                  </Field>
                  <Field label={`Frame rate: ${fps} fps`} className="sm:col-span-2">
                    <Slider value={[fps]} min={5} max={30} step={1} onValueChange={(v) => setFps(v[0] ?? 12)} />
                  </Field>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {end > start
                      ? `${fpsFrames} frames from ${start.toFixed(1)} s to ${end.toFixed(1)} s (${fmtSeconds((fpsFrames * 1000) / fps)}). Frames are captured by seeking, so long clips take a while.`
                      : 'The end time must be after the start time.'}
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </>
      )}

      <Panel>
        <PanelHeader title="Output" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={`Width: ${width} px`} hint={`Height ${outH} px (auto)`}>
            <Slider value={[width]} min={64} max={1080} step={8} onValueChange={(v) => setWidth(v[0] ?? 480)} />
          </Field>
          {source === 'images' && (
            <Field label="Default delay (ms)" hint="Per-frame values in the list override this">
              <Input
                type="number"
                min={MIN_DELAY}
                step={10}
                inputMode="numeric"
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(MIN_DELAY, Math.min(10000, Number(e.target.value) || MIN_DELAY)))}
                className="w-28 font-mono"
              />
            </Field>
          )}
          <Field label="Fit mixed sizes" hint="Contain adds bars, Cover crops">
            <Select value={fit} onValueChange={(v) => setFit(v as FitMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain (letterbox)</SelectItem>
                <SelectItem value="cover">Cover (crop)</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Background">
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={bg}
                disabled={transparentBg}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-12 p-1"
                aria-label="Background colour"
              />
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={transparentBg} onCheckedChange={setTransparentBg} />
                Transparent
              </label>
            </div>
          </Field>
          <Field label="Loop">
            <div className="flex items-center gap-2">
              <Select value={loopMode} onValueChange={(v) => setLoopMode(v as LoopMode)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forever">Forever</SelectItem>
                  <SelectItem value="times">N times</SelectItem>
                  <SelectItem value="once">Play once</SelectItem>
                </SelectContent>
              </Select>
              {loopMode === 'times' && (
                <Input
                  type="number"
                  min={2}
                  max={99}
                  value={loopTimes}
                  onChange={(e) => setLoopTimes(Math.max(2, Math.min(99, Math.round(Number(e.target.value) || 2))))}
                  className="w-16 font-mono"
                  aria-label="Number of plays"
                />
              )}
            </div>
          </Field>
          <Field label="Playback">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={pingpong} onCheckedChange={setPingpong} /> Ping-pong
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={reverse} onCheckedChange={setReverse} /> Reverse
              </label>
            </div>
          </Field>
          <Field label="Colours">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={dither} onCheckedChange={setDither} /> Dither
              </label>
              <label className="flex items-center gap-2 text-xs" title="Unchanged pixels become transparent and frames are cropped to what moved">
                <Switch checked={optimize} onCheckedChange={setOptimize} /> Optimise size
              </label>
            </div>
          </Field>
          <Field label="Palette">
            <Select value={paletteMode} onValueChange={(v) => setPaletteMode(v as PaletteMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Per frame (best colours)</SelectItem>
                <SelectItem value="global">Shared (smaller, steadier)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Palette quality: ${quality}/10`} hint="Lower samples fewer pixels (faster)">
            <Slider value={[quality]} min={1} max={10} step={1} onValueChange={(v) => setQuality(v[0] ?? 10)} />
          </Field>
        </div>
        {budget.message && (
          <div
            className={cn(
              'mx-3 mb-3 rounded-md border px-3 py-2 text-xs',
              budget.level === 'block'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-warning/40 bg-warning/10 text-foreground'
            )}
          >
            {budget.message}
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void generate()} disabled={busy || !canCreate || budget.level === 'block'}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {result ? 'Update GIF' : 'Create GIF'}
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Cancel
          </Button>
        )}
        {busy && progress && (
          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-2xs text-muted-foreground tabular">
              {progress.label} {progress.done}/{progress.total}
            </span>
          </div>
        )}
        {!busy && stale && <span className="text-xs text-warning">Settings changed. Click Update GIF to apply.</span>}
        {notice && !busy && <span className="text-xs text-muted-foreground">{notice}</span>}
      </div>

      {result && (
        <Panel>
          <PanelHeader title="GIF">
            <DownloadButton
              data={() => result.bytes}
              filename="animation.gif"
              mime="image/gif"
              label="Download .gif"
              variant="secondary"
            />
          </PanelHeader>
          <div
            className={cn('flex justify-center p-4', stale && 'opacity-60')}
            style={
              transparentBg
                ? {
                    backgroundColor: '#ffffff',
                    backgroundImage: 'conic-gradient(#e5e7eb 25%, transparent 0 50%, #e5e7eb 0 75%, transparent 0)',
                    backgroundSize: '16px 16px',
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="Generated animated GIF"
              width={result.w}
              height={result.h}
              className="h-auto max-h-[560px] max-w-full rounded border"
            />
          </div>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={[
              `${result.frames} frame${result.frames === 1 ? '' : 's'}${result.merged > 0 ? ` (${result.merged} identical merged)` : ''}`,
              `${result.w}×${result.h}`,
              formatBytes(result.bytes.length),
              fmtSeconds(result.durationMs),
              result.loop,
              `encoded in ${(result.encodeMs / 1000).toFixed(1)} s`,
            ]}
          />
        </Panel>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        GIF is limited to 256 colours per frame, so photos get dithering noise and big files. For best results use short
        clips, a smaller width and the shared palette. Delays are stored in 1/100 s and raised to at least 20 ms (browsers play
        shorter ones as 100 ms). Everything is encoded in your browser; nothing is uploaded.
      </p>
    </div>
  );
}
