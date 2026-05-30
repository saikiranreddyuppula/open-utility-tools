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

type Fmt = 'hex' | 'rgb' | 'hsl';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
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
  transparent: '#00000000',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  lime: '#00ff00',
  maroon: '#800000',
  olive: '#808000',
  gold: '#ffd700',
  indigo: '#4b0082',
  violet: '#ee82ee',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseColor(raw: string): RGBA | null {
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
      return { r: exp(r), g: exp(g), b: exp(b), a: 1 };
    }
    if (hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      const a = hex[3];
      if (r === undefined || g === undefined || b === undefined || a === undefined) return null;
      return { r: exp(r), g: exp(g), b: exp(b), a: exp(a) / 255 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b, a };
    }
    return null;
  }

  const rgbM = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgbM && rgbM[1] !== undefined) {
    const parts = rgbM[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const aRaw = parts[3];
    if (![r, g, b].every(Number.isFinite)) return null;
    let a = 1;
    if (aRaw !== undefined) {
      a = aRaw.endsWith('%') ? Number(aRaw.slice(0, -1)) / 100 : Number(aRaw);
      if (!Number.isFinite(a)) a = 1;
    }
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
  }

  const hslM = s.match(/^hsla?\(([^)]+)\)$/);
  if (hslM && hslM[1] !== undefined) {
    const parts = hslM[1].split(/[,/\s]+/).filter(Boolean);
    const h = Number((parts[0] ?? '').replace('deg', ''));
    const sl = Number((parts[1] ?? '').replace('%', '')) / 100;
    const l = Number((parts[2] ?? '').replace('%', '')) / 100;
    const aRaw = parts[3];
    if (![h, sl, l].every(Number.isFinite)) return null;
    let a = 1;
    if (aRaw !== undefined) {
      a = aRaw.endsWith('%') ? Number(aRaw.slice(0, -1)) / 100 : Number(aRaw);
      if (!Number.isFinite(a)) a = 1;
    }
    const rgb = hslToRgb(h, sl, l);
    return { ...rgb, a: clamp(a, 0, 1) };
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
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

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function fmtColor(c: RGBA, fmt: Fmt): string {
  const hasAlpha = c.a < 1;
  const a = Math.round(c.a * 1000) / 1000;
  if (fmt === 'rgb') {
    return hasAlpha
      ? `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`
      : `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  if (fmt === 'hsl') {
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    const H = Math.round(h);
    const S = Math.round(s * 100);
    const L = Math.round(l * 100);
    return hasAlpha ? `hsla(${H}, ${S}%, ${L}%, ${a})` : `hsl(${H}, ${S}%, ${L}%)`;
  }
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const base = `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
  return hasAlpha ? `${base}${hx(c.a * 255)}` : base;
}

/** Split a comma-separated argument list while respecting nested parens. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface Stop {
  color: string;
  position: string | null;
}

interface ParsedGradient {
  type: string;
  prelude: string | null;
  stops: Stop[];
}

const COLOR_LEAD =
  /^(#[0-9a-fA-F]+|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)\b/;

function parseGradient(input: string): ParsedGradient {
  const s = input.trim().replace(/;$/, '');
  const m = s.match(/^(repeating-)?(linear|radial|conic)-gradient\s*\(([\s\S]*)\)$/i);
  if (!m) throw new Error('Not a CSS gradient. Expected linear-gradient(...), radial-gradient(...), or conic-gradient(...).');
  const repeating = m[1] ?? '';
  const kind = (m[2] ?? '').toLowerCase();
  const body = m[3] ?? '';
  const type = `${repeating}${kind}-gradient`;

  const args = splitTopLevel(body);
  if (args.length < 2) throw new Error('A gradient needs at least two color stops.');

  // Decide if the first arg is a prelude (angle / shape / position) rather than a color.
  const first = args[0] ?? '';
  const looksLikeColor = COLOR_LEAD.test(first) && parseColor((first.split(/\s+/)[0] ?? '')) !== null;
  let prelude: string | null = null;
  let stopArgs = args;
  const isAnglePrelude =
    /(\d+(\.\d+)?(deg|rad|grad|turn))|^to\s/i.test(first) ||
    /^(circle|ellipse|at\s|closest|farthest|from\s)/i.test(first);
  if (!looksLikeColor && isAnglePrelude) {
    prelude = first;
    stopArgs = args.slice(1);
  }

  const stops: Stop[] = [];
  for (const arg of stopArgs) {
    // A stop is: <color> [<pos>] — and a position may appear without a color (interp hint), but keep it simple.
    const colMatch = arg.match(COLOR_LEAD);
    if (!colMatch || colMatch[0] === undefined) {
      throw new Error(`Could not parse color stop: "${arg}"`);
    }
    const colorTok = colMatch[0];
    const rest = arg.slice(colorTok.length).trim();
    const positions = rest ? rest.split(/\s+/).filter(Boolean) : [];
    if (positions.length === 0) {
      stops.push({ color: colorTok, position: null });
    } else {
      // Two positions => double-position stop; emit two rows.
      for (const p of positions) {
        stops.push({ color: colorTok, position: p });
      }
    }
  }
  return { type, prelude, stops };
}

export default function CssGradientParserTool() {
  const [fmt, setFmt] = useState<Fmt>('hex');
  const [normalize, setNormalize] = useState(false);

  return (
    <TextToolLayout
      deps={[fmt, normalize]}
      sample="linear-gradient(135deg, #f06 0%, rgba(255,165,0,0.8) 40%, hsl(120, 60%, 50%))"
      inputLabel="CSS gradient"
      outputLabel="Parsed stops + normalized"
      downloadName="gradient-stops.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const g = parseGradient(input);

        // Normalize positions to percentages where unset (linear distribution).
        const total = g.stops.length;
        const norm = g.stops.map((st, i) => {
          let pos = st.position;
          if (normalize && (pos === null)) {
            pos = total > 1 ? `${Math.round((i / (total - 1)) * 1000) / 10}%` : '0%';
          }
          return { color: st.color, position: pos };
        });

        const lines: string[] = [];
        lines.push(`Type:    ${g.type}`);
        lines.push(`Prelude: ${g.prelude ?? '(default direction)'}`);
        lines.push(`Stops:   ${g.stops.length}`);
        lines.push('');
        lines.push('# Color stops');
        lines.push('idx  position  color');
        norm.forEach((st, i) => {
          const parsed = parseColor(st.color);
          const colOut = parsed ? fmtColor(parsed, fmt) : `${st.color} (unparsed)`;
          const posOut = (st.position ?? 'auto').padEnd(8);
          lines.push(`${String(i).padEnd(4)} ${posOut} ${colOut}`);
        });

        // Re-serialize a normalized gradient.
        const serialized = norm
          .map((st) => {
            const parsed = parseColor(st.color);
            const colOut = parsed ? fmtColor(parsed, fmt) : st.color;
            return st.position ? `${colOut} ${st.position}` : colOut;
          })
          .join(', ');
        const head = g.prelude ? `${g.prelude}, ` : '';
        lines.push('');
        lines.push('# Normalized gradient');
        lines.push(`${g.type}(${head}${serialized})`);

        return lines.join('\n');
      }}
      options={
        <>
          <Field label="Color format">
            <Select value={fmt} onValueChange={(v) => setFmt(v as Fmt)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">HEX</SelectItem>
                <SelectItem value="rgb">RGB</SelectItem>
                <SelectItem value="hsl">HSL</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Normalize positions">
            <Switch checked={normalize} onCheckedChange={setNormalize} />
          </Field>
        </>
      }
    />
  );
}
