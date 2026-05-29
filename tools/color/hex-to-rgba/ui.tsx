'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'hexToRgba' | 'rgbaToHex';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function byteToHex(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number; // 0..1
}

function parseHex(raw: string): Rgba {
  let hex = raw.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid HEX: "${raw}". Use characters 0-9 and a-f.`);
  }

  if (hex.length === 3 || hex.length === 4) {
    // expand shorthand
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (hex.length !== 6 && hex.length !== 8) {
    throw new Error('HEX must be 3, 4, 6, or 8 hex digits.');
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseRgba(raw: string): Rgba {
  const match = raw
    .trim()
    .match(/^rgba?\(\s*([^)]+)\)$/i);
  if (!match || !match[1]) {
    throw new Error('Invalid rgba(). Use rgba(255, 0, 0, 0.5) or rgb(255, 0, 0).');
  }
  const parts = match[1].split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) {
    throw new Error('rgba() needs 3 or 4 components.');
  }

  const channel = (value: string): number => {
    let v: number;
    if (value.endsWith('%')) {
      const pct = Number(value.slice(0, -1));
      if (!Number.isFinite(pct)) throw new Error(`Invalid channel: "${value}".`);
      v = (pct / 100) * 255;
    } else {
      v = Number(value);
      if (!Number.isFinite(v)) throw new Error(`Invalid channel: "${value}".`);
    }
    return clampByte(v);
  };

  const r = channel(parts[0] ?? '0');
  const g = channel(parts[1] ?? '0');
  const b = channel(parts[2] ?? '0');
  let a = 1;
  if (parts.length === 4) {
    const av = parts[3] ?? '1';
    if (av.endsWith('%')) {
      const pct = Number(av.slice(0, -1));
      if (!Number.isFinite(pct)) throw new Error(`Invalid alpha: "${av}".`);
      a = pct / 100;
    } else {
      a = Number(av);
      if (!Number.isFinite(a)) throw new Error(`Invalid alpha: "${av}".`);
    }
    a = Math.max(0, Math.min(1, a));
  }

  return { r, g, b, a };
}

function formatRgba({ r, g, b, a }: Rgba): string {
  const alpha = Number(a.toFixed(3));
  if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatHex({ r, g, b, a }: Rgba): string {
  const base = `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
  if (a >= 1) return base;
  return `${base}${byteToHex(a * 255)}`;
}

export default function HexToRgba() {
  const [mode, setMode] = useState<Mode>('hexToRgba');

  const transform = useCallback(
    (input: string) => {
      const lines = input.split('\n');
      const out: string[] = [];
      let any = false;
      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        any = true;
        if (mode === 'hexToRgba') {
          const rgba = parseHex(line);
          out.push(`${formatRgba(rgba)}   (alpha ${(rgba.a * 100).toFixed(0)}%)`);
        } else {
          const rgba = parseRgba(line);
          out.push(formatHex(rgba));
        }
      }
      if (!any) return '';
      return out.join('\n');
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'hexToRgba' ? 'HEX color(s)' : 'rgba() color(s)'}
      outputLabel={mode === 'hexToRgba' ? 'rgba()' : 'HEX'}
      inputPlaceholder={mode === 'hexToRgba' ? '#3498db or #3498db80' : 'rgba(52, 152, 219, 0.5)'}
      sample={mode === 'hexToRgba' ? '#3498db80' : 'rgba(52, 152, 219, 0.5)'}
      downloadName="colors.txt"
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="hexToRgba">HEX to RGBA</TabsTrigger>
              <TabsTrigger value="rgbaToHex">RGBA to HEX</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
