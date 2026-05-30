'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_DAY = 1000 * 60 * 60 * 24;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Add `n` months, clamping the day to the target month's last day.
function addMonths(base: Date, n: number, anchorDay: number): Date {
  const total = base.getFullYear() * 12 + base.getMonth() + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchorDay, dim));
}

interface Occ {
  date: string;
  weekday: string;
  gapDays: number;
}

function generate(
  start: Date,
  freq: Freq,
  interval: number,
  count: number,
  weekdayFilter: Set<number>,
  end: Date | null,
): Occ[] {
  const out: Occ[] = [];
  const anchorDay = start.getDate();
  let prev: Date | null = null;
  let guard = 0;
  const maxGuard = 20000;

  if (freq === 'weekly' && weekdayFilter.size > 0) {
    // Step day-by-day across weeks of width `interval`; include selected weekdays.
    const startWeekIndex = Math.floor(start.getTime() / (MS_DAY * 7));
    const cursor = new Date(start.getTime());
    while (out.length < count && guard < maxGuard) {
      guard += 1;
      if (cursor.getTime() < start.getTime()) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      if (end && cursor.getTime() > end.getTime()) break;
      const weekIndex = Math.floor(cursor.getTime() / (MS_DAY * 7));
      const onInterval = (weekIndex - startWeekIndex) % interval === 0;
      if (onInterval && weekdayFilter.has(cursor.getDay())) {
        const cur = new Date(cursor.getTime());
        const gap = prev ? Math.round((cur.getTime() - prev.getTime()) / MS_DAY) : 0;
        out.push({ date: fmt(cur), weekday: WEEKDAYS[cur.getDay()] ?? '', gapDays: gap });
        prev = cur;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  // Non-filtered: step the date by interval * frequency.
  let step = 0;
  while (out.length < count && guard < maxGuard) {
    guard += 1;
    let cur: Date;
    if (freq === 'daily') cur = new Date(start.getTime() + step * interval * MS_DAY);
    else if (freq === 'weekly') cur = new Date(start.getTime() + step * interval * 7 * MS_DAY);
    else if (freq === 'monthly') cur = addMonths(start, step * interval, anchorDay);
    else cur = addMonths(start, step * interval * 12, anchorDay); // yearly
    step += 1;
    if (end && cur.getTime() > end.getTime()) break;
    const gap = prev ? Math.round((cur.getTime() - prev.getTime()) / MS_DAY) : 0;
    out.push({ date: fmt(cur), weekday: WEEKDAYS[cur.getDay()] ?? '', gapDays: gap });
    prev = cur;
  }
  return out;
}

export default function RecurringEventDatesTool() {
  const [start, setStart] = useState(todayISO());
  const [freq, setFreq] = useState<Freq>('weekly');
  const [interval, setInterval] = useState('1');
  const [count, setCount] = useState('10');
  const [end, setEnd] = useState('');
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());

  const toggleWd = (d: number) => {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const result = useMemo<{ error: string } | { occ: Occ[] }>(() => {
    const s = parseDate(start);
    if (!s) return { error: 'Enter a valid start date.' };
    const iv = Number(interval);
    if (!Number.isInteger(iv) || iv < 1) return { error: 'Interval must be a whole number ≥ 1.' };
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) return { error: 'Count must be between 1 and 500.' };
    const e = end ? parseDate(end) : null;
    if (end && !e) return { error: 'End date is invalid (leave blank for none).' };
    if (e && e.getTime() < s.getTime()) return { error: 'End date must be on or after the start date.' };
    const occ = generate(s, freq, iv, n, freq === 'weekly' ? weekdays : new Set<number>(), e);
    if (occ.length === 0) return { error: 'No occurrences — check the end date and weekday filter.' };
    return { occ };
  }, [start, freq, interval, count, end, weekdays]);

  const ok = 'occ' in result;
  const text = ok ? result.occ.map((o) => `${o.date} (${o.weekday})`).join('\n') : '';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start date">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Frequency">
            <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Every (interval)">
            <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} className="w-20" inputMode="numeric" />
          </Field>
          <Field label="Count">
            <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} className="w-20" inputMode="numeric" />
          </Field>
          <Field label="End date (optional)">
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </OptionsBar>
        {freq === 'weekly' ? (
          <div className="flex flex-wrap items-center gap-3 px-3 pb-3">
            <span className="text-sm text-muted-foreground">On weekdays (none = use start weekday):</span>
            {WD_SHORT.map((lbl, idx) => (
              <label key={lbl} className="flex items-center gap-1.5">
                <Checkbox checked={weekdays.has(idx)} onCheckedChange={() => toggleWd(idx)} />
                <Label className="cursor-pointer text-sm">{lbl}</Label>
              </label>
            ))}
          </div>
        ) : null}
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${result.occ.length} occurrence${result.occ.length === 1 ? '' : 's'}`}>
            <CopyButton value={() => text} label="Copy all" />
            <DownloadButton data={() => text} filename="recurring-dates.txt" />
          </PanelHeader>
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.occ.map((o, i) => (
              <div key={`${o.date}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <code className="w-28 shrink-0 font-mono text-sm">{o.date}</code>
                <span className="w-24 shrink-0 text-sm">{o.weekday}</span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{i === 0 ? 'first' : `+${o.gapDays} day${o.gapDays === 1 ? '' : 's'}`}</span>
                <CopyButton value={o.date} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.occ.length} dates`,
              `Every ${interval} ${freq}`,
              end ? `Until ${end}` : 'No end date',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
