const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Result of converting a calendar date to its ordinal day-of-year. */
export interface DayOfYearResult {
  /** Ordinal day-of-year, where January 1 is `1`. */
  day: number;
  /** Whole days remaining in the year after this date. */
  remaining: number;
  /** Total days in the year (365, or 366 for a leap year). */
  total: number;
  /** Progress through the year as a percentage string with one decimal, e.g. `"16.7"`. */
  percent: string;
  /** Weekday name in UTC, e.g. `"Friday"`. */
  weekday: string;
  /** Whether the date's year is a leap year. */
  leap: boolean;
}

/** Result of converting an ordinal day-of-year back to a calendar date. */
export interface DateFromDayOfYearResult {
  /** Calendar date as a zero-padded `YYYY-MM-DD` string in UTC. */
  date: string;
  /** Weekday name in UTC, e.g. `"Friday"`. */
  weekday: string;
  /** Whole days remaining in the year after this date. */
  remaining: number;
  /** Total days in the year (365, or 366 for a leap year). */
  total: number;
}

/**
 * Returns `true` if `year` is a Gregorian leap year.
 *
 * @param year - Full calendar year (e.g. `2024`).
 * @returns `true` for leap years, `false` otherwise.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in `year` (366 for a leap year, otherwise 365).
 *
 * @param year - Full calendar year (e.g. `2024`).
 * @returns `366` for leap years, `365` otherwise.
 */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayName(date: Date): string {
  const name = WEEKDAY_NAMES[date.getUTCDay()];
  return name ?? '';
}

function parseISODate(value: string): Date {
  if (!value) {
    throw new TypeError('Enter a valid date.');
  }
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new TypeError('Enter a valid date.');
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new RangeError('Enter a valid date.');
  }
  return date;
}

function ordinalFromDate(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.floor((current - start) / 86400000) + 1;
}

/**
 * Converts an ISO calendar date (`YYYY-MM-DD`) to its ordinal day-of-year,
 * along with days remaining, total days in the year, progress percentage,
 * UTC weekday name, and whether the year is a leap year.
 *
 * The date is interpreted in UTC. The input is validated for real calendar
 * dates: out-of-range components such as `2023-02-29` are rejected.
 *
 * @param isoDate - Date as `YYYY-MM-DD` (e.g. `"2024-03-01"`).
 * @returns A {@link DayOfYearResult} describing the date's position in its year.
 * @throws {TypeError} If `isoDate` is empty or has non-numeric components.
 * @throws {RangeError} If `isoDate` is not a real calendar date.
 * @example
 * ```ts
 * dateToDayOfYear('2024-03-01');
 * // => {
 * //   day: 61,
 * //   remaining: 305,
 * //   total: 366,
 * //   percent: '16.7',
 * //   weekday: 'Friday',
 * //   leap: true,
 * // }
 * ```
 */
export function dateToDayOfYear(isoDate: string): DayOfYearResult {
  const date = parseISODate(isoDate);
  const y = date.getUTCFullYear();
  const day = ordinalFromDate(date);
  const total = daysInYear(y);
  const remaining = total - day;
  const percent = ((day / total) * 100).toFixed(1);
  return {
    day,
    remaining,
    total,
    percent,
    weekday: weekdayName(date),
    leap: isLeapYear(y),
  };
}

/**
 * Converts an ordinal day-of-year back to a calendar date in the given year,
 * along with the UTC weekday name, days remaining, and total days in the year.
 *
 * The result date is computed in UTC and formatted as `YYYY-MM-DD`.
 *
 * @param year - Full calendar year (e.g. `2024`); must be an integer.
 * @param ordinal - Ordinal day-of-year where `1` is January 1; must be an
 *   integer between `1` and the year's day count (inclusive).
 * @returns A {@link DateFromDayOfYearResult} for the resolved date.
 * @throws {TypeError} If `year` is not an integer.
 * @throws {TypeError} If `ordinal` is not an integer.
 * @throws {RangeError} If `ordinal` is outside `1`..`daysInYear(year)`.
 * @example
 * ```ts
 * dayOfYearToDate(2024, 61);
 * // => { date: '2024-03-01', weekday: 'Friday', remaining: 305, total: 366 }
 * ```
 */
export function dayOfYearToDate(
  year: number,
  ordinal: number,
): DateFromDayOfYearResult {
  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new TypeError('Enter a valid year.');
  }
  if (!Number.isFinite(ordinal) || !Number.isInteger(ordinal)) {
    throw new TypeError('Enter a valid day number.');
  }
  const total = daysInYear(year);
  if (ordinal < 1 || ordinal > total) {
    throw new RangeError(`Day must be between 1 and ${total} for ${year}.`);
  }
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + (ordinal - 1));
  return {
    date: formatDate(date),
    weekday: weekdayName(date),
    remaining: total - ordinal,
    total,
  };
}
