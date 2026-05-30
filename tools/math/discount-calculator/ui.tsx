'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Result =
  | { error: string }
  | {
      rows: { label: string; value: string }[];
      steps: string[];
      naive: number;
    };

export default function DiscountCalculator() {
  const [price, setPrice] = useState('120');
  const [discounts, setDiscounts] = useState('20, 10');
  const [flat, setFlat] = useState('5');

  const result = useMemo<Result>(() => {
    const original = Number(price);
    if (!Number.isFinite(original)) return { error: 'Enter a valid original price.' };
    if (original < 0) return { error: 'Original price cannot be negative.' };

    const pcts = discounts
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number);
    for (const p of pcts) {
      if (!Number.isFinite(p)) return { error: 'Each discount must be a valid number.' };
      if (p < 0 || p > 100) return { error: 'Each discount percent must be between 0 and 100.' };
    }

    const flatAmt = flat.trim() === '' ? 0 : Number(flat);
    if (!Number.isFinite(flatAmt) || flatAmt < 0) {
      return { error: 'Flat discount must be a non-negative number.' };
    }

    let running = original;
    const steps: string[] = [`Start: ${fmtMoney(original)}`];
    let summedPct = 0;
    for (const p of pcts) {
      const before = running;
      running = running * (1 - p / 100);
      summedPct += p;
      steps.push(`−${p}%: ${fmtMoney(before)} × ${(1 - p / 100).toFixed(4)} = ${fmtMoney(running)}`);
    }
    if (flatAmt > 0) {
      const before = running;
      running = Math.max(0, running - flatAmt);
      steps.push(`−${fmtMoney(flatAmt)} flat: ${fmtMoney(before)} − ${fmtMoney(flatAmt)} = ${fmtMoney(running)}`);
    }

    const final = Math.max(0, running);
    const savings = original - final;
    const effective = original === 0 ? 0 : (savings / original) * 100;
    const naive = summedPct; // what people wrongly assume stacked % add up to

    return {
      rows: [
        { label: 'Final sale price', value: fmtMoney(final) },
        { label: 'Total savings', value: fmtMoney(savings) },
        { label: 'Effective discount', value: `${effective.toFixed(2)} %` },
      ],
      steps,
      naive,
    };
  }, [price, discounts, flat]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Original price">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Discount % (stack, comma separated)">
            <Input value={discounts} onChange={(e) => setDiscounts(e.target.value)} placeholder="20, 10" />
          </Field>
          <Field label="Flat amount off (optional)">
            <Input value={flat} onChange={(e) => setFlat(e.target.value)} inputMode="decimal" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-2xs text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                    <span>{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `Stacking ≠ adding: 20% + 10% is not 30%`,
                `Summed percents = ${result.naive}%`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Step by step" />
            <div className="space-y-1 p-3 font-mono text-xs">
              {result.steps.map((s, i) => (
                <div key={i} className="text-muted-foreground">
                  {s}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
