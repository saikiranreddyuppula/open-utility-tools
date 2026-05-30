'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type GridSize = 5 | 7;

/** FNV-1a 32-bit hash — deterministic, no dependencies. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in 32-bit range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Build an HSL color from the high bits of the hash. */
function hashColor(hash: number): string {
  const hue = hash % 360;
  const sat = 55 + ((hash >>> 9) % 30); // 55..84
  const light = 42 + ((hash >>> 17) % 18); // 42..59
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

interface Built {
  svg: string;
  dataUri: string;
  cellsOn: number;
  totalCells: number;
  color: string;
}

function buildIdenticon(
  seed: string,
  grid: GridSize,
  bg: string,
  padding: number,
  cell: number,
): Built {
  const base = fnv1a(seed.length ? seed : 'seed');
  const color = hashColor(base);

  // We fill the left half (including the middle column) deterministically, then mirror.
  const half = Math.ceil(grid / 2);
  // Pull pseudo-random bits by re-hashing with a per-column salt so larger grids stay varied.
  const filled: boolean[][] = [];
  for (let col = 0; col < half; col++) {
    const column: boolean[] = [];
    const colHash = fnv1a(`${seed}|c${col}|${grid}`);
    for (let row = 0; row < grid; row++) {
      const bit = (colHash >>> (row % 31)) & 1;
      column.push(bit === 1);
    }
    filled.push(column);
  }

  const fullGrid: boolean[][] = [];
  for (let row = 0; row < grid; row++) {
    const r: boolean[] = [];
    for (let col = 0; col < grid; col++) {
      const mirroredCol = col < half ? col : grid - 1 - col;
      const column = filled[mirroredCol];
      r.push(column ? (column[row] ?? false) : false);
    }
    fullGrid.push(r);
  }

  const size = grid * cell + padding * 2;
  const rects: string[] = [];
  let cellsOn = 0;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (fullGrid[row]?.[col]) {
        cellsOn++;
        const x = padding + col * cell;
        const y = padding + row * cell;
        rects.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${color}" shape-rendering="crispEdges"/>`,
        );
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n` +
    `  <rect width="${size}" height="${size}" fill="${bg}"/>\n` +
    rects.map((r) => `  ${r}`).join('\n') +
    (rects.length ? '\n' : '') +
    `</svg>`;

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return { svg, dataUri, cellsOn, totalCells: grid * grid, color };
}

export default function IdenticonTool() {
  const [seed, setSeed] = useState('octocat@example.com');
  const [grid, setGrid] = useState<GridSize>(5);
  const [bg, setBg] = useState('#f0f0f0');
  const [padding, setPadding] = useState(12);
  const [cell, setCell] = useState(24);

  const built = useMemo(
    () => buildIdenticon(seed, grid, bg, padding, cell),
    [seed, grid, bg, padding, cell],
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Seed" className="min-w-[220px] flex-1">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="username or email"
            className="font-mono"
          />
        </Field>
        <Field label="Grid">
          <Select value={String(grid)} onValueChange={(v) => setGrid(Number(v) === 7 ? 7 : 5)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 × 5</SelectItem>
              <SelectItem value="7">7 × 7</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Background">
          <Input
            type="color"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="h-8 w-14 p-1"
          />
        </Field>
        <Field label={`Padding: ${padding}px`} className="min-w-[160px]">
          <Slider
            value={[padding]}
            min={0}
            max={40}
            step={1}
            onValueChange={(v) => setPadding(v[0] ?? 12)}
          />
        </Field>
        <Field label={`Cell: ${cell}px`} className="min-w-[160px]">
          <Slider
            value={[cell]}
            min={8}
            max={48}
            step={1}
            onValueChange={(v) => setCell(v[0] ?? 24)}
          />
        </Field>
      </OptionsBar>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Preview" />
          <div className="flex flex-col items-center gap-3 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={built.dataUri}
              alt={`identicon for ${seed}`}
              className="rounded border"
              style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
            />
          </div>
          <StatBar
            items={[
              `${grid}×${grid}`,
              `${built.cellsOn}/${built.totalCells} cells`,
              `fill ${built.color}`,
            ]}
          />
        </Panel>

        <Panel>
          <PanelHeader title="SVG markup">
            <CopyButton value={() => built.svg} label="Copy SVG" />
            <DownloadButton data={() => built.svg} filename="identicon.svg" />
          </PanelHeader>
          <pre className="max-h-[360px] overflow-auto p-3 font-mono text-2xs leading-relaxed">
            {built.svg}
          </pre>
          <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Data URI
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-2xs">{built.dataUri}</code>
            <CopyButton value={() => built.dataUri} size="icon-sm" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
