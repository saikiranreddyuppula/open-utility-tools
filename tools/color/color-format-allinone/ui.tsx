'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

type RGBA = { r: number; g: number; b: number; a: number };

const NAMED: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', lime: '00ff00', blue: '0000ff',
  yellow: 'ffff00', cyan: '00ffff', magenta: 'ff00ff', silver: 'c0c0c0', gray: '808080',
  maroon: '800000', olive: '808000', green: '008000', purple: '800080', teal: '008080',
  navy: '000080', orange: 'ffa500', pink: 'ffc0cb', brown: 'a52a2a', gold: 'ffd700',
  indigo: '4b0082', violet: 'ee82ee', coral: 'ff7f50', salmon: 'fa8072', khaki: 'f0e68c',
  crimson: 'dc143c', tomato: 'ff6347', orchid: 'da70d6', plum: 'dda0dd', turquoise: '40e0d0',
  tan: 'd2b48c', beige: 'f5f5dc', ivory: 'fffff0', lavender: 'e6e6fa', aqua: '00ffff',
  fuchsia: 'ff00ff', skyblue: '87ceeb', slategray: '708090', tomatoes: 'ff6347',
  dodgerblue: '1e90ff', forestgreen: '228b22', goldenrod: 'daa520', hotpink: 'ff69b4',
  darkred: '8b0000', darkblue: '00008b', darkgreen: '006400', steelblue: '4682b4',
  seagreen: '2e8b57', chocolate: 'd2691e', firebrick: 'b22222', midnightblue: '191970',
  rebeccapurple: '663399', transparent: '00000000',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseAlpha(s: string): number {
  const t = s.trim();
  if (t.endsWith('%')) {
    const v = Number(t.slice(0, -1));
    return Number.isFinite(v) ? clamp(v / 100, 0, 1) : 1;
  }
  const v = Number(t);
  return Number.isFinite(v) ? clamp(v, 0, 1) : 1;
}

function num(s: string | undefined): number {
  if (s === undefined) return NaN;
  const t = s.trim();
  if (t.endsWith('%')) return Number(t.slice(0, -1));
  return Number(t);
}

function hslToRgb(h: number, s: number, l: number): RGBA {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = ln - c / 2;
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a: 1 };
}

function hwbToRgb(h: number, w: number, b: number): RGBA {
  let wn = w / 100, bn = b / 100;
  if (wn + bn > 1) { const sum = wn + bn; wn /= sum; bn /= sum; }
  const base = hslToRgb(h, 100, 50);
  const f = (c: number) => Math.round(c * (1 - wn - bn) + wn * 255);
  return { r: f(base.r), g: f(base.g), b: f(base.b), a: 1 };
}

// Lab/LCH (D65) -> linear sRGB -> sRGB
function labToRgb(L: number, a: number, bb: number): RGBA {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - bb / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047;
  const y = inv(fy) * 1.0;
  const z = inv(fz) * 1.08883;
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  r = clamp(gamma(r), 0, 1); g = clamp(gamma(g), 0, 1); bl = clamp(gamma(bl), 0, 1);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(bl * 255), a: 1 };
}

function lchToRgb(L: number, C: number, H: number): RGBA {
  const hr = (H * Math.PI) / 180;
  return labToRgb(L, C * Math.cos(hr), C * Math.sin(hr));
}

// OKLab/OKLCH -> linear sRGB -> sRGB
function oklabToRgb(L: number, a: number, b: number): RGBA {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
  r = clamp(gamma(r), 0, 1); g = clamp(gamma(g), 0, 1); bl = clamp(gamma(bl), 0, 1);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(bl * 255), a: 1 };
}

function oklchToRgb(L: number, C: number, H: number): RGBA {
  const hr = (H * Math.PI) / 180;
  return oklabToRgb(L, C * Math.cos(hr), C * Math.sin(hr));
}

