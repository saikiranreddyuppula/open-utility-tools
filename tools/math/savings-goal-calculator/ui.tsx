'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface ScheduleRow {
  month: number;
  deposit: number;
  interest: number;
  balance: number;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SavingsGoalCalculatorTool() {
  const [target, setTarget] = useState('20000');
  const [current, setCurrent] = useState('2000');
  const [rate, setRate] = useState('4');
  const [months, setMonths] = useState('24');

  const result = useMemo(() => {
    const fv = Number(target);
    const pv = Number(current);
    const annual = Number(rate);
    const n = Number(months);

    if (![fv, pv, annual, n].every((v) => Number.isFinite(v))) {
      return { error: 'Enter valid numbers for all fields.' };
    }
    if (fv <= 0) return { error: 'Target amount must be greater than zero.' };
    if (pv < 0) return { error: 'Current savings cannot be negative.' };
    if (annual < 0) return { error: 'Interest rate cannot be negative.' };
    if (!Number.isInteger(n) || n < 1) return { error: 'Time horizon must be a whole number of months ≥ 1.' };
    if (n > 1200) return { error: 'Keep the horizon under 1200 months (100 years).' };

    const i = annual / 12 / 100;

    // Future value of current savings grown over n months.
    const grownPv = i === 0 ? pv : pv * Math.pow(1 + i, n);

    if (grownPv >= fv) {
      // Already on track without further deposits.
      const schedule = buildSchedule(pv, 0, i, n);
      return {
        already: true,
        pmt: 0,
        totalContributed: 0,
        totalInterest: schedule.length > 0 ? (schedule[schedule.length - 1]?.balance ?? grownPv) - pv : grownPv - pv,
        finalBalance: schedule.length > 0 ? schedule[schedule.length - 1]?.balance ?? grownPv : grownPv,
        schedule,
      };
    }

    // Solve PMT for FV-of-annuity (ordinary annuity, deposit at period end).
    let pmt: number;
    if (i === 0) {
      pmt = (fv - pv) / n;
    } else {
      const factor = (Math.pow(1 + i, n) - 1) / i;
      pmt = (fv - grownPv) / factor;
    }

    const schedule = buildSchedule(pv, pmt, i, n);
    const finalBalance = schedule.length > 0 ? schedule[schedule.length - 1]?.balance ?? fv : fv;
    const totalContributed = pmt * n;
    const totalInterest = finalBalance - pv - totalContributed;

    return {
      already: false,
      pmt,
      totalContributed,
      totalInterest,
      finalBalance,
      schedule,
    };
  }, [target, current, rate, months]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Target amount">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Current savings">
            <Input
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Annual rate %">
            <Input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Months">
            <Input
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Plan">
              <CopyButton
                value={() =>
                  [
                    `Required monthly deposit: ${money(result.pmt)}`,
                    `Total contributed: ${money(result.totalContributed)}`,
                    `Total interest earned: ${money(result.totalInterest)}`,
                    `Projected final balance: ${money(result.finalBalance)}`,
                  ].join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {[
                { label: 'Required monthly deposit', value: money(result.pmt) },
                { label: 'Total contributed', value: money(result.totalContributed) },
                { label: 'Total interest earned', value: money(result.totalInterest) },
                { label: 'Projected final balance', value: money(result.finalBalance) },
              ].map((r) => (
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
                result.already
                  ? 'Current savings already reach the goal — no deposits needed.'
                  : `Save ${money(result.pmt)} per month to hit the target.`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Balance schedule" />
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Deposit</th>
                    <th className="px-3 py-2 text-right font-medium">Interest</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono">{row.month}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{money(row.deposit)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{money(row.interest)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{money(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar items={[`${result.schedule.length} months`]} />
          </Panel>
        </>
      )}
    </div>
  );
}

// Build a month-by-month schedule: interest accrues on the prior balance,
// then the deposit is added (ordinary annuity).
function buildSchedule(pv: number, pmt: number, i: number, n: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let balance = pv;
  for (let m = 1; m <= n; m++) {
    const interest = balance * i;
    balance = balance + interest + pmt;
    rows.push({ month: m, deposit: pmt, interest, balance });
  }
  return rows;
}
