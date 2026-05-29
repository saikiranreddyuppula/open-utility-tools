'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DateDifferenceTool() {
  const [from, setFrom] = useState('2000-01-01');
  const [to, setTo] = useState(todayStr());

  const result = useMemo(() => {
    const a = new Date(from);
    const b = new Date(to);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    const ms = Math.abs(b.getTime() - a.getTime());
    const sec = ms / 1000;
    const days = ms / 86400000;

    // Calendar Y/M/D breakdown between the earlier (lo) and later (hi) date.
    const lo = a <= b ? a : b;
    const hi = a <= b ? b : a;
    let years = hi.getFullYear() - lo.getFullYear();
    let months = hi.getMonth() - lo.getMonth();
    let dayDiff = hi.getDate() - lo.getDate();
    if (dayDiff < 0) {
      months -= 1;
      const prevMonth = new Date(hi.getFullYear(), hi.getMonth(), 0).getDate();
      dayDiff += prevMonth;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return {
      calendar: `${years} years, ${months} months, ${dayDiff} days`,
      totalDays: Math.floor(days).toLocaleString(),
      totalWeeks: (days / 7).toFixed(1),
      totalHours: Math.floor(sec / 3600).toLocaleString(),
      totalMinutes: Math.floor(sec / 60).toLocaleString(),
      totalSeconds: Math.floor(sec).toLocaleString(),
    };
  }, [from, to]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="font-mono" />
        </div>
      </div>

      {result && (
        <Panel>
          <PanelHeader title="Difference" />
          <div className="divide-y">
            {[
              ['Calendar', result.calendar],
              ['Total days', result.totalDays],
              ['Total weeks', result.totalWeeks],
              ['Total hours', result.totalHours],
              ['Total minutes', result.totalMinutes],
              ['Total seconds', result.totalSeconds],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                <span className="font-mono text-sm font-semibold tabular">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
