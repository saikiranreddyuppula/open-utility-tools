'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Mode = 'toWeek' | 'toDate';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ISO weekday: Mon=1 .. Sun=7
function isoDow(d: Date): number {
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

// Returns the Monday (UTC) of ISO week 1 of a given ISO year.
function week1Monday(isoYear: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dow = isoDow(jan4);
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (dow - 1));
  return monday;
}

function weeksInIsoYear(isoYear: number): number {
  const start = week1Monday(isoYear);
  const next = week1Monday(isoYear + 1);
  return Math.round((next.getTime() - start.getTime()) / (7 * 86400000));
}

interface WeekInfo {
  isoYear: number;
  week: number;
  weekday: number;
}

function dateToIsoWeek(d: Date): WeekInfo {
  const day = isoDow(d);
  // Thursday of the current week determines the ISO year.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (4 - day));
  const isoYear = thursday.getUTCFullYear();
  const firstMonday = week1Monday(isoYear);
  const week = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  return { isoYear, week, weekday: day };
}

type ToWeekResult =
  | { error: string }
  | {
      isoWeekDate: string;
      isoYear: number;
      week: number;
      weekdayName: string;
      weekday: number;
      weeksInYear: number;
      calendar: string;
    };

function computeToWeek(dateStr: string): ToWeekResult {
  const text = dateStr.trim();
  if (!text) return { error: 'Pick a calendar date.' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return { error: 'Date must be YYYY-MM-DD.' };
  const y = Number(m[1] ?? '');
  const mo = Number(m[2] ?? '');
  const da = Number(m[3] ?? '');
  if (![y, mo, da].every(Number.isFinite)) return { error: 'Invalid date fields.' };
  const d = new Date(Date.UTC(y, mo - 1, da));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) {
    return { error: 'That calendar date does not exist.' };
  }
  const { isoYear, week, weekday } = dateToIsoWeek(d);
  return {
    isoWeekDate: `${isoYear}-W${pad2(week)}-${weekday}`,
    isoYear,
    week,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday - 1] ?? '',
    weeksInYear: weeksInIsoYear(isoYear),
    calendar: `${y}-${pad2(mo)}-${pad2(da)}`,
  };
}

type ToDateResult =
  | { error: string }
  | {
      calendar: string;
      isoWeekDate: string;
      weekdayName: string;
      weeksInYear: number;
      isoYear: number;
    };

function computeToDate(isoYearStr: string, weekStr: string, weekday: number): ToDateResult {
  const isoYear = Number(isoYearStr);
  const week = Number(weekStr);
  if (!Number.isInteger(isoYear)) return { error: 'ISO year must be an integer.' };
  if (!Number.isInteger(week) || week < 1) return { error: 'Week must be a positive integer.' };
  const maxWeeks = weeksInIsoYear(isoYear);
  if (week > maxWeeks) return { error: `${isoYear} has only ${maxWeeks} ISO weeks.` };
  const monday = week1Monday(isoYear);
  const result = new Date(monday);
  result.setUTCDate(monday.getUTCDate() + (week - 1) * 7 + (weekday - 1));
  return {
    calendar: `${result.getUTCFullYear()}-${pad2(result.getUTCMonth() + 1)}-${pad2(result.getUTCDate())}`,
    isoWeekDate: `${isoYear}-W${pad2(week)}-${weekday}`,
    weekdayName: WEEKDAY_NAMES[weekday - 1] ?? '',
    weeksInYear: maxWeeks,
    isoYear,
  };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function IsoWeekDateConverterTool() {
  const [mode, setMode] = useState<Mode>('toWeek');
  const [dateStr, setDateStr] = useState(todayStr());
  const [isoYear, setIsoYear] = useState('2026');
  const [week, setWeek] = useState('1');
  const [weekday, setWeekday] = useState('1');

  const toWeek = useMemo(() => computeToWeek(dateStr), [dateStr]);
  const toDate = useMemo(
    () => computeToDate(isoYear, week, Number(weekday)),
    [isoYear, week, weekday],
  );

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="toWeek">Date → ISO week</TabsTrigger>
          <TabsTrigger value="toDate">ISO week → Date</TabsTrigger>
        </TabsList>

        <TabsContent value="toWeek" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="Calendar date">
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="font-mono" />
              </Field>
            </OptionsBar>
          </Panel>
          {'error' in toWeek ? (
            <ErrorBanner error={toWeek.error} />
          ) : (
            <Panel>
              <PanelHeader title="ISO week date">
                <CopyButton value={toWeek.isoWeekDate} />
              </PanelHeader>
              <div className="rounded-lg border bg-card p-5 text-center">
                <div className="font-mono text-3xl font-semibold">{toWeek.isoWeekDate}</div>
                <div className="text-2xs text-muted-foreground">{toWeek.weekdayName} of week {toWeek.week}</div>
              </div>
              <div className="divide-y">
                {[
                  ['ISO week-year', String(toWeek.isoYear)],
                  ['Week number', String(toWeek.week)],
                  ['ISO weekday', `${toWeek.weekday} (${toWeek.weekdayName})`],
                  ['Weeks in this ISO year', `${toWeek.weeksInYear}${toWeek.weeksInYear === 53 ? ' (long year)' : ''}`],
                  ['Calendar date', toWeek.calendar],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="font-mono text-sm font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="toDate" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="ISO year">
                <Input value={isoYear} onChange={(e) => setIsoYear(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
              </Field>
              <Field label="Week">
                <Input value={week} onChange={(e) => setWeek(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
              </Field>
              <Field label="Weekday">
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>{i + 1} — {name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </OptionsBar>
          </Panel>
          {'error' in toDate ? (
            <ErrorBanner error={toDate.error} />
          ) : (
            <Panel>
              <PanelHeader title="Calendar date">
                <CopyButton value={toDate.calendar} />
              </PanelHeader>
              <div className="rounded-lg border bg-card p-5 text-center">
                <div className="font-mono text-3xl font-semibold">{toDate.calendar}</div>
                <div className="text-2xs text-muted-foreground">{toDate.weekdayName} · {toDate.isoWeekDate}</div>
              </div>
              <div className="divide-y">
                {[
                  ['ISO week date', toDate.isoWeekDate],
                  ['Weekday', toDate.weekdayName],
                  ['Weeks in this ISO year', `${toDate.weeksInYear}${toDate.weeksInYear === 53 ? ' (long year)' : ''}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="font-mono text-sm font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <StatBar items={[`ISO ${toDate.isoYear}`]} />
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
