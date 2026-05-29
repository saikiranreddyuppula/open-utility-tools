'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OutFormat = 'hex' | 'rgb' | 'both';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

/** Normalize hue into [0, 360). */
function normalizeHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

/** Convert HSL (h in deg, s/l in 0-1) to RGB 0-255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = normalizeHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number | null;
}

function parseNumber(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

/** Parse a percent token "50%" or bare "0.5"/"50" into 0-1. */
function parsePercent(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const p = Number(s.slice(0, -1));
    return Number.isFinite(p) ? p / 100 : null;
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  // Treat values > 1 as percentages (e.g. "50" means 50%).
  return v > 1 ? v / 100 : v;
}

function parseAlpha(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const p = Number(s.slice(0, -1));
    return Number.isFinite(p) ? Math.max(0, Math.min(1, p / 100)) : null;
  }
  const v = Number(s);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
}

function parseLine(line: string): Hsl {
  const trimmed = line.trim();
  const m = /^hsla?\s*\(([^)]*)\)$/i.exec(trimmed);
  const inner = m && m[1] !== undefined ? m[1] : trimmed;

  let body = inner;
  let alphaPart: string | null = null;
  const slashIdx = inner.indexOf('/');
  if (slashIdx !== -1) {
    body = inner.slice(0, slashIdx);
    alphaPart = inner.slice(slashIdx + 1);
  }

  const parts = body
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 3) {
    throw new Error(`Expected at least 3 values (H S L), got: "${line.trim()}"`);
  }

  const hRaw = (parts[0] ?? '').replace(/deg$/i, '');
  const h = parseNumber(hRaw);
  const s = parsePercent(parts[1] ?? '');
  const l = parsePercent(parts[2] ?? '');
  if (h === null || s === null || l === null) {
    throw new Error(`Could not parse H/S/L in: "${line.trim()}"`);
  }

  let a: number | null = null;
  if (alphaPart !== null) {
    a = parseAlpha(alphaPart);
    if (a === null) throw new Error(`Invalid alpha in: "${line.trim()}"`);
  } else if (parts.length >= 4) {
    a = parseAlpha(parts[3] ?? '');
    if (a === null) throw new Error(`Invalid alpha in: "${line.trim()}"`);
  }

  return {
    h: normalizeHue(h),
    s: Math.max(0, Math.min(1, s)),
    l: Math.max(0, Math.min(1, l)),
    a,
  };
}

export default function HslToHexTool() {
  const [format, setFormat] = useState<OutFormat>('hex');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = input.split('\n');
      const out: string[] = [];
      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        const { h, s, l, a } = parseLine(line);
        const [r, g, b] = hslToRgb(h, s, l);
        let hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
        if (a !== null) hex += toHexByte(a * 255);

        const ri = clampByte(r);
        const gi = clampByte(g);
        const bi = clampByte(b);
        const rgb =
          a !== null
            ? `rgba(${ri}, ${gi}, ${bi}, ${Number(a.toFixed(3))})`
            : `rgb(${ri}, ${gi}, ${bi})`;

        if (format === 'hex') out.push(hex);
        else if (format === 'rgb') out.push(rgb);
        else out.push(`${hex}  ${rgb}`);
      }
      return out.join('\n');
    },
    [format]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[format]}
      inputLabel="HSL / HSLA"
      outputLabel="Result"
      inputPlaceholder="hsl(9, 100%, 64%)&#10;hsla(210, 100%, 50%, 0.5)&#10;142 71% 45%"
      sample={'hsl(9, 100%, 64%)\nhsla(210, 100%, 50%, 0.5)\n142 71% 45%'}
      downloadName="hsl-converted.txt"
      options={
        <Field label="Output">
          <Tabs value={format} onValueChange={(v) => setFormat(v as OutFormat)}>
            <TabsList>
              <TabsTrigger value="hex">HEX</TabsTrigger>
              <TabsTrigger value="rgb">RGB</TabsTrigger>
              <TabsTrigger value="both">Both</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
