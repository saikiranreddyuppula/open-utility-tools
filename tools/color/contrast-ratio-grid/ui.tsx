'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Swatch {
  raw: string;
  rgb: RGB;
  hex: string;
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
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  purple: '#800080',
  orange: '#ffa500',
  pink: '#ffc0cb',
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const named = NAMED[s];
  if (named !== undefined) return parseColor(named);
  const hex = s.startsWith('#') ? s.slice(1) : /^[0-9a-f]{3,8}$/.test(s) ? s : '';
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1] !== undefined) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }
  return null;
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

type Level = 'AAA' | 'AA' | 'AA Large' | 'Fail';

function levelOf(ratio: number): Level {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

const LEVEL_BG: Record<Level, string> = {
  AAA: 'rgba(34,197,94,0.18)',
  AA: 'rgba(132,204,22,0.16)',
  'AA Large': 'rgba(234,179,8,0.16)',
  Fail: 'rgba(239,68,68,0.14)',
};

const SAMPLE = ['#1f2937', '#ffffff', '#3b82f6', '#f59e0b', '#ef4444'].join('\n');

export default function ContrastRatioGrid() {
  const [text, setText] = useState(SAMPLE);

  const swatches = useMemo<Swatch[]>(() => {
    const out: Swatch[] = [];
    for (const line of text.split(/[\n,]/)) {
      const raw = line.trim();
      if (!raw) continue;
      const rgb = parseColor(raw);
      if (!rgb) continue;
      out.push({ raw, rgb, hex: toHex(rgb) });
      if (out.length >= 20) break;
    }
    return out;
  }, [text]);

  const csv = useMemo(() => {
    if (swatches.length === 0) return '';
    const header = ['', ...swatches.map((s) => s.hex)].join(',');
    const rows = swatches.map((row) => {
      const cells = swatches.map((col) => contrast(row.rgb, col.rgb).toFixed(2));
      return [row.hex, ...cells].join(',');
    });
    return [header, ...rows].join('\n');
  }, [swatches]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Palette colors (one per line)" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={6}
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          placeholder="#1f2937&#10;white&#10;rgb(59,130,246)"
        />
      </Panel>

      {swatches.length >= 2 ? (
        <Panel>
          <PanelHeader title={`${swatches.length} x ${swatches.length} contrast matrix`}>
            <CopyButton value={() => csv} label="Copy CSV" />
          </PanelHeader>
          <div className="overflow-auto p-2">
            <table className="border-collapse text-center font-mono text-2xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card p-1" />
                  {swatches.map((s, i) => (
                    <th key={`h-${i}`} className="p-1">
                      <div className="mx-auto h-5 w-10 rounded border" style={{ backgroundColor: s.hex }} />
                      <div className="mt-0.5 text-[9px] text-muted-foreground">{s.hex}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {swatches.map((row, ri) => (
                  <tr key={`r-${ri}`}>
                    <th className="sticky left-0 z-10 bg-card p-1">
                      <div className="h-5 w-10 rounded border" style={{ backgroundColor: row.hex }} />
                      <div className="mt-0.5 text-[9px] text-muted-foreground">{row.hex}</div>
                    </th>
                    {swatches.map((col, ci) => {
                      const ratio = contrast(row.rgb, col.rgb);
                      const level = levelOf(ratio);
                      return (
                        <td
                          key={`c-${ri}-${ci}`}
                          className="min-w-[54px] border p-1"
                          style={{ backgroundColor: LEVEL_BG[level] }}
                          title={`fg ${row.hex} on bg ${col.hex}: ${ratio.toFixed(2)}:1 (${level})`}
                        >
                          <div
                            className="rounded px-1 py-0.5 text-[11px]"
                            style={{ backgroundColor: col.hex, color: row.hex }}
                          >
                            Aa
                          </div>
                          <div className="mt-0.5 tabular">{ratio.toFixed(2)}</div>
                          <div className="text-[9px] text-muted-foreground">{level}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t px-3 py-2 text-2xs">
            {(['AAA', 'AA', 'AA Large', 'Fail'] as Level[]).map((lv) => (
              <span key={lv} className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border" style={{ backgroundColor: LEVEL_BG[lv] }} />
                {lv}
              </span>
            ))}
          </div>
          <StatBar items={[`${swatches.length} colors`, `cell (row) = foreground, (col) = background`]} />
        </Panel>
      ) : (
        <Panel>
          <div className="p-4 text-sm text-muted-foreground">
            Enter at least two valid colors (HEX, rgb(), or named) to build the contrast grid.
          </div>
        </Panel>
      )}
    </div>
  );
}
