'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MIN_MS = 60000;
const SEC_MS = 1000;

const WEEKDAY = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function fmt(d: Date): string {
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
  return date;
}

interface Milestone {
  label: string;
  date: Date;
  daysFromToday: number;
}

type Result = { error: string } | { rows: Milestone[]; bornMs: number };

export default function BirthdayMilestoneFinder() {
  const [birthdate, setBirthdate] = useState<string>('1995-06-15');
  const [birthtime, setBirthtime] = useState<string>('00:00');

  const result = useMemo<Result>(() => {
    const d = parseISODate(birthdate);
    if (!d) return { error: 'Enter a valid birth date.' };

    const timeParts = birthtime.split(':');
    const hh = Number(timeParts[0] ?? '0');
    const mm = Number(timeParts[1] ?? '0');
    const hour = Number.isFinite(hh) ? Math.max(0, Math.min(23, hh)) : 0;
    const minute = Number.isFinite(mm) ? Math.max(0, Math.min(59, mm)) : 0;

    const born = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0);
    const bornMs = born.getTime();
    const nowMs = Date.now();
    if (bornMs > nowMs) return { error: 'Birth date/time is in the future.' };

    const ageMs = nowMs - bornMs;
    const ageDays = ageMs / DAY_MS;

    const rows: Milestone[] = [];

    const addMs = (label: string, deltaMs: number) => {
      const date = new Date(bornMs + deltaMs);
      const daysFromToday = Math.round((date.getTime() - nowMs) / DAY_MS);
      rows.push({ label, date, daysFromToday });
    };

    // Every 1,000 days up to a horizon (~110 years) but only meaningful ones near age.
    const horizonDays = Math.ceil(ageDays / 1000) * 1000 + 5000;
    for (let k = 1000; k <= horizonDays && k <= 40000; k += 1000) {
      addMs(`${k.toLocaleString()} days old`, k * DAY_MS);
    }

    // Billion-second markers.
    addMs('1 billion seconds old', 1_000_000_000 * SEC_MS);
    addMs('2 billion seconds old', 2_000_000_000 * SEC_MS);

    // Minute markers.
    addMs('500,000 minutes old', 500_000 * MIN_MS);
    addMs('1,000,000 minutes old', 1_000_000 * MIN_MS);

    // Hour marker.
    addMs('100,000 hours old', 100_000 * HOUR_MS);
    addMs('500,000 hours old', 500_000 * HOUR_MS);

    // Round-number birthdays (calendar-anniversary based).
    const roundAges = [18, 21, 25, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const a of roundAges) {
      const bd = new Date(
        born.getFullYear() + a,
        born.getMonth(),
        born.getDate(),
        born.getHours(),
        born.getMinutes(),
        0,
        0,
      );
      const daysFromToday = Math.round((bd.getTime() - nowMs) / DAY_MS);
      rows.push({ label: `${a}th birthday`, date: bd, daysFromToday });
    }

    rows.sort((x, y) => x.date.getTime() - y.date.getTime());

    return { rows, bornMs };
  }, [birthdate, birthtime]);

  const ok = !('error' in result);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Birthday Milestone Finder" />
        <OptionsBar>
          <Field label="Birth date">
            <Input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </Field>
          <Field label="Birth time (optional)">
            <Input
              type="time"
              value={birthtime}
              onChange={(e) => setBirthtime(e.target.value)}
              className="w-32"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Milestones">
            <CopyButton
              value={() =>
                result.rows
                  .map((r) => `${fmt(r.date)}  ${r.label}`)
                  .join('\n')
              }
            />
          </PanelHeader>
          <div className="max-h-[480px] divide-y overflow-auto">
            {result.rows.map((r) => {
              const past = r.daysFromToday < 0;
              const today = r.daysFromToday === 0;
              const rel = today
                ? 'today'
                : past
                  ? `${Math.abs(r.daysFromToday).toLocaleString()} days ago`
                  : `in ${r.daysFromToday.toLocaleString()} days`;
              return (
                <div
                  key={`${r.label}-${r.date.getTime()}`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <code className="w-44 shrink-0 font-mono text-xs tabular-nums">
                    {fmt(r.date)} ({WEEKDAY[r.date.getDay()] ?? ''})
                  </code>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                  <span
                    className={
                      today
                        ? 'shrink-0 text-xs font-medium text-foreground'
                        : past
                          ? 'shrink-0 text-xs text-muted-foreground'
                          : 'shrink-0 text-xs text-foreground'
                    }
                  >
                    {rel}
                  </span>
                  <CopyButton value={fmt(r.date)} size="icon-sm" />
                </div>
              );
            })}
          </div>
          <StatBar
            items={[
              `${result.rows.length} milestones`,
              `Born: ${fmt(new Date(result.bornMs))}`,
              `${result.rows.filter((r) => r.daysFromToday >= 0).length} still upcoming`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
