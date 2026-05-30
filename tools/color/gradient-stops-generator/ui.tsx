'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
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

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Space = 'srgb' | 'hsl' | 'oklch';
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

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

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
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

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp255(v * 255);
}
type OKLab = { L: number; a: number; b: number };
function rgbToOklab({ r, g, b }: RGB): OKLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}
function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function applyEasing(t: number, e: Easing): number {
  switch (e) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t * t;
    case 'ease-out':
      return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default:
      return t;
  }
}

// Interpolate between two RGB colors in the chosen space at fraction t.
function interp(a: RGB, b: RGB, t: number, space: Space): RGB {
  if (space === 'srgb') {
    return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
  }
  if (space === 'hsl') {
    const ah = rgbToHsl(a);
    const bh = rgbToHsl(b);
    let dh = bh.h - ah.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = (((ah.h + dh * t) % 360) + 360) % 360;
    return hslToRgb({ h, s: lerp(ah.s, bh.s, t), l: lerp(ah.l, bh.l, t) });
  }
  const ao = rgbToOklab(a);
  const bo = rgbToOklab(b);
  return oklabToRgb({ L: lerp(ao.L, bo.L, t), a: lerp(ao.a, bo.a, t), b: lerp(ao.b, bo.b, t) });
}

export default function GradientStopsGeneratorTool() {
  const [stops, setStops] = useState<string[]>(['#2563eb', '#db2777']);
  const [count, setCount] = useState(8);
  const [space, setSpace] = useState<Space>('oklch');
  const [easing, setEasing] = useState<Easing>('linear');

  const parsed = useMemo(() => stops.map((s) => parseColor(s)), [stops]);
  const error = parsed.some((p, i) => stops[i]?.trim() && !p)
    ? 'One or more stop colors are invalid. Use HEX or rgb().'
    : null;

  const result = useMemo(() => {
    const valid = parsed.filter((p): p is RGB => p !== null);
    if (valid.length < 2) return [];
    const n = Math.max(valid.length, count);
    const out: { hex: string; rgb: string; pos: number }[] = [];
    for (let i = 0; i < n; i++) {
      const global = n === 1 ? 0 : i / (n - 1);
      const eased = applyEasing(global, easing);
      // Locate the segment for this eased position.
      const segCount = valid.length - 1;
      const scaled = eased * segCount;
      let seg = Math.floor(scaled);
      if (seg >= segCount) seg = segCount - 1;
      const local = scaled - seg;
      const a = valid[seg] ?? valid[0];
      const b = valid[seg + 1] ?? valid[valid.length - 1];
      if (!a || !b) continue;
      const c = interp(a, b, local, space);
      out.push({
        hex: rgbToHex(c),
        rgb: `rgb(${clamp255(c.r)}, ${clamp255(c.g)}, ${clamp255(c.b)})`,
        pos: Math.round(global * 100),
      });
    }
    return out;
  }, [parsed, count, space, easing]);

  const cssGradient = useMemo(() => {
    if (result.length === 0) return '';
    const stopStr = result.map((s) => `${s.hex} ${s.pos}%`).join(', ');
    return `background: linear-gradient(90deg, ${stopStr});`;
  }, [result]);

  const previewGradient = useMemo(() => {
    if (result.length === 0) return undefined;
    return `linear-gradient(90deg, ${result.map((s) => `${s.hex} ${s.pos}%`).join(', ')})`;
  }, [result]);

  const setStop = (i: number, v: string) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  const addStop = () => setStops((prev) => [...prev, '#10b981']);
  const removeStop = (i: number) =>
    setStops((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  return (
    <Panel>
      <PanelHeader title="Gradient Stops Generator" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label={`Total stops: ${count}`} className="min-w-[180px]">
            <Slider
              value={[count]}
              min={2}
              max={32}
              step={1}
              onValueChange={(v) => setCount(v[0] ?? count)}
            />
          </Field>
          <Field label="Interpolation space" className="min-w-[150px]">
            <Select value={space} onValueChange={(v) => setSpace(v as Space)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="srgb">sRGB</SelectItem>
                <SelectItem value="hsl">HSL</SelectItem>
                <SelectItem value="oklch">OKLCH (perceptual)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Easing" className="min-w-[150px]">
            <Select value={easing} onValueChange={(v) => setEasing(v as Easing)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="ease-in">Ease in</SelectItem>
                <SelectItem value="ease-out">Ease out</SelectItem>
                <SelectItem value="ease-in-out">Ease in-out</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>

        <div className="flex flex-col gap-2">
          {stops.map((s, i) => {
            const p = parsed[i] ?? null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-2xs text-muted-foreground">
                  stop {i + 1}
                </span>
                <input
                  type="color"
                  value={p ? rgbToHex(p) : '#000000'}
                  onChange={(e) => setStop(i, e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                  aria-label={`Stop ${i + 1} picker`}
                />
                <Input value={s} onChange={(e) => setStop(i, e.target.value)} className="font-mono" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeStop(i)}
                  disabled={stops.length <= 2}
                  aria-label="Remove stop"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <div>
            <Button variant="outline" size="sm" onClick={addStop}>
              <Plus className="size-3.5" />
              Add stop
            </Button>
          </div>
        </div>

        <ErrorBanner error={error} />

        {result.length > 0 ? (
          <>
            <div
              className="h-16 w-full rounded-md border"
              style={previewGradient ? { backgroundImage: previewGradient } : undefined}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {result.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="h-8 w-8 shrink-0 rounded border" style={{ backgroundColor: s.hex }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{s.hex}</div>
                    <div className="truncate font-mono text-2xs text-muted-foreground">{s.pos}%</div>
                  </div>
                  <CopyButton value={s.hex} size="icon-sm" />
                </div>
              ))}
            </div>

            <StatBar
              items={[`${result.length} stops`, `${space.toUpperCase()} space`, easing]}
            />

            <Panel>
              <PanelHeader title="CSS linear-gradient">
                <CopyButton value={cssGradient} label="Copy" />
              </PanelHeader>
              <pre className="max-h-32 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap break-all">
                {cssGradient}
              </pre>
            </Panel>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
