'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type WeekStart = 'sun' | 'mon';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(y: number, m0: number, day: number): string {
  return `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** day-of-week (0=Sun) of a UTC date, range-safe. */
function dowUTC(y: number, m0: number, day: number): number {
  return new Date(Date.UTC(y, m0, day)).getUTCDay();
}

export default function WeekOfMonthFinder() {
  const [dateStr, setDateStr] = useState(todayISO());
  const [weekStart, setWeekStart] = useState<WeekStart>('sun');

  const result = useMemo(() => {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return { error: 'Enter a valid date (YYYY-MM-DD).' };
    const y = Number(m[1] ?? '');
    const mo = Number(m[2] ?? '');
    const day = Number(m[3] ?? '');
    if (![y, mo, day].every((n) => Number.isFinite(n)) || mo < 1 || mo > 12 || day < 1 || day > 31) {
      return { error: 'Enter a valid date (YYYY-MM-DD).' };
    }
    const m0 = mo - 1;
    const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
    if (day > daysInMonth) return { error: `Day ${day} is out of range for that month.` };

    const startIdx = weekStart === 'mon' ? 1 : 0; // weekday index that begins a row

    // Convention 1: simple = ceil(dayOfMonth / 7)
    const simple = Math.ceil(day / 7);

    // Convention 2: calendar-aligned row index. Week #1 contains the 1st;
    // increments each time we cross the week-start boundary.
    const firstDow = dowUTC(y, m0, 1);
    const offsetOfFirst = (firstDow - startIdx + 7) % 7; // cells before the 1st in its row
    const calendar = Math.ceil((day + offsetOfFirst) / 7);

    // The calendar week row this date sits in: span dates.
    const dateDow = dowUTC(y, m0, day);
    const backToStart = (dateDow - startIdx + 7) % 7;
    const rowStartDay = day - backToStart; // may be <= 0 (previous month)
    const rowEndDay = rowStartDay + 6; // may exceed daysInMonth (next month)

    const rowStart =
      rowStartDay >= 1
        ? fmt(y, m0, rowStartDay)
        : (() => {
            const d = new Date(Date.UTC(y, m0, rowStartDay));
            return fmt(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          })();
    const rowEnd =
      rowEndDay <= daysInMonth
        ? fmt(y, m0, rowEndDay)
        : (() => {
            const d = new Date(Date.UTC(y, m0, rowEndDay));
            return fmt(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          })();

    // Convention 3: ISO-style first-full-week. The first week that lies
    // entirely within the month is week 1; partial leading days are week 0.
    const firstFullWeekStartDay = offsetOfFirst === 0 ? 1 : 1 + (7 - offsetOfFirst);
    const isoStyle =
      day < firstFullWeekStartDay
        ? 0
        : Math.floor((day - firstFullWeekStartDay) / 7) + 1;

    const weekday = WEEKDAYS[dateDow] ?? '';

    return {
      simple,
      calendar,
      isoStyle,
      weekday,
      rowStart,
      rowEnd,
      isWeekend: dateDow === 0 || dateDow === 6,
      daysInMonth,
    };
  }, [dateStr, weekStart]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Date">
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Week starts on">
            <Tabs value={weekStart} onValueChange={(v) => setWeekStart(v as WeekStart)}>
              <TabsList>
                <TabsTrigger value="sun">Sunday</TabsTrigger>
                <TabsTrigger value="mon">Monday</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Week of month">
            <CopyButton
              value={() =>
                [
                  `Simple (ceil): week ${result.simple}`,
                  `Calendar row: week ${result.calendar}`,
                  `First-full-week: ${result.isoStyle === 0 ? 'week 0 (partial)' : `week ${result.isoStyle}`}`,
                  `Weekday: ${result.weekday}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Simple — ceil(day/7)', value: `Week ${result.simple}` },
              { label: 'Calendar-aligned row', value: `Week ${result.calendar}` },
              {
                label: 'First-full-week (ISO style)',
                value: result.isoStyle === 0 ? 'Week 0 (partial)' : `Week ${result.isoStyle}`,
              },
            ].map((r) => (
              <div
                key={r.label}
                className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">{r.label}</span>
                <span className="font-mono text-lg font-semibold">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
            {[
              { label: 'Weekday', value: result.weekday },
              { label: 'Weekend?', value: result.isWeekend ? 'Yes' : 'No' },
              { label: 'Calendar week spans', value: `${result.rowStart} → ${result.rowEnd}` },
              { label: 'Days in month', value: String(result.daysInMonth) },
            ].map((r) => (
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
              `weekday ${result.weekday}`,
              result.isWeekend && 'weekend',
              `row ${result.rowStart} → ${result.rowEnd}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
