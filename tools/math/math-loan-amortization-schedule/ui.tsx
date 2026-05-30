'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
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

type TermUnit = 'years' | 'months';

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

interface Row {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

interface Result {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  rows: Row[];
}

export default function LoanAmortizationScheduleTool() {
  const [principal, setPrincipal] = useState('250000');
  const [rate, setRate] = useState('6.5');
  const [term, setTerm] = useState('30');
  const [unit, setUnit] = useState<TermUnit>('years');

  const result = useMemo<{ error: string } | Result>(() => {
    const p = num(principal);
    const r = num(rate);
    const t = num(term);

    if (p == null || p <= 0) return { error: 'Enter a positive loan principal.' };
    if (r == null || r < 0) return { error: 'Enter a non-negative interest rate.' };
    if (t == null || t <= 0) return { error: 'Enter a positive loan term.' };

    const months = unit === 'years' ? Math.round(t * 12) : Math.round(t);
    if (months < 1) return { error: 'Term must be at least one month.' };
    if (months > 1200) return { error: 'Term is too large (max 1200 months).' };

    const i = r / 100 / 12; // monthly rate

    // Level monthly payment via standard annuity formula.
    let payment: number;
    if (i === 0) {
      payment = p / months;
    } else {
      const factor = Math.pow(1 + i, months);
      payment = (p * i * factor) / (factor - 1);
    }

    const rows: Row[] = [];
    let balance = p;
    let totalInterest = 0;
    let totalPaid = 0;

    for (let period = 1; period <= months; period++) {
      const interest = balance * i;
      let principalPart = payment - interest;
      // On the final period absorb rounding so balance ends at exactly zero.
      if (period === months) {
        principalPart = balance;
      }
      const thisPayment = principalPart + interest;
      balance = balance - principalPart;
      if (balance < 0) balance = 0;
      totalInterest += interest;
      totalPaid += thisPayment;
      rows.push({
        period,
        payment: thisPayment,
        interest,
        principal: principalPart,
        balance,
      });
    }

    return {
      monthlyPayment: payment,
      totalPaid,
      totalInterest,
      rows,
    };
  }, [principal, rate, term, unit]);

  const tableText = useMemo(() => {
    if ('error' in result) return '';
    const header = 'Period\tPayment\tInterest\tPrincipal\tBalance';
    const lines = result.rows.map(
      (row) =>
        `${row.period}\t${money(row.payment)}\t${money(row.interest)}\t${money(
          row.principal
        )}\t${money(row.balance)}`
    );
    return [header, ...lines].join('\n');
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Loan principal" htmlFor="la-principal">
          <Input
            id="la-principal"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-36 font-mono"
          />
        </Field>
        <Field label="Annual rate (%)" htmlFor="la-rate">
          <Input
            id="la-rate"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            type="number"
            className="h-8 w-24 font-mono"
          />
        </Field>
        <Field label="Term" htmlFor="la-term">
          <Input
            id="la-term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-24 font-mono"
          />
        </Field>
        <Field label="Term unit">
          <Select value={unit} onValueChange={(v) => setUnit(v as TermUnit)}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="years">Years</SelectItem>
              <SelectItem value="months">Months</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <PanelHeader title="Monthly payment">
                <CopyButton value={() => result.monthlyPayment.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular text-primary">
                {money(result.monthlyPayment)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Total interest">
                <CopyButton value={() => result.totalInterest.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular">
                {money(result.totalInterest)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Total paid">
                <CopyButton value={() => result.totalPaid.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular">
                {money(result.totalPaid)}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Amortization schedule">
              <CopyButton value={() => tableText} label="Copy" size="sm" />
            </PanelHeader>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-sm tabular">
                <thead className="sticky top-0">
                  <tr className="border-b bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-right">Payment</th>
                    <th className="px-3 py-2 text-right">Interest</th>
                    <th className="px-3 py-2 text-right">Principal</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((row) => (
                    <tr key={row.period}>
                      <td className="px-3 py-1.5 font-mono">{row.period}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {money(row.payment)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-primary">
                        {money(row.interest)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {money(row.principal)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        {money(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar
              items={[
                `${result.rows.length} payment${result.rows.length === 1 ? '' : 's'}`,
                `Interest ${
                  result.totalPaid > 0
                    ? ((result.totalInterest / result.totalPaid) * 100).toFixed(1)
                    : '0.0'
                }% of total`,
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
