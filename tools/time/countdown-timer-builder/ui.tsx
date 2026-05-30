'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

// Build a `datetime-local` string (YYYY-MM-DDTHH:mm) for a given Date in local time.
function toLocalInput(d: Date): string {
  return (
    `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Parse a `datetime-local` value into a Date (local time).
function parseLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6] ?? '0');
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    return null;
  }
  const d = new Date(y, mo - 1, day, hh, mm, Number.isFinite(ss) ? ss : 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

interface Breakdown {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface Totals {
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  totalWeeks: number;
}

type Result =
  | { error: string }
  | {
      future: boolean;
      breakdown: Breakdown;
      totals: Totals;
      summary: string;
      absMs: number;
    };

function defaultTarget(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(0, 0, 0, 0);
  return toLocalInput(d);
}

export default function CountdownSnapshotBuilder() {
  const [target, setTarget] = useState<string>(defaultTarget);
  const [label, setLabel] = useState<string>('Launch');
  const [from, setFrom] = useState<string>(() => toLocalInput(new Date()));

  const result = useMemo<Result>(() => {
    const targetDate = parseLocalInput(target);
    if (!targetDate) return { error: 'Enter a valid target date and time.' };
    const fromDate = parseLocalInput(from);
    if (!fromDate) return { error: 'Enter a valid "from" reference date and time.' };

    const deltaMs = targetDate.getTime() - fromDate.getTime();
    const future = deltaMs >= 0;
    const absMs = Math.abs(deltaMs);

    let rem = Math.floor(absMs / 1000); // seconds
    const totalSeconds = rem;
    const totalMinutes = Math.floor(rem / 60);
    const totalHours = Math.floor(rem / 3600);
    const totalDays = Math.floor(rem / 86400);
    const totalWeeks = Math.floor(rem / 604800);

    const weeks = Math.floor(rem / 604800);
    rem -= weeks * 604800;
    const days = Math.floor(rem / 86400);
    rem -= days * 86400;
    const hours = Math.floor(rem / 3600);
    rem -= hours * 3600;
    const minutes = Math.floor(rem / 60);
    rem -= minutes * 60;
    const seconds = rem;

    const dShown = totalDays;
    const verb = future ? 'in' : 'ago';
    const summary =
      future
        ? `${label || 'Target'} in ${dShown}d ${pad(hours)}h ${pad(minutes)}m`
        : `${label || 'Target'} was ${dShown}d ${pad(hours)}h ${pad(minutes)}m ${verb}`;

    return {
      future,
      breakdown: { weeks, days, hours, minutes, seconds },
      totals: { totalDays, totalHours, totalMinutes, totalSeconds, totalWeeks },
      summary,
      absMs,
    };
  }, [target, from, label]);

  const ok = !('error' in result);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Countdown Snapshot Builder" />
        <OptionsBar>
          <Field label="Target datetime">
            <Input
              type="datetime-local"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Label (optional)">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Launch"
              className="w-40"
            />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="From (reference)">
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFrom(toLocalInput(new Date()))}
            >
              <RefreshCw className="size-3.5" />
              Use current time
            </Button>
          </div>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={result.future ? 'Time remaining' : 'Time elapsed'}>
            <CopyButton value={result.summary} />
          </PanelHeader>
          <div className="p-4">
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {result.breakdown.weeks > 0 ? `${result.breakdown.weeks}w ` : ''}
              {result.breakdown.days}d {pad(result.breakdown.hours)}h{' '}
              {pad(result.breakdown.minutes)}m {pad(result.breakdown.seconds)}s
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{result.summary}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Total weeks', value: result.totals.totalWeeks.toLocaleString() },
              { label: 'Total days', value: result.totals.totalDays.toLocaleString() },
              { label: 'Total hours', value: result.totals.totalHours.toLocaleString() },
              {
                label: 'Total minutes',
                value: result.totals.totalMinutes.toLocaleString(),
              },
              {
                label: 'Total seconds',
                value: result.totals.totalSeconds.toLocaleString(),
              },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              result.future ? 'Target is in the future' : 'Target is in the past',
              `Snapshot computed at the "from" reference time`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
