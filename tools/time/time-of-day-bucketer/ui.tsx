'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Boundary {
  label: string;
  greeting: string;
  /** Minutes since midnight at which this segment STARTS. */
  start: number;
}

// Defaults per spec. Segments are wrap-around ordered by start minute.
const DEFAULTS: Boundary[] = [
  { label: 'Night', greeting: 'Good night', start: 0 },
  { label: 'Morning', greeting: 'Good morning', start: 6 * 60 },
  { label: 'Afternoon', greeting: 'Good afternoon', start: 12 * 60 },
  { label: 'Evening', greeting: 'Good evening', start: 17 * 60 },
  { label: 'Night', greeting: 'Good night', start: 21 * 60 },
];

function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1] ?? '');
  const min = Number(m[2] ?? '');
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(s)) return null;
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

function minutesToClock(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function format12h(totalSeconds: number): string {
  const h24 = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')} ${period}`;
}

function format24h(totalSeconds: number): string {
  const h24 = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimeOfDayClassifier() {
  const [time, setTime] = useState('14:35');
  // Editable boundary start times keyed by index (skip index 0, fixed at 00:00).
  const [bounds, setBounds] = useState<string[]>(DEFAULTS.map((b) => minutesToClock(b.start)));

  const result = useMemo(() => {
    const secs = parseClock(time);
    if (secs === null) {
      return { error: 'Enter a valid clock time as HH:MM or HH:MM:SS (24-hour).' };
    }

    // Resolve boundary start minutes; the first is anchored at 0.
    const starts: number[] = [];
    for (let i = 0; i < DEFAULTS.length; i++) {
      if (i === 0) {
        starts.push(0);
        continue;
      }
      const raw = bounds[i] ?? '';
      const parsed = parseClock(raw);
      if (parsed === null) {
        return { error: `Boundary ${i + 1} is not a valid HH:MM time.` };
      }
      starts.push(Math.floor(parsed / 60));
    }

    // Validate monotonic increasing starts.
    for (let i = 1; i < starts.length; i++) {
      const prev = starts[i - 1] ?? 0;
      const cur = starts[i] ?? 0;
      if (cur <= prev) {
        return { error: 'Boundary start times must strictly increase down the list.' };
      }
    }

    const totalMin = Math.floor(secs / 60);

    // Find the last boundary whose start <= totalMin.
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i] ?? 0;
      if (totalMin >= start) idx = i;
    }
    const seg = DEFAULTS[idx] ?? DEFAULTS[0]!;
    const segStart = starts[idx] ?? 0;
    const nextStart = idx + 1 < starts.length ? starts[idx + 1] ?? 1440 : 1440;

    return {
      label: seg.label,
      greeting: seg.greeting,
      time12: format12h(secs),
      time24: format24h(secs),
      minutesSinceMidnight: totalMin,
      segStart,
      nextStart,
    };
  }, [time, bounds]);

  const isError = 'error' in result;

  const setBound = (i: number, value: string) => {
    setBounds((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Clock time" hint="24-hour HH:MM or HH:MM:SS">
            <Input
              type="time"
              step={1}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-40 font-mono"
            />
          </Field>
        </OptionsBar>
        <OptionsBar>
          {DEFAULTS.map((b, i) => (
            <Field key={`${b.label}-${i}`} label={`${b.label} starts`} hint={i === 0 ? 'fixed 00:00' : undefined}>
              <Input
                type="time"
                value={i === 0 ? '00:00' : bounds[i] ?? ''}
                disabled={i === 0}
                onChange={(e) => setBound(i, e.target.value)}
                className="w-32 font-mono"
              />
            </Field>
          ))}
        </OptionsBar>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Classification">
            <CopyButton
              value={() =>
                [
                  `Part of day: ${result.label}`,
                  `Greeting: ${result.greeting}`,
                  `12-hour: ${result.time12}`,
                  `24-hour: ${result.time24}`,
                  `Minutes since midnight: ${result.minutesSinceMidnight}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="rounded-lg p-5 text-center">
            <div className="text-3xl font-semibold">{result.greeting}</div>
            <div className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
              {result.label}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
            {[
              { label: 'Part of day', value: result.label },
              { label: 'Greeting', value: result.greeting },
              { label: '12-hour form', value: result.time12 },
              { label: '24-hour form', value: result.time24 },
              { label: 'Minutes since midnight', value: String(result.minutesSinceMidnight) },
              {
                label: 'Sits between',
                value: `${minutesToClock(result.segStart)} – ${minutesToClock(result.nextStart)}`,
              },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
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
              `bucket ${result.label}`,
              `${minutesToClock(result.segStart)}–${minutesToClock(result.nextStart)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
