'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'dateToDay' | 'dayToDate';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000) + 1;
}

function todayISO(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export default function DayOfYear() {
  const [mode, setMode] = useState<Mode>('dateToDay');
  const [dateValue, setDateValue] = useState<string>(todayISO());
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [ordinal, setOrdinal] = useState<string>('1');

  const dateResult = useMemo(() => {
    if (mode !== 'dateToDay') return null;
    const date = parseISODate(dateValue);
    if (!date) return { error: 'Enter a valid date.' };
    const y = date.getUTCFullYear();
    const day = dayOfYear(date);
    const total = daysInYear(y);
    const remaining = total - day;
    const percent = ((day / total) * 100).toFixed(1);
    const weekday = WEEKDAY_NAMES[date.getUTCDay()] ?? '';
    return {
      day,
      remaining,
      total,
      percent,
      weekday,
      leap: isLeapYear(y),
      error: null as string | null,
    };
  }, [mode, dateValue]);

  const ordinalResult = useMemo(() => {
    if (mode !== 'dayToDate') return null;
    const y = Number(year);
    const n = Number(ordinal);
    if (!Number.isFinite(y) || !Number.isInteger(y)) {
      return { error: 'Enter a valid year.' };
    }
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: 'Enter a valid day number.' };
    }
    const total = daysInYear(y);
    if (n < 1 || n > total) {
      return { error: `Day must be between 1 and ${total} for ${y}.` };
    }
    const date = new Date(Date.UTC(y, 0, 1));
    date.setUTCDate(date.getUTCDate() + (n - 1));
    const weekday = WEEKDAY_NAMES[date.getUTCDay()] ?? '';
    return {
      date: formatDate(date),
      weekday,
      remaining: total - n,
      total,
      error: null as string | null,
    };
  }, [mode, year, ordinal]);

  const error =
    mode === 'dateToDay' ? dateResult?.error ?? null : ordinalResult?.error ?? null;

  return (
    <Panel>
      <PanelHeader title="Day of Year Calculator" />
      <OptionsBar>
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="dateToDay">Date to day-of-year</TabsTrigger>
              <TabsTrigger value="dayToDate">Day-of-year to date</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      {mode === 'dateToDay' ? (
        <OptionsBar>
          <Field label="Date">
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </Field>
        </OptionsBar>
      ) : (
        <OptionsBar>
          <Field label="Year">
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="Day of year">
            <Input
              type="number"
              value={ordinal}
              onChange={(e) => setOrdinal(e.target.value)}
            />
          </Field>
        </OptionsBar>
      )}

      <ErrorBanner error={error} />

      {mode === 'dateToDay' && dateResult && !dateResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar
            items={[
              `Days remaining: ${dateResult.remaining}`,
              `Days in year: ${dateResult.total}`,
              `Progress: ${dateResult.percent}%`,
              `Weekday: ${dateResult.weekday}`,
              dateResult.leap && 'Leap year',
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{dateResult.day}</span>
            <span className="text-sm text-muted-foreground">day of the year</span>
            <CopyButton value={String(dateResult.day)} />
          </div>
        </div>
      ) : null}

      {mode === 'dayToDate' && ordinalResult && !ordinalResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar
            items={[
              `Weekday: ${ordinalResult.weekday}`,
              `Days remaining: ${ordinalResult.remaining}`,
              `Days in year: ${ordinalResult.total}`,
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{ordinalResult.date}</span>
            <span className="text-sm text-muted-foreground">{ordinalResult.weekday}</span>
            <CopyButton value={ordinalResult.date ?? ''} />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
