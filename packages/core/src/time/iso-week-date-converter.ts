// Extracted from tools/time/iso-week-date-converter. Pure, isomorphic ISO-8601
// week-date math — no DOM, runs in the browser, Node, and Bun.

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO weekday for a UTC date: Monday = 1 … Sunday = 7. */
function isoDow(d: Date): number {
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

/** The UTC Monday that begins ISO week 1 of the given ISO week-year. */
function week1Monday(isoYear: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dow = isoDow(jan4);
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (dow - 1));
  return monday;
}

/** Number of ISO weeks (52 or 53) in the given ISO week-year. */
function weeksInIsoYear(isoYear: number): number {
  const start = week1Monday(isoYear);
  const next = week1Monday(isoYear + 1);
  return Math.round((next.getTime() - start.getTime()) / (7 * 86400000));
}

function dateToIsoWeek(d: Date): { isoYear: number; week: number; weekday: number } {
  const day = isoDow(d);
  // Thursday of the current week determines the ISO week-year.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (4 - day));
  const isoYear = thursday.getUTCFullYear();
  const firstMonday = week1Monday(isoYear);
  const week = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  return { isoYear, week, weekday: day };
}

export interface IsoWeekFromDate {
  /** Canonical ISO week-date string, e.g. `"2020-W53-5"`. */
  isoWeekDate: string;
  /** ISO week-year (may differ from the calendar year near year boundaries). */
  isoYear: number;
  /** ISO week number, 1–53. */
  week: number;
  /** ISO weekday, Monday = 1 … Sunday = 7. */
  weekday: number;
  /** Weekday name, e.g. `"Friday"`. */
  weekdayName: string;
  /** Total ISO weeks (52 or 53) in this ISO week-year. */
  weeksInYear: number;
  /** Echo of the input calendar date as `YYYY-MM-DD`. */
  calendar: string;
}

export interface IsoWeekToDate {
  /** Resolved calendar date as `YYYY-MM-DD`. */
  calendar: string;
  /** Canonical ISO week-date string, e.g. `"2020-W53-5"`. */
  isoWeekDate: string;
  /** Weekday name, e.g. `"Friday"`. */
  weekdayName: string;
  /** Total ISO weeks (52 or 53) in this ISO week-year. */
  weeksInYear: number;
  /** Echo of the input ISO week-year. */
  isoYear: number;
}

/**
 * Converts a Gregorian calendar date into its ISO-8601 week-date form
 * (`YYYY-Www-D`). The ISO week-year is the year that owns the Thursday of the
 * date's week, so it can differ from the calendar year at year boundaries.
 *
 * @param date - Calendar date as `YYYY-MM-DD`.
 * @returns The ISO week-date plus its components and the year's week count.
 * @throws {TypeError} If `date` is not a string.
 * @throws {RangeError} If `date` is empty, not `YYYY-MM-DD`, or names a calendar
 *   date that does not exist (e.g. `2021-02-29`).
 *
 * @example
 * ```ts
 * import { dateToIsoWeekDate } from '@open-utility-tools/core/time/iso-week-date-converter';
 * dateToIsoWeekDate('2021-01-01').isoWeekDate; // → '2020-W53-5' (belongs to 2020)
 * dateToIsoWeekDate('2026-06-02').weekdayName; // → 'Tuesday'
 * ```
 */
export function dateToIsoWeekDate(date: string): IsoWeekFromDate {
  if (typeof date !== 'string') {
    throw new TypeError('date must be a string in YYYY-MM-DD form');
  }
  const text = date.trim();
  if (!text) throw new RangeError('Pick a calendar date.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError('Date must be YYYY-MM-DD.');
  const ys = m[1];
  const mos = m[2];
  const das = m[3];
  if (ys === undefined || mos === undefined || das === undefined) {
    throw new RangeError('Date must be YYYY-MM-DD.');
  }
  const y = Number(ys);
  const mo = Number(mos);
  const da = Number(das);
  if (![y, mo, da].every(Number.isFinite)) throw new RangeError('Invalid date fields.');
  const d = new Date(Date.UTC(y, mo - 1, da));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) {
    throw new RangeError('That calendar date does not exist.');
  }
  const { isoYear, week, weekday } = dateToIsoWeek(d);
  return {
    isoWeekDate: `${isoYear}-W${pad2(week)}-${weekday}`,
    isoYear,
    week,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday - 1] ?? '',
    weeksInYear: weeksInIsoYear(isoYear),
    calendar: `${y}-${pad2(mo)}-${pad2(da)}`,
  };
}

/**
 * Converts an ISO-8601 week-date (week-year, week number, weekday) back into a
 * Gregorian calendar date.
 *
 * @param isoYear - ISO week-year (any integer; can differ from a calendar year).
 * @param week - ISO week number, 1 through the year's week count (52 or 53).
 * @param weekday - ISO weekday, Monday = 1 … Sunday = 7.
 * @returns The calendar date plus the canonical week-date string and metadata.
 * @throws {RangeError} If `isoYear`/`week`/`weekday` are not integers, `week` is
 *   below 1 or above the year's week count, or `weekday` is outside 1–7.
 *
 * @example
 * ```ts
 * import { isoWeekDateToDate } from '@open-utility-tools/core/time/iso-week-date-converter';
 * isoWeekDateToDate(2020, 53, 5).calendar; // → '2021-01-01'
 * isoWeekDateToDate(2009, 1, 1).calendar;  // → '2008-12-29'
 * ```
 */
export function isoWeekDateToDate(
  isoYear: number,
  week: number,
  weekday: number,
): IsoWeekToDate {
  if (!Number.isInteger(isoYear)) throw new RangeError('ISO year must be an integer.');
  if (!Number.isInteger(week) || week < 1) throw new RangeError('Week must be a positive integer.');
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new RangeError('Weekday must be an integer 1 (Monday) through 7 (Sunday).');
  }
  const maxWeeks = weeksInIsoYear(isoYear);
  if (week > maxWeeks) throw new RangeError(`${isoYear} has only ${maxWeeks} ISO weeks.`);
  const monday = week1Monday(isoYear);
  const result = new Date(monday);
  result.setUTCDate(monday.getUTCDate() + (week - 1) * 7 + (weekday - 1));
  return {
    calendar: `${result.getUTCFullYear()}-${pad2(result.getUTCMonth() + 1)}-${pad2(result.getUTCDate())}`,
    isoWeekDate: `${isoYear}-W${pad2(week)}-${weekday}`,
    weekdayName: WEEKDAY_NAMES[weekday - 1] ?? '',
    weeksInYear: maxWeeks,
    isoYear,
  };
}
