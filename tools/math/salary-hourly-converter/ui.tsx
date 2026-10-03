'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CURRENCIES,
  PERIODS,
  PERIOD_SHORT,
  compareOffers,
  computePay,
  computeRaise,
  formatMoney,
  formatMoneyDiff,
  formatNumber,
  formatPct,
  freelanceRate,
  parseAmount,
  type Period,
  type PayBreakdown,
  type Schedule,
} from './logic';

type TabId = 'convert' | 'raise' | 'offers' | 'freelance';
type HoursMode = 'perDay' | 'perWeek';

interface ScheduleState {
  hoursMode: HoursMode;
  hoursPerDay: string;
  hoursPerWeek: string;
  daysPerWeek: string;
  weeksPerYear: string;
  holidays: string;
  vacation: string;
  unpaid: boolean;
  overtimeOn: boolean;
  otThreshold: string;
  otMult: string;
}

const DEFAULT_STATE: ScheduleState = {
  hoursMode: 'perDay',
  hoursPerDay: '8',
  hoursPerWeek: '40',
  daysPerWeek: '5',
  weeksPerYear: '52',
  holidays: '0',
  vacation: '0',
  unpaid: false,
  overtimeOn: true,
  otThreshold: '40',
  otMult: '1.5',
};

function req(raw: string, label: string): number {
  const n = parseAmount(raw);
  if (Number.isNaN(n)) throw new Error(`${label}: enter a valid number.`);
  return n;
}

