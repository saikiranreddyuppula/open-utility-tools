'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function BreakEvenCalculatorTool() {
  const [fixed, setFixed] = useState('50000');
  const [variable, setVariable] = useState('15');
  const [price, setPrice] = useState('40');
  const [targetUnits, setTargetUnits] = useState('5000');

  const result = useMemo(() => {
    const f = Number(fixed);
    const v = Number(variable);
    const p = Number(price);
    if (!Number.isFinite(f) || !Number.isFinite(v) || !Number.isFinite(p)) {
      return { error: 'Enter valid numbers for all cost and price fields.' };
    }
    if (f < 0 || v < 0 || p < 0) return { error: 'Costs and price must be non-negative.' };
    const cm = p - v;
    if (cm <= 0) {
      return { error: 'Selling price must be greater than variable cost per unit.' };
    }

    const beUnits = f / cm;
    const beRevenue = beUnits * p;
    const cmRatio = (cm / p) * 100;

    // Profit-at-volume table around break-even and the target volume
    const tu = Number(targetUnits);
    const targetValid = Number.isFinite(tu) && tu >= 0;
    const samplePoints = [
      0,
      Math.round(beUnits * 0.5),
      Math.ceil(beUnits),
      Math.round(beUnits * 1.5),
      Math.round(beUnits * 2),
    ];
    if (targetValid) samplePoints.push(Math.round(tu));
    const uniqueSorted = Array.from(new Set(samplePoints)).sort((a, b) => a - b);

    const table = uniqueSorted.map((u) => {
      const revenue = u * p;
      const totalCost = f + u * v;
      const profit = revenue - totalCost;
      return {
        units: u,
        revenue: money(revenue),
        profit: money(profit),
        positive: profit >= 0,
      };
    });

    const targetProfit = targetValid ? tu * p - (f + tu * v) : null;

    return {
      rows: [
        { label: 'Break-even units', value: beUnits.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
        { label: 'Break-even revenue', value: money(beRevenue) },
        { label: 'Contribution margin / unit', value: money(cm) },
        { label: 'Contribution margin %', value: `${cmRatio.toFixed(2)}%` },
      ],
      table,
      targetUnitsNum: targetValid ? tu : null,
      targetProfit,
    };
  }, [fixed, variable, price, targetUnits]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Fixed costs">
            <Input
              value={fixed}
              onChange={(e) => setFixed(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Variable cost / unit">
            <Input
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Selling price / unit">
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Target units">
            <Input
              value={targetUnits}
              onChange={(e) => setTargetUnits(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Break-even analysis">
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
            {result.targetProfit !== null && result.targetUnitsNum !== null && (
              <StatBar
                items={[
                  `At ${result.targetUnitsNum.toLocaleString()} units`,
                  `Profit = ${money(result.targetProfit)}`,
                ]}
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Profit at volume" />
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-2xs uppercase text-muted-foreground">
                    <th className="px-3 py-2 text-left">Units</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Profit / (Loss)</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.table.map((row) => (
                    <tr key={row.units} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.units.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{row.revenue}</td>
                      <td
                        className={
                          'px-3 py-2 text-right ' +
                          (row.positive ? 'text-success' : 'text-destructive')
                        }
                      >
                        {row.profit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
