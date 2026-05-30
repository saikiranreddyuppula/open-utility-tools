'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ORDINAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', 'Last'];

function pad(n: number, width: number): string {
  return Math.abs(n).toString().padStart(width, '0');
}

function formatISO(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month + 1, 2)}-${pad(day, 2)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

type Result =
  | { error: string }
  | {
      iso: string;
      weekday: string;
      longLabel: string;
      day: number;
      ordinalLabel: string;
    };

export default function NthWeekdayOfMonth() {
  const now = new Date();
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>('10'); // November (0-based)
  const [weekday, setWeekday] = useState<string>('4'); // Thursday
  const [ordinal, setOrdinal] = useState<string>('3'); // index into ORDINAL_LABELS; '5' = Last

  const result = useMemo<Result>(() => {
    const y = Number(year);
    if (!Number.isFinite(y) || !Number.isInteger(y)) {
      return { error: 'Enter a valid year.' };
    }
    const m = Number(month);
    const dow = Number(weekday);
    const ord = Number(ordinal);
    if (m < 0 || m > 11) return { error: 'Choose a valid month.' };
    if (dow < 0 || dow > 6) return { error: 'Choose a valid weekday.' };
    if (ord < 0 || ord > 5) return { error: 'Choose a valid occurrence.' };

    const total = daysInMonth(y, m);
    const ordinalLabel = ORDINAL_LABELS[ord] ?? '';
    const weekdayName = WEEKDAY_NAMES[dow] ?? '';
    const monthName = MONTH_NAMES[m] ?? '';

    let day: number;
    if (ord === 5) {
      // Last occurrence: walk back from the final day of the month.
      const lastDow = new Date(Date.UTC(y, m, total)).getUTCDay();
      const back = (lastDow - dow + 7) % 7;
      day = total - back;
    } else {
      const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
      const firstMatch = ((dow - firstDow + 7) % 7) + 1;
      day = firstMatch + 7 * ord;
      if (day > total) {
        return {
          error: `There is no ${ordinalLabel} ${weekdayName} in ${monthName} ${y}. That month only has ${Math.floor((total - firstMatch) / 7) + 1} of them.`,
        };
      }
    }

    return {
      iso: formatISO(y, m, day),
      weekday: weekdayName,
      longLabel: `${ordinalLabel} ${weekdayName} of ${monthName} ${y}`,
      day,
      ordinalLabel,
    };
  }, [year, month, weekday, ordinal]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Nth Weekday of Month" />
        <OptionsBar>
          <Field label="Occurrence">
            <Select value={ordinal} onValueChange={setOrdinal}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDINAL_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Weekday">
            <Select value={weekday} onValueChange={setWeekday}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Month">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Year">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-28"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.iso} />
          </PanelHeader>
          <div className="space-y-2 p-4">
            <div className="text-sm text-muted-foreground">{result.longLabel}</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tabular-nums">
                {result.iso}
              </span>
              <CopyButton value={result.iso} size="icon-sm" />
            </div>
            <div className="text-sm text-muted-foreground">{result.weekday}</div>
          </div>
          <StatBar
            items={[
              `Day of month: ${result.day}`,
              `Occurrence: ${result.ordinalLabel}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
