/**
 * Weekday names indexed by JavaScript's `Date.getUTCDay()` convention
 * (0 = Sunday … 6 = Saturday).
 */
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Month names indexed by the 0-based month number (0 = January … 11 = December).
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Ordinal labels indexed by the {@link NthWeekdayOptions.ordinal} value.
 * Indices 0–4 mean the 1st–5th occurrence; index 5 means the last occurrence.
 */
const ORDINAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', 'Last'] as const;

/** A weekday index: 0 (Sunday) through 6 (Saturday). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A 0-based month index: 0 (January) through 11 (December). */
export type Month = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * Occurrence selector. Indices 0–4 select the 1st through 5th occurrence of the
 * weekday in the month; index 5 selects the last occurrence.
 */
export type Ordinal = 0 | 1 | 2 | 3 | 4 | 5;

/** Options describing which weekday occurrence to locate. */
export interface NthWeekdayOptions {
  /** Full year (any integer, e.g. 2026). */
  year: number;
  /** 0-based month: 0 = January … 11 = December. */
  month: number;
  /** Weekday index: 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /**
   * Occurrence selector: 0–4 for the 1st–5th occurrence, 5 for the last
   * occurrence.
   */
  ordinal: number;
}

/** The resolved date of the requested weekday occurrence. */
export interface NthWeekdayResult {
  /** ISO `YYYY-MM-DD` calendar date (year zero-padded to 4 digits). */
  iso: string;
  /** Full weekday name, e.g. `"Thursday"`. */
  weekday: string;
  /** Human-readable label, e.g. `"3rd Thursday of November 2026"`. */
  longLabel: string;
  /** Day of the month (1–31). */
  day: number;
  /** Ordinal label, e.g. `"3rd"` or `"Last"`. */
  ordinalLabel: string;
}

/** Left-pads the absolute value of `n` with zeros to `width` characters. */
function pad(n: number, width: number): string {
  return Math.abs(n).toString().padStart(width, '0');
}

/** Formats a year / 0-based month / day triple as an ISO `YYYY-MM-DD` string. */
function formatISO(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month + 1, 2)}-${pad(day, 2)}`;
}

/** Returns the number of days in the given 0-based month of `year` (UTC). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Finds the calendar date of the Nth occurrence of a given weekday within a
 * month — for example "the 3rd Thursday of November 2026" or "the last Monday
 * of May 2026".
 *
 * The `ordinal` selects the occurrence: values 0–4 mean the 1st through 5th
 * occurrence, and 5 means the last occurrence of that weekday in the month.
 * All date arithmetic is performed in UTC so the result is independent of the
 * host time zone.
 *
 * @param options - The year, 0-based month, weekday (0 = Sunday … 6 = Saturday),
 *   and ordinal occurrence selector.
 * @returns The resolved {@link NthWeekdayResult}, including the ISO date, the
 *   weekday name, the day of the month, and human-readable labels.
 * @throws {TypeError} If `year` is not a finite integer.
 * @throws {RangeError} If `month`, `weekday`, or `ordinal` is out of range, or
 *   if the requested occurrence (e.g. a 5th weekday) does not exist in that
 *   month.
 *
 * @example
 * ```ts
 * // The 3rd Thursday of November 2026
 * nthWeekdayOfMonth({ year: 2026, month: 10, weekday: 4, ordinal: 2 });
 * // => {
 * //   iso: '2026-11-19',
 * //   weekday: 'Thursday',
 * //   longLabel: '3rd Thursday of November 2026',
 * //   day: 19,
 * //   ordinalLabel: '3rd',
 * // }
 *
 * // Thanksgiving (USA) — the last Thursday of November 2026
 * nthWeekdayOfMonth({ year: 2026, month: 10, weekday: 4, ordinal: 5 }).iso;
 * // => '2026-11-26'
 * ```
 */
export function nthWeekdayOfMonth(options: NthWeekdayOptions): NthWeekdayResult {
  const { year: y, month: m, weekday: dow, ordinal: ord } = options;

  if (!Number.isFinite(y) || !Number.isInteger(y)) {
    throw new TypeError('year must be a finite integer.');
  }
  if (!Number.isInteger(m) || m < 0 || m > 11) {
    throw new RangeError('month must be an integer from 0 (January) to 11 (December).');
  }
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
    throw new RangeError('weekday must be an integer from 0 (Sunday) to 6 (Saturday).');
  }
  if (!Number.isInteger(ord) || ord < 0 || ord > 5) {
    throw new RangeError('ordinal must be an integer from 0 (1st) to 5 (Last).');
  }

  const total = daysInMonth(y, m);

  const ordinalLabel = ORDINAL_LABELS[ord] ?? '';
  const weekdayName = WEEKDAY_NAMES[dow] ?? '';
  const monthName = MONTH_NAMES[m] ?? '';

  let day: number;
  if (ord === 5) {
    // Last occurrence: walk back from the final day of the month.
    const lastDow = new Date(Date.UTC(y, m, total)).getUTCDay();
    const back = (lastDow - dow + 7) % 7;
    day = total - back;
  } else {
    const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const firstMatch = ((dow - firstDow + 7) % 7) + 1;
    day = firstMatch + 7 * ord;
    if (day > total) {
      const count = Math.floor((total - firstMatch) / 7) + 1;
      throw new RangeError(
        `There is no ${ordinalLabel} ${weekdayName} in ${monthName} ${y}. That month only has ${count} of them.`,
      );
    }
  }

  return {
    iso: formatISO(y, m, day),
    weekday: weekdayName,
    longLabel: `${ordinalLabel} ${weekdayName} of ${monthName} ${y}`,
    day,
    ordinalLabel,
  };
}
