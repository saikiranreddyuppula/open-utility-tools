'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Space = 'rgb' | 'hsl';

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) {
    const r = hex[0] ?? '0';
    const g = hex[1] ?? '0';
    const b = hex[2] ?? '0';
    const num = parseInt(r + r + g + g + b + b, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map((p) => parseFloat(p));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    if (
      r !== undefined &&
      g !== undefined &&
      b !== undefined &&
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b)
    ) {
      const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
      return { r: clamp(r), g: clamp(g), b: clamp(b) };
    }
  }
  return null;
}

function rgbToHex({ r, g, b }: RGB): string {
  return (
    '#' +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  );
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildScale(a: RGB, b: RGB, steps: number, space: Space): RGB[] {
  const out: RGB[] = [];
  const aH = rgbToHsl(a);
  const bH = rgbToHsl(b);
  // Shortest-path hue interpolation.
  let dh = bH.h - aH.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    if (space === 'rgb') {
      out.push({
        r: Math.round(lerp(a.r, b.r, t)),
        g: Math.round(lerp(a.g, b.g, t)),
        b: Math.round(lerp(a.b, b.b, t)),
      });
    } else {
      const h = (((aH.h + dh * t) % 360) + 360) % 360;
      out.push(hslToRgb({ h, s: lerp(aH.s, bH.s, t), l: lerp(aH.l, bH.l, t) }));
    }
  }
  return out;
}

function ColorField({
  label,
  value,
  onChange,
  parsed,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  parsed: RGB | null;
}) {
  return (
    <Field label={label} className="min-w-[200px]">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={parsed ? rgbToHex(parsed) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
          aria-label={`${label} picker`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

export default function ColorScaleGeneratorTool() {
  const [start, setStart] = useState('#3b82f6');
  const [end, setEnd] = useState('#ef4444');
  const [steps, setSteps] = useState(7);
  const [space, setSpace] = useState<Space>('rgb');

  const startRgb = useMemo(() => parseColor(start), [start]);
  const endRgb = useMemo(() => parseColor(end), [end]);

  const error =
    (start.trim() && !startRgb) || (end.trim() && !endRgb)
      ? 'Enter valid HEX or rgb() colors for both endpoints.'
      : null;

  const scale = useMemo(() => {
    if (!startRgb || !endRgb) return [];
    return buildScale(startRgb, endRgb, steps, space).map((c) => rgbToHex(c));
  }, [startRgb, endRgb, steps, space]);

  const allHex = scale.join(', ');

  return (
    <Panel>
      <PanelHeader title="Color Scale Generator" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <ColorField label="From" value={start} onChange={setStart} parsed={startRgb} />
          <ColorField label="To" value={end} onChange={setEnd} parsed={endRgb} />
          <Field label={`Steps: ${steps}`} className="min-w-[180px]">
            <Slider
              value={[steps]}
              min={2}
              max={24}
              step={1}
              onValueChange={(v) => setSteps(v[0] ?? steps)}
            />
          </Field>
          <Field label="Color space">
            <Tabs value={space} onValueChange={(v) => setSpace(v as Space)}>
              <TabsList>
                <TabsTrigger value="rgb">RGB</TabsTrigger>
                <TabsTrigger value="hsl">HSL</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {scale.length > 0 ? (
          <>
            <div className="flex h-14 w-full overflow-hidden rounded-md border">
              {scale.map((hex, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: hex }} title={hex} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {scale.map((hex, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <div
                    className="h-8 w-8 shrink-0 rounded border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="flex-1 font-mono text-xs">{hex}</span>
                  <CopyButton value={hex} label="" />
                </div>
              ))}
            </div>

            <StatBar items={[`${scale.length} steps`, `${space.toUpperCase()} interpolation`]} />

            <div className="flex items-center gap-2">
              <Input value={allHex} readOnly className="font-mono text-xs" />
              <CopyButton value={allHex} label="Copy all" />
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
