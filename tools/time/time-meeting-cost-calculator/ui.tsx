'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RateMode = 'average' | 'list';

interface CalcResult {
  totalCost: number;
  perMinute: number;
  perAttendee: number;
  attendees: number;
  hours: number;
  ratesSum: number;
  baseSum: number;
}

function parseRates(text: string): number[] {
  return text
    .split(/[\n,]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function fmtMoney(symbol: string, value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${symbol}${fixed}`;
}

export default function MeetingCostCalculator() {
  const [mode, setMode] = useState<RateMode>('average');
  const [attendees, setAttendees] = useState('6');
  const [avgRate, setAvgRate] = useState('75');
  const [rateList, setRateList] = useState('120\n90\n75\n60\n55\n50');
  const [minutes, setMinutes] = useState('60');
  const [symbol, setSymbol] = useState('$');
  const [overhead, setOverhead] = useState('1.0');

  const result = useMemo<CalcResult | { error: string }>(() => {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      return { error: 'Enter a positive meeting duration in minutes.' };
    }

    const ohRaw = Number(overhead);
    const oh = Number.isFinite(ohRaw) && ohRaw > 0 ? ohRaw : 1;

    const hours = mins / 60;

    let baseSum = 0;
    let count = 0;

    if (mode === 'average') {
      const n = Number(attendees);
      const rate = Number(avgRate);
      if (!Number.isFinite(n) || n <= 0) {
        return { error: 'Enter a positive number of attendees.' };
      }
      if (!Number.isFinite(rate) || rate < 0) {
        return { error: 'Enter a valid average hourly rate.' };
      }
      count = Math.floor(n);
      baseSum = count * rate;
    } else {
      const rates = parseRates(rateList);
      if (rates.length === 0) {
        return { error: 'Enter at least one hourly rate (one per line or comma-separated).' };
      }
      count = rates.length;
      baseSum = rates.reduce((acc, r) => acc + r, 0);
    }

    const ratesSum = baseSum * oh;
    const totalCost = ratesSum * hours;
    const perMinute = totalCost / mins;
    const perAttendee = count > 0 ? totalCost / count : 0;

    return {
      totalCost,
      perMinute,
      perAttendee,
      attendees: count,
      hours,
      ratesSum,
      baseSum,
    };
  }, [mode, attendees, avgRate, rateList, minutes, symbol, overhead]);

  const isError = 'error' in result;

  const rows = isError
    ? []
    : [
        { label: 'Total meeting cost', value: fmtMoney(symbol, result.totalCost) },
        { label: 'Cost per minute', value: fmtMoney(symbol, result.perMinute) },
        { label: 'Cost per attendee', value: fmtMoney(symbol, result.perAttendee) },
        { label: 'Combined hourly burn', value: `${fmtMoney(symbol, result.ratesSum)}/hr` },
      ];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Rate mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as RateMode)}>
              <TabsList>
                <TabsTrigger value="average">Single average</TabsTrigger>
                <TabsTrigger value="list">Per-person rates</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Duration (minutes)">
            <Input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Currency symbol">
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.slice(0, 3))}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Overhead ×" hint="Burden multiplier (e.g. 1.4 for benefits)">
            <Input
              value={overhead}
              onChange={(e) => setOverhead(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>

        {mode === 'average' ? (
          <OptionsBar>
            <Field label="Attendees">
              <Input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                inputMode="numeric"
                className="w-28 font-mono"
              />
            </Field>
            <Field label="Average hourly rate">
              <Input
                value={avgRate}
                onChange={(e) => setAvgRate(e.target.value)}
                inputMode="decimal"
                className="w-32 font-mono"
              />
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar>
            <Field label="Hourly rates" hint="One per line or comma-separated" className="min-w-[260px] flex-1">
              <Input
                value={rateList}
                onChange={(e) => setRateList(e.target.value)}
                className="font-mono"
                placeholder="120, 90, 75"
              />
            </Field>
          </OptionsBar>
        )}
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Meeting cost">
            <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
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
              `${result.attendees} attendee${result.attendees === 1 ? '' : 's'}`,
              `${result.hours.toFixed(2)} h`,
              `base ${fmtMoney(symbol, result.baseSum)}/hr`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
