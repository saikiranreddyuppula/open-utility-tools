'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_MIN = 60 * 1000;

function nowMinusDaysISO(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:00`;
}

// Parse "HH:MM" to minutes since midnight; returns null if invalid.
function parseHM(v: string): number | null {
  const parts = v.split(':');
  const hStr = parts[0];
  const mStr = parts[1];
  if (hStr === undefined || mStr === undefined) return null;
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DayRow {
  date: string;
  dow: string;
  minutes: number;
}

interface Computed {
  totalMinutes: number;
  workingDays: number;
  rows: DayRow[];
}

function compute(
  start: Date,
  end: Date,
  winStart: number,
  winEnd: number,
  lunch: number,
  lunchStart: number,
  lunchEnd: number,
  activeDows: Set<number>,
): Computed {
  const rows: DayRow[] = [];
  let totalMinutes = 0;
  let workingDays = 0;

  // Iterate from the start day's midnight to the end day's midnight.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let guard = 0;
  while (cursor.getTime() <= lastDay.getTime() && guard < 4000) {
    guard += 1;
    const dow = cursor.getDay();
    if (activeDows.has(dow)) {
      const dayMid = cursor.getTime();
      const winA = dayMid + winStart * MS_MIN;
      const winB = dayMid + winEnd * MS_MIN;
      const lo = Math.max(winA, start.getTime());
      const hi = Math.min(winB, end.getTime());
      let mins = Math.max(0, Math.round((hi - lo) / MS_MIN));
      // Subtract the portion of the lunch window that overlaps the worked interval.
      if (lunch > 0 && mins > 0) {
        const lunchA = dayMid + lunchStart * MS_MIN;
        const lunchB = dayMid + lunchEnd * MS_MIN;
        const overlap = Math.max(0, Math.min(hi, lunchB) - Math.max(lo, lunchA)) / MS_MIN;
        mins -= Math.round(Math.min(lunch, overlap));
        if (mins < 0) mins = 0;
      }
      if (mins > 0) {
        rows.push({ date: fmtDate(cursor), dow: DOW_LABELS[dow] ?? '', minutes: mins });
        totalMinutes += mins;
        workingDays += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { totalMinutes, workingDays, rows };
}

export default function WorkingHoursCalculatorTool() {
  const [start, setStart] = useState(nowMinusDaysISO(4, 9));
  const [end, setEnd] = useState(nowMinusDaysISO(0, 17));
  const [winStart, setWinStart] = useState('09:00');
  const [winEnd, setWinEnd] = useState('17:00');
  const [lunch, setLunch] = useState('60');
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

  const toggleDay = (d: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const result = useMemo<{ error: string } | { data: Computed }>(() => {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime())) return { error: 'Enter a valid start datetime.' };
    if (Number.isNaN(e.getTime())) return { error: 'Enter a valid end datetime.' };
    if (e.getTime() <= s.getTime()) return { error: 'End must be after start.' };
    const ws = parseHM(winStart);
    const we = parseHM(winEnd);
    if (ws === null) return { error: 'Window start must be HH:MM (00:00-23:59).' };
    if (we === null) return { error: 'Window end must be HH:MM (00:00-23:59).' };
    if (we <= ws) return { error: 'Work-window end must be after its start.' };
    const lunchMin = Number(lunch);
    if (!Number.isFinite(lunchMin) || lunchMin < 0) return { error: 'Lunch minutes must be 0 or more.' };
    if (lunchMin > we - ws) return { error: 'Lunch is longer than the daily work window.' };
    if (days.size === 0) return { error: 'Select at least one working weekday.' };

    // Center the lunch window in the middle of the work day.
    const span = we - ws;
    const lunchStart = ws + Math.floor((span - lunchMin) / 2);
    const lunchEnd = lunchStart + lunchMin;

    const data = compute(s, e, ws, we, lunchMin, lunchStart, lunchEnd, days);
    return { data };
  }, [start, end, winStart, winEnd, lunch, days]);

  const ok = 'data' in result;
  const totalHrs = ok ? Math.floor(result.data.totalMinutes / 60) : 0;
  const totalMins = ok ? result.data.totalMinutes % 60 : 0;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start datetime">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End datetime">
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Work day start">
            <Input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
          </Field>
          <Field label="Work day end">
            <Input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
          </Field>
          <Field label="Lunch (min)">
            <Input type="number" min={0} value={lunch} onChange={(e) => setLunch(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
        <div className="flex flex-wrap items-center gap-3 px-3 pb-3">
          <span className="text-sm text-muted-foreground">Working days:</span>
          {DOW_LABELS.map((lbl, idx) => (
            <label key={lbl} className="flex items-center gap-1.5">
              <Checkbox checked={days.has(idx)} onCheckedChange={() => toggleDay(idx)} />
              <Label className="cursor-pointer text-sm">{lbl}</Label>
            </label>
          ))}
        </div>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Net working time">
            <CopyButton
              value={() =>
                `${totalHrs}h ${totalMins}m over ${result.data.workingDays} working day(s)\n` +
                result.data.rows.map((r) => `${r.date} (${r.dow}): ${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`).join('\n')
              }
            />
          </PanelHeader>
          <div className="px-3 pt-3">
            <p className="text-2xl font-semibold tabular-nums">
              {totalHrs}h {totalMins}m
            </p>
            <p className="text-sm text-muted-foreground">
              {result.data.totalMinutes.toLocaleString()} minutes · {(result.data.totalMinutes / 60).toFixed(2)} hours
            </p>
          </div>
          <div className="max-h-[320px] divide-y overflow-auto p-3">
            {result.data.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No working time in this range.</p>
            ) : (
              result.data.rows.map((r) => (
                <div key={r.date} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-mono text-xs">
                    {r.date} <span className="text-muted-foreground">{r.dow}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {Math.floor(r.minutes / 60)}h {r.minutes % 60}m
                  </span>
                </div>
              ))
            )}
          </div>
          <StatBar
            items={[
              `Working days: ${result.data.workingDays}`,
              `Total: ${(result.data.totalMinutes / 60).toFixed(2)} h`,
              `Lunch deducted: ${lunch} min/day`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
