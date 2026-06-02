// Extracted from tools/time/stardate-converter. Pure, isomorphic novelty math
// for the popular TNG film-era stardate convention. No DOM, no React.

const EPOCH_YEAR = 2323; // 2323-01-01 = stardate 0 in the popular TNG film-era convention

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

function formatISO(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m + 1, 2)}-${pad(d, 2)}`;
}

function parseISODate(value: string): { y: number; m: number; d: number } | null {
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
  return { y, m, d };
}

function dayOfYear(y: number, m: number, d: number): number {
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m, d);
  return Math.floor((current - start) / 86400000); // 0-based fraction of the year
}

export interface DateToStardateResult {
  /** The computed stardate, formatted to one decimal place (e.g. `"41000.0"`). */
  stardate: string;
  /** Whole-year offset from the 2323 epoch, i.e. `year − 2323`. */
  yearOffset: number;
  /** Day-of-year fraction scaled to the 0–1000 stardate band, one decimal. */
  fraction: string;
  /** The input date echoed back as `YYYY-MM-DD`. */
  gregorianDate: string;
}

export interface StardateToDateResult {
  /** The resulting Gregorian date as `YYYY-MM-DD`. */
  gregorianDate: string;
  /** The Gregorian year. */
  year: number;
  /** 1-based day of the year. */
  dayOfYear: number;
  /** The input stardate, formatted to one decimal place. */
  stardate: string;
}

/**
 * Converts a Gregorian date to a TNG film-era stardate using the popular fan
 * formula `SD = 1000 × (year − 2323) + (dayOfYear / daysInYear) × 1000`, where
 * `2323-01-01` is stardate `0`. Pure and isomorphic — no DOM, runs in the
 * browser, Node, and Bun.
 *
 * Multiple stardate systems exist; this implements the common fan convention
 * only. Note that stardates below 0 (dates before the 2323 epoch) are still
 * produced here as negative numbers.
 *
 * @param date - Gregorian date as `YYYY-MM-DD`.
 * @returns The stardate, the year offset, the day-of-year fraction, and the echoed date.
 * @throws {RangeError} If `date` is not a valid `YYYY-MM-DD` calendar date.
 *
 * @example
 * ```ts
 * import { dateToStardate } from '@open-utility-tools/core/time/stardate-converter';
 * dateToStardate('2364-01-01').stardate; // → '41000.0'
 * dateToStardate('2323-07-02').stardate; // → '498.6'
 * ```
 */
export function dateToStardate(date: string): DateToStardateResult {
  const parsed = parseISODate(date);
  if (!parsed) {
    throw new RangeError(`Invalid date: ${JSON.stringify(date)} (expected YYYY-MM-DD)`);
  }
  const { y, m, d } = parsed;
  // Use 0-based month index for arithmetic.
  const doy = dayOfYear(y, m - 1, d);
  const frac = doy / daysInYear(y);
  const sd = 1000 * (y - EPOCH_YEAR) + frac * 1000;
  return {
    stardate: sd.toFixed(1),
    yearOffset: y - EPOCH_YEAR,
    fraction: (frac * 1000).toFixed(1),
    gregorianDate: formatISO(y, m - 1, d),
  };
}

/**
 * Converts a TNG film-era stardate back to a Gregorian date, inverting
 * {@link dateToStardate}. The whole-thousands part selects the year offset from
 * the 2323 epoch and the remainder is mapped onto the day of that year. Pure and
 * isomorphic — no DOM, runs in the browser, Node, and Bun.
 *
 * @param stardate - The stardate as a number or numeric string (e.g. `41000.0`).
 * @returns The Gregorian date, year, 1-based day of year, and the echoed stardate.
 * @throws {TypeError} If `stardate` is not a finite number.
 * @throws {RangeError} If `stardate` is negative — this convention only supports
 *   stardates ≥ 0 (year 2323 onward).
 *
 * @example
 * ```ts
 * import { stardateToDate } from '@open-utility-tools/core/time/stardate-converter';
 * stardateToDate(41000).gregorianDate;   // → '2364-01-01'
 * stardateToDate('41500.0').gregorianDate; // → '2364-07-02'
 * ```
 */
export function stardateToDate(stardate: number | string): StardateToDateResult {
  const sd = typeof stardate === 'number' ? stardate : Number(stardate);
  if (!Number.isFinite(sd)) {
    throw new TypeError(`Invalid stardate: ${JSON.stringify(stardate)} (expected a finite number)`);
  }
  if (sd < 0) {
    throw new RangeError('This convention only supports stardates >= 0 (year 2323+).');
  }
  const yearOffset = Math.floor(sd / 1000);
  const year = EPOCH_YEAR + yearOffset;
  const frac = (sd - yearOffset * 1000) / 1000; // 0..1
  const total = daysInYear(year);
  let doy = Math.round(frac * total); // 0-based
  if (doy >= total) doy = total - 1;
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + doy);
  const iso = formatISO(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return {
    gregorianDate: iso,
    year,
    dayOfYear: doy + 1,
    stardate: sd.toFixed(1),
  };
}
