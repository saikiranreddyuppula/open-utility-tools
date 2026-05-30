'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Shape = 'trapezoid' | 'parallelogram';

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function TrapezoidParallelogramCalculatorTool() {
  const [shape, setShape] = useState<Shape>('trapezoid');
  // Trapezoid inputs
  const [a, setA] = useState('8');
  const [b, setB] = useState('5');
  const [h, setH] = useState('4');
  const [leg1, setLeg1] = useState('5');
  const [leg2, setLeg2] = useState('5');
  // Parallelogram inputs
  const [pbase, setPbase] = useState('6');
  const [pheight, setPheight] = useState('4');
  const [pside, setPside] = useState('5');

  const result = useMemo(() => {
    if (shape === 'trapezoid') {
      const A = Number(a);
      const B = Number(b);
      const H = Number(h);
      const L1 = Number(leg1);
      const L2 = Number(leg2);
      if (![A, B, H].every((v) => Number.isFinite(v))) {
        return { error: 'Enter valid numbers for the two parallel sides and the height.' };
      }
      if (A <= 0 || B <= 0 || H <= 0) {
        return { error: 'Parallel sides and height must be positive.' };
      }
      const area = ((A + B) / 2) * H;
      const haveLegs = Number.isFinite(L1) && Number.isFinite(L2) && L1 > 0 && L2 > 0;
      const perimeter = haveLegs ? A + B + L1 + L2 : NaN;
      const median = (A + B) / 2;
      const rows: { label: string; value: string }[] = [
        { label: 'Area', value: num(area) },
        { label: 'Median (mid-segment)', value: num(median) },
        {
          label: 'Perimeter',
          value: haveLegs ? num(perimeter) : 'enter both legs',
        },
      ];
      return { rows, formula: 'Area = ((a + b) / 2) · h,  Perimeter = a + b + leg₁ + leg₂' };
    }

    // parallelogram
    const base = Number(pbase);
    const height = Number(pheight);
    const side = Number(pside);
    if (![base, height, side].every((v) => Number.isFinite(v))) {
      return { error: 'Enter valid numbers for base, height, and side.' };
    }
    if (base <= 0 || height <= 0 || side <= 0) {
      return { error: 'Base, height, and side must be positive.' };
    }
    const area = base * height;
    const perimeter = 2 * (base + side);
    const rows: { label: string; value: string }[] = [
      { label: 'Area', value: num(area) },
      { label: 'Perimeter', value: num(perimeter) },
    ];
    return { rows, formula: 'Area = base · height,  Perimeter = 2 · (base + side)' };
  }, [shape, a, b, h, leg1, leg2, pbase, pheight, pside]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Shape">
            <Tabs value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <TabsList>
                <TabsTrigger value="trapezoid">Trapezoid</TabsTrigger>
                <TabsTrigger value="parallelogram">Parallelogram</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {shape === 'trapezoid' ? (
            <>
              <Field label="Parallel side a">
                <Input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Parallel side b">
                <Input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Height h">
                <Input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Leg 1 (optional)">
                <Input value={leg1} onChange={(e) => setLeg1(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Leg 2 (optional)">
                <Input value={leg2} onChange={(e) => setLeg2(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Base">
                <Input value={pbase} onChange={(e) => setPbase(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Height">
                <Input value={pheight} onChange={(e) => setPheight(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
              <Field label="Side">
                <Input value={pside} onChange={(e) => setPside(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
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
          <StatBar items={[result.formula]} />
        </Panel>
      )}
    </div>
  );
}
