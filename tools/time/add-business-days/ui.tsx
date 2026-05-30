'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function formatDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(value: string): Date | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function todayISO(): string {
  return formatDate(new Date());
}

type DayResult =
  | { error: string }
  | {
      resultDate: string;
      weekday: string;
      calendarSpan: number;
      skipped: string[];
    };

export default function AddBusinessDays() {
  const [start, setStart] = useState<string>(todayISO());
  const [count, setCount] = useState<string>('10');
  const [weekend, setWeekend] = useState<boolean[]>([
    true, // Sunday
    false,
    false,
    false,
    false,
    false,
    true, // Saturday
  ]);
  const [holidaysText, setHolidaysText] = useState<string>('');

  const result = useMemo<DayResult>(() => {
    const startDate = parseISODate(start);
    if (!startDate) return { error: 'Enter a valid start date.' };

    const n = Number(count);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: 'Enter a whole number of business days.' };
    }

    if (weekend.every((w) => w)) {
      return { error: 'Every weekday is marked as a weekend — no business days exist.' };
    }

    const holidaySet = new Set<string>();
    for (const raw of holidaysText.split('\n')) {
      const line = raw.trim();
      if (line === '') continue;
      const h = parseISODate(line);
      if (h) holidaySet.add(formatDate(h));
    }

    const isBusiness = (d: Date): boolean => {
      if (weekend[d.getDay()] === true) return false;
      if (holidaySet.has(formatDate(d))) return false;
      return true;
    };

    if (n === 0) {
      return {
        resultDate: formatDate(startDate),
        weekday: WEEKDAY_NAMES[startDate.getDay()] ?? '',
        calendarSpan: 0,
        skipped: [],
      };
    }

    const step = n > 0 ? 1 : -1;
    let remaining = Math.abs(n);
    const cursor = new Date(startDate.getTime());
    const skipped: string[] = [];
    let calendarSpan = 0;

    // Cap iterations to avoid runaway loops on absurd inputs.
    let guard = 0;
    const MAX = 200000;
    while (remaining > 0 && guard < MAX) {
      cursor.setDate(cursor.getDate() + step);
      calendarSpan += 1;
      guard += 1;
      if (isBusiness(cursor)) {
        remaining -= 1;
      } else if (skipped.length < 60) {
        const label =
          weekend[cursor.getDay()] === true
            ? `${formatDate(cursor)} (${WEEKDAY_NAMES[cursor.getDay()] ?? ''})`
            : `${formatDate(cursor)} (holiday)`;
        skipped.push(label);
      }
    }

    if (guard >= MAX) {
      return { error: 'Count is too large to compute.' };
    }

    return {
      resultDate: formatDate(cursor),
      weekday: WEEKDAY_NAMES[cursor.getDay()] ?? '',
      calendarSpan,
      skipped,
    };
  }, [start, count, weekend, holidaysText]);

  const toggleWeekend = (idx: number) => {
    setWeekend((prev) => prev.map((w, i) => (i === idx ? !w : w)));
  };

  const ok = !('error' in result);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Add Business Days" />
        <OptionsBar>
          <Field label="Start date">
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Business days" hint="Negative goes backwards">
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Weekend / non-working weekdays">
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_NAMES.map((name, i) => (
                <label key={name} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={weekend[i] === true}
                    onCheckedChange={() => toggleWeekend(i)}
                  />
                  <span>{name.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Holidays (one ISO date per line)" className="min-w-[260px] flex-1">
            <Textarea
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder={'2026-01-01\n2026-12-25'}
              spellCheck={false}
              className="min-h-20 font-mono text-xs"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={result.resultDate} />
          </PanelHeader>
          <div className="flex items-center gap-2 p-3">
            <span className="text-2xl font-semibold tabular-nums">
              {result.resultDate}
            </span>
            <span className="text-sm text-muted-foreground">{result.weekday}</span>
          </div>
          <StatBar
            items={[
              `Calendar days spanned: ${result.calendarSpan}`,
              `Non-business days skipped: ${result.skipped.length}`,
            ]}
          />
          {result.skipped.length > 0 ? (
            <div className="max-h-48 overflow-auto border-t p-3">
              <div className="mb-1 text-2xs uppercase tracking-wide text-muted-foreground">
                Skipped days
              </div>
              <div className="flex flex-col gap-0.5 font-mono text-xs">
                {result.skipped.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        <Label className="text-xs">Tip:</Label> Steps one calendar day at a time in the
        direction of the sign, decrementing only when the landed day is a business day.
      </p>
    </div>
  );
}
