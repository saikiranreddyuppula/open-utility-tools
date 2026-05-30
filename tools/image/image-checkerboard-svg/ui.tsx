'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Pattern = 'checkerboard' | 'stripes' | 'dots' | 'grid';
type StripeDir = 'horizontal' | 'vertical' | 'diagonal';

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

interface Opts {
  pattern: Pattern;
  tile: number;
  thickness: number;
  stripeDir: StripeDir;
  colorA: string;
  colorB: string;
}

function buildTile(o: Opts): string {
  const s = o.tile;
  const half = s / 2;
  const t = clamp(o.thickness, 1, s);
  switch (o.pattern) {
    case 'checkerboard':
      return `<rect width="${s}" height="${s}" fill="${o.colorA}"/><rect width="${half}" height="${half}" fill="${o.colorB}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${o.colorB}"/>`;
    case 'stripes': {
      const rect = `<rect width="${s}" height="${s}" fill="${o.colorA}"/>`;
      if (o.stripeDir === 'horizontal') {
        return `${rect}<rect width="${s}" height="${t}" fill="${o.colorB}"/>`;
      }
      if (o.stripeDir === 'vertical') {
        return `${rect}<rect width="${t}" height="${s}" fill="${o.colorB}"/>`;
      }
      // diagonal: draw a band plus wrap-around segments for seamless tiling.
      return `${rect}<path d="M0,${s} L${s},0 M-${t},${t} L${t},-${t} M${s - t},${s + t} L${s + t},${s - t}" stroke="${o.colorB}" stroke-width="${t}"/>`;
    }
    case 'dots': {
      const r = clamp(o.thickness, 1, half);
      return `<rect width="${s}" height="${s}" fill="${o.colorA}"/><circle cx="${half}" cy="${half}" r="${r}" fill="${o.colorB}"/>`;
    }
    case 'grid':
      return `<rect width="${s}" height="${s}" fill="${o.colorA}"/><path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${o.colorB}" stroke-width="${t}"/>`;
    default:
      return `<rect width="${s}" height="${s}" fill="${o.colorA}"/>`;
  }
}

function buildSvg(o: Opts, canvasSize: number): string {
  const tile = buildTile(o);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">`,
    `  <defs>`,
    `    <pattern id="p" width="${o.tile}" height="${o.tile}" patternUnits="userSpaceOnUse">${tile}</pattern>`,
    `  </defs>`,
    `  <rect width="100%" height="100%" fill="url(#p)"/>`,
    `</svg>`,
  ].join('\n');
}

export default function CheckerboardPatternGenerator() {
  const [pattern, setPattern] = useState<Pattern>('checkerboard');
  const [tile, setTile] = useState(32);
  const [thickness, setThickness] = useState(4);
  const [stripeDir, setStripeDir] = useState<StripeDir>('diagonal');
  const [colorA, setColorA] = useState('#ffffff');
  const [colorB, setColorB] = useState('#d4d4d8');
  const [canvasSize, setCanvasSize] = useState(256);
  const [pngError, setPngError] = useState<string | null>(null);

  const opts: Opts = useMemo(
    () => ({ pattern, tile: clamp(Math.round(tile), 4, 200), thickness, stripeDir, colorA, colorB }),
    [pattern, tile, thickness, stripeDir, colorA, colorB],
  );

  const svg = useMemo(() => buildSvg(opts, clamp(Math.round(canvasSize), 16, 2048)), [opts, canvasSize]);

  const dataUri = useMemo(() => {
    // A single tile for use as a repeating CSS background.
    const tileSvg = buildSvg(opts, opts.tile);
    return `url("data:image/svg+xml,${encodeURIComponent(tileSvg)}")`;
  }, [opts]);

  const downloadPng = () => {
    setPngError(null);
    const size = clamp(Math.round(canvasSize), 16, 2048);
    const img = new globalThis.Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setPngError('Canvas not supported.');
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => {
        if (!out) {
          setPngError('Could not export PNG.');
          return;
        }
        const a = document.createElement('a');
        const dl = URL.createObjectURL(out);
        a.href = dl;
        a.download = `${pattern}-pattern.png`;
        a.click();
        URL.revokeObjectURL(dl);
      }, 'image/png');
    };
    img.onerror = () => {
      setPngError('Could not rasterize SVG.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Pattern">
            <Select value={pattern} onValueChange={(v) => setPattern(v as Pattern)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkerboard">Checkerboard</SelectItem>
                <SelectItem value="stripes">Stripes</SelectItem>
                <SelectItem value="dots">Polka dots</SelectItem>
                <SelectItem value="grid">Grid lines</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {pattern === 'stripes' && (
            <Field label="Stripe direction">
              <Select value={stripeDir} onValueChange={(v) => setStripeDir(v as StripeDir)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="diagonal">Diagonal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label={`Tile size: ${opts.tile}px`} className="min-w-[180px]">
            <Slider min={4} max={120} step={1} value={[tile]} onValueChange={(v) => setTile(v[0] ?? 32)} />
          </Field>
          {pattern !== 'checkerboard' && (
            <Field label={`${pattern === 'dots' ? 'Dot radius' : 'Thickness'}: ${thickness}px`} className="min-w-[180px]">
              <Slider min={1} max={40} step={1} value={[thickness]} onValueChange={(v) => setThickness(v[0] ?? 4)} />
            </Field>
          )}
          <Field label="Color A">
            <div className="flex items-center gap-2">
              <Input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} className="h-9 w-12 p-1" />
              <Input value={colorA} onChange={(e) => setColorA(e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <Field label="Color B">
            <div className="flex items-center gap-2">
              <Input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} className="h-9 w-12 p-1" />
              <Input value={colorB} onChange={(e) => setColorB(e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <Field label={`Canvas: ${clamp(Math.round(canvasSize), 16, 2048)}px`} className="min-w-[180px]">
            <Slider min={64} max={1024} step={16} value={[canvasSize]} onValueChange={(v) => setCanvasSize(v[0] ?? 256)} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="flex justify-center p-4">
          <div
            className="h-56 w-full max-w-md rounded-md border border-border"
            style={{ backgroundImage: dataUri, backgroundRepeat: 'repeat' }}
          />
        </div>
      </Panel>

      <ErrorBanner error={pngError} />

      <Panel>
        <PanelHeader title="SVG markup">
          <Button variant="secondary" size="sm" onClick={downloadPng}>
            Download PNG
          </Button>
          <CopyButton value={svg} />
          <DownloadButton data={svg} filename={`${pattern}-pattern.svg`} mime="image/svg+xml" />
        </PanelHeader>
        <pre className="max-h-60 overflow-auto bg-card p-3 font-mono text-xs">{svg}</pre>
        <StatBar items={[`pattern: ${pattern}`, `tile: ${opts.tile}px`, `${svg.length} chars`]} />
      </Panel>

      <Panel>
        <PanelHeader title="CSS background data URI">
          <CopyButton value={`background-image: ${dataUri};\nbackground-repeat: repeat;`} />
        </PanelHeader>
        <pre className="max-h-40 overflow-auto break-all whitespace-pre-wrap bg-card p-3 font-mono text-xs">
          {`background-image: ${dataUri};\nbackground-repeat: repeat;`}
        </pre>
      </Panel>
    </div>
  );
}
