'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const MS_DAY = 1000 * 60 * 60 * 24;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Result {
  reversed: boolean;
  totalDays: number;
  fullWeeks: number;
  leftoverDays: number;
  fullMonths: number;
  leftoverMonthDays: number;
  weekendDays: number;
  businessDays: number;
}

function compute(from: Date, to: Date): Result {
  const reversed = to.getTime() < from.getTime();
  const a = reversed ? to : from;
  const b = reversed ? from : to;

  const totalDays = Math.round((b.getTime() - a.getTime()) / MS_DAY);
  const fullWeeks = Math.floor(totalDays / 7);
  const leftoverDays = totalDays % 7;

  // Month-step from a toward b, clamping month-end overflow.
  let fullMonths = 0;
  const cursor = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const dayOfMonth = a.getDate();
  for (;;) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const daysInNext = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayOfMonth, daysInNext));
    if (next.getTime() > b.getTime()) break;
    cursor.setTime(next.getTime());
    fullMonths += 1;
  }
  const leftoverMonthDays = Math.round((b.getTime() - cursor.getTime()) / MS_DAY);

  // Count weekend days and business days across the span (exclusive of start day,
  // inclusive through the end day so the span covers totalDays calendar days).
  let weekendDays = 0;
  let businessDays = 0;
  for (let i = 1; i <= totalDays; i += 1) {
    const d = new Date(a.getTime() + i * MS_DAY);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) weekendDays += 1;
    else businessDays += 1;
  }

  return {
    reversed,
    totalDays,
    fullWeeks,
    leftoverDays,
    fullMonths,
    leftoverMonthDays,
    weekendDays,
    businessDays,
  };
}

export default function WeeksUntilDateTool() {
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState(todayISO());

  const result = useMemo<{ error: string } | { rows: { label: string; value: string }[]; res: Result }>(() => {
    const t = parseDate(target);
    const f = parseDate(from);
    if (!f) return { error: 'Enter a valid "from" date.' };
    if (!t) return { error: 'Enter a valid target date.' };
    const res = compute(f, t);
    const rows = [
      { label: 'Total calendar days', value: res.totalDays.toLocaleString() },
      {
        label: 'Full weeks + days',
        value: `${res.fullWeeks.toLocaleString()} week${res.fullWeeks === 1 ? '' : 's'} ${res.leftoverDays} day${res.leftoverDays === 1 ? '' : 's'}`,
      },
      {
        label: 'Full months + days',
        value: `${res.fullMonths.toLocaleString()} month${res.fullMonths === 1 ? '' : 's'} ${res.leftoverMonthDays} day${res.leftoverMonthDays === 1 ? '' : 's'}`,
      },
      { label: 'Weekend days (Sat/Sun)', value: res.weekendDays.toLocaleString() },
      { label: 'Business days (Mon-Fri)', value: res.businessDays.toLocaleString() },
    ];
    return { rows, res };
  }, [target, from]);

  const ok = 'rows' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="From date">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={result.res.reversed ? 'Span (target is in the past)' : 'Span until target'}>
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
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
              `From ${from}`,
              `To ${target}`,
              result.res.reversed ? 'Direction: past' : 'Direction: future',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
