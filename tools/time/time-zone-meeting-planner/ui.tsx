'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse "+5.5", "-8", "+05:30" or "0" into a UTC offset in minutes. */
function parseOffset(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const colon = t.match(/^([+-]?)(\d{1,2}):(\d{2})$/);
  if (colon) {
    const sign = colon[1] === '-' ? -1 : 1;
    const h = Number(colon[2] ?? '');
    const m = Number(colon[3] ?? '');
    if (!Number.isFinite(h) || !Number.isFinite(m) || h > 14 || m > 59) return null;
    return sign * (h * 60 + m);
  }
  const dec = Number(t);
  if (!Number.isFinite(dec) || Math.abs(dec) > 14) return null;
  return Math.round(dec * 60);
}

function fmtOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse a wall-clock "HH:MM" into minutes since midnight (0–1439). */
function parseClockMinutes(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1] ?? '');
  const min = Number(m[2] ?? '');
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

interface ParticipantRow {
  label: string;
  offsetMin: number;
  clock: string;
  weekday: string;
  dayShift: number;
  inHours: boolean;
}

export default function MeetingPlanner() {
  const [baseDate, setBaseDate] = useState('2026-06-01');
  const [baseTime, setBaseTime] = useState('14:00');
  const [baseOffset, setBaseOffset] = useState('+1');
  const [participants, setParticipants] = useState(
    'New York, -4\nLondon, +1\nMumbai, +5.5\nTokyo, +9\nSan Francisco, -7',
  );
  const [winStart, setWinStart] = useState('08:00');
  const [winEnd, setWinEnd] = useState('20:00');

  const result = useMemo(() => {
    const dm = baseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = baseTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!dm || !tm) return { error: 'Enter a valid base date and time.' };

    const y = Number(dm[1] ?? '');
    const mo = Number(dm[2] ?? '');
    const d = Number(dm[3] ?? '');
    const hh = Number(tm[1] ?? '');
    const mi = Number(tm[2] ?? '');
    if (![y, mo, d, hh, mi].every((n) => Number.isFinite(n)) || hh > 23 || mi > 59) {
      return { error: 'Enter a valid base date and time.' };
    }

    const baseOff = parseOffset(baseOffset);
    if (baseOff === null) return { error: 'Enter a valid base UTC offset (e.g. +1, -8, +05:30).' };

    const ws = parseClockMinutes(winStart);
    const we = parseClockMinutes(winEnd);
    if (ws === null || we === null || ws >= we) {
      return { error: 'Acceptable window must be valid times with start before end.' };
    }

    // Build a UTC instant for the base local datetime.
    const baseUtcMs = Date.UTC(y, mo - 1, d, hh, mi) - baseOff * 60000;

    const rows: ParticipantRow[] = [];
    for (const line of participants.split('\n')) {
      const text = line.trim();
      if (!text) continue;
      const idx = text.lastIndexOf(',');
      if (idx < 0) continue;
      const label = text.slice(0, idx).trim() || 'Participant';
      const off = parseOffset(text.slice(idx + 1));
      if (off === null) continue;

      const localMs = baseUtcMs + off * 60000;
      const ld = new Date(localMs);
      const lh = ld.getUTCHours();
      const lm = ld.getUTCMinutes();
      const minutesOfDay = lh * 60 + lm;

      // Day shift relative to the base local calendar date.
      const baseDayUtc = Date.UTC(y, mo - 1, d);
      const localDayUtc = Date.UTC(ld.getUTCFullYear(), ld.getUTCMonth(), ld.getUTCDate());
      const dayShift = Math.round((localDayUtc - baseDayUtc) / 86400000);

      rows.push({
        label,
        offsetMin: off,
        clock: `${pad(lh)}:${pad(lm)}`,
        weekday: WEEKDAYS[ld.getUTCDay()] ?? '',
        dayShift,
        inHours: minutesOfDay >= ws && minutesOfDay < we,
      });
    }

    if (rows.length === 0) {
      return { error: 'Add at least one participant as "Label, offset" (e.g. "Tokyo, +9").' };
    }

    const inCount = rows.filter((r) => r.inHours).length;
    return { rows, inCount, baseOff };
  }, [baseDate, baseTime, baseOffset, participants, winStart, winEnd]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Base date">
            <Input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Base time">
            <Input type="time" value={baseTime} onChange={(e) => setBaseTime(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Base UTC offset" hint="e.g. +1, -8, +05:30">
            <Input value={baseOffset} onChange={(e) => setBaseOffset(e.target.value)} className="w-24 font-mono" />
          </Field>
          <Field label="Window start">
            <Input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Window end">
            <Input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} className="font-mono" />
          </Field>
        </OptionsBar>
        <div className="p-3">
          <Field label="Participants" hint='One per line: "Label, offset" (e.g. "Mumbai, +5.5")'>
            <Textarea
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              spellCheck={false}
              rows={5}
              className="font-mono"
            />
          </Field>
        </div>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Local meeting times">
            <CopyButton
              value={() =>
                result.rows
                  .map(
                    (r) =>
                      `${r.label} (${fmtOffset(r.offsetMin)}): ${r.weekday} ${r.clock}` +
                      `${r.dayShift !== 0 ? ` (${r.dayShift > 0 ? '+' : ''}${r.dayShift}d)` : ''}` +
                      ` — ${r.inHours ? 'in hours' : 'OUT of hours'}`,
                  )
                  .join('\n')
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
                <code className="shrink-0 font-mono text-2xs text-muted-foreground">{fmtOffset(r.offsetMin)}</code>
                <span className="w-12 shrink-0 text-xs text-muted-foreground">{r.weekday}</span>
                <span className="w-16 shrink-0 font-mono text-sm tabular">{r.clock}</span>
                <span className="w-10 shrink-0 text-center font-mono text-2xs text-muted-foreground">
                  {r.dayShift > 0 ? `+${r.dayShift}` : r.dayShift}
                </span>
                <span
                  className={
                    'w-24 shrink-0 text-right text-xs font-medium ' +
                    (r.inHours
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400')
                  }
                >
                  {r.inHours ? 'in hours' : 'out of hours'}
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.inCount}/${result.rows.length} in working hours`,
              `base ${fmtOffset(result.baseOff)}`,
              `window ${winStart}–${winEnd}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
