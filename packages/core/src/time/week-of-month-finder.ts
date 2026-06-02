/**
 * Week of Month Finder
 *
 * Determine which week of the month a date falls in, using several common
 * counting conventions. Lifted verbatim from the open-utility-tools UI; pure,
 * isomorphic (browser + Node 20 + Bun), no DOM or framework dependencies.
 */

/** Which weekday a calendar row begins on. */
export type WeekStart = 'sun' | 'mon';

/** Structured result describing where a date sits within its month. */
export interface WeekOfMonthResult {
  /** Simple convention: `ceil(dayOfMonth / 7)`. Always 1-6. */
  simple: number;
  /**
   * Calendar-aligned row index. Week 1 contains the 1st of the month; the
   * count increments each time the week-start boundary is crossed.
   */
  calendar: number;
  /**
   * First-full-week (ISO style) index. The first week lying entirely within
   * the month is week 1; partial leading days are week 0.
   */
  isoStyle: number;
  /** English weekday name of the date, e.g. `"Tuesday"`. */
  weekday: string;
  /** First date (YYYY-MM-DD) of the calendar row the date sits in; may be in the previous month. */
  rowStart: string;
  /** Last date (YYYY-MM-DD) of the calendar row the date sits in; may be in the next month. */
  rowEnd: string;
  /** True when the date is a Saturday or Sunday. */
  isWeekend: boolean;
  /** Number of days in the date's month. */
  daysInMonth: number;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Format a Y/M0/day triple as a zero-padded `YYYY-MM-DD` string (m0 is 0-based). */
function fmt(y: number, m0: number, day: number): string {
  return `${String(y).padStart(4, '0')}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Day-of-week (0 = Sunday) of a UTC date, range-safe across month boundaries. */
function dowUTC(y: number, m0: number, day: number): number {
  return new Date(Date.UTC(y, m0, day)).getUTCDay();
}

/**
 * Determine which week of the month a date falls in, under three common
 * conventions, along with its calendar-row span and weekday metadata.
 *
 * @param dateStr - The date as an ISO-style `YYYY-MM-DD` string.
 * @param weekStart - Which weekday begins a calendar row: `'sun'` (default) or `'mon'`.
 * @returns A {@link WeekOfMonthResult} with the three week numbers, weekday,
 *   weekend flag, calendar-row span, and the month's day count.
 * @throws {RangeError} If `dateStr` is not a valid `YYYY-MM-DD` string, the
 *   month is outside 1-12, or the day is outside the valid range for that month.
 *
 * @example
 * ```ts
 * findWeekOfMonth('2025-12-25', 'sun');
 * // => {
 * //   simple: 4,
 * //   calendar: 4,
 * //   isoStyle: 3,
 * //   weekday: 'Thursday',
 * //   rowStart: '2025-12-21',
 * //   rowEnd: '2025-12-27',
 * //   isWeekend: false,
 * //   daysInMonth: 31,
 * // }
 * ```
 */
export function findWeekOfMonth(
  dateStr: string,
  weekStart: WeekStart = 'sun',
): WeekOfMonthResult {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new RangeError('Enter a valid date (YYYY-MM-DD).');
  const y = Number(m[1] ?? '');
  const mo = Number(m[2] ?? '');
  const day = Number(m[3] ?? '');
  if (
    ![y, mo, day].every((n) => Number.isFinite(n)) ||
    mo < 1 ||
    mo > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new RangeError('Enter a valid date (YYYY-MM-DD).');
  }
  const m0 = mo - 1;
  const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  if (day > daysInMonth) {
    throw new RangeError(`Day ${day} is out of range for that month.`);
  }

  const startIdx = weekStart === 'mon' ? 1 : 0; // weekday index that begins a row

  // Convention 1: simple = ceil(dayOfMonth / 7)
  const simple = Math.ceil(day / 7);

  // Convention 2: calendar-aligned row index. Week #1 contains the 1st;
  // increments each time we cross the week-start boundary.
  const firstDow = dowUTC(y, m0, 1);
  const offsetOfFirst = (firstDow - startIdx + 7) % 7; // cells before the 1st in its row
  const calendar = Math.ceil((day + offsetOfFirst) / 7);

  // The calendar week row this date sits in: span dates.
  const dateDow = dowUTC(y, m0, day);
  const backToStart = (dateDow - startIdx + 7) % 7;
  const rowStartDay = day - backToStart; // may be <= 0 (previous month)
  const rowEndDay = rowStartDay + 6; // may exceed daysInMonth (next month)

  const rowStart =
    rowStartDay >= 1
      ? fmt(y, m0, rowStartDay)
      : (() => {
          const d = new Date(Date.UTC(y, m0, rowStartDay));
          return fmt(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        })();
  const rowEnd =
    rowEndDay <= daysInMonth
      ? fmt(y, m0, rowEndDay)
      : (() => {
          const d = new Date(Date.UTC(y, m0, rowEndDay));
          return fmt(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        })();

  // Convention 3: ISO-style first-full-week. The first week that lies
  // entirely within the month is week 1; partial leading days are week 0.
  const firstFullWeekStartDay = offsetOfFirst === 0 ? 1 : 1 + (7 - offsetOfFirst);
  const isoStyle =
    day < firstFullWeekStartDay
      ? 0
      : Math.floor((day - firstFullWeekStartDay) / 7) + 1;

  const weekday = WEEKDAYS[dateDow] ?? '';

  return {
    simple,
    calendar,
    isoStyle,
    weekday,
    rowStart,
    rowEnd,
    isWeekend: dateDow === 0 || dateDow === 6,
    daysInMonth,
  };
}