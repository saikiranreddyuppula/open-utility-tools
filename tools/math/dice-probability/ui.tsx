'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TargetMode = 'exact' | 'atleast' | 'atmost' | 'range';

const MODE_LABEL: Record<TargetMode, string> = {
  exact: 'Sum equals',
  atleast: 'Sum at least',
  atmost: 'Sum at most',
  range: 'Sum within range',
};

function bgcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Build the sum distribution of n dice with s sides via convolution.
// counts[k] = number of ways to roll sum (n + k), k from 0..n*(s-1).
function sumDistribution(n: number, s: number): bigint[] {
  let dist: bigint[] = [1n]; // 0 dice => 1 way for "sum 0" offset
  for (let d = 0; d < n; d++) {
    const next: bigint[] = new Array<bigint>(dist.length + (s - 1)).fill(0n);
    for (let i = 0; i < dist.length; i++) {
      const c = dist[i] ?? 0n;
      if (c === 0n) continue;
      for (let f = 0; f < s; f++) {
        next[i + f] = (next[i + f] ?? 0n) + c;
      }
    }
    dist = next;
  }
  return dist;
}

export default function DiceProbabilityTool() {
  const [dice, setDice] = useState('2');
  const [sides, setSides] = useState('6');
  const [mode, setMode] = useState<TargetMode>('exact');
  const [target, setTarget] = useState('7');
  const [rangeHi, setRangeHi] = useState('9');

  const result = useMemo(() => {
    const n = Number(dice.trim());
    const s = Number(sides.trim());
    if (!Number.isInteger(n) || n < 1) return { error: 'Number of dice must be a positive integer.' as string };
    if (!Number.isInteger(s) || s < 2) return { error: 'Sides per die must be an integer ≥ 2.' };
    if (n > 200) return { error: 'Keep the number of dice at or below 200.' };
    if (s > 1000) return { error: 'Keep sides per die at or below 1000.' };
    if (n * s > 20000) return { error: 'Combined size too large; reduce dice or sides.' };

    const dist = sumDistribution(n, s);
    const minSum = n;
    const maxSum = n * s;
    // Total outcomes = s^n
    let total = 1n;
    for (let i = 0; i < n; i++) total *= BigInt(s);

    const lo = Number(target.trim());
    if (!Number.isInteger(lo)) return { error: 'Target sum must be an integer.' };

    let favorable = 0n;
    let label = '';

    const ways = (sum: number): bigint => {
      const idx = sum - minSum;
      if (idx < 0 || idx >= dist.length) return 0n;
      return dist[idx] ?? 0n;
    };

    if (mode === 'exact') {
      favorable = ways(lo);
      label = `P(sum = ${lo})`;
    } else if (mode === 'atleast') {
      for (let sum = lo; sum <= maxSum; sum++) favorable += ways(sum);
      label = `P(sum ≥ ${lo})`;
    } else if (mode === 'atmost') {
      for (let sum = minSum; sum <= lo; sum++) favorable += ways(sum);
      label = `P(sum ≤ ${lo})`;
    } else {
      const hi = Number(rangeHi.trim());
      if (!Number.isInteger(hi)) return { error: 'Range upper bound must be an integer.' };
      const a = Math.min(lo, hi);
      const b = Math.max(lo, hi);
      for (let sum = a; sum <= b; sum++) favorable += ways(sum);
      label = `P(${a} ≤ sum ≤ ${b})`;
    }

    if (favorable < 0n) favorable = 0n;
    if (favorable > total) favorable = total;

    const g = bgcd(favorable, total);
    const fracNum = g === 0n ? favorable : favorable / g;
    const fracDen = g === 0n ? total : total / g;
    const decimal = total === 0n ? 0 : Number(favorable) / Number(total);
    const percent = decimal * 100;
    const againstNum = total - favorable;
    const oddsStr =
      favorable === 0n
        ? 'impossible'
        : favorable === total
          ? 'certain'
          : `${(againstNum / (g || 1n)).toString()} : ${fracNum.toString()} against`;

    // Distribution table (cap rows to keep it light).
    const rows: { sum: number; ways: bigint; prob: number }[] = [];
    for (let sum = minSum; sum <= maxSum; sum++) {
      const w = ways(sum);
      rows.push({ sum, ways: w, prob: total === 0n ? 0 : Number(w) / Number(total) });
    }

    return {
      label,
      favorable,
      total,
      fracNum,
      fracDen,
      decimal,
      percent,
      oddsStr,
      rows,
      minSum,
      maxSum,
    };
  }, [dice, sides, mode, target, rangeHi]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number of dice" className="min-w-[110px]">
            <Input value={dice} onChange={(e) => setDice(e.target.value)} inputMode="numeric" placeholder="2" />
          </Field>
          <Field label="Sides per die" className="min-w-[110px]">
            <Input value={sides} onChange={(e) => setSides(e.target.value)} inputMode="numeric" placeholder="6" />
          </Field>
          <Field label="Target" className="min-w-[170px]">
            <Select value={mode} onValueChange={(v) => setMode(v as TargetMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABEL) as TargetMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {MODE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={mode === 'range' ? 'From' : 'Sum'} className="min-w-[90px]">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder="7" />
          </Field>
          {mode === 'range' && (
            <Field label="To" className="min-w-[90px]">
              <Input value={rangeHi} onChange={(e) => setRangeHi(e.target.value)} inputMode="numeric" placeholder="9" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title={result.label}>
              <CopyButton
                value={() =>
                  [
                    `Fraction: ${result.fracNum.toString()}/${result.fracDen.toString()}`,
                    `Decimal: ${result.decimal}`,
                    `Percent: ${result.percent.toFixed(4)}%`,
                    `Odds: ${result.oddsStr}`,
                  ].join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {[
                { label: 'Probability (fraction)', value: `${result.fracNum.toString()}/${result.fracDen.toString()}` },
                { label: 'Probability (decimal)', value: result.decimal.toPrecision(8) },
                { label: 'Probability (percent)', value: `${result.percent.toFixed(4)}%` },
                { label: 'Odds', value: result.oddsStr },
                { label: 'Favorable outcomes', value: result.favorable.toString() },
                { label: 'Total outcomes', value: result.total.toString() },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className="break-all text-right">{row.value}</span>
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`Possible sums ${result.minSum}–${result.maxSum}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Sum distribution" />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Sum</th>
                    <th className="px-3 py-2 text-left">Ways</th>
                    <th className="px-3 py-2 text-left">Probability</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((r) => (
                    <tr key={r.sum}>
                      <td className="px-3 py-1.5 font-mono">{r.sum}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.ways.toString()}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {(r.prob * 100).toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar items={[`${result.rows.length} possible sums`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
