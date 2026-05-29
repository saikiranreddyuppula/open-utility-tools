'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export default function WeekNumberTool() {
  const [date, setDate] = useState(todayStr());

  const result = useMemo(() => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const { week, year } = isoWeek(d);
    const start = new Date(d.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return {
      week,
      year,
      iso: `${year}-W${String(week).padStart(2, '0')}`,
      dayOfYear,
      weekday,
    };
  }, [date]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs font-mono" />
      </div>
      {result && (
        <>
          <div className="rounded-lg border bg-card p-5 text-center">
            <div className="font-mono text-3xl font-semibold">Week {result.week}</div>
            <div className="text-2xs text-muted-foreground">{result.iso}</div>
          </div>
          <Panel>
            <div className="divide-y">
              {[
                ['ISO week', String(result.week)],
                ['ISO week-year', String(result.year)],
                ['Weekday', result.weekday],
                ['Day of year', String(result.dayOfYear)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-2">
                  <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                  <span className="font-mono text-sm font-semibold tabular">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
