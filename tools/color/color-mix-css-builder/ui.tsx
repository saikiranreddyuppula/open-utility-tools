'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type RGB = { r: number; g: number; b: number };
type Space = 'srgb' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch';
const SPACES: Space[] = ['srgb', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch'];

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

function parseColor(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]); const g = Number(rgbMatch[2]); const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const linRGB = (c: number) => { const cs = c / 255; return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
const gammaRGB = (c: number) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055; return clamp01(v) * 255; };

// shortest-path hue interpolation (degrees)
function lerpHue(h1: number, h2: number, t: number): number {
  let d = h2 - h1;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  let h = h1 + d * t;
  h = ((h % 360) + 360) % 360;
  return h;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- forward to space ----
function rgbToHsl({ r, g, b }: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t; if (tt < 0) tt += 1; if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255), g: Math.round(hue2rgb(p, q, hn) * 255), b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255) };
}
function rgbToHwb(c: RGB): [number, number, number] {
  const [h] = rgbToHsl(c);
  const rn = c.r / 255, gn = c.g / 255, bn = c.b / 255;
  return [h, Math.min(rn, gn, bn), 1 - Math.max(rn, gn, bn)];
}
function hwbToRgb(h: number, w: number, bk: number): RGB {
  let wn = w, bn = bk;
  if (wn + bn > 1) { const sum = wn + bn; wn /= sum; bn /= sum; }
  const base = hslToRgb(h, 1, 0.5);
  const f = (ch: number) => Math.round((ch / 255) * (1 - wn - bn) * 255 + wn * 255);
  return { r: f(base.r), g: f(base.g), b: f(base.b) };
}
function rgbToLab(c: RGB): [number, number, number] {
  const rl = linRGB(c.r), gl = linRGB(c.g), bl = linRGB(c.b);
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L: number, a: number, bb: number): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return { r: gammaRGB(r), g: gammaRGB(g), b: gammaRGB(bl) };
}
function labToLch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI; if (H < 0) H += 360;
  return [L, C, H];
}
function lchToLab(L: number, C: number, H: number): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  return [L, C * Math.cos(hr), C * Math.sin(hr)];
}
function rgbToOklab(c: RGB): [number, number, number] {
  const rl = linRGB(c.r), gl = linRGB(c.g), bl = linRGB(c.b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_];
}
function oklabToRgb(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: gammaRGB(r), g: gammaRGB(g), b: gammaRGB(bl) };
}

function mix(a: RGB, b: RGB, t: number, space: Space): RGB {
  switch (space) {
    case 'srgb':
      return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) };
    case 'hsl': {
      const [h1, s1, l1] = rgbToHsl(a); const [h2, s2, l2] = rgbToHsl(b);
      return hslToRgb(lerpHue(h1, h2, t), lerp(s1, s2, t), lerp(l1, l2, t));
    }
    case 'hwb': {
      const [h1, w1, k1] = rgbToHwb(a); const [h2, w2, k2] = rgbToHwb(b);
      return hwbToRgb(lerpHue(h1, h2, t), lerp(w1, w2, t), lerp(k1, k2, t));
    }
    case 'lab': {
      const [l1, a1, b1] = rgbToLab(a); const [l2, a2, b2] = rgbToLab(b);
      return labToRgb(lerp(l1, l2, t), lerp(a1, a2, t), lerp(b1, b2, t));
    }
    case 'lch': {
      const [l1, c1, h1] = labToLch(...rgbToLab(a)); const [l2, c2, h2] = labToLch(...rgbToLab(b));
      const [L, A, B] = lchToLab(lerp(l1, l2, t), lerp(c1, c2, t), lerpHue(h1, h2, t));
      return labToRgb(L, A, B);
    }
    case 'oklab': {
      const [l1, a1, b1] = rgbToOklab(a); const [l2, a2, b2] = rgbToOklab(b);
      return oklabToRgb(lerp(l1, l2, t), lerp(a1, a2, t), lerp(b1, b2, t));
    }
    case 'oklch': {
      const [l1, a1, b1] = rgbToOklab(a); const [l2, a2, b2] = rgbToOklab(b);
      const c1 = Math.sqrt(a1 * a1 + b1 * b1); let hh1 = (Math.atan2(b1, a1) * 180) / Math.PI; if (hh1 < 0) hh1 += 360;
      const c2 = Math.sqrt(a2 * a2 + b2 * b2); let hh2 = (Math.atan2(b2, a2) * 180) / Math.PI; if (hh2 < 0) hh2 += 360;
      const L = lerp(l1, l2, t); const C = lerp(c1, c2, t); const H = lerpHue(hh1, hh2, t);
      const hr = (H * Math.PI) / 180;
      return oklabToRgb(L, C * Math.cos(hr), C * Math.sin(hr));
    }
    default:
      return a;
  }
}

