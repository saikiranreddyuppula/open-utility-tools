'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

export default function CagrCalculatorTool() {
  const [begin, setBegin] = useState('10000');
  const [end, setEnd] = useState('25000');
  const [years, setYears] = useState('5');

  const result = useMemo(() => {
    const bv = Number(begin);
    const ev = Number(end);
    const yr = Number(years);

    if (!Number.isFinite(bv) || !Number.isFinite(ev) || !Number.isFinite(yr)) {
      return { error: 'Enter valid numbers for all fields.' };
    }
    if (bv <= 0) return { error: 'Beginning value must be greater than zero.' };
    if (ev <= 0) return { error: 'Ending value must be greater than zero.' };
    if (yr <= 0) return { error: 'Number of years must be greater than zero.' };

    const ratio = ev / bv;
    const cagr = (Math.pow(ratio, 1 / yr) - 1) * 100;
    const totalReturn = (ev - bv) / bv * 100;

    // Doubling time
    const rule72 = cagr !== 0 ? 72 / cagr : Infinity;
    const exactDouble = cagr > -100 ? Math.log(2) / Math.log(1 + cagr / 100) : Infinity;

    const rows: { label: string; value: string }[] = [
      { label: 'CAGR', value: `${cagr.toFixed(4)}%` },
      { label: 'Total return', value: `${totalReturn.toFixed(2)}%` },
      { label: 'Growth multiple', value: `${ratio.toFixed(4)}×` },
    ];
    if (Number.isFinite(rule72) && cagr > 0) {
      rows.push({ label: 'Doubling time (Rule of 72)', value: `${rule72.toFixed(2)} yrs` });
    }
    if (Number.isFinite(exactDouble) && exactDouble > 0) {
      rows.push({ label: 'Doubling time (exact)', value: `${exactDouble.toFixed(2)} yrs` });
    }

    // Verify: begin grown at CAGR for yr years should reproduce end.
    const check = bv * Math.pow(1 + cagr / 100, yr);

    return { rows, check };
  }, [begin, end, years]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Beginning value">
            <Input
              value={begin}
              onChange={(e) => setBegin(e.target.value)}
              inputMode="decimal"
              className="w-36 font-mono"
            />
          </Field>
          <Field label="Ending value">
            <Input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              inputMode="decimal"
              className="w-36 font-mono"
            />
          </Field>
          <Field label="Years">
            <Input
              value={years}
              onChange={(e) => setYears(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
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
              `Check: ${result.check.toLocaleString(undefined, { maximumFractionDigits: 2 })} ≈ ending value`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
