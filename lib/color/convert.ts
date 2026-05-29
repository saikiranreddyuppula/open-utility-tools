/** Color space conversions: HEX, RGB, HSL, HSV, CMYK, OKLCH. Pure functions. */

export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  // hex
  const hex = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return { r: p(hex[0]!), g: p(hex[1]!), b: p(hex[2]!), a: 1 };
  }
  if (/^[0-9a-f]{4}$/.test(hex)) {
    return { r: p(hex[0]!), g: p(hex[1]!), b: p(hex[2]!), a: parseInt(hex[3]! + hex[3]!, 16) / 255 };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  if (/^[0-9a-f]{8}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  // rgb()/rgba()
  const rgb = s.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const nums = rgb[1]!.split(/[,/\s]+/).filter(Boolean).map(Number);
    if (nums.length >= 3) return { r: nums[0]!, g: nums[1]!, b: nums[2]!, a: nums[3] ?? 1 };
  }
  // hsl()
  const hsl = s.match(/hsla?\(([^)]+)\)/);
  if (hsl) {
    const parts = hsl[1]!.split(/[,/\s]+/).filter(Boolean);
    const h = parseFloat(parts[0]!);
    const sl = parseFloat(parts[1]!) / 100;
    const l = parseFloat(parts[2]!) / 100;
    const a = parts[3] != null ? parseFloat(parts[3]) : 1;
    return { ...hslToRgb(h, sl, l), a };
  }
  return null;
  function p(c: string) {
    return parseInt(c + c, 16);
  }
}

export function toHex({ r, g, b, a }: RGB, withAlpha = false): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return withAlpha && a < 1 ? base + h(a * 255) : base;
}

export function toRgbString({ r, g, b, a }: RGB): string {
  const round = (n: number) => Math.round(clamp(n, 0, 255));
  return a < 1
    ? `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${round2(a)})`
    : `rgb(${round(r)}, ${round(g)}, ${round(b)})`;
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function toHslString(rgb: RGB): string {
  const { h, s, l } = rgbToHsl(rgb);
  return rgb.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${round2(rgb.a)})` : `hsl(${h}, ${s}%, ${l}%)`;
}

export function hslToRgb(h: number, s: number, l: number): Omit<RGB, 'a'> {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function rgbToHsv({ r, g, b }: RGB): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function rgbToCmyk({ r, g, b }: RGB): { c: number; m: number; y: number; k: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}

// sRGB → OKLCH
export function rgbToOklch({ r, g, b }: RGB): { l: number; c: number; h: number } {
  const lin = (u: number) => {
    u /= 255;
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: round3(L), c: round3(C), h: Math.round(h) };
}

export function toOklchString(rgb: RGB): string {
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h})`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** WCAG relative luminance + contrast ratio. */
export function luminance({ r, g, b }: RGB): number {
  const ch = (u: number) => {
    u /= 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
