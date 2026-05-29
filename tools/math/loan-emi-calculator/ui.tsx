'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TermUnit = 'years' | 'months';

function parsePositive(raw: string, name: string, allowZero = false): number {
  const s = raw.trim();
  if (s === '') throw new Error(`${name} is required.`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  if (n < 0) throw new Error(`${name} must not be negative.`);
  if (!allowZero && n <= 0) throw new Error(`${name} must be greater than 0.`);
  return n;
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LoanEmiCalculatorTool() {
  const [principalRaw, setPrincipalRaw] = useState('250000');
  const [rateRaw, setRateRaw] = useState('6.5');
  const [termRaw, setTermRaw] = useState('30');
  const [termUnit, setTermUnit] = useState<TermUnit>('years');

  const result = useMemo(() => {
    try {
      const principal = parsePositive(principalRaw, 'Principal');
      const annualRate = parsePositive(rateRaw, 'Annual interest rate', true);
      const term = parsePositive(termRaw, 'Term');

      const months = termUnit === 'years' ? Math.round(term * 12) : Math.round(term);
      if (months <= 0) throw new Error('Term must result in at least 1 month.');

      const monthlyRate = annualRate / 100 / 12;

      let emi: number;
      if (monthlyRate === 0) {
        emi = principal / months;
      } else {
        const factor = Math.pow(1 + monthlyRate, months);
        emi = (principal * monthlyRate * factor) / (factor - 1);
      }

      const totalPayment = emi * months;
      const totalInterest = totalPayment - principal;

      return {
        error: null as string | null,
        emi,
        totalPayment,
        totalInterest,
        principal,
        months,
        interestPct: totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        emi: 0,
        totalPayment: 0,
        totalInterest: 0,
        principal: 0,
        months: 0,
        interestPct: 0,
      };
    }
  }, [principalRaw, rateRaw, termRaw, termUnit]);

  const copyValue = result.error
    ? ''
    : [
        `Monthly payment (EMI): ${money(result.emi)}`,
        `Total payment: ${money(result.totalPayment)}`,
        `Total interest: ${money(result.totalInterest)}`,
        `Principal: ${money(result.principal)}`,
        `Number of payments: ${result.months}`,
      ].join('\n');

  return (
    <Panel>
      <PanelHeader title="Loan & EMI Calculator" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="loan-principal">Loan amount</Label>
          <Input
            id="loan-principal"
            inputMode="decimal"
            value={principalRaw}
            onChange={(e) => setPrincipalRaw(e.target.value)}
            placeholder="e.g. 250000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loan-rate">Annual interest rate (%)</Label>
          <Input
            id="loan-rate"
            inputMode="decimal"
            value={rateRaw}
            onChange={(e) => setRateRaw(e.target.value)}
            placeholder="e.g. 6.5"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loan-term">Term</Label>
          <Input
            id="loan-term"
            inputMode="decimal"
            value={termRaw}
            onChange={(e) => setTermRaw(e.target.value)}
            placeholder="e.g. 30"
          />
        </div>
      </div>

      <OptionsBar>
        <Field label="Term unit">
          <Tabs value={termUnit} onValueChange={(v) => setTermUnit(v as TermUnit)}>
            <TabsList>
              <TabsTrigger value="years">Years</TabsTrigger>
              <TabsTrigger value="months">Months</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {!result.error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-4">
            <div>
              <div className="text-xs text-muted-foreground">Monthly payment (EMI)</div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                {money(result.emi)}
              </div>
            </div>
            <CopyButton value={copyValue} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total payment</div>
              <div className="font-mono tabular-nums">{money(result.totalPayment)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total interest</div>
              <div className="font-mono tabular-nums">{money(result.totalInterest)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Payments</div>
              <div className="font-mono tabular-nums">{result.months}</div>
            </div>
          </div>

          <StatBar
            items={[
              `principal: ${money(result.principal)}`,
              `interest share: ${(Math.round(result.interestPct * 100) / 100).toString()}%`,
              `${result.months} monthly payments`,
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
