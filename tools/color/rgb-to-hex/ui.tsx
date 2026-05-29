'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Case = 'lower' | 'upper';

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampAlpha(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

/** Parse "12", "50%" into a 0-255 channel value. */
function parseChannel(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const pct = Number(s.slice(0, -1));
    if (!Number.isFinite(pct)) return null;
    return (pct / 100) * 255;
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return v;
}

/** Parse alpha as 0-1; supports "0.5" or "50%". */
function parseAlpha(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const pct = Number(s.slice(0, -1));
    if (!Number.isFinite(pct)) return null;
    return pct / 100;
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return v;
}

interface Parsed {
  r: number;
  g: number;
  b: number;
  a: number | null;
}

function parseLine(line: string): Parsed {
  const trimmed = line.trim();
  // Strip an optional rgb()/rgba() wrapper.
  const m = /^rgba?\s*\(([^)]*)\)$/i.exec(trimmed);
  const inner = m && m[1] !== undefined ? m[1] : trimmed;

  // Modern slash syntax: "r g b / a"
  let body = inner;
  let alphaPart: string | null = null;
  const slashIdx = inner.indexOf('/');
  if (slashIdx !== -1) {
    body = inner.slice(0, slashIdx);
    alphaPart = inner.slice(slashIdx + 1);
  }

  // Split channels on comma or whitespace.
  const parts = body
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 3) {
    throw new Error(`Expected at least 3 channels (R G B), got: "${line.trim()}"`);
  }

  const rRaw = parts[0] ?? '';
  const gRaw = parts[1] ?? '';
  const bRaw = parts[2] ?? '';

  const r = parseChannel(rRaw);
  const g = parseChannel(gRaw);
  const b = parseChannel(bRaw);
  if (r === null || g === null || b === null) {
    throw new Error(`Could not parse R/G/B channels in: "${line.trim()}"`);
  }

  // Alpha may come from slash syntax or a 4th comma/space value.
  let a: number | null = null;
  if (alphaPart !== null) {
    a = parseAlpha(alphaPart);
    if (a === null) throw new Error(`Invalid alpha in: "${line.trim()}"`);
  } else if (parts.length >= 4) {
    const aRaw = parts[3] ?? '';
    a = parseAlpha(aRaw);
    if (a === null) throw new Error(`Invalid alpha in: "${line.trim()}"`);
  }

  return { r, g, b, a };
}

export default function RgbToHexTool() {
  const [hexCase, setHexCase] = useState<Case>('lower');

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
        const { r, g, b, a } = parseLine(line);
        let hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
        if (a !== null) {
          const alphaByte = clampAlpha(a) * 255;
          hex += toHexByte(alphaByte);
        }
        out.push(hexCase === 'upper' ? hex.toUpperCase() : hex.toLowerCase());
      }
      return out.join('\n');
    },
    [hexCase]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[hexCase]}
      inputLabel="RGB / RGBA"
      outputLabel="HEX"
      inputPlaceholder="rgb(255, 99, 71)&#10;rgba(0, 128, 255, 0.5)&#10;34 197 94"
      sample={'rgb(255, 99, 71)\nrgba(0, 128, 255, 0.5)\n34 197 94 / 0.8'}
      downloadName="hex-colors.txt"
      options={
        <Field label="Output case">
          <Tabs value={hexCase} onValueChange={(v) => setHexCase(v as Case)}>
            <TabsList>
              <TabsTrigger value="lower">lower</TabsTrigger>
              <TabsTrigger value="upper">UPPER</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
