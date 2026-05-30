'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'sides' | 'area';

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function aspectRatio(l: number, w: number): string {
  // Use a fine-grained integer approximation for the side ratio.
  const scale = 1000;
  const a = Math.round(l * scale);
  const b = Math.round(w * scale);
  const g = gcd(a, b);
  if (g === 0) return '—';
  return `${a / g} : ${b / g}`;
}

export default function RectangleSquareCalculatorTool() {
  const [mode, setMode] = useState<Mode>('sides');
  const [length, setLength] = useState('8');
  const [width, setWidth] = useState('5');
  const [area, setArea] = useState('40');
  const [side, setSide] = useState('5');
  const [unit, setUnit] = useState('cm');

  const result = useMemo(() => {
    let l: number;
    let w: number;

    if (mode === 'sides') {
      l = Number(length);
      w = Number(width);
      if (!Number.isFinite(l) || !Number.isFinite(w)) {
        return { error: 'Enter valid numbers for length and width.' };
      }
      if (l <= 0 || w <= 0) return { error: 'Length and width must be greater than zero.' };
    } else {
      const a = Number(area);
      const s = Number(side);
      if (!Number.isFinite(a) || !Number.isFinite(s)) {
        return { error: 'Enter valid numbers for area and the known side.' };
      }
      if (a <= 0 || s <= 0) return { error: 'Area and side must be greater than zero.' };
      l = s;
      w = a / s;
    }

    const u = unit.trim() || '';
    const su = u ? ` ${u}` : '';
    const sq = u ? ` ${u}²` : '';

    const areaVal = l * w;
    const perimeter = 2 * (l + w);
    const diagonal = Math.sqrt(l * l + w * w);
    const isSquare = Math.abs(l - w) < 1e-9;

    const rows: { label: string; value: string }[] = [
      { label: 'Area', value: `${num(areaVal)}${sq}` },
      { label: 'Perimeter', value: `${num(perimeter)}${su}` },
      { label: 'Diagonal', value: `${num(diagonal)}${su}` },
      { label: 'Aspect ratio', value: aspectRatio(l, w) },
    ];

    if (mode === 'area') {
      rows.unshift({ label: 'Missing side', value: `${num(w)}${su}` });
    }

    return {
      rows,
      length: l,
      width: w,
      isSquare,
      unit: u,
    };
  }, [mode, length, width, area, side, unit]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="sides">From sides</TabsTrigger>
                <TabsTrigger value="area">From area + side</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'sides' ? (
            <>
              <Field label="Length">
                <Input
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  inputMode="decimal"
                  className="w-28 font-mono"
                />
              </Field>
              <Field label="Width (= length for a square)">
                <Input
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  inputMode="decimal"
                  className="w-28 font-mono"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Area">
                <Input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  inputMode="decimal"
                  className="w-28 font-mono"
                />
              </Field>
              <Field label="Known side">
                <Input
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  inputMode="decimal"
                  className="w-28 font-mono"
                />
              </Field>
            </>
          )}
          <Field label="Unit (optional)">
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-24 font-mono"
              placeholder="cm"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={result.isSquare ? 'Square properties' : 'Rectangle properties'}>
            <CopyButton
              value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Length = ${num(result.length)}`,
              `Width = ${num(result.width)}`,
              result.isSquare ? 'Shape: square' : 'Shape: rectangle',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
