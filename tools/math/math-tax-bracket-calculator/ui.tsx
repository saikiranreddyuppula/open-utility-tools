'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Bracket {
  id: number;
  from: string; // lower threshold (income at/above which this rate begins)
  rate: string; // marginal rate %
}

let nextId = 5;

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TaxBracketCalculatorTool() {
  const [income, setIncome] = useState('85000');
  const [brackets, setBrackets] = useState<Bracket[]>([
    { id: 1, from: '0', rate: '10' },
    { id: 2, from: '11000', rate: '12' },
    { id: 3, from: '44725', rate: '22' },
    { id: 4, from: '95375', rate: '24' },
  ]);

  const update = (id: number, field: 'from' | 'rate', value: string) => {
    setBrackets((bs) => bs.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };
  const addBracket = () => {
    setBrackets((bs) => [...bs, { id: nextId++, from: '', rate: '' }]);
  };
  const removeBracket = (id: number) => {
    setBrackets((bs) => bs.filter((b) => b.id !== id));
  };

  const result = useMemo(() => {
    const inc = num(income);
    if (inc == null || inc < 0) return { error: 'Enter a non-negative taxable income.' };

    const parsed: { from: number; rate: number }[] = [];
    for (const b of brackets) {
      const from = num(b.from);
      const rate = num(b.rate);
      if (from == null || rate == null) continue;
      if (from < 0 || rate < 0) return { error: 'Thresholds and rates must be non-negative.' };
      parsed.push({ from, rate });
    }
    if (parsed.length === 0) return { error: 'Add at least one bracket with a threshold and rate.' };

    parsed.sort((a, b) => a.from - b.from);

    // Build upper bounds: each bracket ends where the next begins.
    const rows: {
      from: number;
      to: number | null;
      rate: number;
      taxableInBand: number;
      taxInBand: number;
    }[] = [];

    let total = 0;
    let marginalRate = 0;
    for (let i = 0; i < parsed.length; i++) {
      const cur = parsed[i];
      if (!cur) continue;
      const next = parsed[i + 1];
      const upper = next ? next.from : null;
      const bandFrom = cur.from;
      const bandTo = upper;

      let taxable = 0;
      if (inc > bandFrom) {
        const effectiveTop = bandTo == null ? inc : Math.min(inc, bandTo);
        taxable = Math.max(0, effectiveTop - bandFrom);
      }
      const tax = taxable * (cur.rate / 100);
      total += tax;
      if (inc > bandFrom) marginalRate = cur.rate;

      rows.push({
        from: bandFrom,
        to: bandTo,
        rate: cur.rate,
        taxableInBand: taxable,
        taxInBand: tax,
      });
    }

    const effective = inc > 0 ? (total / inc) * 100 : 0;
    const afterTax = inc - total;

    return { inc, total, effective, marginalRate, afterTax, rows };
  }, [income, brackets]);

  const tableText = useMemo(() => {
    if ('error' in result) return '';
    const header = 'From\tTo\tRate\tTaxable\tTax';
    const lines = result.rows.map(
      (r) =>
        `${r.from}\t${r.to ?? '∞'}\t${r.rate}%\t${money(r.taxableInBand)}\t${money(r.taxInBand)}`
    );
    return [header, ...lines, `Total\t\t\t\t${money(result.total)}`].join('\n');
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Taxable income" htmlFor="tb-income">
          <Input
            id="tb-income"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-36 font-mono"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Brackets (threshold = income where this marginal rate begins)">
          <Button variant="secondary" size="sm" onClick={addBracket}>
            <Plus className="size-3.5" /> Add bracket
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-2 p-3">
          {brackets.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">From</span>
              <Input
                value={b.from}
                onChange={(e) => update(b.id, 'from', e.target.value)}
                type="number"
                min="0"
                className="h-8 w-32 font-mono"
              />
              <span className="shrink-0 text-xs text-muted-foreground">Rate %</span>
              <Input
                value={b.rate}
                onChange={(e) => update(b.id, 'rate', e.target.value)}
                type="number"
                min="0"
                className="h-8 w-24 font-mono"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeBracket(b.id)}
                aria-label="Remove bracket"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Panel>
              <PanelHeader title="Total tax">
                <CopyButton value={() => result.total.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-xl font-semibold tabular text-primary">
                {money(result.total)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="After tax" />
              <div className="px-3 py-4 font-mono text-xl font-semibold tabular">
                {money(result.afterTax)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Effective rate" />
              <div className="px-3 py-4 font-mono text-xl font-semibold tabular">
                {result.effective.toFixed(2)}%
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Marginal rate" />
              <div className="px-3 py-4 font-mono text-xl font-semibold tabular">
                {result.marginalRate.toFixed(2)}%
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Per-bracket breakdown">
              <CopyButton value={() => tableText} label="Copy" size="sm" />
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead>
                  <tr className="border-b bg-muted/30 text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-right">From</th>
                    <th className="px-3 py-2 text-right">To</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-right font-mono">{money(r.from)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {r.to == null ? '∞' : money(r.to)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.rate}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {money(r.taxableInBand)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-primary">
                        {money(r.taxInBand)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar items={[`${result.rows.length} bracket${result.rows.length === 1 ? '' : 's'}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
