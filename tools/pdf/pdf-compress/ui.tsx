'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minimize2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';
import {
  getImageStream,
  isEncrypted,
  listImages,
  optimizePdf,
  pageCount,
  replaceImages,
  type PdfImageInfo,
  type PdfImageReplacement,
} from '@/lib/wasm/pdf';
import {
  MIN_GAIN,
  PRESETS,
  buildJpegPdf,
  classifyImage,
  decodeFlateSamples,
  fitDimensions,
  parseJpeg,
  percentSaved,
  stripExtension,
  type Classification,
  type ImageKind,
  type ImageRow,
  type PresetId,
} from './logic';

// ---------------------------------------------------------------------------
// Canvas helpers (browser only; only ever called from handlers)
// ---------------------------------------------------------------------------

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('Canvas is not available for an image of this size');
  return x;
}

function release(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

/** Downscale in halving steps (good quality even where `imageSmoothingQuality` is weak), then a final draw. */
function drawScaled(src: CanvasImageSource, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = sw;
  let ch = sh;
  let prev: HTMLCanvasElement | null = null;
  while (cw > tw * 2 || ch > th * 2) {
    const nw = cw > tw * 2 ? Math.ceil(cw / 2) : tw;
    const nh = ch > th * 2 ? Math.ceil(ch / 2) : th;
    const c = newCanvas(nw, nh);
    const x = ctx2d(c);
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    if (prev) release(prev);
    prev = c;
    cur = c;
    cw = nw;
    ch = nh;
  }
  const out = newCanvas(tw, th);
  const x = ctx2d(out);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, tw, th);
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, cw, ch, 0, 0, tw, th);
  if (prev) release(prev);
  return out;
}

function toGray(c: HTMLCanvasElement) {
  const x = ctx2d(c);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0));
    d[i] = y;
    d[i + 1] = y;
    d[i + 2] = y;
  }
  x.putImageData(img, 0, 0);
}

async function decodeJpegBitmap(
  bytes: Uint8Array,
): Promise<{ src: CanvasImageSource; width: number; height: number; close: () => void }> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
  try {
    const bmp = await createImageBitmap(blob);
    return { src: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new globalThis.Image();
      img.src = url;
      await img.decode();
      return { src: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

type Recompressed =
  | { ok: true; jpeg: Uint8Array; width: number; height: number; gray: boolean }
  | { ok: false; reason: string };

interface Settings {
  quality: number;
  maxDim: number;
  grayscale: boolean;
}

async function recompressImage(
  info: PdfImageInfo,
  kind: ImageKind,
  stream: Uint8Array,
  s: Settings,
): Promise<Recompressed> {
  let source: CanvasImageSource;
  let sw: number;
  let sh: number;
  let cleanup: () => void = () => undefined;

  if (kind === 'jpeg') {
    const pj = parseJpeg(stream);
    if (!pj) return { ok: false, reason: 'Stream is not a plain JPEG file' };
    if (pj.precision !== 8) return { ok: false, reason: `${pj.precision}-bit JPEG` };
    if (pj.components !== 1 && pj.components !== 3) return { ok: false, reason: `${pj.components}-channel JPEG` };
    if (pj.exifOrientation !== null && pj.exifOrientation !== 1) {
      return { ok: false, reason: 'JPEG carries an EXIF rotation' };
    }
    const dec = await decodeJpegBitmap(stream);
    if (dec.width !== pj.width || dec.height !== pj.height) {
      dec.close();
      return { ok: false, reason: 'Browser decoded a different size' };
    }
    source = dec.src;
    sw = dec.width;
    sh = dec.height;
    cleanup = dec.close;
  } else {
    const r = decodeFlateSamples(stream, info.width, info.height, info.components, info.hasPredictor);
    if (!r.ok) return { ok: false, reason: r.reason };
    const base = newCanvas(info.width, info.height);
    const bx = ctx2d(base);
    const img = bx.createImageData(info.width, info.height);
    const d = img.data;
    const px = info.width * info.height;
    const sm = r.samples;
    if (info.components === 3) {
      for (let i = 0, o = 0, p = 0; p < px; p++, i += 3, o += 4) {
        d[o] = sm[i] ?? 0;
        d[o + 1] = sm[i + 1] ?? 0;
        d[o + 2] = sm[i + 2] ?? 0;
        d[o + 3] = 255;
      }
    } else {
      for (let p = 0, o = 0; p < px; p++, o += 4) {
        const v = sm[p] ?? 0;
        d[o] = v;
        d[o + 1] = v;
        d[o + 2] = v;
        d[o + 3] = 255;
      }
    }
    bx.putImageData(img, 0, 0);
    source = base;
    sw = info.width;
    sh = info.height;
    cleanup = () => release(base);
  }

  let canvas: HTMLCanvasElement | null = null;
  try {
    const { width: tw, height: th } = fitDimensions(sw, sh, s.maxDim);
    canvas = drawScaled(source, sw, sh, tw, th);
    if (s.grayscale) toGray(canvas);
    const target = canvas;
    const blob = await new Promise<Blob | null>((res) => target.toBlob(res, 'image/jpeg', s.quality));
    if (!blob) return { ok: false, reason: 'The browser could not encode this image' };
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const pj = parseJpeg(jpeg);
    if (!pj || (pj.components !== 1 && pj.components !== 3) || pj.width !== tw || pj.height !== th) {
      return { ok: false, reason: 'Re-encoded JPEG did not validate' };
    }
    return { ok: true, jpeg, width: pj.width, height: pj.height, gray: pj.components === 1 };
  } finally {
    cleanup();
    if (canvas) release(canvas);
  }
}

// ---------------------------------------------------------------------------
// Sample PDF: two photo-like pages, generated with canvas
// ---------------------------------------------------------------------------

async function makeSamplePdf(): Promise<Uint8Array> {
  const W = 2200;
  const H = 1500;
  const pages: Parameters<typeof buildJpegPdf>[0] = [];
  for (let k = 0; k < 2; k++) {
    const c = newCanvas(W, H);
    const x = ctx2d(c);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, k === 0 ? '#1e3a8a' : '#064e3b');
    g.addColorStop(0.55, k === 0 ? '#f97316' : '#84cc16');
    g.addColorStop(1, k === 0 ? '#fde68a' : '#fef9c3');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const cx = ((i * 7919 + k * 313) % 1000) / 1000 * W;
      const cy = ((i * 104729 + k * 77) % 1000) / 1000 * H;
      const r = 80 + ((i * 31) % 260);
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `hsla(${(i * 47 + k * 120) % 360}, 70%, 60%, 0.55)`);
      rg.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
      x.fillStyle = rg;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
    // Sensor-style noise so the JPEG is realistically heavy.
    const img = x.getImageData(0, 0, W, H);
    const d = img.data;
    let seed = 1234567 + k;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = ((seed >>> 24) % 25) - 12;
      d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n));
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n));
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n));
    }
    x.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.95));
    release(c);
    if (!blob) throw new Error('Could not create the sample image');
    pages.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      width: W,
      height: H,
      pageW: 842,
      pageH: 595,
      caption: `Sample photo ${k + 1} (${W} x ${H} px, heavy JPEG)`,
    });
    await tick();
  }
  return buildJpegPdf(pages);
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

