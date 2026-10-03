'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/download';
import { toleranceFromDetail, traceImage, type RasterImage, type TraceResult } from './logic';

type Mode = 'bw' | 'color';
type Stacking = 'stacked' | 'separate';

interface Source {
  img: HTMLImageElement;
  url: string;
  name: string;
  size: number;
  ow: number;
  oh: number;
}

interface Traced {
  res: TraceResult;
  dataUri: string;
  bytes: number;
  ms: number;
}

const MAX_INPUT_PIXELS = 100_000_000;

const CHECKER: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: 'conic-gradient(#e5e7eb 25%, transparent 0 50%, #e5e7eb 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

async function makeSampleBlob(): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 360;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 480, 360);
  ctx.fillStyle = '#1f5fd1';
  ctx.beginPath();
  ctx.arc(175, 170, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(175, 170, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8a00';
  ctx.beginPath();
  ctx.moveTo(175, 105);
  ctx.lineTo(228, 205);
  ctx.lineTo(122, 205);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#17a673';
  ctx.beginPath();
  ctx.arc(375, 105, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(375, 105, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 330);
  ctx.bezierCurveTo(140, 290, 200, 350, 290, 315);
  ctx.bezierCurveTo(340, 295, 400, 330, 440, 300);
  ctx.stroke();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the sample image.'))), 'image/png'));
}

const fmtInt = (n: number) => n.toLocaleString('en-US');

export default function ImageToSvgTracerTool() {
  const [src, setSrc] = useState<Source | null>(null);
  const [mode, setMode] = useState<Mode>('color');
  const [autoThreshold, setAutoThreshold] = useState(true);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [colors, setColors] = useState(5);
  const [stacking, setStacking] = useState<Stacking>('stacked');
  const [detail, setDetail] = useState(60);
  const [curves, setCurves] = useState(true);
  const [corner, setCorner] = useState(55);
  const [speckle, setSpeckle] = useState(6);
  const [blurBw, setBlurBw] = useState(0);
  const [blurColor, setBlurColor] = useState(0);
  const [bwTransparent, setBwTransparent] = useState(true);
  const [colorTransparent, setColorTransparent] = useState(false);
  const [ink, setInk] = useState('#000000');
  const [paper, setPaper] = useState('#ffffff');
  const [maxSide, setMaxSide] = useState(1000);

  const [traced, setTraced] = useState<Traced | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const runId = useRef(0);
  const srcRef = useRef<Source | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    srcRef.current = src;
  }, [src]);

  useEffect(() => {
    return () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current.url);
    };
  }, []);

  const loadBlob = useCallback(async (blob: Blob, name: string) => {
    setLoadError(null);
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const ow = img.naturalWidth || img.width || 512;
      const oh = img.naturalHeight || img.height || 512;
      if (ow * oh > MAX_INPUT_PIXELS) {
        throw new Error(`That image is ${ow}×${oh} px, which is too large to decode safely here. Downscale it first.`);
      }
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { img, url, name, size: blob.size, ow, oh };
      });
    } catch (e) {
      URL.revokeObjectURL(url);
      setLoadError(
        e instanceof Error && e.message !== 'decode failed'
          ? e.message
          : `Could not read "${name}" as an image. Use PNG, JPG, WebP, GIF, BMP or SVG.`
      );
    }
  }, []);

  const loadSample = useCallback(async () => {
    try {
      await loadBlob(await makeSampleBlob(), 'sample-logo.png');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [loadBlob]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void loadSample();
  }, [loadSample]);

  // Pixels at working resolution.
  const raster = useMemo<RasterImage | null>(() => {
    if (!src) return null;
    const long = Math.max(src.ow, src.oh);
    const scale = long > maxSide ? maxSide / long : 1;
    const w = Math.max(1, Math.round(src.ow * scale));
    const h = Math.max(1, Math.round(src.oh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src.img, 0, 0, w, h);
    try {
      return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
    } catch {
      return null;
    }
  }, [src, maxSide]);

  const tolerance = toleranceFromDetail(detail);
  const blur = mode === 'bw' ? blurBw : blurColor;
  const transparentBg = mode === 'bw' ? bwTransparent : colorTransparent;

  // Trace (debounced; stale runs cancel themselves).
  useEffect(() => {
    if (!raster || !src) return;
    const id = ++runId.current;
    const timer = setTimeout(() => {
      void (async () => {
        setBusy(true);
        const t0 = performance.now();
        try {
          const res = await traceImage(raster, {
            mode,
            threshold: autoThreshold ? 'auto' : threshold,
            invert,
            colors,
            stacking,
            detail,
            curves,
            cornerAngle: corner,
            speckle,
            blur,
            transparentBg,
            ink,
            paper,
            outWidth: src.ow,
            outHeight: src.oh,
            shouldCancel: () => id !== runId.current,
          });
          if (id !== runId.current) return;
          setTraced({
            res,
            dataUri: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(res.svg),
            bytes: new Blob([res.svg]).size,
            ms: performance.now() - t0,
          });
          setError(null);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg !== 'cancelled' && id === runId.current) setError(msg);
        } finally {
          if (id === runId.current) setBusy(false);
        }
      })();
    }, 220);
    return () => clearTimeout(timer);
  }, [raster, src, mode, autoThreshold, threshold, invert, colors, stacking, detail, curves, corner, speckle, blur, transparentBg, ink, paper]);

  const baseName = (src?.name ?? 'image').replace(/\.[^.]+$/, '') || 'image';
  const scaled = raster && src && (raster.width !== src.ow || raster.height !== src.oh);
  const res = traced?.res ?? null;

  return (
    <div className="flex flex-col gap-4">
      <FileDropzone
        onFiles={(files) => {
          const f = files[0];
          if (f) void loadBlob(f, f.name);
        }}
        accept="image/*"
        label="Drop an image to vectorize"
        hint="PNG, JPG, WebP, GIF, BMP or SVG · logos, icons, signatures and line art work best"
        compact
      />
      {loadError && <ErrorBanner error={loadError} />}

      <Panel>
        <PanelHeader title="Trace settings">
          <Button size="sm" variant="ghost" onClick={() => void loadSample()}>
            <Sparkles className="size-3.5" /> Sample
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-3 p-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="bw">Black &amp; white</TabsTrigger>
              <TabsTrigger value="color">Colour</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {mode === 'bw' ? (
              <>
                <Field
                  label={autoThreshold ? `Threshold: auto${res?.thresholdUsed != null ? ` (${res.thresholdUsed})` : ''}` : `Threshold: ${threshold}`}
                  hint="Pixels darker than this become ink"
                >
                  <div className="flex items-center gap-3">
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      <Switch checked={autoThreshold} onCheckedChange={setAutoThreshold} /> Auto
                    </label>
                    <Slider
                      value={[autoThreshold && res?.thresholdUsed != null ? res.thresholdUsed : threshold]}
                      min={1}
                      max={255}
                      step={1}
                      disabled={autoThreshold}
                      onValueChange={(v) => setThreshold(v[0] ?? 128)}
                    />
                  </div>
                </Field>
                <Field label="Invert" hint="Trace light shapes on a dark ground">
                  <label className="flex h-8 items-center gap-2 text-xs">
                    <Switch checked={invert} onCheckedChange={setInvert} /> {invert ? 'Light is ink' : 'Dark is ink'}
                  </label>
                </Field>
                <Field label="Colours">
                  <div className="flex items-center gap-2">
                    <Input type="color" value={ink} onChange={(e) => setInk(e.target.value)} className="h-8 w-12 p-1" aria-label="Ink colour" />
                    <span className="text-2xs text-muted-foreground">ink</span>
                    <Input
                      type="color"
                      value={paper}
                      disabled={bwTransparent}
                      onChange={(e) => setPaper(e.target.value)}
                      className="h-8 w-12 p-1"
                      aria-label="Paper colour"
                    />
                    <span className="text-2xs text-muted-foreground">paper</span>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label={`Colours: ${colors}`} hint="Posterized with k-means, then traced per colour">
                  <Slider value={[colors]} min={2} max={16} step={1} onValueChange={(v) => setColors(v[0] ?? 5)} />
                </Field>
                <Field label="Layering" hint={stacking === 'stacked' ? 'Layers overlap, so no gaps show between regions' : 'Each colour only covers its own pixels'}>
                  <Select value={stacking} onValueChange={(v) => setStacking(v as Stacking)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stacked">Stacked (cumulative layers)</SelectItem>
                      <SelectItem value="separate">Separate regions</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            <Field label={`Detail: ${detail}%`} hint={`Path tolerance ${tolerance.toFixed(2)} px`}>
              <Slider value={[detail]} min={0} max={100} step={1} onValueChange={(v) => setDetail(v[0] ?? 60)} />
            </Field>
            <Field label={`Speckle filter: ${speckle} px²`} hint="Drops specks and pinholes smaller than this">
              <Slider value={[speckle]} min={0} max={100} step={1} onValueChange={(v) => setSpeckle(v[0] ?? 6)} />
            </Field>
            <Field label={`Pre-smoothing: ${blur}`} hint="Blurs jagged or noisy edges before tracing">
              <Slider
                value={[blur]}
                min={0}
                max={4}
                step={1}
                onValueChange={(v) => (mode === 'bw' ? setBlurBw(v[0] ?? 0) : setBlurColor(v[0] ?? 1))}
              />
            </Field>
            <Field label="Curves">
              <label className="flex h-8 items-center gap-2 text-xs">
                <Switch checked={curves} onCheckedChange={setCurves} /> {curves ? 'Smooth Béziers' : 'Straight segments'}
              </label>
            </Field>
            {curves && (
              <Field label={`Corner threshold: ${corner}°`} hint="Turns sharper than this stay corners">
                <Slider value={[corner]} min={20} max={120} step={1} onValueChange={(v) => setCorner(v[0] ?? 55)} />
              </Field>
            )}
            <Field label="Transparent background" hint={mode === 'bw' ? 'Off paints the paper colour behind the ink' : 'Drops the most common edge colour'}>
              <label className="flex h-8 items-center gap-2 text-xs">
                <Switch
                  checked={transparentBg}
                  onCheckedChange={(c) => (mode === 'bw' ? setBwTransparent(c) : setColorTransparent(c))}
                />
                {transparentBg ? 'Transparent' : 'Keep background'}
              </label>
            </Field>
            <Field label="Max working size" hint="Larger images are downscaled first">
              <Select value={String(maxSide)} onValueChange={(v) => setMaxSide(Number(v) || 1000)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[500, 750, 1000, 1500, 2000].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} px (long side)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      {error && <ErrorBanner error={error} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Original">
            {src && (
              <span className="px-1 font-mono text-2xs text-muted-foreground">
                {src.ow}×{src.oh} · {formatBytes(src.size)}
              </span>
            )}
          </PanelHeader>
          <div className="flex min-h-[260px] items-center justify-center p-3" style={CHECKER}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src.url} alt="Original" className="max-h-[480px] w-full object-contain" />
            ) : (
              <span className="text-sm text-muted-foreground">No image yet</span>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="SVG">
            {busy && <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground" aria-label="Tracing" />}
            <CopyButton value={() => res?.svg ?? ''} label="Copy SVG" disabled={!res} />
            <DownloadButton
              data={() => res?.svg ?? ''}
              filename={`${baseName}.svg`}
              mime="image/svg+xml;charset=utf-8"
              label="Download .svg"
              variant="secondary"
              disabled={!res}
            />
          </PanelHeader>
          <div className={cn('relative flex min-h-[260px] items-center justify-center p-3', busy && traced && 'opacity-60')} style={CHECKER}>
            {traced ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={traced.dataUri} alt="Traced SVG" className="max-h-[480px] w-full object-contain" />
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {busy && <Loader2 className="size-4 animate-spin" />} {busy ? 'Tracing…' : 'The vector will appear here'}
              </span>
            )}
          </div>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={
              res && traced
                ? [
                    `${res.paths} path${res.paths === 1 ? '' : 's'}`,
                    `${fmtInt(res.shapes)} shapes (${res.holes} holes)`,
                    `${fmtInt(res.nodes)} nodes`,
                    formatBytes(traced.bytes),
                    `${traced.ms.toFixed(0)} ms`,
                    scaled && raster ? `traced at ${raster.width}×${raster.height}` : null,
                  ]
                : [busy ? 'Tracing…' : 'No result yet']
            }
          />
        </Panel>
      </div>

      {res && res.palette.length > 0 && mode === 'color' && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Layers, bottom to top</span>
          {res.layers.map((l, i) => (
            <span key={`${l.color}-${i}`} className="flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-2xs">
              <span className="size-3 rounded-sm border" style={{ backgroundColor: l.color }} />
              {l.color}
              <span className="text-muted-foreground">{fmtInt(l.shapes)}</span>
            </span>
          ))}
        </div>
      )}

      {res && res.nodes > 60000 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>This SVG has {fmtInt(res.nodes)} nodes. Lower the detail, raise the speckle filter or use fewer colours to shrink it.</span>
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Best for logos, icons, signatures and line art. Photos produce very large SVGs with many small shapes. Tracing runs
        entirely in your browser: outlines are found with sub-pixel marching squares, simplified, then fitted with cubic
        Béziers that keep sharp corners. Images wider than the working size are downscaled before tracing; the SVG keeps
        the original dimensions.
      </p>
    </div>
  );
}
