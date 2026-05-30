'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Fill = 'row' | 'column';
type Overflow = 'truncate' | 'wrap';

function clampInt(s: string, min: number, max: number, fallback: number): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Wrap a single cell value into one or more width-W lines.
function wrapCell(value: string, width: number): string[] {
  if (value.length <= width) return [value];
  const out: string[] = [];
  let rest = value;
  while (rest.length > width) {
    out.push(rest.slice(0, width));
    rest = rest.slice(width);
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

export default function TextToColumnsTool() {
  const [cols, setCols] = useState('3');
  const [width, setWidth] = useState('16');
  const [gutter, setGutter] = useState('2');
  const [fill, setFill] = useState<Fill>('row');
  const [overflow, setOverflow] = useState<Overflow>('truncate');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const items = input.split('\n').map((l) => l.replace(/\s+$/, ''));
      const n = clampInt(cols, 1, 12, 3);
      const w = clampInt(width, 1, 120, 16);
      const g = clampInt(gutter, 0, 20, 2);
      const gutterStr = ' '.repeat(g);

      // Normalize each item into one cell string (truncate keeps single line).
      const total = items.length;
      const rowsCount = Math.ceil(total / n);

      // Determine the cell at output grid position (rowIdx, colIdx).
      const cellAt = (rowIdx: number, colIdx: number): string => {
        let srcIdx: number;
        if (fill === 'row') {
          srcIdx = rowIdx * n + colIdx;
        } else {
          srcIdx = colIdx * rowsCount + rowIdx;
        }
        if (srcIdx < 0 || srcIdx >= total) return '';
        return items[srcIdx] ?? '';
      };

      const lines: string[] = [];
      for (let r = 0; r < rowsCount; r += 1) {
        if (overflow === 'wrap') {
          // Wrap each cell, then stack sub-lines for the whole row.
          const wrapped: string[][] = [];
          let maxSub = 1;
          for (let c = 0; c < n; c += 1) {
            const sub = wrapCell(cellAt(r, c), w);
            wrapped.push(sub);
            if (sub.length > maxSub) maxSub = sub.length;
          }
          for (let sl = 0; sl < maxSub; sl += 1) {
            const parts: string[] = [];
            for (let c = 0; c < n; c += 1) {
              const cellLines = wrapped[c] ?? [];
              const piece = cellLines[sl] ?? '';
              parts.push(piece.padEnd(w).slice(0, w));
            }
            lines.push(parts.join(gutterStr).replace(/\s+$/, ''));
          }
        } else {
          const parts: string[] = [];
          for (let c = 0; c < n; c += 1) {
            const cell = cellAt(r, c).slice(0, w);
            parts.push(cell.padEnd(w));
          }
          lines.push(parts.join(gutterStr).replace(/\s+$/, ''));
        }
      }

      return lines.join('\n');
    },
    [cols, width, gutter, fill, overflow]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[cols, width, gutter, fill, overflow]}
      inputLabel="Items (one per line)"
      outputLabel="Columns"
      sample={
        'Mercury\nVenus\nEarth\nMars\nJupiter\nSaturn\nUranus\nNeptune\nPluto\nCeres\nEris'
      }
      downloadName="columns.txt"
      options={
        <>
          <Field label="Columns">
            <Input
              value={cols}
              onChange={(e) => setCols(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Cell width">
            <Input
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Gutter">
            <Input
              value={gutter}
              onChange={(e) => setGutter(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Fill order">
            <Tabs value={fill} onValueChange={(v) => setFill(v as Fill)}>
              <TabsList>
                <TabsTrigger value="row">Row-major</TabsTrigger>
                <TabsTrigger value="column">Column-major</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Overflow">
            <Tabs value={overflow} onValueChange={(v) => setOverflow(v as Overflow)}>
              <TabsList>
                <TabsTrigger value="truncate">Truncate</TabsTrigger>
                <TabsTrigger value="wrap">Wrap</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
