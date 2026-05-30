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

type NoiseType = 'fractalNoise' | 'turbulence';

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

interface Opts {
  noiseType: NoiseType;
  baseFreq: number;
  octaves: number;
  seed: number;
  opacity: number;
  overlay: string;
  size: number;
}

function buildSvg(o: Opts): string {
  const size = clamp(Math.round(o.size), 16, 2048);
  const freq = clamp(o.baseFreq, 0.001, 2);
  const oct = clamp(Math.round(o.octaves), 1, 8);
  const seed = clamp(Math.round(o.seed), 0, 9999);
  const op = clamp(o.opacity, 0, 1);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <defs>`,
    `    <filter id="noise">`,
    `      <feTurbulence type="${o.noiseType}" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="n"/>`,
    `    </filter>`,
    `  </defs>`,
    `  <rect width="100%" height="100%" fill="${o.overlay}"/>`,
    `  <rect width="100%" height="100%" filter="url(#noise)" opacity="${op}"/>`,
    `</svg>`,
  ].join('\n');
}

export default function NoiseTextureSvgGenerator() {
  const [noiseType, setNoiseType] = useState<NoiseType>('fractalNoise');
  const [baseFreq, setBaseFreq] = useState(0.65);
  const [octaves, setOctaves] = useState(3);
  const [seed, setSeed] = useState(0);
  const [opacity, setOpacity] = useState(0.4);
  const [overlay, setOverlay] = useState('#ffffff');
  const [size, setSize] = useState(256);
  const [pngError, setPngError] = useState<string | null>(null);

  const opts: Opts = useMemo(
    () => ({ noiseType, baseFreq, octaves, seed, opacity, overlay, size }),
    [noiseType, baseFreq, octaves, seed, opacity, overlay, size],
  );

  const svg = useMemo(() => buildSvg(opts), [opts]);
  const dataUri = useMemo(() => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, [svg]);

  const downloadPng = () => {
    setPngError(null);
    const px = clamp(Math.round(size), 16, 2048);
    const img = new globalThis.Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setPngError('Canvas not supported.');
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => {
        if (!out) {
          setPngError('Could not export PNG (the browser may not rasterize feTurbulence).');
          return;
        }
        const a = document.createElement('a');
        const dl = URL.createObjectURL(out);
        a.href = dl;
        a.download = 'noise-texture.png';
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
          <Field label="Noise type">
            <Select value={noiseType} onValueChange={(v) => setNoiseType(v as NoiseType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fractalNoise">fractalNoise</SelectItem>
                <SelectItem value="turbulence">turbulence</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Base frequency: ${baseFreq.toFixed(3)}`} className="min-w-[200px]">
            <Slider min={0.01} max={1.5} step={0.01} value={[baseFreq]} onValueChange={(v) => setBaseFreq(v[0] ?? 0.65)} />
          </Field>
          <Field label={`Octaves: ${octaves}`} className="min-w-[160px]">
            <Slider min={1} max={8} step={1} value={[octaves]} onValueChange={(v) => setOctaves(v[0] ?? 3)} />
          </Field>
          <Field label="Seed">
            <Input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              className="w-24 font-mono"
            />
          </Field>
          <Field label={`Opacity: ${opacity.toFixed(2)}`} className="min-w-[160px]">
            <Slider min={0} max={1} step={0.01} value={[opacity]} onValueChange={(v) => setOpacity(v[0] ?? 0.4)} />
          </Field>
          <Field label="Overlay color">
            <div className="flex items-center gap-2">
              <Input type="color" value={overlay} onChange={(e) => setOverlay(e.target.value)} className="h-9 w-12 p-1" />
              <Input value={overlay} onChange={(e) => setOverlay(e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <Field label={`Size: ${clamp(Math.round(size), 16, 2048)}px`} className="min-w-[180px]">
            <Slider min={64} max={1024} step={16} value={[size]} onValueChange={(v) => setSize(v[0] ?? 256)} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Preview (repeating)" />
        <div className="flex justify-center p-4">
          <div
            className="h-56 w-full max-w-md rounded-md border border-border bg-muted/30"
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
          <DownloadButton data={svg} filename="noise-texture.svg" mime="image/svg+xml" />
        </PanelHeader>
        <pre className="max-h-60 overflow-auto bg-card p-3 font-mono text-xs">{svg}</pre>
        <StatBar items={[noiseType, `freq ${baseFreq.toFixed(3)}`, `seed ${seed}`, `${svg.length} chars`]} />
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
