'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ErrorBanner } from '@/components/tools/error-banner';

interface ChannelStats {
  min: number;
  max: number;
  mean: number;
  clipLow: number;
  clipHigh: number;
}

interface HistResult {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
  stats: { r: ChannelStats; g: ChannelStats; b: ChannelStats; luma: ChannelStats };
}

const CW = 512;
const CH = 180;

function emptyBins(): number[] {
  return new Array<number>(256).fill(0);
}

function statsFor(bins: number[]): ChannelStats {
  let total = 0;
  let sum = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < 256; i++) {
    const c = bins[i] ?? 0;
    if (c > 0) {
      total += c;
      sum += c * i;
      if (i < min) min = i;
      if (i > max) max = i;
    }
  }
  const clipLowCount = bins[0] ?? 0;
  const clipHighCount = bins[255] ?? 0;
  return {
    min: total === 0 ? 0 : min,
    max,
    mean: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
    clipLow: total === 0 ? 0 : Math.round((clipLowCount / total) * 1000) / 10,
    clipHigh: total === 0 ? 0 : Math.round((clipHighCount / total) * 1000) / 10,
  };
}

export default function HistogramTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [hist, setHist] = useState<HistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showR, setShowR] = useState(true);
  const [showG, setShowG] = useState(true);
  const [showB, setShowB] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const rgbCanvasRef = useRef<HTMLCanvasElement>(null);
  const lumaCanvasRef = useRef<HTMLCanvasElement>(null);

  const analyse = useCallback((dataUrl: string) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const maxDim = 512;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported in this browser.');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        setError('Could not read pixel data from this image.');
        return;
      }
      const r = emptyBins();
      const g = emptyBins();
      const b = emptyBins();
      const luma = emptyBins();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] ?? 0;
        if (a === 0) continue;
        const rv = data[i] ?? 0;
        const gv = data[i + 1] ?? 0;
        const bv = data[i + 2] ?? 0;
        r[rv] = (r[rv] ?? 0) + 1;
        g[gv] = (g[gv] ?? 0) + 1;
        b[bv] = (b[bv] ?? 0) + 1;
        const y = Math.round(0.299 * rv + 0.587 * gv + 0.114 * bv);
        const yi = y > 255 ? 255 : y;
        luma[yi] = (luma[yi] ?? 0) + 1;
      }
      setHist({
        r,
        g,
        b,
        luma,
        stats: { r: statsFor(r), g: statsFor(g), b: statsFor(b), luma: statsFor(luma) },
      });
      setError(null);
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
  }, []);

  const onFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        if (!url) {
          setError('Could not read file.');
          return;
        }
        setSrc(url);
        analyse(url);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [analyse]
  );

  const drawChannelBars = useCallback(
    (ctx: CanvasRenderingContext2D, bins: number[], maxBin: number, color: string) => {
      if (maxBin <= 0) return;
      ctx.fillStyle = color;
      for (let i = 0; i < 256; i++) {
        const c = bins[i] ?? 0;
        const barH = (c / maxBin) * (CH - 4);
        const x = (i / 256) * CW;
        ctx.fillRect(x, CH - barH, CW / 256 + 0.5, barH);
      }
    },
    []
  );

  // Render the overlaid RGB chart and the separate luma chart.
  useEffect(() => {
    if (!hist) return;
    const rgbCanvas = rgbCanvasRef.current;
    const lumaCanvas = lumaCanvasRef.current;
    if (!rgbCanvas || !lumaCanvas) return;

    const rctx = rgbCanvas.getContext('2d');
    if (rctx) {
      rctx.clearRect(0, 0, CW, CH);
      rctx.fillStyle = '#0a0a0a';
      rctx.fillRect(0, 0, CW, CH);
      const max = Math.max(
        showR ? Math.max(...hist.r) : 0,
        showG ? Math.max(...hist.g) : 0,
        showB ? Math.max(...hist.b) : 0,
        1
      );
      // 'screen'-like additive blend so overlapping channels read well.
      rctx.globalCompositeOperation = 'lighter';
      if (showR) drawChannelBars(rctx, hist.r, max, 'rgba(255,80,80,0.9)');
      if (showG) drawChannelBars(rctx, hist.g, max, 'rgba(80,220,120,0.9)');
      if (showB) drawChannelBars(rctx, hist.b, max, 'rgba(90,140,255,0.9)');
      rctx.globalCompositeOperation = 'source-over';
    }

    const lctx = lumaCanvas.getContext('2d');
    if (lctx) {
      lctx.clearRect(0, 0, CW, CH);
      lctx.fillStyle = '#0a0a0a';
      lctx.fillRect(0, 0, CW, CH);
      const maxL = Math.max(Math.max(...hist.luma), 1);
      drawChannelBars(lctx, hist.luma, maxL, 'rgba(220,220,220,0.95)');
    }
  }, [hist, showR, showG, showB, drawChannelBars]);

  const downloadChart = useCallback((canvas: HTMLCanvasElement | null, name: string) => {
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = name;
    a.click();
  }, []);

  const statRows = hist
    ? ([
        ['R', hist.stats.r],
        ['G', hist.stats.g],
        ['B', hist.stats.b],
        ['Luma', hist.stats.luma],
      ] as const)
    : [];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <Field label="Red">
            <div className="flex h-8 items-center">
              <Switch checked={showR} onCheckedChange={setShowR} />
            </div>
          </Field>
          <Field label="Green">
            <div className="flex h-8 items-center">
              <Switch checked={showG} onCheckedChange={setShowG} />
            </div>
          </Field>
          <Field label="Blue">
            <div className="flex h-8 items-center">
              <Switch checked={showB} onCheckedChange={setShowB} />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {hist && (
        <>
          <Panel>
            <PanelHeader title="RGB histogram">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadChart(rgbCanvasRef.current, 'histogram-rgb.png')}
              >
                Download PNG
              </Button>
            </PanelHeader>
            <div className="p-3">
              <canvas
                ref={rgbCanvasRef}
                width={CW}
                height={CH}
                className="w-full rounded border"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Luminance histogram">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadChart(lumaCanvasRef.current, 'histogram-luma.png')}
              >
                Download PNG
              </Button>
            </PanelHeader>
            <div className="p-3">
              <canvas
                ref={lumaCanvasRef}
                width={CW}
                height={CH}
                className="w-full rounded border"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Channel statistics" />
            <div className="overflow-auto p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1 font-medium">Channel</th>
                    <th className="px-2 py-1 font-medium">Min</th>
                    <th className="px-2 py-1 font-medium">Max</th>
                    <th className="px-2 py-1 font-medium">Mean</th>
                    <th className="px-2 py-1 font-medium">Clip @0</th>
                    <th className="px-2 py-1 font-medium">Clip @255</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {statRows.map(([label, s]) => (
                    <tr key={label} className="border-t">
                      <td className="px-2 py-1">{label}</td>
                      <td className="px-2 py-1">{s.min}</td>
                      <td className="px-2 py-1">{s.max}</td>
                      <td className="px-2 py-1">{s.mean}</td>
                      <td className="px-2 py-1">{s.clipLow}%</td>
                      <td className="px-2 py-1">{s.clipHigh}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar items={['Sampled at up to 512px on the longest edge']} />
          </Panel>
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Histograms are computed from a downscaled copy in your browser — nothing is uploaded.
      </p>
    </div>
  );
}