interface Analysis {
  pages: number;
  infos: PdfImageInfo[];
  classes: Classification[];
  imageBytes: number;
  candidates: number;
}

interface Outcome {
  key: string;
  bytes: Uint8Array;
  before: number;
  after: number;
  rows: ImageRow[];
  recompressed: number;
  kept: number;
  skipped: number;
  notes: string[];
}

export default function PdfCompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [preset, setPreset] = useState<PresetId>('recommended');
  const [customQuality, setCustomQuality] = useState(72);
  const [customMaxDim, setCustomMaxDim] = useState(1600);
  const [stripMeta, setStripMeta] = useState(true);
  const [grayscale, setGrayscale] = useState(false);

  const srcRef = useRef<Uint8Array | null>(null);
  const loadId = useRef(0);
  const runId = useRef(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    const cancel = cancelRef;
    return () => {
      cancel.current = true;
    };
  }, []);

  const settings: Settings = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1];
    if (preset === 'custom' || !p) return { quality: customQuality / 100, maxDim: customMaxDim, grayscale };
    return { quality: p.quality, maxDim: p.maxDim, grayscale };
  }, [preset, customQuality, customMaxDim, grayscale]);

  const loadFile = useCallback(async (f: File) => {
    const myLoad = ++loadId.current;
    runId.current++;
    cancelRef.current = true;
    setFile(f);
    setAnalysis(null);
    setOutcome(null);
    setError(null);
    setWorking(false);
    setProgress(null);
    setLoading(true);
    srcRef.current = null;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let pages: number;
      let infos: PdfImageInfo[];
      try {
        pages = await pageCount(bytes.slice());
        infos = await listImages(bytes.slice());
      } catch (e) {
        let encrypted = false;
        try {
          encrypted = await isEncrypted(bytes.slice());
        } catch {
          encrypted = false;
        }
        if (encrypted) {
          throw new Error('This PDF is password-protected or encrypted. Remove the protection first, then compress it.');
        }
        throw new Error(`Could not read this PDF (${e instanceof Error ? e.message : String(e)}).`);
      }
      if (myLoad !== loadId.current) return;
      const classes = infos.map(classifyImage);
      srcRef.current = bytes;
      setAnalysis({
        pages,
        infos,
        classes,
        imageBytes: infos.reduce((n, i) => n + i.length, 0),
        candidates: classes.filter((c) => c.ok).length,
      });
    } catch (e) {
      if (myLoad === loadId.current) {
        setFile(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (myLoad === loadId.current) setLoading(false);
    }
  }, []);

  const loadSample = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const bytes = await makeSamplePdf();
      const f = new File([bytes as unknown as BlobPart], 'sample-photos.pdf', { type: 'application/pdf' });
      await loadFile(f);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadFile]);

  const currentKey = useMemo(
    () => JSON.stringify({ f: file?.name, s: file?.size, q: settings, m: stripMeta }),
    [file, settings, stripMeta],
  );

  const run = useCallback(async () => {
    const src = srcRef.current;
    if (!src || !analysis || !file) return;
    const myRun = ++runId.current;
    const stale = () => myRun !== runId.current || cancelRef.current;
    cancelRef.current = false;
    setWorking(true);
    setError(null);
    setOutcome(null);

    const notes: string[] = [];
    const rows: ImageRow[] = [];
    const replacements: PdfImageReplacement[] = [];
    const rowFor = new Map<number, ImageRow>();
    const todo: { info: PdfImageInfo; kind: ImageKind }[] = [];

    analysis.infos.forEach((info, i) => {
      const c = analysis.classes[i];
      if (c && c.ok) {
        todo.push({ info, kind: c.kind });
      } else {
        rows.push({
          id: info.id, page: info.page, status: 'skipped', note: c && !c.ok ? c.reason : 'Skipped',
          widthBefore: info.width, heightBefore: info.height, widthAfter: info.width, heightAfter: info.height,
          bytesBefore: info.length, bytesAfter: info.length,
        });
      }
    });

    try {
      for (let n = 0; n < todo.length; n++) {
        const item = todo[n];
        if (!item) continue;
        if (stale()) return;
        const { info, kind } = item;
        setProgress({ done: n, total: todo.length, label: `Image ${n + 1} / ${todo.length}` });
        await tick();
        const row: ImageRow = {
          id: info.id, page: info.page, status: 'kept', note: '',
          widthBefore: info.width, heightBefore: info.height, widthAfter: info.width, heightAfter: info.height,
          bytesBefore: info.length, bytesAfter: info.length,
        };
        try {
          const stream = await getImageStream(src.slice(), info.id);
          if (stale()) return;
          const res = await recompressImage(info, kind, stream, settings);
          if (!res.ok) {
            row.status = 'skipped';
            row.note = res.reason;
          } else if (res.jpeg.length > info.length * (1 - MIN_GAIN)) {
            row.status = 'kept';
            row.note = 'No size gain, kept original';
            row.widthAfter = res.width;
            row.heightAfter = res.height;
            row.bytesAfter = res.jpeg.length;
          } else {
            row.status = 'recompressed';
            row.note = res.width !== info.width ? 'Downscaled and recompressed' : 'Recompressed';
            row.widthAfter = res.width;
            row.heightAfter = res.height;
            row.bytesAfter = res.jpeg.length;
            replacements.push({ id: info.id, jpeg: res.jpeg, width: res.width, height: res.height, gray: res.gray });
          }
        } catch (e) {
          if (stale()) return;
          row.status = 'skipped';
          row.note = e instanceof Error ? e.message : String(e);
        }
        rows.push(row);
        rowFor.set(info.id, row);
        await tick();
      }

      if (stale()) return;
      setProgress({ done: todo.length, total: todo.length, label: 'Rebuilding PDF…' });
      await tick();

      let work: Uint8Array = src.slice();
      if (replacements.length > 0) {
        try {
          work = await replaceImages(src.slice(), replacements);
        } catch (e) {
          notes.push(`Replacing images failed (${e instanceof Error ? e.message : String(e)}); only the structural clean-up was applied.`);
          for (const r of replacements) {
            const row = rowFor.get(r.id);
            if (row) {
              row.status = 'kept';
              row.note = 'Replacement failed, kept original';
              row.widthAfter = row.widthBefore;
              row.heightAfter = row.heightBefore;
              row.bytesAfter = row.bytesBefore;
            }
          }
          replacements.length = 0;
          work = src.slice();
        }
      }
      if (stale()) return;

      setProgress({ done: todo.length, total: todo.length, label: 'Cleaning up structure…' });
      await tick();
      const fallback = work.slice();
      let out: Uint8Array;
      try {
        out = await optimizePdf(work, stripMeta);
      } catch (e) {
        notes.push(`Structural clean-up failed (${e instanceof Error ? e.message : String(e)}).`);
        out = fallback;
      }
      if (stale()) return;

      // Safety net: the result must still open and keep every page.
      try {
        const pc = await pageCount(out.slice());
        if (pc !== analysis.pages) throw new Error(`page count changed from ${analysis.pages} to ${pc}`);
      } catch (e) {
        notes.push(`The compressed file failed a sanity check (${e instanceof Error ? e.message : String(e)}), so the original is offered instead.`);
        out = src.slice();
      }
      if (stale()) return;

      rows.sort((a, b) => (a.page || 1e9) - (b.page || 1e9) || a.id - b.id);
      setOutcome({
        key: currentKey,
        bytes: out,
        before: src.length,
        after: out.length,
        rows,
        recompressed: rows.filter((r) => r.status === 'recompressed').length,
        kept: rows.filter((r) => r.status === 'kept').length,
        skipped: rows.filter((r) => r.status === 'skipped').length,
        notes,
      });
    } catch (e) {
      if (!stale()) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (myRun === runId.current) {
        setWorking(false);
        setProgress(null);
      }
    }
  }, [analysis, file, settings, stripMeta, currentKey]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    runId.current++;
    setWorking(false);
    setProgress(null);
  }, []);

  const base = file ? stripExtension(file.name) : 'document';
  const fresh = outcome !== null && outcome.key === currentKey;
  const smaller = outcome !== null && outcome.after < outcome.before;
  const activePreset = PRESETS.find((p) => p.id === preset);
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => {
          const first = f[0];
          if (first) void loadFile(first);
        }}
        accept="application/pdf,.pdf"
        label={file ? file.name : 'Drop a PDF'}
        hint={
          analysis
            ? `${analysis.pages} page${analysis.pages === 1 ? '' : 's'} · ${formatBytes(file?.size ?? 0)} · click to replace`
            : loading
              ? 'reading…'
              : 'or click to browse'
        }
        compact={!!file}
        disabled={loading || working}
      />

      <ErrorBanner error={error} />

      {!file && !loading && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <Button variant="secondary" size="sm" onClick={() => void loadSample()}>
            <Minimize2 className="size-3.5" /> Try a sample PDF
          </Button>
          <p className="text-xs text-muted-foreground">
            Shrink a PDF by recompressing its images. Files never leave your browser.
          </p>
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Reading PDF…
        </p>
      )}

      {analysis && file && (
        <>
          <Panel>
            <PanelHeader title="Compression level" />
            <div className="flex flex-col gap-3 p-3">
              <Tabs value={preset} onValueChange={(v) => setPreset(v as PresetId)}>
                <TabsList className="flex-wrap">
                  {PRESETS.map((p) => (
                    <TabsTrigger key={p.id} value={p.id} disabled={working}>
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {activePreset?.blurb}
                {': '}
                <span className="font-mono text-foreground">
                  JPEG quality {Math.round(settings.quality * 100)}%, images up to {settings.maxDim} px
                </span>
              </p>
              {preset === 'custom' && (
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <Field label={`JPEG quality: ${customQuality}%`} className="min-w-[200px] flex-1">
                    <Slider
                      value={[customQuality]}
                      min={20}
                      max={95}
                      step={1}
                      onValueChange={(v) => setCustomQuality(v[0] ?? 72)}
                      disabled={working}
                    />
                  </Field>
                  <Field label={`Max image size: ${customMaxDim} px`} className="min-w-[200px] flex-1">
                    <Slider
                      value={[customMaxDim]}
                      min={400}
                      max={4000}
                      step={50}
                      onValueChange={(v) => setCustomMaxDim(v[0] ?? 1600)}
                      disabled={working}
                    />
                  </Field>
                </div>
              )}
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Switch checked={stripMeta} onCheckedChange={setStripMeta} disabled={working} />
                  Remove metadata &amp; thumbnails
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Switch checked={grayscale} onCheckedChange={setGrayscale} disabled={working} />
                  Convert colour images to grayscale
                </label>
              </div>
            </div>
            <StatBar
              items={[
                `${analysis.pages} page${analysis.pages === 1 ? '' : 's'}`,
                `${formatBytes(file.size)}`,
                `${analysis.infos.length} image${analysis.infos.length === 1 ? '' : 's'}${
                  analysis.infos.length > 0 ? ` (${formatBytes(analysis.imageBytes)})` : ''
                }`,
                `${analysis.candidates} recompressible`,
              ]}
            />
          </Panel>

          {analysis.candidates === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {analysis.infos.length === 0
                ? 'This PDF has no images, so only the lossless structural clean-up can shrink it. Expect small savings.'
                : 'None of the images in this PDF can be recompressed safely (see the list of skip reasons after running). Only the structural clean-up will apply.'}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void run()} disabled={working || loading}>
              {working ? <Loader2 className="size-3.5 animate-spin" /> : <Minimize2 className="size-3.5" />}
              Compress PDF
            </Button>
            {working && (
              <Button variant="outline" size="sm" onClick={cancel}>
                <X className="size-3.5" /> Cancel
              </Button>
            )}
          </div>

          {working && progress && (
            <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
              <div className="flex items-center justify-between font-mono text-2xs text-muted-foreground tabular">
                <span>{progress.label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {outcome && !fresh && !working && (
            <p className="text-xs text-muted-foreground">
              Settings changed since the last run. Compress again to refresh the result.
            </p>
          )}

          {outcome && (
            <Panel className={cn(!fresh && 'opacity-60')}>
              <PanelHeader title="Result">
                {smaller ? (
                  <DownloadButton
                    data={() => outcome.bytes}
                    filename={`${base}-compressed.pdf`}
                    mime="application/pdf"
                    label="Download compressed PDF"
                    variant="secondary"
                  />
                ) : (
                  <>
                    <DownloadButton
                      data={() => outcome.bytes}
                      filename={`${base}-compressed.pdf`}
                      mime="application/pdf"
                      label="Download anyway"
                      variant="ghost"
                    />
                    <DownloadButton
                      data={() => file}
                      filename={file.name}
                      mime="application/pdf"
                      label="Download original"
                      variant="secondary"
                    />
                  </>
                )}
              </PanelHeader>

              <div className="flex flex-col gap-1 p-4">
                <p className="font-mono text-lg tabular" data-testid="size-summary">
                  {formatBytes(outcome.before)} <span className="text-muted-foreground">→</span> {formatBytes(outcome.after)}
                </p>
                {smaller ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    {percentSaved(outcome.before, outcome.after).toFixed(1)}% smaller
                    <span className="text-muted-foreground"> · saved {formatBytes(outcome.before - outcome.after)}</span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    The result is not smaller than the original, so there is nothing to gain here. The original file is
                    offered for download. Try the Strong preset if the PDF contains photos.
                  </p>
                )}
                {outcome.notes.map((n) => (
                  <ErrorBanner key={n} error={n} className="mt-2" />
                ))}
              </div>

              <StatBar
                items={[
                  `${outcome.recompressed} recompressed`,
                  `${outcome.kept} kept (no gain)`,
                  `${outcome.skipped} skipped`,
                  `${analysis.pages} pages`,
                ]}
              />

              {outcome.rows.length > 0 && (
                <details className="group border-t">
                  <summary className="flex h-9 cursor-pointer select-none items-center gap-2 bg-muted/40 px-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Per-image details ({outcome.rows.length})
                  </summary>
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full text-left font-mono text-2xs tabular">
                      <thead className="sticky top-0 bg-card text-muted-foreground">
                        <tr className="border-b">
                          <th className="px-3 py-1.5 font-medium">Page</th>
                          <th className="px-3 py-1.5 font-medium">Pixels</th>
                          <th className="px-3 py-1.5 font-medium">Size</th>
                          <th className="px-3 py-1.5 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {outcome.rows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-1.5">{r.page || '–'}</td>
                            <td className="whitespace-nowrap px-3 py-1.5">
                              {r.widthBefore}×{r.heightBefore}
                              {r.status !== 'skipped' && (r.widthAfter !== r.widthBefore || r.heightAfter !== r.heightBefore) && (
                                <> → {r.widthAfter}×{r.heightAfter}</>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5">
                              {formatBytes(r.bytesBefore)}
                              {r.status === 'recompressed' && <> → {formatBytes(r.bytesAfter)}</>}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-1.5 font-sans',
                                r.status === 'recompressed' && 'text-emerald-600 dark:text-emerald-400',
                                r.status !== 'recompressed' && 'text-muted-foreground',
                              )}
                            >
                              {r.note}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </Panel>
          )}

          <p className="px-1 text-2xs text-muted-foreground">
            Text and vector content are kept as-is; savings come mostly from images. Images are re-encoded as JPEG, so
            this is lossy for photos. CMYK, JPEG 2000, JBIG2, CCITT, indexed-colour and stencil-mask images are left
            untouched. Colour-managed profiles are replaced by plain RGB.
          </p>
        </>
      )}
    </div>
  );
}
