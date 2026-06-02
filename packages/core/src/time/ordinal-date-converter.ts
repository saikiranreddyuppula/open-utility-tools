/**
 * Ordinal Date Converter
 *
 * Converts between calendar dates (ISO `YYYY-MM-DD`) and ISO 8601 ordinal dates
 * (`YYYY-DDD`, i.e. year + day-of-year). Pure and isomorphic: relies only on the
 * standard `Date` object and runs identically in browsers, Node 20+, and Bun.
 *
 * The arithmetic mirrors the original UI implementation exactly (UTC-based day
 * counting, proleptic Gregorian leap rule).
 */

/** Result of converting a calendar date to its ordinal representation. */
export interface DateToOrdinalResult {
  /** ISO 8601 ordinal date, e.g. `"2024-061"`. */
  ordinal: string;
  /** Calendar year. */
  year: number;
  /** Day-of-year (1-based; 1 = Jan 1). */
  dayOfYear: number;
  /** Days remaining in the year after this date (0 on the last day). */
  daysRemaining: number;
  /** Total days in the year (365 or 366). */
  daysInYear: number;
  /** Whether the year is a leap year. */
  leapYear: boolean;
}

/** Result of converting an ordinal date back to a calendar date. */
export interface OrdinalToDateResult {
  /** ISO 8601 calendar date, e.g. `"2024-03-01"`. */
  date: string;
  /** ISO 8601 ordinal date, e.g. `"2024-061"`. */
  ordinal: string;
  /** Days remaining in the year after this date (0 on the last day). */
  daysRemaining: number;
  /** Total days in the year (365 or 366). */
  daysInYear: number;
  /** Whether the year is a leap year. */
  leapYear: boolean;
}

/** Proleptic Gregorian leap-year test. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in the given calendar year (365 or 366). */
function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Left-pad a non-negative integer to a fixed width with zeros. */
function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

/**
 * Parse and validate a strict `YYYY-MM-DD` calendar date string.
 * Returns `null` for malformed or non-existent dates (e.g. Feb 30).
 */
function parseISODate(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const parts = value.split('-');
  const yRaw = parts[0];
  const mRaw = parts[1];
  const dRaw = parts[2];
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/** Compute the 1-based day-of-year for a UTC calendar date. */
function computeDayOfYear(y: number, m: number, d: number): number {
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / 86400000) + 1;
}

/**
 * Convert an ISO calendar date (`YYYY-MM-DD`) to its ISO 8601 ordinal date
 * (`YYYY-DDD`) along with related day-of-year statistics.
 *
 * @param isoDate - Calendar date in strict `YYYY-MM-DD` form (UTC-interpreted).
 * @returns The ordinal date plus year, day-of-year, days remaining, days in
 *   year, and leap-year flag.
 * @throws {RangeError} If `isoDate` is empty, malformed, or a non-existent
 *   calendar date (e.g. `"2023-02-29"`).
 *
 * @example
 * ```ts
 * dateToOrdinal('2024-03-01');
 * // => {
 * //   ordinal: '2024-061',
 * //   year: 2024,
 * //   dayOfYear: 61,
 * //   daysRemaining: 305,
 * //   daysInYear: 366,
 * //   leapYear: true,
 * // }
 * ```
 */
export function dateToOrdinal(isoDate: string): DateToOrdinalResult {
  const parsed = parseISODate(isoDate);
  if (parsed === null) {
    throw new RangeError(`Invalid calendar date: ${JSON.stringify(isoDate)}`);
  }
  const { y, m, d } = parsed;
  const doy = computeDayOfYear(y, m, d);
  const total = daysInYear(y);
  return {
    ordinal: `${pad(y, 4)}-${pad(doy, 3)}`,
    year: y,
    dayOfYear: doy,
    daysRemaining: total - doy,
    daysInYear: total,
    leapYear: isLeapYear(y),
  };
}

/**
 * Convert an ordinal date (year + day-of-year) back to an ISO calendar date
 * (`YYYY-MM-DD`) along with related statistics.
 *
 * @param year - Calendar year (must be an integer).
 * @param dayOfYear - 1-based day-of-year (must be an integer between 1 and the
 *   number of days in `year`, inclusive).
 * @returns The calendar date plus the ordinal date, days remaining, days in
 *   year, and leap-year flag.
 * @throws {TypeError} If `year` or `dayOfYear` is not an integer.
 * @throws {RangeError} If `dayOfYear` is outside `1..daysInYear(year)`.
 *
 * @example
 * ```ts
 * ordinalToDate(2024, 61);
 * // => {
 * //   date: '2024-03-01',
 * //   ordinal: '2024-061',
 * //   daysRemaining: 305,
 * //   daysInYear: 366,
 * //   leapYear: true,
 * // }
 * ```
 */
export function ordinalToDate(year: number, dayOfYear: number): OrdinalToDateResult {
  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new TypeError(`Year must be an integer, received: ${JSON.stringify(year)}`);
  }
  if (!Number.isFinite(dayOfYear) || !Number.isInteger(dayOfYear)) {
    throw new TypeError(
      `Day-of-year must be an integer, received: ${JSON.stringify(dayOfYear)}`,
    );
  }
  const total = daysInYear(year);
  if (dayOfYear < 1 || dayOfYear > total) {
    throw new RangeError(
      `Day-of-year must be between 1 and ${total} for ${year}, received: ${dayOfYear}`,
    );
  }
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + (dayOfYear - 1));
  const iso = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(
    date.getUTCDate(),
    2,
  )}`;
  return {
    date: iso,
    ordinal: `${pad(year, 4)}-${pad(dayOfYear, 3)}`,
    daysRemaining: total - dayOfYear,
    daysInYear: total,
    leapYear: isLeapYear(year),
  };
}
