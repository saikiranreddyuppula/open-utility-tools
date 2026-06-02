// Extracted from tools/time/leap-year-checker. Pure, isomorphic Gregorian
// leap-year math — no React, no DOM. Runs in the browser, Node, and Bun.

/** Maximum span (in years) allowed for a range scan, mirroring the UI guard. */
const MAX_RANGE_SPAN = 2000;

/** Maximum supported magnitude for a year, mirroring the UI guard. */
const MAX_YEAR_MAGNITUDE = 9999999;

/**
 * Tests whether `year` is a leap year under the Gregorian (proleptic) calendar:
 * divisible by 4, except centuries which must also be divisible by 400.
 *
 * @param year - The year to test (negative values are treated proleptically).
 * @returns `true` if `year` is a Gregorian leap year, otherwise `false`.
 *
 * @example
 * ```ts
 * isGregorianLeapYear(2024); // → true
 * isGregorianLeapYear(1900); // → false (century, not divisible by 400)
 * isGregorianLeapYear(2000); // → true  (century divisible by 400)
 * ```
 */
export function isGregorianLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

/** Builds the plain-language explanation for why `year` is/ isn't a leap year. */
function gregorianReason(year: number): string {
  if (year % 4 !== 0) return `${year} is not divisible by 4 → common year.`;
  if (year % 100 !== 0) return `${year} is divisible by 4 and not by 100 → leap year.`;
  if (year % 400 !== 0) {
    return `${year} is divisible by 100 but not by 400 → common year (century exception).`;
  }
  return `${year} is divisible by 400 → leap year (century exception override).`;
}

/**
 * Finds the nearest leap year from `from` in direction `dir`, searching at most
 * 15 years before giving up. If no leap year is found within that window the
 * last candidate scanned is returned (this preserves the original tool's
 * behaviour; in practice a leap year always occurs within 8 years).
 */
function nextLeapYear(from: number, dir: 1 | -1): number {
  let y = from + dir;
  while (!isGregorianLeapYear(y) && Math.abs(y - from) < 16) y += dir;
  return y;
}

/** Options for {@link checkLeapYear}. */
export interface LeapYearOptions {
  /**
   * If provided, also scan every year between `year` and `rangeEnd`
   * (inclusive, either order) and collect the leap years found. Must be a whole
   * number; the span may not exceed 2000 years.
   */
  rangeEnd?: number;
}

/** Result of {@link checkLeapYear}. */
export interface LeapYearResult {
  /** The year that was checked. */
  year: number;
  /** Whether `year` is a Gregorian leap year. */
  leap: boolean;
  /** Human-readable explanation of the leap-year rule applied to `year`. */
  reason: string;
  /** Number of days in `year` (366 if leap, else 365). */
  days: number;
  /** Number of days in February for `year` (29 if leap, else 28). */
  februaryDays: number;
  /** The next leap year at or after `year + 1`. */
  next: number;
  /** The previous leap year at or before `year - 1`. */
  previous: number;
  /** Whether `year` would be a leap year under the older Julian rule (÷4). */
  julianLeap: boolean;
  /**
   * Leap years found in the requested range, or `null` when `rangeEnd` was not
   * supplied. Always ascending.
   */
  rangeLeaps: number[] | null;
  /** The `rangeEnd` that was scanned, or `null` when no range was supplied. */
  rangeEnd: number | null;
}

/**
 * Checks whether a year is a leap year under the Gregorian calendar and reports
 * the supporting facts: the rule explanation, day counts, the neighbouring leap
 * years, the legacy Julian rule, and — optionally — every leap year in a range.
 * Pure and isomorphic: no DOM, runs in the browser, Node, and Bun.
 *
 * @param year - The year to check. Must be a whole number with magnitude ≤ 9999999.
 * @param options - Optional range scan settings (see {@link LeapYearOptions}).
 * @returns A {@link LeapYearResult} describing the year and (optionally) the range.
 * @throws {TypeError} If `year` (or `options.rangeEnd`) is not a whole number.
 * @throws {RangeError} If `year`/`rangeEnd` exceed magnitude 9999999, or the
 *   range span exceeds 2000 years.
 *
 * @example
 * ```ts
 * import { checkLeapYear } from '@open-utility-tools/core/time/leap-year-checker';
 *
 * checkLeapYear(2024).leap;            // → true
 * checkLeapYear(1900).reason;          // → "1900 is divisible by 100 but not by 400 → common year (century exception)."
 * checkLeapYear(2000, { rangeEnd: 2024 }).rangeLeaps;
 * //                                   → [2000, 2004, 2008, 2012, 2016, 2020, 2024]
 * ```
 */
export function checkLeapYear(year: number, options: LeapYearOptions = {}): LeapYearResult {
  if (typeof year !== 'number' || !Number.isInteger(year)) {
    throw new TypeError('year must be a whole number');
  }
  if (Math.abs(year) > MAX_YEAR_MAGNITUDE) {
    throw new RangeError(`year is unreasonably large (max magnitude ${MAX_YEAR_MAGNITUDE})`);
  }

  let rangeLeaps: number[] | null = null;
  let rangeEnd: number | null = null;

  const end = options.rangeEnd;
  if (end !== undefined) {
    if (typeof end !== 'number' || !Number.isInteger(end)) {
      throw new TypeError('rangeEnd must be a whole number');
    }
    if (Math.abs(end) > MAX_YEAR_MAGNITUDE) {
      throw new RangeError(`rangeEnd is unreasonably large (max magnitude ${MAX_YEAR_MAGNITUDE})`);
    }
    const lo = Math.min(year, end);
    const hi = Math.max(year, end);
    if (hi - lo > MAX_RANGE_SPAN) {
      throw new RangeError(`Range is too large (max ${MAX_RANGE_SPAN} years).`);
    }
    rangeEnd = end;
    rangeLeaps = [];
    for (let v = lo; v <= hi; v++) {
      if (isGregorianLeapYear(v)) rangeLeaps.push(v);
    }
  }

  const leap = isGregorianLeapYear(year);
  return {
    year,
    leap,
    reason: gregorianReason(year),
    days: leap ? 366 : 365,
    februaryDays: leap ? 29 : 28,
    next: nextLeapYear(year, 1),
    previous: nextLeapYear(year, -1),
    julianLeap: year % 4 === 0,
    rangeLeaps,
    rangeEnd,
  };
}