function buildSchedule(s: ScheduleState): Schedule {
  const dpw = req(s.daysPerWeek, 'Days per week');
  const hpw =
    s.hoursMode === 'perDay' ? req(s.hoursPerDay, 'Hours per day') * dpw : req(s.hoursPerWeek, 'Hours per week');
  return {
    hoursPerWeek: hpw,
    daysPerWeek: dpw,
    weeksPerYear: req(s.weeksPerYear, 'Weeks per year'),
    paidHolidays: req(s.holidays || '0', 'Paid holidays'),
    vacationDays: req(s.vacation || '0', 'Vacation days'),
    unpaidTimeOff: s.unpaid,
    overtimeThreshold: s.overtimeOn ? req(s.otThreshold, 'Overtime threshold') : 1e9,
    overtimeMultiplier: s.overtimeOn ? req(s.otMult, 'Overtime multiplier') : 1,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function NumInput({
  value,
  onChange,
  className,
  id,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      placeholder={placeholder}
      className={cn('font-mono', className)}
    />
  );
}

function PeriodSelect({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Period)}>
      <SelectTrigger className="w-full min-w-[12rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ScheduleFields({
  state,
  onChange,
  showOvertime,
}: {
  state: ScheduleState;
  onChange: (s: ScheduleState) => void;
  showOvertime: boolean;
}) {
  const set = <K extends keyof ScheduleState>(k: K, v: ScheduleState[K]) => onChange({ ...state, [k]: v });
  return (
    <OptionsBar>
      <Field label="Hours entered as">
        <Tabs value={state.hoursMode} onValueChange={(v) => set('hoursMode', v as HoursMode)}>
          <TabsList>
            <TabsTrigger value="perDay">Per day</TabsTrigger>
            <TabsTrigger value="perWeek">Per week</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>
      {state.hoursMode === 'perDay' ? (
        <Field label="Hours / day">
          <NumInput value={state.hoursPerDay} onChange={(v) => set('hoursPerDay', v)} className="w-20" />
        </Field>
      ) : (
        <Field label="Hours / week">
          <NumInput value={state.hoursPerWeek} onChange={(v) => set('hoursPerWeek', v)} className="w-20" />
        </Field>
      )}
      <Field label="Days / week">
        <NumInput value={state.daysPerWeek} onChange={(v) => set('daysPerWeek', v)} className="w-20" />
      </Field>
      <Field label="Weeks / year">
        <NumInput value={state.weeksPerYear} onChange={(v) => set('weeksPerYear', v)} className="w-20" />
      </Field>
      <Field label="Paid holidays (days)">
        <NumInput value={state.holidays} onChange={(v) => set('holidays', v)} className="w-24" />
      </Field>
      <Field label="Vacation (days)">
        <NumInput value={state.vacation} onChange={(v) => set('vacation', v)} className="w-24" />
      </Field>
      <Field label="Time off is unpaid">
        <div className="flex h-8 items-center">
          <Switch checked={state.unpaid} onCheckedChange={(c) => set('unpaid', c)} aria-label="Time off is unpaid" />
        </div>
      </Field>
      {showOvertime && (
        <>
          <Field label="Overtime (hourly only)">
            <div className="flex h-8 items-center">
              <Switch
                checked={state.overtimeOn}
                onCheckedChange={(c) => set('overtimeOn', c)}
                aria-label="Pay overtime"
              />
            </div>
          </Field>
          {state.overtimeOn && (
            <>
              <Field label="Over (h/week)">
                <NumInput value={state.otThreshold} onChange={(v) => set('otThreshold', v)} className="w-20" />
              </Field>
              <Field label="Multiplier">
                <NumInput value={state.otMult} onChange={(v) => set('otMult', v)} className="w-20" />
              </Field>
            </>
          )}
        </>
      )}
    </OptionsBar>
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-[11rem]" aria-label="Currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BigStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function assumptions(b: PayBreakdown, s: Schedule): string[] {
  const out: string[] = [];
  out.push(
    `Schedule: ${formatNumber(b.hoursPerWeek)} h/week over ${formatNumber(s.daysPerWeek)} days (${formatNumber(b.hoursPerDay)} h/day), ${formatNumber(s.weeksPerYear)} weeks/year = ${formatNumber(b.scheduledHoursYear)} scheduled hours.`
  );
  if (b.timeOffDays > 0) {
    out.push(
      s.unpaidTimeOff
        ? `${formatNumber(b.timeOffDays)} days off are unpaid, so pay covers ${formatNumber(b.hoursWorkedYear)} hours worked.`
        : `${formatNumber(b.timeOffDays)} days off are paid, so annual pay covers all ${formatNumber(b.scheduledHoursYear)} scheduled hours; you actually work ${formatNumber(b.hoursWorkedYear)} hours.`
    );
  } else {
    out.push('No holidays or vacation entered; pay covers every scheduled hour.');
  }
  if (b.overtimeApplied) {
    out.push(
      `Overtime: ${formatNumber(b.overtimeHoursWeek)} h/week above ${formatNumber(s.overtimeThreshold)} h paid at ${formatNumber(s.overtimeMultiplier)}x the base rate.`
    );
  } else {
    out.push('Overtime is only applied when the pay entered is hourly and hours exceed the threshold.');
  }
  out.push('Weekly and bi-weekly figures are for a worked week; monthly, semi-monthly and quarterly are annual / 12, / 24 and / 4.');
  out.push('Gross pay; taxes vary by location. No taxes, deductions or benefits are included.');
  return out;
}

function PayTable({
  b,
  currency,
  highlight,
}: {
  b: PayBreakdown;
  currency: string;
  highlight?: Period;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/30 text-left text-2xs uppercase tracking-wide text-muted-foreground">
          <th className="px-3 py-1.5 font-medium">Period</th>
          <th className="px-3 py-1.5 text-right font-medium">Gross pay</th>
          <th className="w-10 px-1 py-1.5" />
        </tr>
      </thead>
      <tbody>
        {PERIODS.map(({ id }) => (
          <tr key={id} className={cn('border-b last:border-0', highlight === id && 'bg-primary/10')}>
            <td className="px-3 py-1.5">
              {PERIOD_SHORT[id]}
              {highlight === id && <span className="ml-2 text-2xs text-muted-foreground">(entered)</span>}
            </td>
            <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatMoney(b.amounts[id], currency)}</td>
            <td className="px-1 py-1">
              <CopyButton value={b.amounts[id].toFixed(2)} size="icon-sm" label={`Copy ${PERIOD_SHORT[id]}`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function payText(b: PayBreakdown, currency: string): string {
  return [
    ...PERIODS.map((p) => `${PERIOD_SHORT[p.id]}: ${formatMoney(b.amounts[p.id], currency)}`),
    `Effective hourly (per hour worked): ${formatMoney(b.effectiveHourly, currency)}`,
    'Gross pay, no taxes.',
  ].join('\n');
}

function payCsv(b: PayBreakdown): string {
  return ['period,gross_pay', ...PERIODS.map((p) => `${p.id},${b.amounts[p.id].toFixed(2)}`)].join('\n');
}

export default function SalaryHourlyConverterTool() {
  const [tab, setTab] = useState<TabId>('convert');
  const [currency, setCurrency] = useState('USD');

  // converter + raise share one schedule
  const [sched, setSched] = useState<ScheduleState>(DEFAULT_STATE);
  const [amount, setAmount] = useState('25');
  const [period, setPeriod] = useState<Period>('hourly');

  const [raiseAmount, setRaiseAmount] = useState('52000');
  const [raisePeriod, setRaisePeriod] = useState<Period>('annual');
  const [raiseType, setRaiseType] = useState<'percent' | 'amount'>('percent');
  const [raiseValue, setRaiseValue] = useState('4');

  const [offerA, setOfferA] = useState({ amount: '65000', period: 'annual' as Period, bonus: '0', sched: { ...DEFAULT_STATE, holidays: '10', vacation: '15' } });
  const [offerB, setOfferB] = useState({ amount: '34', period: 'hourly' as Period, bonus: '0', sched: { ...DEFAULT_STATE, unpaid: true, holidays: '10', vacation: '10' } });

  const [fl, setFl] = useState({ target: '85000', expenses: '12000', hours: '40', days: '5', util: '65', weeksOff: '5' });

  const m = (v: number) => formatMoney(v, currency);

  const convert = useMemo(() => {
    try {
      const s = buildSchedule(sched);
      const b = computePay(req(amount, 'Pay amount'), period, s);
      return { b, s, error: null as string | null };
    } catch (e) {
      return { b: null, s: null, error: errMsg(e) };
    }
  }, [sched, amount, period]);

  const raise = useMemo(() => {
    try {
      const s = buildSchedule(sched);
      const r = computeRaise(req(raiseAmount, 'Current pay'), raisePeriod, { type: raiseType, value: req(raiseValue, 'Raise') }, s);
      return { r, error: null as string | null };
    } catch (e) {
      return { r: null, error: errMsg(e) };
    }
  }, [sched, raiseAmount, raisePeriod, raiseType, raiseValue]);

  const offers = useMemo(() => {
    try {
      const mk = (o: typeof offerA, label: string) => {
        try {
          return {
            amount: req(o.amount, 'Pay amount'),
            period: o.period,
            schedule: buildSchedule(o.sched),
            bonus: req(o.bonus || '0', 'Bonus'),
          };
        } catch (e) {
          throw new Error(`${label}: ${errMsg(e)}`);
        }
      };
      const c = compareOffers(mk(offerA, 'Offer A'), mk(offerB, 'Offer B'));
      return { c, error: null as string | null };
    } catch (e) {
      return { c: null, error: errMsg(e) };
    }
  }, [offerA, offerB]);

  const freelance = useMemo(() => {
    try {
      const r = freelanceRate({
        targetIncome: req(fl.target, 'Target income'),
        expenses: req(fl.expenses || '0', 'Business expenses'),
        hoursPerWeek: req(fl.hours, 'Hours per week'),
        daysPerWeek: req(fl.days, 'Days per week'),
        utilizationPct: req(fl.util, 'Utilization'),
        weeksOff: req(fl.weeksOff || '0', 'Weeks off'),
      });
      return { r, error: null as string | null };
    } catch (e) {
      return { r: null, error: errMsg(e) };
    }
  }, [fl]);

  const cb = convert.b;
  const cs = convert.s;
  const rr = raise.r;
  const oc = offers.c;
  const fr = freelance.r;

  const setOffer = (which: 'A' | 'B', patch: Partial<typeof offerA>) => {
    if (which === 'A') setOfferA({ ...offerA, ...patch });
    else setOfferB({ ...offerB, ...patch });
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="convert">Converter</TabsTrigger>
            <TabsTrigger value="raise">Raise</TabsTrigger>
            <TabsTrigger value="offers">Compare offers</TabsTrigger>
            <TabsTrigger value="freelance">Freelance rate</TabsTrigger>
          </TabsList>
          <Field label="Currency" className="w-52">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <TabsContent value="convert" className="space-y-4">
          <OptionsBar>
            <Field label="Pay amount">
              <NumInput value={amount} onChange={setAmount} className="w-40" id="sh-amount" />
            </Field>
            <Field label="Pay period" className="w-64">
              <PeriodSelect value={period} onChange={setPeriod} />
            </Field>
          </OptionsBar>
          <ScheduleFields state={sched} onChange={setSched} showOvertime={period === 'hourly'} />
          <ErrorBanner error={convert.error} />
          {cb && cs && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <BigStat label="Hourly (base rate)" value={m(cb.rate)} sub={`over ${formatNumber(cb.hoursPaidYear)} paid hours/year`} />
                <BigStat label="Annual gross" value={m(cb.annual)} sub={`${m(cb.amounts.monthly)} per month`} />
                <BigStat
                  label="Effective hourly"
                  value={m(cb.effectiveHourly)}
                  sub={`annual / ${formatNumber(cb.hoursWorkedYear)} hours actually worked`}
                />
              </div>
              <Panel>
                <PanelHeader title="Equivalent gross pay">
                  <CopyButton value={() => payText(cb, currency)} />
                  <DownloadButton data={() => payCsv(cb)} filename="pay-equivalents.csv" mime="text/csv" />
                </PanelHeader>
                <PayTable b={cb} currency={currency} highlight={period} />
                <StatBar className="h-auto min-h-7 py-1"
                  items={[
                    `${formatNumber(cb.hoursPerWeek)} h/week`,
                    `${formatNumber(cb.scheduledHoursYear)} scheduled h/year`,
                    `${formatNumber(cb.hoursWorkedYear)} h worked`,
                    cb.overtimeApplied && `${formatNumber(cb.overtimeHoursWeek)} h/week overtime`,
                  ]}
                />
              </Panel>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">Assumptions</div>
                <ul className="list-disc space-y-0.5 pl-5">
                  {assumptions(cb, cs).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="raise" className="space-y-4">
          <OptionsBar>
            <Field label="Current pay">
              <NumInput value={raiseAmount} onChange={setRaiseAmount} className="w-40" />
            </Field>
            <Field label="Pay period" className="w-64">
              <PeriodSelect value={raisePeriod} onChange={setRaisePeriod} />
            </Field>
            <Field label="Raise type">
              <Tabs value={raiseType} onValueChange={(v) => setRaiseType(v as 'percent' | 'amount')}>
                <TabsList>
                  <TabsTrigger value="percent">Percent</TabsTrigger>
                  <TabsTrigger value="amount">Amount</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label={raiseType === 'percent' ? 'Raise (%)' : `Raise (per ${PERIOD_SHORT[raisePeriod].toLowerCase()} period)`}>
              <NumInput value={raiseValue} onChange={setRaiseValue} className="w-28" />
            </Field>
          </OptionsBar>
          <ScheduleFields state={sched} onChange={setSched} showOvertime={raisePeriod === 'hourly'} />
          <ErrorBanner error={raise.error} />
          {rr && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <BigStat label={`New ${PERIOD_SHORT[raisePeriod].toLowerCase()} pay`} value={m(rr.newAmount)} sub={`${formatPct(rr.effectivePct)} vs current`} />
                <BigStat label="New annual" value={m(rr.next.annual)} sub={`${formatMoneyDiff(rr.next.annual - rr.current.annual, currency)} per year`} />
                <BigStat label="New hourly" value={m(rr.next.rate)} sub={`${formatMoneyDiff(rr.next.rate - rr.current.rate, currency)} per hour`} />
              </div>
              <Panel>
                <PanelHeader title="Before and after">
                  <CopyButton
                    value={() =>
                      rr.rows
                        .map((r) => `${PERIOD_SHORT[r.period]}: ${m(r.current)} -> ${m(r.next)} (${formatMoneyDiff(r.diff, currency)}, ${formatPct(r.pct)})`)
                        .join('\n')
                    }
                  />
                </PanelHeader>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-2xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">Period</th>
                        <th className="px-3 py-1.5 text-right font-medium">Current</th>
                        <th className="px-3 py-1.5 text-right font-medium">New</th>
                        <th className="px-3 py-1.5 text-right font-medium">Difference</th>
                        <th className="px-3 py-1.5 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rr.rows.map((r) => (
                        <tr key={r.period} className={cn('border-b last:border-0', r.period === raisePeriod && 'bg-primary/10')}>
                          <td className="px-3 py-1.5">{PERIOD_SHORT[r.period]}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{m(r.current)}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{m(r.next)}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-success">{formatMoneyDiff(r.diff, currency)}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatPct(r.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <StatBar className="h-auto min-h-7 py-1" items={['Gross pay, no taxes']} />
              </Panel>
            </>
          )}
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(['A', 'B'] as const).map((which) => {
              const o = which === 'A' ? offerA : offerB;
              return (
                <div key={which} className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offer {which}</div>
                  <OptionsBar>
                    <Field label="Pay amount">
                      <NumInput value={o.amount} onChange={(v) => setOffer(which, { amount: v })} className="w-32" />
                    </Field>
                    <Field label="Pay period" className="w-56">
                      <PeriodSelect value={o.period} onChange={(p) => setOffer(which, { period: p })} />
                    </Field>
                    <Field label="Annual bonus / extra">
                      <NumInput value={o.bonus} onChange={(v) => setOffer(which, { bonus: v })} className="w-28" />
                    </Field>
                  </OptionsBar>
                  <ScheduleFields state={o.sched} onChange={(s) => setOffer(which, { sched: s })} showOvertime={o.period === 'hourly'} />
                </div>
              );
            })}
          </div>
          <ErrorBanner error={offers.error} />
          {oc && (
            <>
              <div className="rounded-md border bg-primary/10 p-3 text-sm">
                {Math.abs(oc.diffAnnual) < 0.005 ? (
                  <>Both offers pay the same total per year.</>
                ) : (
                  <>
                    <strong>Offer {oc.diffAnnual > 0 ? 'B' : 'A'}</strong> pays{' '}
                    <strong className="font-mono">{m(Math.abs(oc.diffAnnual))}</strong> more per year than Offer{' '}
                    {oc.diffAnnual > 0 ? 'A' : 'B'} (
                    {formatNumber(
                      (Math.abs(oc.diffAnnual) / Math.min(oc.a.totalAnnual, oc.b.totalAnnual || 1)) * 100,
                      2
                    )}
                    % more).{' '}
                  </>
                )}
                {Math.abs(oc.diffEffective) >= 0.005 ? (
                  <>
                    Per hour actually worked, <strong>Offer {oc.diffEffective > 0 ? 'B' : 'A'}</strong> leads by{' '}
                    <strong className="font-mono">{m(Math.abs(oc.diffEffective))}</strong>.
                  </>
                ) : (
                  <>Per hour actually worked, they tie.</>
                )}
              </div>
              <Panel>
                <PanelHeader title="Side by side">
                  <CopyButton
                    value={() => {
                      const c = oc;
                      const rows: [string, number, number, number][] = [
                        ['Annual base', c.a.pay.annual, c.b.pay.annual, c.b.pay.annual - c.a.pay.annual],
                        ['Annual total', c.a.totalAnnual, c.b.totalAnnual, c.diffAnnual],
                        ['Monthly', c.a.monthlyEquivalent, c.b.monthlyEquivalent, c.diffMonthly],
                        ['Hourly (paid hours)', c.a.hourlyEquivalent, c.b.hourlyEquivalent, c.diffHourly],
                        ['Effective hourly (hours worked)', c.a.effectiveHourly, c.b.effectiveHourly, c.diffEffective],
                      ];
                      return ['Metric | Offer A | Offer B | B - A', ...rows.map((r) => `${r[0]} | ${m(r[1])} | ${m(r[2])} | ${formatMoneyDiff(r[3], currency)}`)].join('\n');
                    }}
                  />
                </PanelHeader>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-2xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">Metric</th>
                        <th className="px-3 py-1.5 text-right font-medium">Offer A</th>
                        <th className="px-3 py-1.5 text-right font-medium">Offer B</th>
                        <th className="px-3 py-1.5 text-right font-medium">B minus A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Annual base pay', oc.a.pay.annual, oc.b.pay.annual, 'money'],
                          ['Bonus / extra', oc.a.bonus, oc.b.bonus, 'money'],
                          ['Total annual', oc.a.totalAnnual, oc.b.totalAnnual, 'money'],
                          ['Monthly equivalent', oc.a.monthlyEquivalent, oc.b.monthlyEquivalent, 'money'],
                          ['Hourly (over paid hours)', oc.a.hourlyEquivalent, oc.b.hourlyEquivalent, 'money'],
                          ['Effective hourly (hours worked)', oc.a.effectiveHourly, oc.b.effectiveHourly, 'money'],
                          ['Hours worked per year', oc.a.pay.hoursWorkedYear, oc.b.pay.hoursWorkedYear, 'hours'],
                          ['Days off per year', oc.a.pay.timeOffDays, oc.b.pay.timeOffDays, 'hours'],
                        ] as [string, number, number, 'money' | 'hours'][]
                      ).map(([label, a, b, kind]) => (
                        <tr key={label} className="border-b last:border-0">
                          <td className="px-3 py-1.5">{label}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{kind === 'money' ? m(a) : formatNumber(a)}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{kind === 'money' ? m(b) : formatNumber(b)}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                            {kind === 'money' ? formatMoneyDiff(b - a, currency) : `${b - a > 0 ? '+' : ''}${formatNumber(b - a)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <StatBar className="h-auto min-h-7 py-1" items={['Gross pay, no taxes or benefits', 'Hourly figure = total annual / paid hours']} />
              </Panel>
            </>
          )}
        </TabsContent>

        <TabsContent value="freelance" className="space-y-4">
          <OptionsBar>
            <Field label="Target annual income">
              <NumInput value={fl.target} onChange={(v) => setFl({ ...fl, target: v })} className="w-36" />
            </Field>
            <Field label="Business expenses / year">
              <NumInput value={fl.expenses} onChange={(v) => setFl({ ...fl, expenses: v })} className="w-36" />
            </Field>
            <Field label="Hours worked / week">
              <NumInput value={fl.hours} onChange={(v) => setFl({ ...fl, hours: v })} className="w-24" />
            </Field>
            <Field label="Days / week">
              <NumInput value={fl.days} onChange={(v) => setFl({ ...fl, days: v })} className="w-20" />
            </Field>
            <Field label="Billable share (%)">
              <NumInput value={fl.util} onChange={(v) => setFl({ ...fl, util: v })} className="w-24" />
            </Field>
            <Field label="Weeks off / year">
              <NumInput value={fl.weeksOff} onChange={(v) => setFl({ ...fl, weeksOff: v })} className="w-24" />
            </Field>
          </OptionsBar>
          <ErrorBanner error={freelance.error} />
          {fr && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <BigStat label="Required hourly rate" value={m(fr.hourlyRate)} sub={`${formatNumber(fr.billableHoursYear)} billable hours/year`} />
                <BigStat label="Required day rate" value={m(fr.dayRate)} sub={`${formatNumber(fr.billableDaysYear)} billable days/year`} />
                <BigStat label="Revenue to invoice" value={m(fr.revenueNeeded)} sub={`${m(fr.monthlyRevenue)} per month`} />
              </div>
              <Panel>
                <PanelHeader title="Breakdown">
                  <CopyButton
                    value={() => {
                      const r = fr;
                      return [
                        `Required hourly rate: ${m(r.hourlyRate)}`,
                        `Required day rate: ${m(r.dayRate)}`,
                        `Revenue needed: ${m(r.revenueNeeded)} (income ${fl.target} + expenses ${fl.expenses})`,
                        `Billable hours per year: ${formatNumber(r.billableHoursYear)}`,
                      ].join('\n');
                    }}
                  />
                </PanelHeader>
                <div className="divide-y text-sm">
                  {(
                    [
                      ['Revenue needed (income + expenses)', m(fr.revenueNeeded)],
                      ['Working weeks per year', formatNumber(fr.workingWeeks)],
                      ['Billable hours per week', formatNumber(fr.billableHoursWeek)],
                      ['Billable hours per year', formatNumber(fr.billableHoursYear)],
                      ['Weekly revenue target (52 weeks)', m(fr.weeklyRevenue)],
                      ['Same income as an employee would need per hour worked', m(fr.employeeEquivalentHourly)],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
                <StatBar className="h-auto min-h-7 py-1" items={['rate = (income + expenses) / (hours x billable share x working weeks)']} />
              </Panel>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Target income is gross, before income tax and self-employment contributions, which vary by location. Add those
                (and health insurance, retirement saving and a buffer for unpaid gaps) to your target or to business expenses. The
                day rate assumes a full working day.
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
