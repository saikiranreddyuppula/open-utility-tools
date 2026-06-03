/**
 * ISO 8601 week <-> date conversions.
 *
 * Lifted verbatim from the "Week Number to Date" tool UI. All math is done in
 * UTC so results are independent of the host time zone. Isomorphic: relies only
 * on `Date`, `Number`, `Math`, and `String` — no DOM or Web APIs.
 *
 * @module
 */

/** Result of converting an ISO week number into its calendar date range. */
export interface WeekDateRange {
  /** First day (Monday) of the ISO week, as a `YYYY-MM-DD` string. */
  start: string;
  /** Last day (Sunday) of the ISO week, as a `YYYY-MM-DD` string. */
  end: string;
  /** Total number of ISO weeks in the given ISO week-numbering year (52 or 53). */
  weeksInYear: number;
}

/** Result of converting a calendar date into its ISO week coordinates. */
export interface IsoWeekInfo {
  /** ISO week-numbering year (may differ from the calendar year near year boundaries). */
  isoYear: number;
  /** ISO week number, 1..53. */
  isoWeek: number;
  /** ISO weekday, Monday = 1 .. Sunday = 7. */
  isoWeekday: number;
  /** English weekday name, e.g. `'Monday'`. */
  weekdayName: string;
  /** Compact ISO week label, e.g. `'2026-W23'`. */
  label: string;
}

const WEEKDAY_NAMES: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Format a UTC `Date` as a zero-padded `YYYY-MM-DD` string. */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Number of ISO weeks in a given ISO week-numbering year.
 *
 * A year has 53 weeks if Jan 1 is a Thursday, or if it is a leap year whose
 * Jan 1 is a Wednesday; otherwise it has 52.
 *
 * @param year - ISO week-numbering year.
 * @returns Either `52` or `53`.
 */
export function isoWeeksInYear(year: number): number {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (jan1 === 4 || (isLeap && jan1 === 3)) return 53;
  return 52;
}

/** Given an ISO year + week, return the Monday (UTC) starting that week. */
function isoWeekToMonday(isoYear: number, isoWeek: number): Date {
  // The Monday of ISO week 1 is the Monday on or before Jan 4.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay(); // 1..7, Mon=1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return monday;
}

/** Given a UTC `Date`, return its ISO year, week number, and weekday. */
function dateToIsoWeek(date: Date): {
  isoYear: number;
  isoWeek: number;
  isoWeekday: number;
} {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNr = target.getUTCDay() === 0 ? 7 : target.getUTCDay(); // Mon=1..Sun=7
  // Move to the Thursday of the current ISO week.
  target.setUTCDate(target.getUTCDate() + (4 - dayNr));
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const diffDays = Math.round((target.getTime() - yearStart.getTime()) / 86400000);
  const isoWeek = Math.floor(diffDays / 7) + 1;
  return { isoYear, isoWeek, isoWeekday: dayNr };
}

/**
 * Parse a `YYYY-MM-DD` string into a UTC `Date`, validating that the components
 * round-trip (rejecting e.g. `2021-02-30`).
 *
 * @returns A UTC `Date`, or `null` if the string is not a valid calendar date.
 */
function parseISODate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/**
 * Convert an ISO week number and year into the Monday–Sunday date range of that
 * week.
 *
 * The returned dates are UTC `YYYY-MM-DD` strings; near year boundaries the
 * range may span two calendar years (an ISO week always starts on Monday and
 * ends on the following Sunday).
 *
 * @param year - ISO week-numbering year (must be a finite integer).
 * @param week - ISO week number; must be an integer in `1..isoWeeksInYear(year)`.
 * @returns The week's `start` (Monday), `end` (Sunday), and `weeksInYear`.
 * @throws {TypeError} If `year` or `week` is not a finite integer.
 * @throws {RangeError} If `week` is outside `1..isoWeeksInYear(year)`.
 *
 * @example
 * weekToDateRange(2020, 53);
 * // => { start: '2020-12-28', end: '2021-01-03', weeksInYear: 53 }
 */
export function weekToDateRange(year: number, week: number): WeekDateRange {
  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new TypeError('Enter a valid year.');
  }
  if (!Number.isFinite(week) || !Number.isInteger(week)) {
    throw new TypeError('Enter a valid week number.');
  }
  const maxWeeks = isoWeeksInYear(year);
  if (week < 1 || week > maxWeeks) {
    throw new RangeError(`Week must be between 1 and ${maxWeeks} for ${year}.`);
  }
  const monday = isoWeekToMonday(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday),
    weeksInYear: maxWeeks,
  };
}

/**
 * Convert a calendar date into its ISO week coordinates.
 *
 * Accepts either a `YYYY-MM-DD` string or a `Date` (interpreted via its UTC
 * year/month/day). Returns the ISO year, week number, weekday, weekday name,
 * and a `YYYY-Www` label.
 *
 * @param value - A `YYYY-MM-DD` string or a `Date`.
 * @returns The date's ISO week information.
 * @throws {TypeError} If a string is not a valid calendar date, or a `Date` is invalid.
 *
 * @example
 * dateToWeek('2026-06-02');
 * // => { isoYear: 2026, isoWeek: 23, isoWeekday: 2, weekdayName: 'Tuesday', label: '2026-W23' }
 */
export function dateToWeek(value: string | Date): IsoWeekInfo {
  let date: Date | null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Enter a valid date.');
    }
    date = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  } else {
    date = parseISODate(value);
  }
  if (!date) {
    throw new TypeError('Enter a valid date.');
  }
  const { isoYear, isoWeek, isoWeekday } = dateToIsoWeek(date);
  const weekdayName = WEEKDAY_NAMES[date.getUTCDay()] ?? '';
  return {
    isoYear,
    isoWeek,
    isoWeekday,
    weekdayName,
    label: `${isoYear}-W${String(isoWeek).padStart(2, '0')}`,
  };
}