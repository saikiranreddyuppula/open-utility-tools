const DAY_MS = 86_400_000;

/**
 * Day-of-week names, indexed 0..6 to match `Date.prototype.getUTCDay()`
 * (0 = Sunday). Matches the output of
 * `toLocaleDateString('en-US', { weekday: 'long' })`.
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

/** A long-form English weekday name (e.g. `"Tuesday"`). */
export type Weekday = (typeof WEEKDAY_NAMES)[number];

/** The computed calendar facts for a single date. */
export interface WeekNumberResult {
  /** ISO 8601 week number (1–53). */
  week: number;
  /**
   * ISO week-year. This is NOT always the calendar year: the first/last
   * days of January or December can belong to a week owned by the adjacent
   * year (e.g. 2021-01-01 is ISO week 53 of week-year 2020).
   */
  year: number;
  /** Combined ISO designation, e.g. `"2026-W23"` (week zero-padded to 2 digits). */
  iso: string;
  /** Ordinal day of the calendar year (1 = Jan 1, 365/366 = Dec 31). */
  dayOfYear: number;
  /** Long-form weekday name, e.g. `"Tuesday"`. */
  weekday: Weekday;
}

/**
 * Core ISO-week computation, operating purely on a UTC timestamp so the
 * result is independent of the host timezone.
 *
 * The algorithm (lifted verbatim from the source UI): shift the date to the
 * Thursday of its week (ISO weeks are owned by the year containing their
 * Thursday), then count whole weeks since that year's Jan 1.
 */
function isoWeekFromUTC(utc: number): { week: number; year: number } {
  const d = new Date(utc);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/**
 * Compute the ISO 8601 week number — plus the ISO week-year, day-of-year, and
 * weekday name — for a calendar date given as year/month/day components.
 *
 * The date is interpreted as a calendar date (no time-of-day, no timezone):
 * the computation is fully deterministic and yields identical results on every
 * host, in Node, Bun, and the browser.
 *
 * @param year - Full calendar year (e.g. `2026`). Must be a finite integer.
 * @param month - Calendar month, 1-based (1 = January … 12 = December).
 * @param day - Day of the month, 1-based (1–31, validated against the month).
 * @returns The {@link WeekNumberResult} for the date.
 * @throws {TypeError} If any component is not a finite number.
 * @throws {RangeError} If any component is non-integer or out of range, or if
 *   the combination is not a real calendar date (e.g. `2026-02-30`).
 *
 * @example
 * ```ts
 * weekNumber(2026, 6, 2);
 * // => {
 * //   week: 23,
 * //   year: 2026,
 * //   iso: '2026-W23',
 * //   dayOfYear: 153,
 * //   weekday: 'Tuesday',
 * // }
 *
 * // ISO week-year can differ from the calendar year:
 * weekNumber(2025, 12, 29);
 * // => { week: 1, year: 2026, iso: '2026-W01', dayOfYear: 363, weekday: 'Monday' }
 * ```
 */
export function weekNumber(year: number, month: number, day: number): WeekNumberResult {
  const components: ReadonlyArray<readonly [string, number]> = [
    ['year', year],
    ['month', month],
    ['day', day],
  ];
  for (const entry of components) {
    const label = entry[0];
    const value = entry[1];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${label} must be a finite number, received ${String(value)}`);
    }
    if (!Number.isInteger(value)) {
      throw new RangeError(`${label} must be an integer, received ${value}`);
    }
  }
  if (month < 1 || month > 12) {
    throw new RangeError(`month must be between 1 and 12, received ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new RangeError(`day must be between 1 and 31, received ${day}`);
  }

  const monthIndex = month - 1;
  const utc = Date.UTC(year, monthIndex, day);
  const probe = new Date(utc);
  // Date.UTC silently rolls over impossible dates (e.g. Feb 30 -> Mar 2),
  // so reject any input that doesn't round-trip exactly.
  if (probe.getUTCMonth() !== monthIndex || probe.getUTCDate() !== day) {
    throw new RangeError(`invalid calendar date: ${year}-${month}-${day}`);
  }

  const isoWeek = isoWeekFromUTC(utc);

  // Day-of-year: distance from "day 0" of the calendar year (Dec 31 of the
  // previous year), measured in whole days.
  const yearStartUTC = Date.UTC(probe.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((utc - yearStartUTC) / DAY_MS);

  const weekday = WEEKDAY_NAMES[probe.getUTCDay()];
  if (weekday === undefined) {
    throw new RangeError(`could not resolve weekday for ${year}-${month}-${day}`);
  }

  return {
    week: isoWeek.week,
    year: isoWeek.year,
    iso: `${isoWeek.year}-W${String(isoWeek.week).padStart(2, '0')}`,
    dayOfYear,
    weekday,
  };
}

/**
 * Convenience wrapper around {@link weekNumber} that accepts a `YYYY-MM-DD`
 * date string (the format produced by an `<input type="date">`).
 *
 * @param date - A calendar date string in strict `YYYY-MM-DD` form. Leading and
 *   trailing whitespace is trimmed.
 * @returns The {@link WeekNumberResult} for the date.
 * @throws {TypeError} If `date` is not a string.
 * @throws {RangeError} If `date` is not in `YYYY-MM-DD` form or is not a real
 *   calendar date.
 *
 * @example
 * ```ts
 * weekNumberFromISO('2024-01-01');
 * // => { week: 1, year: 2024, iso: '2024-W01', dayOfYear: 1, weekday: 'Monday' }
 * ```
 */
export function weekNumberFromISO(date: string): WeekNumberResult {
  if (typeof date !== 'string') {
    throw new TypeError(`date must be a string, received ${typeof date}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (match === null) {
    throw new RangeError(`date must be in YYYY-MM-DD format, received "${date}"`);
  }
  const yearStr = match[1];
  const monthStr = match[2];
  const dayStr = match[3];
  if (yearStr === undefined || monthStr === undefined || dayStr === undefined) {
    throw new RangeError(`date must be in YYYY-MM-DD format, received "${date}"`);
  }
  return weekNumber(Number(yearStr), Number(monthStr), Number(dayStr));
}