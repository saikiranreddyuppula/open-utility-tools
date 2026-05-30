'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';

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
  transparent: '#00000000',
};

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

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
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      const aCh = hex[3];
      if (r === undefined || g === undefined || b === undefined) return null;
      const a = aCh !== undefined ? exp(aCh) / 255 : 1;
      return { r: exp(r), g: exp(g), b: exp(b), a };
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
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m && m[1] !== undefined) {
    const p = m[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(p[0]);
    const g = Number(p[1]);
    const b = Number(p[2]);
    if (![r, g, b].every(Number.isFinite)) return null;
    let a = 1;
    const aRaw = p[3];
    if (aRaw !== undefined) {
      a = aRaw.endsWith('%') ? Number(aRaw.slice(0, -1)) / 100 : Number(aRaw);
      if (!Number.isFinite(a)) a = 1;
    }
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
  }
  return null;
}

function toHex(c: RGBA): string {
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
}

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

const COLOR_LEAD = /^(#[0-9a-fA-F]+|rgba?\([^)]*\)|[a-zA-Z]+)\b/;

interface Stop {
  rgba: RGBA;
  offset: number; // 0..1
}

/** Map a CSS gradient angle (0deg = up, clockwise) to SVG x1/y1/x2/y2 within a unit box. */
function angleToVector(deg: number): { x1: number; y1: number; x2: number; y2: number } {
  // CSS: 0deg points up, increases clockwise. Convert to standard math direction vector.
  const rad = ((deg % 360) * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  // Gradient line passes through center (0.5,0.5); project box corners to find extent.
  const x1 = 0.5 - dx / 2;
  const y1 = 0.5 - dy / 2;
  const x2 = 0.5 + dx / 2;
  const y2 = 0.5 + dy / 2;
  const r = (n: number): number => Math.round(clamp(n, 0, 1) * 1000) / 1000;
  return { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2) };
}

const SIDE_ANGLE: Record<string, number> = {
  'to top': 0,
  'to right': 90,
  'to bottom': 180,
  'to left': 270,
  'to top right': 45,
  'to right top': 45,
  'to bottom right': 135,
  'to right bottom': 135,
  'to bottom left': 225,
  'to left bottom': 225,
  'to top left': 315,
  'to left top': 315,
};

export default function GradientCssToSvgTool() {
  const [size, setSize] = useState('200');

  return (
    <TextToolLayout
      deps={[size]}
      sample="linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 50%, #556270 100%)"
      inputLabel="CSS gradient"
      outputLabel="SVG"
      downloadName="gradient.svg"
      downloadMime="image/svg+xml"
      transform={(input) => {
        if (!input.trim()) return '';
        const s = input.trim().replace(/;$/, '');
        const m = s.match(/^(linear|radial)-gradient\s*\(([\s\S]*)\)$/i);
        if (!m) throw new Error('Expected linear-gradient(...) or radial-gradient(...). conic is not supported by SVG.');
        const kind = (m[1] ?? '').toLowerCase();
        const body = m[2] ?? '';
        const args = splitTopLevel(body);
        if (args.length < 2) throw new Error('A gradient needs at least two color stops.');

        let angle = 180; // default CSS linear direction is "to bottom"
        let prelude: string | null = null;
        const first = args[0] ?? '';
        const firstIsColor = COLOR_LEAD.test(first) && parseColor(first.split(/\s+/)[0] ?? '') !== null;
        let stopArgs = args;
        if (!firstIsColor) {
          prelude = first;
          stopArgs = args.slice(1);
          const angM = first.match(/(-?\d+(?:\.\d+)?)deg/i);
          if (angM && angM[1] !== undefined) {
            angle = Number(angM[1]);
          } else {
            const sideKey = first.toLowerCase().trim();
            const side = SIDE_ANGLE[sideKey];
            if (side !== undefined) angle = side;
          }
        }

        // Parse stops with positions; fill missing offsets evenly.
        const raw: { rgba: RGBA; pos: number | null }[] = [];
        for (const a of stopArgs) {
          const cm = a.match(COLOR_LEAD);
          if (!cm || cm[0] === undefined) throw new Error(`Could not parse color stop: "${a}"`);
          const colTok = cm[0];
          const rgba = parseColor(colTok);
          if (!rgba) throw new Error(`Invalid color: "${colTok}"`);
          const rest = a.slice(colTok.length).trim();
          const pm = rest.match(/(-?\d+(?:\.\d+)?)%/);
          const pos = pm && pm[1] !== undefined ? Number(pm[1]) / 100 : null;
          raw.push({ rgba, pos });
        }

        const n = raw.length;
        const stops: Stop[] = raw.map((st, i) => ({
          rgba: st.rgba,
          offset: st.pos ?? (n > 1 ? i / (n - 1) : 0),
        }));

        const sz = Math.round(Number(size));
        const dim = Number.isFinite(sz) && sz > 0 ? sz : 200;

        const stopEls = stops
          .map((st) => {
            const off = Math.round(clamp(st.offset, 0, 1) * 10000) / 100;
            const op = st.rgba.a < 1 ? ` stop-opacity="${Math.round(st.rgba.a * 1000) / 1000}"` : '';
            return `      <stop offset="${off}%" stop-color="${toHex(st.rgba)}"${op} />`;
          })
          .join('\n');

        let defs: string;
        if (kind === 'linear') {
          const v = angleToVector(angle);
          defs = `    <linearGradient id="grad" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}">\n${stopEls}\n    </linearGradient>`;
        } else {
          defs = `    <radialGradient id="grad" cx="0.5" cy="0.5" r="0.5">\n${stopEls}\n    </radialGradient>`;
        }

        const comment = prelude ? `  <!-- source: ${kind}-gradient, ${prelude} -->\n` : '';
        return [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">`,
          comment + '  <defs>',
          defs,
          '  </defs>',
          `  <rect width="${dim}" height="${dim}" fill="url(#grad)" />`,
          '</svg>',
        ].join('\n');
      }}
      options={
        <Field label="Preview size (px)">
          <Input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            inputMode="numeric"
            className="w-28"
          />
        </Field>
      }
    />
  );
}
