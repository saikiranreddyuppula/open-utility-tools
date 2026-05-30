'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function RoiCalculatorTool() {
  const [cost, setCost] = useState('10000');
  const [final, setFinal] = useState('13500');
  const [years, setYears] = useState('3');

  const result = useMemo(() => {
    const c = Number(cost);
    const f = Number(final);

    if (!Number.isFinite(c) || !Number.isFinite(f)) {
      return { error: 'Enter valid numbers for the investment and return value.' };
    }
    if (c <= 0) return { error: 'Initial investment must be greater than zero.' };

    const gain = f - c;
    const roi = (gain / c) * 100;

    const rows: { label: string; value: string }[] = [
      { label: gain >= 0 ? 'Net profit' : 'Net loss', value: money(gain) },
      { label: 'Simple ROI', value: `${roi.toFixed(2)}%` },
      { label: 'Return multiple', value: `${(f / c).toFixed(4)}×` },
    ];

    // Annualized ROI only when a positive holding period is supplied.
    const hasYears = years.trim() !== '';
    const yr = Number(years);
    let annualized: number | null = null;
    if (hasYears) {
      if (!Number.isFinite(yr) || yr <= 0) {
        return { error: 'Holding period must be a positive number of years (or leave it blank).' };
      }
      if (f <= 0) {
        // Total loss / negative final value cannot be annualized with a real root.
        annualized = null;
      } else {
        annualized = (Math.pow(f / c, 1 / yr) - 1) * 100;
        rows.push({ label: 'Annualized ROI', value: `${annualized.toFixed(2)}%` });
      }
    }

    return { rows, gain, roi, annualized, hasYears };
  }, [cost, final, years]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Initial investment (cost)">
            <Input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="decimal"
              className="w-36 font-mono"
            />
          </Field>
          <Field label="Final / return value">
            <Input
              value={final}
              onChange={(e) => setFinal(e.target.value)}
              inputMode="decimal"
              className="w-36 font-mono"
            />
          </Field>
          <Field label="Holding period (years — optional)">
            <Input
              value={years}
              onChange={(e) => setYears(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
              placeholder="e.g. 3"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
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
              result.gain >= 0 ? 'Profitable' : 'At a loss',
              result.hasYears && result.annualized === null
                ? 'Annualized ROI undefined for a non-positive final value'
                : `Simple ROI ${result.roi.toFixed(2)}%`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
