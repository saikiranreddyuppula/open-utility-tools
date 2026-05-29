'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Panel, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  nextBirthdayDays: number;
  nextBirthdayDate: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysInMonth(year: number, monthIndex: number): number {
  // monthIndex is 0-based; day 0 of next month = last day of this month
  return new Date(year, monthIndex + 1, 0).getDate();
}

function computeAge(birth: Date, now: Date): AgeResult {
  // Calendar diff (years/months/days)
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // Borrow days from the previous month relative to `now`
    const prevMonthIndex = now.getMonth() - 1;
    const borrowYear = prevMonthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const borrowMonth = (prevMonthIndex + 12) % 12;
    days += daysInMonth(borrowYear, borrowMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const diffMs = now.getTime() - birth.getTime();
  const totalDays = Math.floor(diffMs / MS_PER_DAY);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  // Next birthday
  let nextYear = now.getFullYear();
  let next = new Date(nextYear, birth.getMonth(), birth.getDate());
  // Normalize "today" to midnight for a clean day count
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() <= today.getTime()) {
    nextYear += 1;
    next = new Date(nextYear, birth.getMonth(), birth.getDate());
  }
  const nextBirthdayDays = Math.round((next.getTime() - today.getTime()) / MS_PER_DAY);

  return {
    years,
    months,
    days,
    totalDays,
    totalHours,
    totalMinutes,
    nextBirthdayDays,
    nextBirthdayDate: next.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

export default function AgeCalculatorTool() {
  const [value, setValue] = useState('');

  const { result, error } = useMemo<{ result: AgeResult | null; error: string | null }>(() => {
    if (!value) return { result: null, error: null };
    const birth = new Date(`${value}T00:00:00`);
    if (Number.isNaN(birth.getTime())) {
      return { result: null, error: 'Enter a valid birth date.' };
    }
    const now = new Date();
    if (birth.getTime() > now.getTime()) {
      return { result: null, error: 'Birth date cannot be in the future.' };
    }
    return { result: computeAge(birth, now), error: null };
  }, [value]);

  const summary = result
    ? `${result.years} years, ${result.months} months, ${result.days} days`
    : '';

  return (
    <div className="space-y-4">
      <Panel title="Birth date">
        <Field label="Date of birth">
          <Input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>
      </Panel>

      <ErrorBanner error={error} />

      {result ? (
        <Panel title="Age">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums">{summary}</p>
              <CopyButton value={summary} />
            </div>
            <StatBar
              items={[
                `Total days: ${result.totalDays.toLocaleString()}`,
                `Total hours: ${result.totalHours.toLocaleString()}`,
                `Total minutes: ${result.totalMinutes.toLocaleString()}`,
              ]}
            />
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <span className="font-medium">Next birthday: </span>
              {result.nextBirthdayDays === 0
                ? 'Today! Happy birthday.'
                : `${result.nextBirthdayDays.toLocaleString()} day${
                    result.nextBirthdayDays === 1 ? '' : 's'
                  } away (${result.nextBirthdayDate})`}
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
