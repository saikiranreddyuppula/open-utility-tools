'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'count' | 'add';

function parseDate(value: string): Date | null {
  if (!value) return null;
  // value is expected as YYYY-MM-DD from the date input
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDate(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function todayISO(): string {
  return formatDate(new Date());
}

export default function BusinessDaysCalculator() {
  const [mode, setMode] = useState<Mode>('count');
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [endDate, setEndDate] = useState<string>(todayISO());
  const [includeStart, setIncludeStart] = useState<boolean>(true);
  const [offset, setOffset] = useState<string>('5');

  const countResult = useMemo(() => {
    if (mode !== 'count') return null;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start) return { error: 'Enter a valid start date.' };
    if (!end) return { error: 'Enter a valid end date.' };

    let from = start;
    let to = end;
    let reversed = false;
    if (from.getTime() > to.getTime()) {
      [from, to] = [to, from];
      reversed = true;
    }

    let business = 0;
    let weekend = 0;
    let total = 0;
    const cursor = new Date(from.getTime());
    while (cursor.getTime() <= to.getTime()) {
      const sameAsStart = cursor.getTime() === from.getTime();
      const include = includeStart || !sameAsStart;
      if (include) {
        total += 1;
        if (isWeekend(cursor)) weekend += 1;
        else business += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { business, weekend, total, reversed, error: null as string | null };
  }, [mode, startDate, endDate, includeStart]);

  const addResult = useMemo(() => {
    if (mode !== 'add') return null;
    const start = parseDate(startDate);
    if (!start) return { error: 'Enter a valid start date.' };
    const n = Number(offset);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: 'Enter a whole number of business days.' };
    }

    const step = n >= 0 ? 1 : -1;
    let remaining = Math.abs(n);
    const cursor = new Date(start.getTime());
    while (remaining > 0) {
      cursor.setDate(cursor.getDate() + step);
      if (!isWeekend(cursor)) remaining -= 1;
    }

    const resultDate = formatDate(cursor);
    const weekday = WEEKDAY_NAMES[cursor.getDay()] ?? '';
    return { resultDate, weekday, error: null as string | null };
  }, [mode, startDate, offset]);

  const error = mode === 'count' ? countResult?.error ?? null : addResult?.error ?? null;

  return (
    <Panel>
      <PanelHeader title="Business Days Calculator" />
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="count">Count between dates</TabsTrigger>
              <TabsTrigger value="add">Add business days</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      {mode === 'count' ? (
        <OptionsBar>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Include start day" hint="Count the start date itself">
            <Tabs
              value={includeStart ? 'yes' : 'no'}
              onValueChange={(v) => setIncludeStart(v === 'yes')}
            >
              <TabsList>
                <TabsTrigger value="yes">Yes</TabsTrigger>
                <TabsTrigger value="no">No</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      ) : (
        <OptionsBar>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Business days" hint="Negative goes backwards">
            <Input
              type="number"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
            />
          </Field>
        </OptionsBar>
      )}

      <ErrorBanner error={error} />

      {mode === 'count' && countResult && !countResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar
            items={[
              `Business days: ${countResult.business}`,
              `Weekend days: ${countResult.weekend}`,
              `Calendar days: ${countResult.total}`,
              countResult.reversed && 'End date was before start date',
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {countResult.business}
            </span>
            <span className="text-sm text-muted-foreground">working days</span>
            <CopyButton value={String(countResult.business)} />
          </div>
        </div>
      ) : null}

      {mode === 'add' && addResult && !addResult.error ? (
        <div className="space-y-3 p-1">
          <StatBar items={[`Result day: ${addResult.weekday}`]} />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{addResult.resultDate}</span>
            <span className="text-sm text-muted-foreground">{addResult.weekday}</span>
            <CopyButton value={addResult.resultDate ?? ''} />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
