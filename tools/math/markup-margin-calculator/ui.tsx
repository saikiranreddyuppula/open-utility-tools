'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

type Result =
  | { error: string }
  | {
      cost: number;
      price: number;
      profit: number;
      markup: number;
      margin: number;
    };

function num(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarkupMarginCalculator() {
  // Two of these are entered; the rest are solved.
  const [cost, setCost] = useState('80');
  const [price, setPrice] = useState('100');
  const [markup, setMarkup] = useState('');
  const [margin, setMargin] = useState('');
  const [profit, setProfit] = useState('');

  const result = useMemo<Result>(() => {
    const c = num(cost);
    const p = num(price);
    const mu = num(markup);
    const mg = num(margin);
    const pf = num(profit);

    const fields = [c, p, mu, mg, pf];
    if (fields.some((f) => Number.isNaN(f))) return { error: 'All entered values must be valid numbers.' };

    const provided = fields.filter((f) => f !== null) as number[];
    if (provided.length < 2) return { error: 'Enter any two values to solve for the rest.' };

    let C: number | null = c;
    let P: number | null = p;

    // Resolve cost (C) and price (P) from whatever pair is given.
    if (C !== null && P !== null) {
      // already have both
    } else if (C !== null && mu !== null) {
      P = C * (1 + mu / 100);
    } else if (C !== null && mg !== null) {
      if (mg >= 100) return { error: 'Margin must be below 100%.' };
      P = C / (1 - mg / 100);
    } else if (C !== null && pf !== null) {
      P = C + pf;
    } else if (P !== null && mu !== null) {
      C = P / (1 + mu / 100);
    } else if (P !== null && mg !== null) {
      if (mg >= 100) return { error: 'Margin must be below 100%.' };
      C = P * (1 - mg / 100);
    } else if (P !== null && pf !== null) {
      C = P - pf;
    } else if (pf !== null && mu !== null) {
      // profit = cost * markup/100  => cost = profit / (markup/100)
      if (mu === 0) return { error: 'Markup of 0% with a profit is inconsistent.' };
      C = pf / (mu / 100);
      P = C + pf;
    } else if (pf !== null && mg !== null) {
      // profit = price * margin/100 => price = profit / (margin/100)
      if (mg === 0) return { error: 'Margin of 0% with a profit is inconsistent.' };
      P = pf / (mg / 100);
      C = P - pf;
    } else if (mu !== null && mg !== null) {
      return { error: 'Markup and margin alone do not fix the dollar amounts; add cost, price, or profit.' };
    } else {
      return { error: 'Enter a pair that includes a dollar amount (cost, price, or profit).' };
    }

    if (C === null || P === null) return { error: 'Could not resolve cost and price from inputs.' };
    if (C <= 0) return { error: 'Cost must be greater than 0.' };
    if (P <= 0) return { error: 'Price must be greater than 0.' };

    const profitAmt = P - C;
    const markupPct = (profitAmt / C) * 100;
    const marginPct = (profitAmt / P) * 100;

    return { cost: C, price: P, profit: profitAmt, markup: markupPct, margin: marginPct };
  }, [cost, price, markup, margin, profit]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Enter any two values" />
        <OptionsBar>
          <Field label="Cost ($)">
            <Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="80" />
          </Field>
          <Field label="Selling price ($)">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="100" />
          </Field>
          <Field label="Profit ($)">
            <Input value={profit} onChange={(e) => setProfit(e.target.value)} inputMode="decimal" placeholder="" />
          </Field>
          <Field label="Markup (%)">
            <Input value={markup} onChange={(e) => setMarkup(e.target.value)} inputMode="decimal" placeholder="" />
          </Field>
          <Field label="Margin (%)">
            <Input value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" placeholder="" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                [
                  `Cost: ${fmt(result.cost)}`,
                  `Price: ${fmt(result.price)}`,
                  `Profit: ${fmt(result.profit)}`,
                  `Markup: ${result.markup.toFixed(2)}%`,
                  `Margin: ${result.margin.toFixed(2)}%`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Cost', value: fmt(result.cost) },
              { label: 'Selling price', value: fmt(result.price) },
              { label: 'Profit', value: fmt(result.profit) },
              { label: 'Markup %', value: `${result.markup.toFixed(2)} %` },
              { label: 'Margin %', value: `${result.margin.toFixed(2)} %` },
            ].map((r) => (
              <div key={r.label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
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
              'Markup = profit / cost',
              'Margin = profit / price',
              'Markup is always larger than margin',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
