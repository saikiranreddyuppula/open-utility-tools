'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Zeller's congruence (Gregorian) → 0=Sunday … 6=Saturday. */
function zeller(year: number, month: number, day: number): number {
  let m = month;
  let y = year;
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  const k = y % 100;
  const j = Math.floor(y / 100);
  // Zeller's h: 0=Saturday, 1=Sunday … so we convert to 0=Sunday afterward.
  const h =
    (day +
      Math.floor((13 * (m + 1)) / 5) +
      k +
      Math.floor(k / 4) +
      Math.floor(j / 4) +
      5 * j) %
    7;
  // h: 0=Sat,1=Sun,2=Mon,...,6=Fri → map to 0=Sun..6=Sat
  return (h + 6) % 7;
}

// Anchor "doomsday" weekday per century (0=Sun..6=Sat). Tuesday(2), Sunday(0), Friday(5), Wednesday(3) cycle.
function centuryAnchor(year: number): number {
  const c = Math.floor(year / 100) % 4;
  // 1800s=Fri(5), 1900s=Wed(3), 2000s=Tue(2), 2100s=Sun(0)
  const table = [2, 0, 5, 3]; // index by ((c)%4): 2000→2, 2100→0, 2200→5, 2300→3
  return table[((c % 4) + 4) % 4] ?? 2;
}

function doomsdayOfYear(year: number): number {
  const anchor = centuryAnchor(year);
  const yy = year % 100;
  const a = Math.floor(yy / 12);
  const b = yy % 12;
  const c = Math.floor(b / 4);
  return (anchor + a + b + c) % 7;
}

/** Reference doomsday day-of-month for each month given leap status. */
function monthDoomsdayDay(month: number, leap: boolean): number {
  switch (month) {
    case 1:
      return leap ? 4 : 3;
    case 2:
      return leap ? 29 : 28;
    case 3:
      return 14; // "Pi day" 3/14
    case 4:
      return 4;
    case 5:
      return 9;
    case 6:
      return 6;
    case 7:
      return 11;
    case 8:
      return 8;
    case 9:
      return 5;
    case 10:
      return 10;
    case 11:
      return 7;
    case 12:
      return 12;
    default:
      return 3;
  }
}

const CENTURY_NAME: Record<number, string> = {
  0: 'Sunday',
  2: 'Tuesday',
  3: 'Wednesday',
  5: 'Friday',
};

export default function WeekdayOfDate() {
  const [dateStr, setDateStr] = useState('2026-05-30');

  const result = useMemo(() => {
    const m = dateStr.match(/^(-?\d{1,7})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return { error: 'Enter a date as YYYY-MM-DD (negative years allowed, e.g. -0044-03-15).' };
    const year = Number(m[1] ?? '');
    const month = Number(m[2] ?? '');
    const day = Number(m[3] ?? '');
    if (![year, month, day].every((n) => Number.isFinite(n))) {
      return { error: 'Date fields must be numeric.' };
    }
    if (month < 1 || month > 12) return { error: 'Month must be 1–12.' };
    const leap = isLeap(year);
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const maxDay = dim[month - 1] ?? 31;
    if (day < 1 || day > maxDay) return { error: `Day must be 1–${maxDay} for that month.` };

    const idx = zeller(year, month, day);
    const isoNum = idx === 0 ? 7 : idx; // Mon=1..Sun=7

    // Conway doomsday walkthrough
    const anchor = centuryAnchor(year);
    const dYear = doomsdayOfYear(year);
    const mdDay = monthDoomsdayDay(month, leap);
    const diff = day - mdDay;
    const finalDow = (((dYear + diff) % 7) + 7) % 7;

    const yy = year % 100;
    const a = Math.floor(yy / 12);
    const b = yy % 12;
    const c = Math.floor(b / 4);

    const steps = [
      `Century anchor for the ${Math.floor(year / 100) * 100}s: ${CENTURY_NAME[anchor] ?? WEEKDAYS[anchor]} (index ${anchor}).`,
      `Year doomsday: anchor + ⌊${yy}/12⌋ + (${yy} mod 12) + ⌊rem/4⌋ = ${anchor} + ${a} + ${b} + ${c} = ${dYear} mod 7 → ${WEEKDAYS[dYear] ?? ''}.`,
      `${month}/${month === 2 ? 'last' : ''} doomsday date this month is the ${mdDay}${leap && (month === 1 || month === 2) ? ' (leap-year value)' : ''}, which is a ${WEEKDAYS[dYear] ?? ''}.`,
      `Target day ${day} is ${diff >= 0 ? '+' : ''}${diff} days from the ${mdDay}: (${dYear} + ${diff}) mod 7 = ${finalDow} → ${WEEKDAYS[finalDow] ?? ''}.`,
    ];

    return {
      weekday: WEEKDAYS[idx] ?? '',
      short: WEEKDAYS_SHORT[idx] ?? '',
      isoNum,
      isWeekend: idx === 0 || idx === 6,
      leap,
      steps,
      crosscheck: WEEKDAYS[finalDow] === WEEKDAYS[idx],
    };
  }, [dateStr]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Date" hint="YYYY-MM-DD; wide year range, negatives allowed">
            <Input
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-48 font-mono"
              placeholder="2026-05-30"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Weekday">
            <CopyButton value={result.weekday} />
          </PanelHeader>
          <div className="rounded-lg p-5 text-center">
            <div className="text-3xl font-semibold">{result.weekday}</div>
            <div className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
              {result.short} · ISO weekday {result.isoNum}
              {result.isWeekend ? ' · weekend' : ''}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-3 pb-2 sm:grid-cols-2">
            {[
              { label: 'Full name', value: result.weekday },
              { label: 'Abbreviated', value: result.short },
              { label: 'ISO weekday (Mon=1)', value: String(result.isoNum) },
              { label: 'Leap year', value: result.leap ? 'Yes' : 'No' },
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
          <div className="px-3 pb-3">
            <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Doomsday-rule walkthrough
            </div>
            <ol className="list-decimal space-y-1 rounded-md border bg-muted/20 py-2 pl-7 pr-3 text-xs">
              {result.steps.map((s, i) => (
                <li key={i} className="leading-relaxed">
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <StatBar
            items={[
              `ISO ${result.isoNum}`,
              result.isWeekend && 'weekend',
              result.crosscheck ? 'Zeller ✓ Doomsday' : 'check mismatch',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
