'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

type Freq = '1' | '2' | '4' | '12' | '365';
type ContribTiming = 'end' | 'start';

const FREQ_LABEL: Record<Freq, string> = {
  '1': 'Annually',
  '2': 'Semi-annually',
  '4': 'Quarterly',
  '12': 'Monthly',
  '365': 'Daily',
};

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

interface YearRow {
  year: number;
  contributed: number;
  interest: number;
  balance: number;
}

export default function CompoundInterestCalculatorTool() {
  const [principal, setPrincipal] = useState('1000');
  const [rate, setRate] = useState('5');
  const [years, setYears] = useState('10');
  const [freq, setFreq] = useState<Freq>('12');
  const [contribution, setContribution] = useState('100');
  const [contribFreq, setContribFreq] = useState<Freq>('12');
  const [timing, setTiming] = useState<ContribTiming>('end');

  const result = useMemo(() => {
    const p = num(principal) ?? 0;
    const r = num(rate);
    const y = num(years);
    const n = Number(freq);
    const contrib = num(contribution) ?? 0;
    const cf = Number(contribFreq);

    if (r == null || y == null || y <= 0 || n <= 0) return null;
    if (p < 0 || contrib < 0) return null;

    const annualRate = r / 100;
    const ratePerPeriod = annualRate / n;
    const totalPeriods = Math.round(y * n);
    // How many compounding periods elapse per contribution.
    const periodsPerContribution = cf > 0 ? n / cf : 0;

    let balance = p;
    let totalContributed = p;
    const rows: YearRow[] = [];
    const contribStride =
      cf > 0 && periodsPerContribution > 0
        ? Math.max(1, Math.round(periodsPerContribution))
        : 0;

    for (let period = 1; period <= totalPeriods; period++) {
      const addContribution =
        contribStride > 0 && (period - 1) % contribStride === 0;

      if (timing === 'start' && addContribution) {
        balance += contrib;
        totalContributed += contrib;
      }

      balance += balance * ratePerPeriod;

      if (timing === 'end' && addContribution) {
        balance += contrib;
        totalContributed += contrib;
      }

      if (period % n === 0 || period === totalPeriods) {
        const yearNumber = Math.ceil(period / n);
        rows.push({
          year: yearNumber,
          contributed: totalContributed,
          interest: balance - totalContributed,
          balance,
        });
      }
    }

    const finalBalance = balance;
    const interestEarned = finalBalance - totalContributed;

    return {
      finalBalance,
      totalContributed,
      interestEarned,
      rows,
    };
  }, [principal, rate, years, freq, contribution, contribFreq, timing]);

  const breakdownText = useMemo(() => {
    if (!result) return '';
    const header = 'Year\tContributed\tInterest\tBalance';
    const lines = result.rows.map(
      (row) =>
        `${row.year}\t${money(row.contributed)}\t${money(row.interest)}\t${money(row.balance)}`
    );
    return [header, ...lines].join('\n');
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Initial principal" htmlFor="ci-principal">
          <Input
            id="ci-principal"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-32 font-mono"
          />
        </Field>
        <Field label="Annual rate (%)" htmlFor="ci-rate">
          <Input
            id="ci-rate"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            type="number"
            className="h-8 w-24 font-mono"
          />
        </Field>
        <Field label="Years" htmlFor="ci-years">
          <Input
            id="ci-years"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-20 font-mono"
          />
        </Field>
        <Field label="Compounding">
          <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FREQ_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Contribution" htmlFor="ci-contrib">
          <Input
            id="ci-contrib"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            type="number"
            min="0"
            className="h-8 w-28 font-mono"
          />
        </Field>
        <Field label="Contribution frequency">
          <Select value={contribFreq} onValueChange={(v) => setContribFreq(v as Freq)}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FREQ_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Timing">
          <Select
            value={timing}
            onValueChange={(v) => setTiming(v as ContribTiming)}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="end">End of period</SelectItem>
              <SelectItem value="start">Start of period</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <PanelHeader title="Final balance">
                <CopyButton value={() => result.finalBalance.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular text-primary">
                {money(result.finalBalance)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Total contributed">
                <CopyButton value={() => result.totalContributed.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular">
                {money(result.totalContributed)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Interest earned">
                <CopyButton value={() => result.interestEarned.toFixed(2)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular text-primary">
                {money(result.interestEarned)}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Yearly breakdown">
              <CopyButton value={() => breakdownText} label="Copy" size="sm" />
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead>
                  <tr className="border-b bg-muted/30 text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left">Year</th>
                    <th className="px-3 py-2 text-right">Contributed</th>
                    <th className="px-3 py-2 text-right">Interest</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((row) => (
                    <tr key={row.year}>
                      <td className="px-3 py-1.5 font-mono">{row.year}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {money(row.contributed)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-primary">
                        {money(row.interest)}
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
                `${result.rows.length} year${result.rows.length === 1 ? '' : 's'}`,
                `Growth ${
                  result.totalContributed > 0
                    ? (
                        (result.interestEarned / result.totalContributed) *
                        100
                      ).toFixed(1)
                    : '0.0'
                }%`,
              ]}
            />
          </Panel>
        </>
      ) : (
        <Panel>
          <PanelHeader title="Result" />
          <div className="px-3 py-4 text-sm text-muted-foreground">
            Enter a valid rate, term, and non-negative amounts to see the projection.
          </div>
        </Panel>
      )}
    </div>
  );
}
