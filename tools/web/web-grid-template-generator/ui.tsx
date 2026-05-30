'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const MAX = 12;

/** Ensure an array has exactly `n` entries, filling new slots with `fill`. */
function resize<T>(arr: T[], n: number, fill: () => T): T[] {
  const out = arr.slice(0, n);
  while (out.length < n) out.push(fill());
  return out;
}

/** A track token is shown raw; default to "1fr" so output is always valid. */
function trackToken(raw: string): string {
  const t = raw.trim();
  return t === '' ? '1fr' : t;
}

export default function GridTemplateGeneratorTool() {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [colTokens, setColTokens] = useState<string[]>(['1fr', '2fr', '1fr']);
  const [rowTokens, setRowTokens] = useState<string[]>(['auto', '1fr']);
  const [colGap, setColGap] = useState(12);
  const [rowGap, setRowGap] = useState(12);
  const [useAreas, setUseAreas] = useState(true);
  // areas[r][c]
  const [areas, setAreas] = useState<string[][]>([
    ['header', 'header', 'header'],
    ['sidebar', 'main', 'main'],
  ]);

  const onColsChange = (n: number) => {
    setCols(n);
    setColTokens((prev) => resize(prev, n, () => '1fr'));
    setAreas((prev) => prev.map((row) => resize(row, n, () => '.')));
  };
  const onRowsChange = (n: number) => {
    setRows(n);
    setRowTokens((prev) => resize(prev, n, () => 'auto'));
    setAreas((prev) => resize(prev, n, () => Array.from({ length: cols }, () => '.')));
  };

  const setColToken = (i: number, v: string) =>
    setColTokens((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  const setRowToken = (i: number, v: string) =>
    setRowTokens((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  const setArea = (r: number, c: number, v: string) =>
    setAreas((prev) =>
      prev.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row,
      ),
    );

  const colsValue = useMemo(
    () => Array.from({ length: cols }, (_, i) => trackToken(colTokens[i] ?? '1fr')).join(' '),
    [cols, colTokens],
  );
  const rowsValue = useMemo(
    () => Array.from({ length: rows }, (_, i) => trackToken(rowTokens[i] ?? 'auto')).join(' '),
    [rows, rowTokens],
  );

  const areasValue = useMemo(() => {
    if (!useAreas) return '';
    const lines: string[] = [];
    for (let r = 0; r < rows; r += 1) {
      const row = areas[r] ?? [];
      const cells: string[] = [];
      for (let c = 0; c < cols; c += 1) {
        const raw = (row[c] ?? '').trim();
        // CSS area names cannot contain spaces; use a dot for empty cells.
        cells.push(raw === '' ? '.' : raw.replace(/\s+/g, '-'));
      }
      lines.push(`"${cells.join(' ')}"`);
    }
    return lines.join('\n    ');
  }, [useAreas, areas, rows, cols]);

  const css = useMemo(() => {
    const decls: string[] = [
      '  display: grid;',
      `  grid-template-columns: ${colsValue};`,
      `  grid-template-rows: ${rowsValue};`,
    ];
    if (colGap === rowGap) {
      if (colGap > 0) decls.push(`  gap: ${colGap}px;`);
    } else {
      decls.push(`  gap: ${rowGap}px ${colGap}px;`);
    }
    if (useAreas && areasValue) {
      decls.push(`  grid-template-areas:\n    ${areasValue};`);
    }
    return `.grid {\n${decls.join('\n')}\n}`;
  }, [colsValue, rowsValue, colGap, rowGap, useAreas, areasValue]);

  const previewStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: colsValue,
    gridTemplateRows: rowsValue,
    columnGap: `${colGap}px`,
    rowGap: `${rowGap}px`,
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Tracks" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label={`Columns: ${cols}`} className="min-w-[200px]">
              <Slider value={[cols]} min={1} max={MAX} step={1} onValueChange={(v) => onColsChange(v[0] ?? 1)} />
            </Field>
            <Field label={`Rows: ${rows}`} className="min-w-[200px]">
              <Slider value={[rows]} min={1} max={MAX} step={1} onValueChange={(v) => onRowsChange(v[0] ?? 1)} />
            </Field>
            <Field label={`Column gap: ${colGap}px`} className="min-w-[200px]">
              <Slider value={[colGap]} min={0} max={60} step={1} onValueChange={(v) => setColGap(v[0] ?? 0)} />
            </Field>
            <Field label={`Row gap: ${rowGap}px`} className="min-w-[200px]">
              <Slider value={[rowGap]} min={0} max={60} step={1} onValueChange={(v) => setRowGap(v[0] ?? 0)} />
            </Field>
          </OptionsBar>

          <div>
            <Label className="text-xs text-muted-foreground">Column track sizes</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {Array.from({ length: cols }, (_, i) => (
                <Input
                  key={i}
                  value={colTokens[i] ?? ''}
                  onChange={(e) => setColToken(i, e.target.value)}
                  placeholder="1fr"
                  spellCheck={false}
                  className="w-28 font-mono"
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Row track sizes</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {Array.from({ length: rows }, (_, i) => (
                <Input
                  key={i}
                  value={rowTokens[i] ?? ''}
                  onChange={(e) => setRowToken(i, e.target.value)}
                  placeholder="auto"
                  spellCheck={false}
                  className="w-28 font-mono"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="use-areas" checked={useAreas} onCheckedChange={setUseAreas} />
            <Label htmlFor="use-areas" className="text-sm">Use grid-template-areas (name each cell)</Label>
          </div>

          {useAreas && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex flex-wrap gap-2">
                  {Array.from({ length: cols }, (_, c) => (
                    <Input
                      key={c}
                      value={areas[r]?.[c] ?? ''}
                      onChange={(e) => setArea(r, c, e.target.value)}
                      placeholder="."
                      spellCheck={false}
                      className="w-28 font-mono"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="m-3 min-h-[200px] rounded-md border bg-muted/30 p-3" style={previewStyle}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const label = useAreas ? (areas[r]?.[c] ?? '.') : `${r + 1},${c + 1}`;
            return (
              <div
                key={i}
                className="flex min-h-12 items-center justify-center rounded bg-primary/80 px-2 font-mono text-xs text-primary-foreground"
              >
                {label}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={() => css} />
        </PanelHeader>
        <pre className="overflow-x-auto whitespace-pre p-3 font-mono text-xs">{css}</pre>
        <StatBar items={[`${cols}×${rows}`, useAreas ? 'with areas' : 'no areas']} />
      </Panel>
    </div>
  );
}