export default function ColorMixBuilder() {
  const [a, setA] = useState('#3b82f6');
  const [b, setB] = useState('#ef4444');
  const [pct, setPct] = useState(50);
  const [space, setSpace] = useState<Space>('oklch');
  const [flip, setFlip] = useState(false);

  const result = useMemo(() => {
    const ca = parseColor(a); const cb = parseColor(b);
    if (!ca) return { error: 'Color A is invalid (#hex or rgb()).' };
    if (!cb) return { error: 'Color B is invalid (#hex or rgb()).' };
    // In CSS, color-mix(in s, A p%, B): p% is A's weight. Here pct is the slider for A.
    const aWeight = flip ? 100 - pct : pct;
    const t = 1 - aWeight / 100; // fraction toward B
    const mixed = mix(ca, cb, t, space);
    const refColor = flip ? 'B' : 'A';
    const css = `color-mix(in ${space}, ${toHex(ca)} ${aWeight}%, ${toHex(cb)})`;
    return { ca, cb, mixed, css, aWeight, refColor };
  }, [a, b, pct, space, flip]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color A" className="min-w-[170px]">
            <div className="flex items-center gap-2">
              <input type="color" value={parseColor(a) ? toHex(parseColor(a) as RGB) : '#3b82f6'} onChange={(e) => setA(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color A" />
              <Input value={a} onChange={(e) => setA(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Color B" className="min-w-[170px]">
            <div className="flex items-center gap-2">
              <input type="color" value={parseColor(b) ? toHex(parseColor(b) as RGB) : '#ef4444'} onChange={(e) => setB(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color B" />
              <Input value={b} onChange={(e) => setB(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Interpolation space" className="min-w-[150px]">
            <Select value={space} onValueChange={(v) => setSpace(v as Space)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPACES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Mix: ${pct}% A`} className="min-w-[200px] flex-1">
            <Slider value={[pct]} min={0} max={100} step={1} onValueChange={(v) => setPct(v[0] ?? 50)} />
          </Field>
          <Field label="Reference">
            <button
              type="button"
              onClick={() => setFlip((f) => !f)}
              className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
            >
              ref: {flip ? 'B' : 'A'}
            </button>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(result.ca) }} />
              <span className="font-mono text-xs">A {toHex(result.ca)}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-16 w-full rounded border-2 border-primary" style={{ backgroundColor: toHex(result.mixed) }} />
              <span className="font-mono text-xs font-semibold">{toHex(result.mixed)}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(result.cb) }} />
              <span className="font-mono text-xs">B {toHex(result.cb)}</span>
            </div>
          </div>

          <Panel>
            <PanelHeader title="CSS color-mix()">
              <CopyButton value={result.css} />
            </PanelHeader>
            <div className="p-3">
              <code className="block break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">{result.css}</code>
            </div>
            <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Resolved HEX</span>
                <span className="flex items-center gap-2 font-mono text-sm">{toHex(result.mixed)}<CopyButton value={toHex(result.mixed)} size="icon-sm" /></span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Resolved RGB</span>
                <span className="flex items-center gap-2 font-mono text-sm">rgb({result.mixed.r}, {result.mixed.g}, {result.mixed.b})<CopyButton value={`rgb(${result.mixed.r}, ${result.mixed.g}, ${result.mixed.b})`} size="icon-sm" /></span>
              </div>
            </div>
            <StatBar items={[`space ${space}`, `${result.aWeight}% A / ${100 - result.aWeight}% B`, `result ${toHex(result.mixed)}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
