'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Schedule {
  months: number;
  totalInterest: number;
}

interface Ok {
  ok: true;
  payment: number;
  baseline: Schedule;
  withExtra: Schedule;
  monthsSaved: number;
  interestSaved: number;
}

interface Err {
  ok: false;
  error: string;
}

const MAX_MONTHS = 1200; // 100 years safety cap

function simulate(principal: number, monthlyRate: number, payment: number, extra: number): Schedule {
  let balance = principal;
  let totalInterest = 0;
  let months = 0;
  const perMonth = payment + extra;
  while (balance > 0.005 && months < MAX_MONTHS) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    let principalPaid = perMonth - interest;
    if (principalPaid > balance) principalPaid = balance;
    balance -= principalPaid;
    months += 1;
  }
  return { months, totalInterest };
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMonths(m: number): string {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} yr`);
  if (mo > 0) parts.push(`${mo} mo`);
  if (parts.length === 0) parts.push('0 mo');
  return `${m} months (${parts.join(' ')})`;
}

export default function MortgageExtraPaymentTool() {
  const [principalRaw, setPrincipalRaw] = useState('300000');
  const [rateRaw, setRateRaw] = useState('6.5');
  const [yearsRaw, setYearsRaw] = useState('30');
  const [extraRaw, setExtraRaw] = useState('200');

  const result = useMemo<Ok | Err>(() => {
    const principal = Number(principalRaw);
    const annualRate = Number(rateRaw);
    const years = Number(yearsRaw);
    const extra = Number(extraRaw);

    if (![principal, annualRate, years, extra].every((n) => Number.isFinite(n))) {
      return { ok: false, error: 'Enter valid numbers for all fields.' };
    }
    if (principal <= 0) return { ok: false, error: 'Loan principal must be greater than zero.' };
    if (years <= 0) return { ok: false, error: 'Term in years must be greater than zero.' };
    if (annualRate < 0) return { ok: false, error: 'Annual rate cannot be negative.' };
    if (extra < 0) return { ok: false, error: 'Extra payment cannot be negative.' };

    const n = Math.round(years * 12);
    const i = annualRate / 12 / 100;

    let payment: number;
    if (i === 0) {
      payment = principal / n;
    } else {
      payment = (principal * i) / (1 - Math.pow(1 + i, -n));
    }
    if (!Number.isFinite(payment) || payment <= 0) {
      return { ok: false, error: 'Could not compute a valid monthly payment from these inputs.' };
    }

    const baseline = simulate(principal, i, payment, 0);
    const withExtra = simulate(principal, i, payment, extra);

    return {
      ok: true,
      payment,
      baseline,
      withExtra,
      monthsSaved: baseline.months - withExtra.months,
      interestSaved: baseline.totalInterest - withExtra.totalInterest,
    };
  }, [principalRaw, rateRaw, yearsRaw, extraRaw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Loan principal">
            <Input value={principalRaw} onChange={(e) => setPrincipalRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
          </Field>
          <Field label="Annual rate %">
            <Input value={rateRaw} onChange={(e) => setRateRaw(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Term (years)">
            <Input value={yearsRaw} onChange={(e) => setYearsRaw(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Extra / month">
            <Input value={extraRaw} onChange={(e) => setExtraRaw(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton
              value={() =>
                [
                  `Base monthly payment: ${fmtMoney(result.payment)}`,
                  `Months saved: ${result.monthsSaved}`,
                  `Interest saved: ${fmtMoney(result.interestSaved)}`,
                  `Baseline payoff: ${fmtMonths(result.baseline.months)}, interest ${fmtMoney(result.baseline.totalInterest)}`,
                  `With extra: ${fmtMonths(result.withExtra.months)}, interest ${fmtMoney(result.withExtra.totalInterest)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Base monthly payment</span>
              <span className="font-mono text-sm">{fmtMoney(result.payment)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Total monthly with extra</span>
              <span className="font-mono text-sm">{fmtMoney(result.payment + Number(extraRaw))}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-emerald-500/10 px-3 py-2">
              <span className="text-sm text-muted-foreground">Months saved</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{result.monthsSaved} ({(result.monthsSaved / 12).toFixed(1)} yrs)</span>
                <CopyButton value={String(result.monthsSaved)} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-emerald-500/10 px-3 py-2">
              <span className="text-sm text-muted-foreground">Interest saved</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{fmtMoney(result.interestSaved)}</span>
                <CopyButton value={result.interestSaved.toFixed(2)} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Baseline payoff</span>
              <span className="font-mono text-xs sm:text-sm">{fmtMonths(result.baseline.months)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Payoff with extra</span>
              <span className="font-mono text-xs sm:text-sm">{fmtMonths(result.withExtra.months)}</span>
            </div>
          </div>
          <StatBar
            items={[
              `Baseline interest: ${fmtMoney(result.baseline.totalInterest)}`,
              `With-extra interest: ${fmtMoney(result.withExtra.totalInterest)}`,
              result.monthsSaved > 0
                ? `Paying ${extraRaw} extra/month pays off ${(result.monthsSaved / 12).toFixed(1)} years sooner`
                : 'No extra payment entered',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
