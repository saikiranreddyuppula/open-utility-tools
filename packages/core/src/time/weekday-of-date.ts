// Extracted from tools/time/weekday-of-date. Pure, isomorphic weekday math —
// no React/DOM/Web APIs. Lifts the existing Zeller + Conway "Doomsday rule"
// algorithm out of ui.tsx verbatim.

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
    (day + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7;
  // h: 0=Sat,1=Sun,2=Mon,...,6=Fri → map to 0=Sun..6=Sat
  return (h + 6) % 7;
}

// Anchor "doomsday" weekday per century (0=Sun..6=Sat). Tuesday(2), Sunday(0),
// Friday(5), Wednesday(3) cycle.
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

/** Structured result describing the weekday of a date plus a mental-math trail. */
export interface WeekdayOfDateResult {
  /** Parsed calendar year (may be negative). */
  year: number;
  /** Parsed month, 1–12. */
  month: number;
  /** Parsed day of month. */
  day: number;
  /** Full weekday name, e.g. `"Saturday"`. */
  weekday: string;
  /** Abbreviated weekday name, e.g. `"Sat"`. */
  short: string;
  /** Weekday index, 0=Sunday … 6=Saturday. */
  index: number;
  /** ISO-8601 weekday number, Monday=1 … Sunday=7. */
  isoNum: number;
  /** True when the date is a Saturday or Sunday. */
  isWeekend: boolean;
  /** True when `year` is a leap year. */
  leap: boolean;
  /** Human-readable Conway "Doomsday rule" walkthrough, one line per step. */
  steps: string[];
  /** True when the Doomsday-rule result agrees with Zeller's congruence. */
  crosscheck: boolean;
}

/**
 * Finds which day of the week a Gregorian date falls on using Zeller's
 * congruence, and produces a Conway "Doomsday rule" mental-math walkthrough that
 * is cross-checked against the Zeller result. Pure and isomorphic — no DOM, runs
 * in the browser, Node, and Bun.
 *
 * Years may be negative and span a wide range (`-9999999`…`9999999`). The
 * Doomsday walkthrough is illustrative and, like the original tool, can disagree
 * with Zeller for far-past / negative years; that disagreement is surfaced via
 * `crosscheck` rather than corrected.
 *
 * @param date - A date string in `YYYY-MM-DD` form. Negative years are allowed,
 *   e.g. `"-0044-03-15"`. Leading/trailing whitespace is trimmed.
 * @returns The weekday name, ISO weekday number, weekend/leap flags, the
 *   Doomsday walkthrough steps, and a Zeller↔Doomsday cross-check flag.
 * @throws {RangeError} If `date` is not `YYYY-MM-DD`, its fields are not numeric,
 *   the month is outside 1–12, or the day is outside the valid range for that
 *   month (accounting for leap years).
 *
 * @example
 * ```ts
 * import { weekdayOfDate } from '@open-utility-tools/core/time/weekday-of-date';
 * const r = weekdayOfDate('2026-05-30');
 * r.weekday;    // → 'Saturday'
 * r.isoNum;     // → 6
 * r.isWeekend;  // → true
 * r.crosscheck; // → true
 * ```
 */
export function weekdayOfDate(date: string): WeekdayOfDateResult {
  const trimmed = date.trim();
  const m = trimmed.match(/^(-?\d{1,7})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    throw new RangeError(
      'Enter a date as YYYY-MM-DD (negative years allowed, e.g. -0044-03-15).',
    );
  }
  const year = Number(m[1] ?? '');
  const month = Number(m[2] ?? '');
  const day = Number(m[3] ?? '');
  if (![year, month, day].every((n) => Number.isFinite(n))) {
    throw new RangeError('Date fields must be numeric.');
  }
  if (month < 1 || month > 12) throw new RangeError('Month must be 1–12.');
  const leap = isLeap(year);
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = dim[month - 1] ?? 31;
  if (day < 1 || day > maxDay) {
    throw new RangeError(`Day must be 1–${maxDay} for that month.`);
  }

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

  const weekday = WEEKDAYS[idx] ?? '';
  const short = WEEKDAYS_SHORT[idx] ?? '';

  return {
    year,
    month,
    day,
    weekday,
    short,
    index: idx,
    isoNum,
    isWeekend: idx === 0 || idx === 6,
    leap,
    steps,
    crosscheck: WEEKDAYS[finalDow] === WEEKDAYS[idx],
  };
}
