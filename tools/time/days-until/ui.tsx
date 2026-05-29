'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Panel, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Countdown {
  past: boolean;
  days: number;
  weeks: number;
  remDays: number;
  hours: number;
  minutes: number;
  totalHours: number;
  totalMinutes: number;
}

function computeCountdown(target: Date, now: Date): Countdown {
  const diffMs = target.getTime() - now.getTime();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);

  const totalMinutes = Math.floor(abs / (1000 * 60));
  const totalHours = Math.floor(abs / (1000 * 60 * 60));
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return { past, days, weeks, remDays, hours, minutes, totalHours, totalMinutes };
}

export default function DaysUntilTool() {
  const [value, setValue] = useState('');

  const { result, error } = useMemo<{ result: Countdown | null; error: string | null }>(() => {
    if (!value) return { result: null, error: null };
    const target = new Date(`${value}T00:00:00`);
    if (Number.isNaN(target.getTime())) {
      return { result: null, error: 'Enter a valid target date.' };
    }
    return { result: computeCountdown(target, new Date()), error: null };
  }, [value]);

  const headline = result
    ? result.days === 0
      ? 'That date is today'
      : `${result.days.toLocaleString()} day${result.days === 1 ? '' : 's'} ${
          result.past ? 'ago' : 'remaining'
        }`
    : '';

  return (
    <div className="space-y-4">
      <Panel title="Target date">
        <Field label="Date">
          <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </Panel>

      <ErrorBanner error={error} />

      {result ? (
        <Panel title="Countdown">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums">{headline}</p>
              <CopyButton value={headline} />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              {result.weeks > 0
                ? `${result.weeks} week${result.weeks === 1 ? '' : 's'} and ${result.remDays} day${
                    result.remDays === 1 ? '' : 's'
                  }`
                : `${result.remDays} day${result.remDays === 1 ? '' : 's'}`}
              {' • '}
              {result.hours}h {result.minutes}m {result.past ? 'past the start of day' : 'into the day'}
            </div>
            <StatBar
              items={[
                `Total days: ${result.days.toLocaleString()}`,
                `Total hours: ${result.totalHours.toLocaleString()}`,
                `Total minutes: ${result.totalMinutes.toLocaleString()}`,
                result.past ? 'Direction: past' : 'Direction: future',
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
