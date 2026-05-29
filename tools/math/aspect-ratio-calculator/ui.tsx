'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'solve' | 'reduce';

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function parseRatio(s: string): { w: number; h: number } | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const sep = trimmed.includes(':') ? ':' : trimmed.includes('/') ? '/' : trimmed.includes('x') ? 'x' : null;
  if (!sep) return null;
  const parts = trimmed.split(sep);
  if (parts.length !== 2) return null;
  const w = Number((parts[0] ?? '').trim());
  const h = Number((parts[1] ?? '').trim());
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

export default function AspectRatioCalculatorTool() {
  const [mode, setMode] = useState<Mode>('solve');

  // solve mode state
  const [ratio, setRatio] = useState('16:9');
  const [width, setWidth] = useState('1920');
  const [height, setHeight] = useState('');

  // reduce mode state
  const [resW, setResW] = useState('1920');
  const [resH, setResH] = useState('1080');

  const solve = useMemo(() => {
    if (mode !== 'solve') return null;
    const r = parseRatio(ratio);
    if (!r) return { error: 'Enter a valid ratio like 16:9' };
    const w = width.trim() === '' ? null : Number(width);
    const h = height.trim() === '' ? null : Number(height);
    if (w !== null && (!Number.isFinite(w) || w <= 0)) return { error: 'Width must be a positive number.' };
    if (h !== null && (!Number.isFinite(h) || h <= 0)) return { error: 'Height must be a positive number.' };
    if (w !== null && h !== null) {
      return { error: 'Leave exactly one of width or height empty to solve for it.' };
    }
    if (w === null && h === null) {
      return { error: 'Enter width or height to solve for the other.' };
    }
    if (w !== null) {
      const solvedH = (w * r.h) / r.w;
      return { value: solvedH, field: 'Height', w, h: solvedH };
    }
    const solvedW = ((h as number) * r.w) / r.h;
    return { value: solvedW, field: 'Width', w: solvedW, h: h as number };
  }, [mode, ratio, width, height]);

  const reduce = useMemo(() => {
    if (mode !== 'reduce') return null;
    const w = Number(resW);
    const h = Number(resH);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return { error: 'Enter a positive width and height.' };
    }
    const g = gcd(w, h);
    const rw = Math.round(w) / g;
    const rh = Math.round(h) / g;
    return { ratio: `${rw}:${rh}`, decimal: w / h, gcd: g };
  }, [mode, resW, resH]);

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, ''));

  return (
    <Panel>
      <PanelHeader title="Aspect Ratio Calculator" />
      <div className="space-y-4 p-4">
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="solve">Solve dimension</TabsTrigger>
                <TabsTrigger value="reduce">Reduce ratio</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        {mode === 'solve' ? (
          <>
            <OptionsBar>
              <Field label="Target ratio" hint="e.g. 16:9, 4:3, 21:9">
                <Input value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="16:9" />
              </Field>
              <Field label="Width" hint="leave empty to solve">
                <Input
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  inputMode="decimal"
                  placeholder="1920"
                />
              </Field>
              <Field label="Height" hint="leave empty to solve">
                <Input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  inputMode="decimal"
                  placeholder="1080"
                />
              </Field>
            </OptionsBar>

            {solve && 'error' in solve ? (
              <ErrorBanner error={solve.error} />
            ) : solve ? (
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{solve.field}</p>
                    <p className="text-2xl font-semibold tabular-nums">{fmt(solve.value)}</p>
                  </div>
                  <CopyButton value={() => fmt(solve.value)} />
                </div>
                <StatBar
                  items={[
                    `Resolution: ${fmt(solve.w)} x ${fmt(solve.h)}`,
                    `Ratio: ${ratio.trim()}`,
                  ]}
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <OptionsBar>
              <Field label="Width (px)">
                <Input value={resW} onChange={(e) => setResW(e.target.value)} inputMode="numeric" placeholder="1920" />
              </Field>
              <Field label="Height (px)">
                <Input value={resH} onChange={(e) => setResH(e.target.value)} inputMode="numeric" placeholder="1080" />
              </Field>
            </OptionsBar>

            {reduce && 'error' in reduce ? (
              <ErrorBanner error={reduce.error} />
            ) : reduce ? (
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Simplified ratio</p>
                    <p className="text-2xl font-semibold tabular-nums">{reduce.ratio}</p>
                  </div>
                  <CopyButton value={() => reduce.ratio} />
                </div>
                <StatBar
                  items={[
                    `Decimal: ${reduce.decimal.toFixed(4)}`,
                    `GCD: ${reduce.gcd}`,
                  ]}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </Panel>
  );
}
