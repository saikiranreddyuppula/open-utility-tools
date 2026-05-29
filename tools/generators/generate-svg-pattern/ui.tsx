'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Shape = 'dots' | 'grid' | 'stripes' | 'checkerboard';

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function buildPattern(
  shape: Shape,
  size: number,
  thickness: number,
  bg: string,
  fg: string,
): string {
  const s = clampNum(Math.trunc(size), 4, 200);
  const t = clampNum(thickness, 1, Math.max(1, Math.floor(s / 2)));
  const half = s / 2;

  let body = '';
  switch (shape) {
    case 'dots': {
      const r = t;
      body = `<rect width="${s}" height="${s}" fill="${bg}"/><circle cx="${half}" cy="${half}" r="${r}" fill="${fg}"/>`;
      break;
    }
    case 'grid': {
      body = `<rect width="${s}" height="${s}" fill="${bg}"/><path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${fg}" stroke-width="${t}"/>`;
      break;
    }
    case 'stripes': {
      // diagonal stripes
      body = `<rect width="${s}" height="${s}" fill="${bg}"/><path d="M0,${s} l${s},-${s} M-${t},${t} l${t * 2},-${t * 2} M${s - t},${s + t} l${t * 2},-${t * 2}" stroke="${fg}" stroke-width="${t}"/>`;
      break;
    }
    case 'checkerboard': {
      body = `<rect width="${s}" height="${s}" fill="${bg}"/><rect width="${half}" height="${half}" fill="${fg}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fg}"/>`;
      break;
    }
    default:
      body = `<rect width="${s}" height="${s}" fill="${bg}"/>`;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">`,
    `  <defs>`,
    `    <pattern id="p" width="${s}" height="${s}" patternUnits="userSpaceOnUse">`,
    `      ${body}`,
    `    </pattern>`,
    `  </defs>`,
    `  <rect width="100%" height="100%" fill="url(#p)"/>`,
    `</svg>`,
  ].join('\n');
}

export default function SvgPatternGenerator() {
  const [shape, setShape] = useState<Shape>('dots');
  const [size, setSize] = useState(24);
  const [thickness, setThickness] = useState(3);
  const [bg, setBg] = useState('#ffffff');
  const [fg, setFg] = useState('#3b82f6');

  const svg = useMemo(
    () => buildPattern(shape, size, thickness, bg, fg),
    [shape, size, thickness, bg, fg],
  );

  const dataUri = useMemo(
    () => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    [svg],
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Shape">
            <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dots">Dots</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="stripes">Stripes</SelectItem>
                <SelectItem value="checkerboard">Checkerboard</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Tile size: ${size}px`}>
            <Slider
              min={4}
              max={120}
              step={1}
              value={[size]}
              onValueChange={(v) => setSize(v[0] ?? size)}
            />
          </Field>
          <Field label={`Thickness: ${thickness}px`}>
            <Slider
              min={1}
              max={40}
              step={1}
              value={[thickness]}
              onValueChange={(v) => setThickness(v[0] ?? thickness)}
            />
          </Field>
          <Field label="Background">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-9 w-12 p-1"
              />
              <Input value={bg} onChange={(e) => setBg(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Foreground">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                className="h-9 w-12 p-1"
              />
              <Input value={fg} onChange={(e) => setFg(e.target.value)} className="font-mono" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div
          className="h-48 w-full rounded-md border border-border"
          style={{ backgroundImage: dataUri, backgroundRepeat: 'repeat' }}
        />
      </Panel>

      <Panel>
        <PanelHeader title="SVG markup">
          <CopyButton value={svg} />
          <DownloadButton data={svg} filename="pattern.svg" mime="image/svg+xml" />
        </PanelHeader>
        <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{svg}</pre>
        <StatBar items={[`shape: ${shape}`, `tile: ${size}px`, `${svg.length} chars`]} />
      </Panel>
    </div>
  );
}
