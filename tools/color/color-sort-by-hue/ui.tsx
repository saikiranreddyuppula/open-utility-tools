'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type SortKey = 'hue' | 'lightness' | 'saturation' | 'luminance' | 'step';
type OutFmt = 'preserve' | 'hex';

interface RGB {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  lime: '#00ff00',
  maroon: '#800000',
  olive: '#808000',
  gold: '#ffd700',
  indigo: '#4b0082',
  violet: '#ee82ee',
  coral: '#ff7f50',
  salmon: '#fa8072',
  khaki: '#f0e68c',
  crimson: '#dc143c',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const named = NAMED[s];
  if (named) return parseColor(named);
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const exp = (n: string): number => parseInt(n + n, 16);
    if (hex.length === 3) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r: exp(r), g: exp(g), b: exp(b) };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m && m[1] !== undefined) {
    const p = m[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(p[0]);
    const g = Number(p[1]);
    const b = Number(p[2]);
    if (![r, g, b].every(Number.isFinite)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
  }
  const hm = s.match(/^hsla?\(([^)]+)\)$/);
  if (hm && hm[1] !== undefined) {
    const p = hm[1].split(/[,/\s]+/).filter(Boolean);
    const h = Number((p[0] ?? '').replace('deg', ''));
    const sl = Number((p[1] ?? '').replace('%', '')) / 100;
    const l = Number((p[2] ?? '').replace('%', '')) / 100;
    if (![h, sl, l].every(Number.isFinite)) return null;
    return hslToRgb(h, sl, l);
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsl(c: RGB): { h: number; s: number; l: number } {
  const rn = c.r / 255;
  const gn = c.g / 255;
  const bn = c.b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function luminance(c: RGB): number {
  const lin = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function toHex(c: RGB): string {
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
}

interface Item {
  raw: string;
  rgb: RGB;
  h: number;
  s: number;
  l: number;
  lum: number;
}

export default function ColorListSorterTool() {
  const [key, setKey] = useState<SortKey>('step');
  const [desc, setDesc] = useState(false);
  const [grayFirst, setGrayFirst] = useState(true);
  const [out, setOut] = useState<OutFmt>('preserve');

  return (
    <TextToolLayout
      deps={[key, desc, grayFirst, out]}
      sample={`#e74c3c\n#3498db\n#2ecc71\n#f1c40f\n#9b59b6\n#1abc9c\n#e67e22\n#34495e\n#95a5a6\n#ffffff`}
      inputLabel="Color list"
      outputLabel="Sorted"
      inputPlaceholder="One color per line (HEX / rgb() / hsl() / name)…"
      downloadName="sorted-colors.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const tokens = input
          .split(/[\n,]+/)
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.length === 0) return '';

        const items: Item[] = [];
        const bad: string[] = [];
        for (const t of tokens) {
          const rgb = parseColor(t);
          if (!rgb) {
            bad.push(t);
            continue;
          }
          const { h, s, l } = rgbToHsl(rgb);
          items.push({ raw: t, rgb, h, s, l, lum: luminance(rgb) });
        }
        if (items.length === 0) throw new Error('No valid colors found. Use HEX, rgb(), hsl(), or names.');

        const GRAY_SAT = 0.12;
        let sorted: Item[];
        if (key === 'step') {
          const bands = 8;
          const score = (it: Item): number => {
            const band = Math.floor((it.h / 360) * bands);
            // alternate luminance direction per band for a smooth zig-zag (classic step sort)
            const lum2 = band % 2 === 0 ? it.lum : 1 - it.lum;
            return band * 1000 + lum2 * 100;
          };
          const grays = grayFirst ? items.filter((it) => it.s < GRAY_SAT) : [];
          const colored = grayFirst ? items.filter((it) => it.s >= GRAY_SAT) : items.slice();
          grays.sort((a, b) => a.lum - b.lum);
          colored.sort((a, b) => score(a) - score(b));
          sorted = [...grays, ...colored];
        } else {
          const val = (it: Item): number => {
            if (key === 'hue') return it.h;
            if (key === 'lightness') return it.l;
            if (key === 'saturation') return it.s;
            return it.lum;
          };
          if (key === 'hue' && grayFirst) {
            const grays = items.filter((it) => it.s < GRAY_SAT).sort((a, b) => a.lum - b.lum);
            const colored = items.filter((it) => it.s >= GRAY_SAT).sort((a, b) => val(a) - val(b));
            sorted = [...grays, ...colored];
          } else {
            sorted = items.slice().sort((a, b) => val(a) - val(b));
          }
        }
        if (desc) sorted = sorted.reverse();

        const lines = sorted.map((it) => (out === 'hex' ? toHex(it.rgb) : it.raw));
        let result = lines.join('\n');
        if (bad.length > 0) {
          result += `\n\n# ${bad.length} unparsed: ${bad.join(', ')}`;
        }
        return result;
      }}
      options={
        <>
          <Field label="Sort by">
            <Select value={key} onValueChange={(v) => setKey(v as SortKey)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="step">Step sort (hue bands)</SelectItem>
                <SelectItem value="hue">Hue</SelectItem>
                <SelectItem value="lightness">Lightness</SelectItem>
                <SelectItem value="saturation">Saturation</SelectItem>
                <SelectItem value="luminance">Perceived luminance</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Output">
            <Select value={out} onValueChange={(v) => setOut(v as OutFmt)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preserve">Preserve notation</SelectItem>
                <SelectItem value="hex">Normalize to HEX</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Grays first">
            <Switch checked={grayFirst} onCheckedChange={setGrayFirst} />
          </Field>
          <Field label="Descending">
            <Switch checked={desc} onCheckedChange={setDesc} />
          </Field>
        </>
      }
    />
  );
}
