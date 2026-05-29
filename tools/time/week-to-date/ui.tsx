'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'weekToDate' | 'dateToWeek';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Number of ISO weeks in a given ISO week-numbering year.
function isoWeeksInYear(year: number): number {
  // A year has 53 weeks if Jan 1 is Thursday, or Dec 31 is Thursday (leap year).
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (jan1 === 4 || (isLeap && jan1 === 3)) return 53;
  return 52;
}

// Given ISO year + week, return the Monday (UTC) starting that week.
function isoWeekToMonday(isoYear: number, isoWeek: number): Date {
  // The Monday of ISO week 1 is the Monday on or before Jan 4.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay(); // 1..7, Mon=1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return monday;
}

// Given a date, return its ISO year and week number.
function dateToIsoWeek(date: Date): { isoYear: number; isoWeek: number; isoWeekday: number } {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNr = target.getUTCDay() === 0 ? 7 : target.getUTCDay(); // Mon=1..Sun=7
  // Move to the Thursday of the current ISO week.
  target.setUTCDate(target.getUTCDate() + (4 - dayNr));
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const diffDays = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  const isoWeek = Math.floor(diffDays / 7) + 1;
  return { isoYear, isoWeek, isoWeekday: dayNr };
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

function todayISO(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export default function WeekToDate() {
  const [mode, setMode] = useState<Mode>('weekToDate');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [week, setWeek] = useState<string>('1');
  const [dateValue, setDateValue] = useState<string>(todayISO());

  const weekResult = useMemo(() => {
    if (mode !== 'weekToDate') return null;
    const y = Number(year);
    const w = Number(week);
    if (!Number.isFinite(y) || !Number.isInteger(y)) {
      return { error: 'Enter a valid year.' };
    }
    if (!Number.isFinite(w) || !Number.isInteger(w)) {
      return { error: 'Enter a valid week number.' };
    }
    const maxWeeks = isoWeeksInYear(y);
    if (w < 1 || w > maxWeeks) {
      return { error: `Week must be between 1 and ${maxWeeks} for ${y}.` };
    }
    const monday = isoWeekToMonday(y, w);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      start: formatDate(monday),
      end: formatDate(sunday),
      maxWeeks,
      error: null as string | null,
    };
  }, [mode, year, week]);

  const dateResult = useMemo(() => {
    if (mode !== 'dateToWeek') return null;
    const date = parseISODate(dateValue);
    if (!date) return { error: 'Enter a valid date.' };
    const { isoYear, isoWeek, isoWeekday } = dateToIsoWeek(date);
    const weekdayName = WEEKDAY_NAMES[date.getUTCDay()] ?? '';
    return {
      isoYear,
      isoWeek,
      isoWeekday,
      weekdayName,
      label: `${isoYear}-W${String(isoWeek).padStart(2, '0')}`,
      error: null as string | null,
    };
  }, [mode, dateValue]);

  const error =
    mode === 'weekToDate' ? weekResult?.error ?? null : dateResult?.error ?? null;

  return (
    <Panel>
      <PanelHeader title="Week Number to Date" />
      <OptionsBar>
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="weekToDate">Week to date range</TabsTrigger>
              <TabsTrigger value="dateToWeek">Date to week number</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      {mode === 'weekToDate' ? (
        <OptionsBar>
          <Field label="Year">
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="ISO week number">
            <Input type="number" value={week} onChange={(e) => setWeek(e.target.value)} />
          </Field>
        </OptionsBar>
      ) : (
        <OptionsBar>
          <Field label="Date">
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </Field>
        </OptionsBar>
      )}

      <ErrorBanner error={error} />

      {mode === 'weekToDate' && weekResult && !weekResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar
            items={[
              `Monday: ${weekResult.start}`,
              `Sunday: ${weekResult.end}`,
              `Weeks in year: ${weekResult.maxWeeks}`,
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {weekResult.start} to {weekResult.end}
            </span>
            <CopyButton value={`${weekResult.start} to ${weekResult.end}`} />
          </div>
        </div>
      ) : null}

      {mode === 'dateToWeek' && dateResult && !dateResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar
            items={[
              `ISO year: ${dateResult.isoYear}`,
              `ISO week: ${dateResult.isoWeek}`,
              `Weekday: ${dateResult.weekdayName} (${dateResult.isoWeekday})`,
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{dateResult.label}</span>
            <CopyButton value={dateResult.label ?? ''} />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
