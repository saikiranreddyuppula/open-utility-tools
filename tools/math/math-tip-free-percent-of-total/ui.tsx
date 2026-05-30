'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'p-of-what' | 'what-percent' | 'before-change';
type Direction = 'increase' | 'decrease';

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ReversePercentageCalculatorTool() {
  const [mode, setMode] = useState<Mode>('p-of-what');
  const [precision, setPrecision] = useState(2);
  const [direction, setDirection] = useState<Direction>('increase');

  // Mode a: X is P% of what
  const [aX, setAX] = useState('45');
  const [aP, setAP] = useState('30');
  // Mode b: what % is X of Y
  const [bX, setBX] = useState('45');
  const [bY, setBY] = useState('150');
  // Mode c: before a P% change given after value
  const [cAfter, setCAfter] = useState('120');
  const [cP, setCP] = useState('20');

  const result = useMemo(() => {
    const fix = (n: number) => n.toFixed(precision);
    switch (mode) {
      case 'p-of-what': {
        const x = num(aX);
        const p = num(aP);
        if (x == null || p == null) return { error: 'Enter both X and the percentage.' };
        if (p === 0) return { error: 'Percentage cannot be zero (division by zero).' };
        const answer = (x / p) * 100;
        return {
          answer: fix(answer),
          formula: `whole = X ÷ P × 100 = ${x} ÷ ${p} × 100 = ${fix(answer)}`,
          label: `${x} is ${p}% of`,
          stats: [`X = ${x}`, `P = ${p}%`],
        };
      }
      case 'what-percent': {
        const x = num(bX);
        const y = num(bY);
        if (x == null || y == null) return { error: 'Enter both X and Y.' };
        if (y === 0) return { error: 'Y cannot be zero (division by zero).' };
        const answer = (x / y) * 100;
        return {
          answer: `${fix(answer)}%`,
          formula: `percent = X ÷ Y × 100 = ${x} ÷ ${y} × 100 = ${fix(answer)}%`,
          label: `${x} as a percentage of ${y}`,
          stats: [`X = ${x}`, `Y = ${y}`],
        };
      }
      case 'before-change': {
        const after = num(cAfter);
        const p = num(cP);
        if (after == null || p == null) return { error: 'Enter the after value and the percentage.' };
        const factor = direction === 'increase' ? 1 + p / 100 : 1 - p / 100;
        if (factor === 0) return { error: 'A 100% decrease leaves no original value to recover.' };
        const before = after / factor;
        const sign = direction === 'increase' ? '+' : '−';
        return {
          answer: fix(before),
          formula: `before = after ÷ (1 ${sign} P/100) = ${after} ÷ ${factor} = ${fix(before)}`,
          label: `value before a ${p}% ${direction}`,
          stats: [`After = ${after}`, `${direction} ${p}%`],
        };
      }
      default:
        return { error: 'Unknown mode.' };
    }
  }, [mode, precision, direction, aX, aP, bX, bY, cAfter, cP]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Problem type">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="p-of-what">X is P% of ?</TabsTrigger>
              <TabsTrigger value="what-percent">X is ?% of Y</TabsTrigger>
              <TabsTrigger value="before-change">Before change</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label={`Precision: ${precision}`} className="min-w-[180px]">
          <Slider
            value={[precision]}
            min={0}
            max={6}
            step={1}
            onValueChange={(v) => setPrecision(v[0] ?? 2)}
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Inputs" />
        <div className="flex flex-wrap items-end gap-3 p-3">
          {mode === 'p-of-what' && (
            <>
              <Field label="X (the part)" htmlFor="rp-ax">
                <Input
                  id="rp-ax"
                  value={aX}
                  onChange={(e) => setAX(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
              <Field label="P (percent)" htmlFor="rp-ap">
                <Input
                  id="rp-ap"
                  value={aP}
                  onChange={(e) => setAP(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
            </>
          )}
          {mode === 'what-percent' && (
            <>
              <Field label="X (the part)" htmlFor="rp-bx">
                <Input
                  id="rp-bx"
                  value={bX}
                  onChange={(e) => setBX(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
              <Field label="Y (the whole)" htmlFor="rp-by">
                <Input
                  id="rp-by"
                  value={bY}
                  onChange={(e) => setBY(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
            </>
          )}
          {mode === 'before-change' && (
            <>
              <Field label="After value" htmlFor="rp-after">
                <Input
                  id="rp-after"
                  value={cAfter}
                  onChange={(e) => setCAfter(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
              <Field label="Percent change" htmlFor="rp-cp">
                <Input
                  id="rp-cp"
                  value={cP}
                  onChange={(e) => setCP(e.target.value)}
                  type="number"
                  className="h-8 w-28 font-mono"
                />
              </Field>
              <Field label="Direction">
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as Direction)}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase</SelectItem>
                    <SelectItem value="decrease">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Answer — ${result.label}`}>
            <CopyButton value={() => result.answer} />
          </PanelHeader>
          <div className="px-3 py-4 font-mono text-3xl font-semibold tabular text-primary">
            {result.answer}
          </div>
          <div className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
            {result.formula}
          </div>
          <StatBar items={result.stats} />
        </Panel>
      )}
    </div>
  );
}