function parse(input: string): RGBA | null {
  const raw = input.trim();
  if (!raw) return null;
  const low = raw.toLowerCase();

  // Named
  if (NAMED[low]) {
    const hex = NAMED[low];
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }

  // Hex
  let h = low.startsWith('#') ? low.slice(1) : null;
  if (h !== null) {
    if (/^[0-9a-f]{3}$/.test(h)) {
      const r = h[0]; const g = h[1]; const b = h[2];
      if (r && g && b) h = `${r}${r}${g}${g}${b}${b}`;
    } else if (/^[0-9a-f]{4}$/.test(h)) {
      const r = h[0]; const g = h[1]; const b = h[2]; const al = h[3];
      if (r && g && b && al) h = `${r}${r}${g}${g}${b}${b}${al}${al}`;
    }
    if (/^[0-9a-f]{6}$/.test(h)) {
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    if (/^[0-9a-f]{8}$/.test(h)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }

  // Functional: fn(args)
  const fn = /^([a-z]+)\(([^)]*)\)$/.exec(low);
  if (!fn) return null;
  const name = fn[1];
  const body = fn[2];
  if (name === undefined || body === undefined) return null;
  const parts = body.split(/[ ,/]+/).filter(Boolean);
  const a = (i: number) => parts[i];

  switch (name) {
    case 'rgb':
    case 'rgba': {
      const r = num(a(0)), g = num(a(1)), b = num(a(2));
      if (![r, g, b].every(Number.isFinite)) return null;
      const conv = (v: string | undefined, raw2: number) => (v && v.includes('%') ? (raw2 / 100) * 255 : raw2);
      return {
        r: clamp(Math.round(conv(a(0), r)), 0, 255),
        g: clamp(Math.round(conv(a(1), g)), 0, 255),
        b: clamp(Math.round(conv(a(2), b)), 0, 255),
        a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1,
      };
    }
    case 'hsl':
    case 'hsla': {
      const hh = num(a(0)), s = num(a(1)), l = num(a(2));
      if (![hh, s, l].every(Number.isFinite)) return null;
      const c = hslToRgb(hh, s, l);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    case 'hwb': {
      const hh = num(a(0)), w = num(a(1)), bl = num(a(2));
      if (![hh, w, bl].every(Number.isFinite)) return null;
      const c = hwbToRgb(hh, w, bl);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    case 'lab': {
      const L = num(a(0)), aa = num(a(1)), bb = num(a(2));
      if (![L, aa, bb].every(Number.isFinite)) return null;
      const c = labToRgb(L, aa, bb);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    case 'lch': {
      const L = num(a(0)), C = num(a(1)), H = num(a(2));
      if (![L, C, H].every(Number.isFinite)) return null;
      const c = lchToRgb(L, C, H);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    case 'oklab': {
      const L = num(a(0)), aa = num(a(1)), bb = num(a(2));
      if (![L, aa, bb].every(Number.isFinite)) return null;
      const Ln = a(0) && a(0)?.includes('%') ? L / 100 : L;
      const c = oklabToRgb(Ln, aa, bb);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    case 'oklch': {
      const L = num(a(0)), C = num(a(1)), H = num(a(2));
      if (![L, C, H].every(Number.isFinite)) return null;
      const Ln = a(0) && a(0)?.includes('%') ? L / 100 : L;
      const c = oklchToRgb(Ln, C, H);
      return { ...c, a: parts[3] !== undefined ? parseAlpha(parts[3]) : 1 };
    }
    default:
      return null;
  }
}

// ---- forward conversions for display ----
function toHex({ r, g, b, a }: RGBA): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a < 1 ? `${base}${h(a * 255)}` : base;
}

function rgbToHslVals({ r, g, b }: RGBA): [number, number, number] {
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
  return [h * 360, s * 100, l * 100];
}

function rgbToHsvVals({ r, g, b }: RGBA): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  return [h, s, max * 100];
}

function rgbToHwbVals(c: RGBA): [number, number, number] {
  const [h] = rgbToHsvVals(c);
  const rn = c.r / 255, gn = c.g / 255, bn = c.b / 255;
  const w = Math.min(rn, gn, bn) * 100;
  const bk = (1 - Math.max(rn, gn, bn)) * 100;
  return [h, w, bk];
}

function rgbToCmyk({ r, g, b }: RGBA): [number, number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return [0, 0, 0, 100];
  return [
    ((1 - rn - k) / (1 - k)) * 100,
    ((1 - gn - k) / (1 - k)) * 100,
    ((1 - bn - k) / (1 - k)) * 100,
    k * 100,
  ];
}

function rgbToLab({ r, g, b }: RGBA): [number, number, number] {
  const lin = (c: number) => { const cs = c / 255; return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function rgbToLch(c: RGBA): [number, number, number] {
  const [L, a, b] = rgbToLab(c);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function rgbToOklab({ r, g, b }: RGBA): [number, number, number] {
  const lin = (c: number) => { const cs = c / 255; return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function rgbToOklch(c: RGBA): [number, number, number] {
  const [L, a, b] = rgbToOklab(c);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function nearestNamed(c: RGBA): string {
  let best = ''; let bestD = Infinity;
  for (const [name, hex] of Object.entries(NAMED)) {
    if (hex.length !== 6) continue;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => Math.round(n).toString();

export default function ColorFormatAllInOne() {
  const [input, setInput] = useState('#3b82f6');

  const data = useMemo(() => {
    const c = parse(input);
    if (!c) return { error: 'Could not parse this color. Try #hex, rgb(), hsl(), oklch(), or a CSS name.' };
    const [h, s, l] = rgbToHslVals(c);
    const [hv, sv, vv] = rgbToHsvVals(c);
    const [hw, ww, bw] = rgbToHwbVals(c);
    const [cy, ma, ye, k] = rgbToCmyk(c);
    const [lL, la, lb] = rgbToLab(c);
    const [cL, cC, cH] = rgbToLch(c);
    const [oL, oa, ob] = rgbToOklab(c);
    const [oclL, oclC, oclH] = rgbToOklch(c);
    const av = c.a < 1 ? ` / ${f1(c.a * 100)}%` : '';
    const rows: { label: string; value: string }[] = [
      { label: 'HEX', value: toHex(c).toUpperCase() },
      { label: 'RGB', value: c.a < 1 ? `rgb(${f0(c.r)} ${f0(c.g)} ${f0(c.b)} / ${f1(c.a * 100)}%)` : `rgb(${f0(c.r)}, ${f0(c.g)}, ${f0(c.b)})` },
      { label: 'HSL', value: `hsl(${f1(h)} ${f1(s)}% ${f1(l)}%${av})` },
      { label: 'HSV', value: `hsv(${f1(hv)}, ${f1(sv)}%, ${f1(vv)}%)` },
      { label: 'HWB', value: `hwb(${f1(hw)} ${f1(ww)}% ${f1(bw)}%${av})` },
      { label: 'CMYK', value: `cmyk(${f0(cy)}%, ${f0(ma)}%, ${f0(ye)}%, ${f0(k)}%)` },
      { label: 'LAB', value: `lab(${f1(lL)}% ${f1(la)} ${f1(lb)})` },
      { label: 'LCH', value: `lch(${f1(cL)}% ${f1(cC)} ${f1(cH)})` },
      { label: 'OKLAB', value: `oklab(${oL.toFixed(4)} ${oa.toFixed(4)} ${ob.toFixed(4)})` },
      { label: 'OKLCH', value: `oklch(${oclL.toFixed(4)} ${oclC.toFixed(4)} ${f1(oclH)})` },
      { label: 'Nearest name', value: nearestNamed(c) },
    ];
    return { c, rows };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="CSS color" className="min-w-[260px] flex-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={!('error' in data) ? `#${[data.c.r, data.c.g, data.c.b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('')}` : '#3b82f6'}
                onChange={(e) => setInput(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color picker"
              />
              <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" placeholder="#3b82f6 or oklch(...)" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in data ? (
        <ErrorBanner error={data.error} />
      ) : (
        <Panel>
          <PanelHeader title="All formats">
            <CopyButton value={() => data.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div
            className="h-24 w-full border-b"
            style={{ backgroundColor: `rgba(${data.c.r}, ${data.c.g}, ${data.c.b}, ${data.c.a})`, backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0' }}
          >
            <div className="h-full w-full" style={{ backgroundColor: `rgba(${data.c.r}, ${data.c.g}, ${data.c.b}, ${data.c.a})` }} />
          </div>
          <div className="divide-y">
            {data.rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-sm">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`alpha ${f1(data.c.a * 100)}%`, `R${data.c.r} G${data.c.g} B${data.c.b}`]} />
        </Panel>
      )}
    </div>
  );
}
