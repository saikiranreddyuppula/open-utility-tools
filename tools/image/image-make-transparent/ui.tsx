'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Undo2, RotateCcw, X, Wand2, Download, Pipette, Loader2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';
import {
  DEFAULT_SETTINGS,
  CancelledError,
  DistanceCache,
  MAX_PIXELS,
  contentBounds,
  cropRgba,
  detectBackground,
  parseHex,
  removeBackgroundAsync,
  toHex,
  type Mode,
  type Rgb,
  type Settings,
  type Target,
} from './logic';

interface Loaded {
  name: string;
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
}

type PreviewBg = 'checker' | 'white' | 'black' | 'custom';
type Zoom = 'fit' | '1' | '2' | '4';
type ExportFormat = 'png' | 'webp';

const MAX_TARGETS = 12;

const CHECKER_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: 'conic-gradient(#d4d4d8 25%, #ffffff 0 50%, #d4d4d8 0 75%, #ffffff 0)',
  backgroundSize: '16px 16px',
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new globalThis.Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not decode this image. Please use a PNG, JPEG, WebP, GIF or BMP file.'));
    im.src = url;
  });
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function MakeTransparentTool() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [history, setHistory] = useState<Target[][]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [bg, setBg] = useState<PreviewBg>('checker');
  const [customBg, setCustomBg] = useState('#ff3b8d');
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualColor, setManualColor] = useState('#ffffff');
  const [trim, setTrim] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(92);
  const [stats, setStats] = useState<{ transparent: number; bounds: { w: number; h: number } | null }>({ transparent: 0, bounds: null });
  const [hover, setHover] = useState<{ x: number; y: number; c: Rgb; a: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<DistanceCache | null>(null);
  const resultRef = useRef<Uint8ClampedArray | null>(null);
  const spareRef = useRef<Uint8ClampedArray | null>(null);
  const [ctl] = useState(() => ({ run: 0 }));
  const imageDataRef = useRef<ImageData | null>(null);
  const showOriginalRef = useRef(false);
  const trimRef = useRef(false);

  // ---- drawing -----------------------------------------------------------------------------
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !loaded) return;
    if (cv.width !== loaded.w || cv.height !== loaded.h) {
      cv.width = loaded.w;
      cv.height = loaded.h;
      imageDataRef.current = null;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let id = imageDataRef.current;
    if (!id || id.width !== loaded.w || id.height !== loaded.h) {
      id = ctx.createImageData(loaded.w, loaded.h);
      imageDataRef.current = id;
    }
    id.data.set(showOriginalRef.current ? loaded.rgba : (resultRef.current ?? loaded.rgba));
    ctx.putImageData(id, 0, 0);
  }, [loaded]);

  // ---- recompute the cut-out whenever inputs change (cooperative + cancellable) --------------
  useEffect(() => {
    if (!loaded) return;
    const myRun = ++ctl.run;
    setBusy(true);
    const delay = loaded.w * loaded.h > 4_000_000 ? 80 : 25;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const cache = cacheRef.current ?? new DistanceCache(loaded.rgba);
          cacheRef.current = cache;
          const spare = spareRef.current && spareRef.current.length === loaded.rgba.length ? spareRef.current : undefined;
          const r = await removeBackgroundAsync(
            loaded.rgba,
            loaded.w,
            loaded.h,
            targets,
            settings,
            cache,
            { shouldCancel: () => ctl.run !== myRun },
            spare
          );
          if (ctl.run !== myRun) return;
          spareRef.current = resultRef.current && resultRef.current !== loaded.rgba ? resultRef.current : null;
          resultRef.current = r.pixels;
          const b = trimRef.current ? contentBounds(r.pixels, loaded.w, loaded.h) : null;
          setStats({ transparent: r.transparent / (loaded.w * loaded.h), bounds: b ? { w: b.w, h: b.h } : null });
          setError(null);
          draw();
        } catch (e) {
          if (e instanceof CancelledError) return;
          resultRef.current = loaded.rgba;
          setError(e instanceof Error ? e.message : 'Could not process this image.');
          draw();
        }
        if (ctl.run === myRun) setBusy(false);
      })();
    }, delay);
    return () => {
      clearTimeout(timer);
      ctl.run++;
    };
  }, [loaded, targets, settings, draw, ctl]);

  // keep the "trim" size hint in sync without recomputing the whole cut-out
  useEffect(() => {
    trimRef.current = trim;
    const out = resultRef.current;
    if (!loaded || !out) return;
    const b = trim ? contentBounds(out, loaded.w, loaded.h) : null;
    setStats((st) => ({ ...st, bounds: b ? { w: b.w, h: b.h } : null }));
  }, [trim, loaded]);

  useEffect(() => {
    showOriginalRef.current = showOriginal;
    draw();
  }, [showOriginal, draw]);

  // ---- loading ---------------------------------------------------------------------------
  const loadFromUrl = useCallback(async (url: string, name: string) => {
    setError(null);
    setNotice(null);
    try {
      const img = await loadImage(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w < 1 || h < 1) throw new Error('Image has no pixels.');
      if (w * h > MAX_PIXELS) throw new Error(`Image is ${((w * h) / 1e6).toFixed(1)} megapixels — the limit is ${MAX_PIXELS / 1e6} MP.`);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas is not available in this browser.');
      ctx.drawImage(img, 0, 0);
      const rgba = ctx.getImageData(0, 0, w, h).data;
      c.width = 0;
      cacheRef.current?.clear();
      cacheRef.current = new DistanceCache(rgba);
      resultRef.current = null;
      spareRef.current = null;
      imageDataRef.current = null;
      const guess = detectBackground(rgba, w, h);
      setHistory([]);
      setTargets(guess ? [{ x: null, y: null, color: guess.color }] : []);
      setNotice(
        guess
          ? `Detected a uniform background (${toHex(guess.color)}) along the border and removed it — click the image to adjust.`
          : 'No uniform background detected on the border — click the colour you want to remove.'
      );
      setLoaded({ name, w, h, rgba });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the image.');
    }
  }, []);

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      void loadFromUrl(url, f.name).finally(() => URL.revokeObjectURL(url));
    },
    [loadFromUrl]
  );

  const loadSample = useCallback(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 900, 600);
    const g = ctx.createLinearGradient(250, 100, 650, 500);
    g.addColorStop(0, '#14b8a6');
    g.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(450, 300, 230, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(450, 300, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(330, 190, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOGO', 450, 575);
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      void loadFromUrl(url, 'sample-logo.png').finally(() => URL.revokeObjectURL(url));
    }, 'image/png');
  }, [loadFromUrl]);

  // ---- target management (with undo) ---------------------------------------------------------
  const commitTargets = useCallback(
    (next: Target[]) => {
      setHistory((h) => [...h.slice(-49), targets]);
      setTargets(next);
    },
    [targets]
  );

  const addTarget = useCallback(
    (t: Target) => {
      if (targets.length >= MAX_TARGETS) {
        setNotice(`Up to ${MAX_TARGETS} colours / points at once — remove one or reset first.`);
        return;
      }
      commitTargets([...targets, t]);
    },
    [targets, commitTargets]
  );

  const undo = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setTargets(prev);
    setHistory(history.slice(0, -1));
  }, [history]);

  const pointFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cv = canvasRef.current;
      if (!cv || !loaded) return null;
      const r = cv.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const x = Math.min(loaded.w - 1, Math.max(0, Math.floor(((e.clientX - r.left) * loaded.w) / r.width)));
      const y = Math.min(loaded.h - 1, Math.max(0, Math.floor(((e.clientY - r.top) * loaded.h) / r.height)));
      const o = (y * loaded.w + x) * 4;
      const c: Rgb = [loaded.rgba[o] ?? 0, loaded.rgba[o + 1] ?? 0, loaded.rgba[o + 2] ?? 0];
      return { x, y, c, a: loaded.rgba[o + 3] ?? 255 };
    },
    [loaded]
  );

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = pointFromEvent(e);
      if (!p) return;
      if (p.a < 8) {
        setNotice('That pixel is already transparent — click a coloured pixel.');
        return;
      }
      setNotice(null);
      addTarget({ x: p.x, y: p.y, color: p.c });
    },
    [pointFromEvent, addTarget]
  );

  const autoDetect = useCallback(() => {
    if (!loaded) return;
    const guess = detectBackground(loaded.rgba, loaded.w, loaded.h, 0.5);
    if (!guess) {
      setNotice('No single dominant colour along the image border — click the background instead.');
      return;
    }
    setNotice(`Background detected: ${toHex(guess.color)}`);
    addTarget({ x: null, y: null, color: guess.color });
  }, [loaded, addTarget]);

  const addManual = useCallback(() => {
    const c = parseHex(manualColor);
    if (c) addTarget({ x: null, y: null, color: c });
  }, [manualColor, addTarget]);

  // ---- export ----------------------------------------------------------------------------
  const exportImage = useCallback(async () => {
    if (!loaded || !resultRef.current) return;
    setExporting(true);
    setError(null);
    try {
      let data = resultRef.current;
      let w = loaded.w;
      let h = loaded.h;
      if (trim) {
        const b = contentBounds(data, w, h);
        if (b) {
          data = cropRgba(data, w, b);
          w = b.w;
          h = b.h;
        } else {
          throw new Error('Nothing is left to export — the whole image is transparent.');
        }
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');
      const id = ctx.createImageData(w, h);
      id.data.set(data);
      ctx.putImageData(id, 0, 0);
      const mime = format === 'png' ? 'image/png' : 'image/webp';
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, mime, quality / 100));
      c.width = 0;
      if (!blob) throw new Error('The browser could not encode the image.');
      const base = loaded.name.replace(/\.[^.]+$/, '') || 'image';
      const isWebp = blob.type === 'image/webp';
      if (format === 'webp' && !isWebp) setNotice('This browser cannot encode WebP — saved as PNG instead.');
      saveBlob(blob, `${base}-transparent.${isWebp ? 'webp' : 'png'}`);
      setNotice((n) => n ?? `Saved ${formatBytes(blob.size)} (${w}×${h}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [loaded, trim, format, quality]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const previewBgStyle: React.CSSProperties =
    bg === 'checker' ? CHECKER_STYLE : { backgroundColor: bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : customBg };
  const zoomN = zoom === 'fit' ? 0 : Number(zoom);
  const canvasStyle: React.CSSProperties =
    loaded && zoomN > 0
      ? { width: loaded.w * zoomN, height: loaded.h * zoomN, maxWidth: 'none', imageRendering: zoomN >= 2 ? 'pixelated' : 'auto' }
      : { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '70vh' };

  return (
    <div className="space-y-4">
      {!loaded && (
        <>
          <FileDropzone
            onFiles={onFiles}
            accept="image/*"
            label="Drop an image here"
            hint="PNG, JPEG, WebP, GIF or BMP · up to 40 megapixels · nothing is uploaded"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={loadSample}>
              <Wand2 className="size-3.5" /> Try a sample logo on white
            </Button>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Works best on flat, solid backgrounds — white product photos, logos, signatures, scans and screenshots. It
            removes pixels by colour similarity (a magic wand), it does not “understand” photos; for complex scenes use an
            AI background remover.
          </p>
        </>
      )}
      <ErrorBanner error={error} />

      {loaded && (
        <>
          <Panel>
            <OptionsBar>
              <Field label="Remove">
                <Tabs value={settings.mode} onValueChange={(v) => set('mode', v as Mode)}>
                  <TabsList>
                    <TabsTrigger value="flood">Flood fill</TabsTrigger>
                    <TabsTrigger value="global">Everywhere</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              <Field label={`Tolerance: ${settings.tolerance} ΔE`} className="min-w-[170px] flex-1" hint="how different a colour may be">
                <Slider
                  value={[settings.tolerance]}
                  min={0}
                  max={60}
                  step={1}
                  onValueChange={(v) => set('tolerance', v[0] ?? 0)}
                  aria-label="Tolerance"
                />
              </Field>
              <Field label={`Edge softness: ${settings.feather} ΔE`} className="min-w-[170px] flex-1" hint="fade-out band at edges">
                <Slider
                  value={[settings.feather]}
                  min={0}
                  max={40}
                  step={1}
                  onValueChange={(v) => set('feather', v[0] ?? 0)}
                  aria-label="Edge softness"
                />
              </Field>
              <Field label="Defringe">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="defringe" checked={settings.defringe} onCheckedChange={(c) => set('defringe', c)} />
                  <Label htmlFor="defringe" className="text-xs text-muted-foreground">
                    remove background tint
                  </Label>
                </div>
              </Field>
            </OptionsBar>
          </Panel>

          <Panel>
            <PanelHeader title="Colours to remove">
              <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={history.length === 0} aria-label="Undo last action">
                <Undo2 className="size-3.5" /> Undo
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => commitTargets([])} disabled={targets.length === 0} aria-label="Reset">
                <RotateCcw className="size-3.5" /> Reset
              </Button>
            </PanelHeader>
            <div className="flex flex-wrap items-center gap-2 p-3">
              {targets.length === 0 && <span className="text-xs text-muted-foreground">None yet — click the image to pick a colour.</span>}
              {targets.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 py-1 pl-1.5 pr-1 text-xs">
                  <span className="size-4 rounded border" style={{ backgroundColor: toHex(t.color) }} />
                  <code className="font-mono">{toHex(t.color)}</code>
                  <span className="text-muted-foreground">{t.x !== null ? `@ ${t.x},${t.y}` : 'from edges'}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Remove ${toHex(t.color)}`}
                    onClick={() => commitTargets(targets.filter((_, k) => k !== i))}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <input
                type="color"
                value={manualColor}
                onChange={(e) => setManualColor(e.target.value)}
                aria-label="Pick a colour to add"
                className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0.5"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addManual}>
                Add colour
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={autoDetect}>
                <Pipette className="size-3.5" /> Auto-detect background
              </Button>
            </div>
            <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">
              {settings.mode === 'flood'
                ? 'Flood fill: each click removes the connected area of that colour (like a magic wand). Colours added without a click start from every matching pixel on the image border.'
                : 'Everywhere: every pixel similar to a picked colour is removed, including enclosed areas such as the inside of letters.'}
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Preview">
              <Button
                type="button"
                variant={showOriginal ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowOriginal((s) => !s)}
                aria-pressed={showOriginal}
              >
                {showOriginal ? 'Showing original' : 'Show original'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLoaded(null)}>
                New image
              </Button>
            </PanelHeader>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b bg-muted/20 px-3 py-2">
              <Field label="Background">
                <Tabs value={bg} onValueChange={(v) => setBg(v as PreviewBg)}>
                  <TabsList>
                    <TabsTrigger value="checker">Checker</TabsTrigger>
                    <TabsTrigger value="white">White</TabsTrigger>
                    <TabsTrigger value="black">Black</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              {bg === 'custom' && (
                <Field label="Colour">
                  <input
                    type="color"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    aria-label="Custom preview background"
                    className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                  />
                </Field>
              )}
              <Field label="Zoom">
                <Select value={zoom} onValueChange={(v) => setZoom(v as Zoom)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit">Fit</SelectItem>
                    <SelectItem value="1">100%</SelectItem>
                    <SelectItem value="2">200%</SelectItem>
                    <SelectItem value="4">400%</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {busy && (
                <span className="flex items-center gap-1.5 pb-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Updating…
                </span>
              )}
            </div>
            <div className="max-h-[78vh] overflow-auto p-3">
              <div className="relative mx-auto w-fit rounded border" style={previewBgStyle}>
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label="Preview of the image with its background removed. Click to pick a colour."
                  className="block cursor-crosshair"
                  style={canvasStyle}
                  onClick={onCanvasClick}
                  onMouseMove={(e) => {
                    const p = pointFromEvent(e);
                    if (p) setHover((h) => (h && h.x === p.x && h.y === p.y ? h : p));
                  }}
                  onMouseLeave={() => setHover(null)}
                />
                {targets.map((t, i) =>
                  t.x !== null && t.y !== null ? (
                    <span
                      key={i}
                      className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.75)]"
                      style={{ left: `${(t.x / loaded.w) * 100}%`, top: `${(t.y / loaded.h) * 100}%`, backgroundColor: toHex(t.color) }}
                    />
                  ) : null
                )}
              </div>
            </div>
            <StatBar
              items={[
                `${loaded.w}×${loaded.h} px`,
                `${(stats.transparent * 100).toFixed(1)}% transparent`,
                hover && `x ${hover.x}, y ${hover.y}  ${toHex(hover.c)}${hover.a < 255 ? ` α${hover.a}` : ''}`,
              ]}
            />
            {notice && <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">{notice}</p>}
          </Panel>

          <Panel>
            <PanelHeader title="Export" />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 p-3">
              <Field label="Format">
                <Tabs value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <TabsList>
                    <TabsTrigger value="png">PNG</TabsTrigger>
                    <TabsTrigger value="webp">WebP</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              {format === 'webp' && (
                <Field label={`Quality: ${quality}`} className="min-w-[160px]">
                  <Slider value={[quality]} min={50} max={100} step={1} onValueChange={(v) => setQuality(v[0] ?? 92)} aria-label="WebP quality" />
                </Field>
              )}
              <Field label="Crop" hint={trim && stats.bounds ? `→ ${stats.bounds.w}×${stats.bounds.h} px` : undefined}>
                <div className="flex h-8 items-center gap-2">
                  <Switch id="trim" checked={trim} onCheckedChange={setTrim} />
                  <Label htmlFor="trim" className="text-xs text-muted-foreground">
                    trim transparent edges
                  </Label>
                </div>
              </Field>
              <Button type="button" onClick={() => void exportImage()} disabled={exporting || busy}>
                {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Download {format.toUpperCase()}
              </Button>
            </div>
          </Panel>

          <p className="px-1 text-2xs text-muted-foreground">
            Colour similarity uses CIELAB ΔE (≈ 2 is barely visible, ≈ 10 is a clearly different shade). Raise edge softness
            and keep defringe on to avoid a light halo around dark subjects. JPEG compression noise needs a higher tolerance
            than PNG. Everything runs locally in your browser.
          </p>
        </>
      )}
    </div>
  );
}
