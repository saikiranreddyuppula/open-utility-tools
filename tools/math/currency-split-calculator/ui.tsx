'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Rounding = 'cents' | 'up' | 'even';

interface Share {
  person: string;
  weight: number;
  amount: number;
}

const ROUNDING_LABEL: Record<Rounding, string> = {
  cents: 'Round to cents (distribute remainder)',
  up: 'Round each up to whole unit',
  even: 'Force exactly even split',
};

// Distribute totalCents across n parts proportional to weights, summing exactly.
function splitCents(totalCents: number, weights: number[]): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / sumW);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);
  // Largest-remainder method: give the leftover cents to the parts with the biggest fractional remainders.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  let idx = 0;
  while (remainder > 0 && order.length > 0) {
    const entry = order[idx % order.length];
    if (entry) {
      const cur = result[entry.i] ?? 0;
      result[entry.i] = cur + 1;
      remainder -= 1;
    }
    idx += 1;
  }
  return result;
}

export default function CurrencySplitCalculatorTool() {
  const [total, setTotal] = useState('100.00');
  const [people, setPeople] = useState('3');
  const [useWeights, setUseWeights] = useState(false);
  const [weightsRaw, setWeightsRaw] = useState('1, 2, 1');
  const [rounding, setRounding] = useState<Rounding>('cents');

  const result = useMemo(() => {
    const amt = Number(total.trim().replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt < 0) return { error: 'Enter a valid non-negative total amount.' as string };
    const n = Number(people.trim());
    if (!Number.isInteger(n) || n < 1) return { error: 'Number of people must be a positive integer.' };
    if (n > 1000) return { error: 'Keep the number of people at or below 1000.' };

    let weights: number[];
    if (useWeights) {
      weights = weightsRaw
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (weights.length !== n) {
        return { error: `Provide exactly ${n} weights (you gave ${weights.length}).` };
      }
      if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
        return { error: 'Weights must be non-negative numbers.' };
      }
      if (weights.reduce((a, b) => a + b, 0) <= 0) {
        return { error: 'At least one weight must be greater than zero.' };
      }
    } else {
      weights = Array.from({ length: n }, () => 1);
    }

    const totalCents = Math.round(amt * 100);

    let cents: number[];
    if (rounding === 'even') {
      const base = Math.floor(totalCents / n);
      cents = Array.from({ length: n }, () => base);
      // even mode ignores weights; leftover stays distributed to first people for exactness
      let rem = totalCents - base * n;
      for (let i = 0; i < n && rem > 0; i++) {
        cents[i] = (cents[i] ?? base) + 1;
        rem -= 1;
      }
    } else if (rounding === 'up') {
      // Round each proportional share up to a whole currency unit.
      const sumW = weights.reduce((a, b) => a + b, 0);
      cents = weights.map((w) => Math.ceil((amt * w) / sumW) * 100);
    } else {
      cents = splitCents(totalCents, weights);
    }

    const shares: Share[] = weights.map((w, i) => ({
      person: `Person ${i + 1}`,
      weight: w,
      amount: (cents[i] ?? 0) / 100,
    }));

    const distributed = shares.reduce((a, s) => a + Math.round(s.amount * 100), 0) / 100;
    const exact = Math.abs(distributed - amt) < 0.0001;

    return { shares, distributed, exact, requested: amt };
  }, [total, people, useWeights, weightsRaw, rounding]);

  const money = (n: number) => n.toFixed(2);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Total amount" className="min-w-[140px]">
            <Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="100.00" />
          </Field>
          <Field label="People" className="min-w-[100px]">
            <Input value={people} onChange={(e) => setPeople(e.target.value)} inputMode="numeric" placeholder="3" />
          </Field>
          <Field label="Rounding" className="min-w-[200px]">
            <Select value={rounding} onValueChange={(v) => setRounding(v as Rounding)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROUNDING_LABEL) as Rounding[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ROUNDING_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Weighted shares">
            <Switch checked={useWeights} onCheckedChange={setUseWeights} />
          </Field>
        </OptionsBar>
        {useWeights && (
          <div className="px-3 pb-3">
            <Field label="Weights (one per person, comma/space separated)">
              <Input value={weightsRaw} onChange={(e) => setWeightsRaw(e.target.value)} placeholder="1, 2, 1" />
            </Field>
          </div>
        )}
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Per-person split">
            <CopyButton
              value={() => result.shares.map((s) => `${s.person}: ${money(s.amount)}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            {result.shares.map((s) => (
              <div
                key={s.person}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">
                  {s.person}
                  {useWeights ? ` (×${s.weight})` : ''}
                </span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{money(s.amount)}</span>
                  <CopyButton value={money(s.amount)} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Requested: ${money(result.requested)}`,
              `Distributed: ${money(result.distributed)}`,
              result.exact ? 'Sums exactly ✓' : 'Differs from total',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
