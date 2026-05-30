'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function defaultNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function humanDuration(ms: number): string {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return (neg ? '-' : '') + parts.join(' ');
}

interface Row {
  period: string;
  start: number;
  end: number;
}

function buildRows(d: Date): Row[] {
  const t = d.getTime();
  const y = d.getFullYear();
  const mo = d.getMonth();

  const minStart = new Date(t);
  minStart.setSeconds(0, 0);
  const hourStart = new Date(t);
  hourStart.setMinutes(0, 0, 0);
  const dayStart = new Date(y, mo, d.getDate());
  // week starts Monday
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(y, mo, d.getDate() - dow);
  const monthStart = new Date(y, mo, 1);
  const quarter = Math.floor(mo / 3);
  const quarterStart = new Date(y, quarter * 3, 1);
  const yearStart = new Date(y, 0, 1);

  return [
    { period: 'Minute', start: minStart.getTime(), end: minStart.getTime() + 60000 },
    { period: 'Hour', start: hourStart.getTime(), end: hourStart.getTime() + 3600000 },
    { period: 'Day', start: dayStart.getTime(), end: new Date(y, mo, d.getDate() + 1).getTime() },
    { period: 'Week (Mon)', start: weekStart.getTime(), end: new Date(weekStart.getTime() + 7 * 86400000).getTime() },
    { period: 'Month', start: monthStart.getTime(), end: new Date(y, mo + 1, 1).getTime() },
    { period: 'Quarter', start: quarterStart.getTime(), end: new Date(y, quarter * 3 + 3, 1).getTime() },
    { period: 'Year', start: yearStart.getTime(), end: new Date(y + 1, 0, 1).getTime() },
  ];
}

interface Computed {
  period: string;
  pctElapsed: number;
  pctRemaining: number;
  elapsed: string;
  remaining: string;
}

function compute(dateStr: string): { rows: Computed[]; iso: string } | { error: string } {
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) return { error: 'Enter a valid datetime.' };
  const d = new Date(ms);
  const rows = buildRows(d).map((r): Computed => {
    const len = r.end - r.start;
    const elapsedMs = ms - r.start;
    const pct = len > 0 ? (elapsedMs / len) * 100 : 0;
    return {
      period: r.period,
      pctElapsed: pct,
      pctRemaining: 100 - pct,
      elapsed: humanDuration(elapsedMs),
      remaining: humanDuration(r.end - ms),
    };
  });
  return { rows, iso: d.toString() };
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default function DayPercentageElapsed() {
  const [dateStr, setDateStr] = useState(defaultNow());

  const result = useMemo(() => compute(dateStr), [dateStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Moment">
            <Input type="datetime-local" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </Field>
          <Field label="Reset">
            <Button variant="secondary" size="sm" className="h-9" onClick={() => setDateStr(defaultNow())}>
              Now
            </Button>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Elapsed">
            <CopyButton
              value={() => result.rows.map((r) => `${r.period}: ${r.pctElapsed.toFixed(2)}% elapsed`).join('\n')}
            />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.period} className="flex flex-col gap-1.5 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{r.period}</span>
                  <span className="font-mono text-sm tabular">{r.pctElapsed.toFixed(2)}%</span>
                </div>
                <Bar pct={r.pctElapsed} />
                <div className="flex items-center justify-between font-mono text-2xs text-muted-foreground">
                  <span>elapsed {r.elapsed}</span>
                  <span>{r.remaining} / {r.pctRemaining.toFixed(2)}% left</span>
                </div>
              </div>
            ))}
          </div>
          <StatBar items={[result.iso]} />
        </Panel>
      )}
    </div>
  );
}
