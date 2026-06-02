/**
 * Quarter & Fiscal Period Finder — pure, isomorphic core.
 *
 * Given an ISO date and a configurable fiscal-year start month, computes the
 * calendar or fiscal quarter, half, fiscal-year boundaries, the quarter's
 * start/end dates, and progress through the quarter.
 *
 * Lifted verbatim from the app UI's transform; runs unchanged in browser,
 * Node 20, and Bun. All date math is done in UTC to avoid timezone drift.
 */

/** Result of {@link quarterOfDate}. */
export interface QuarterInfo {
  /** Quarter number within the fiscal year, 1-4. */
  quarter: number;
  /** Short quarter label, e.g. `"Q2"`. */
  quarterLabel: string;
  /** Half number within the fiscal year, 1-2. */
  half: number;
  /** Short half label, e.g. `"H1"`. */
  halfLabel: string;
  /** Calendar year in which the containing fiscal year begins. */
  fiscalYearStartYear: number;
  /**
   * Fiscal-year label. For a January start (calendar quarters) this is just
   * the year, e.g. `"2026"`; otherwise the span form, e.g. `"FY 2026-27"`.
   */
  fiscalYearLabel: string;
  /** Quarter label combined with the fiscal year, e.g. `"Q2 2026"`. */
  quarterFullLabel: string;
  /** Half label combined with the fiscal year, e.g. `"H1 2026"`. */
  halfFullLabel: string;
  /** First day of the quarter, ISO `YYYY-MM-DD`. */
  quarterStart: string;
  /** Last day of the quarter, ISO `YYYY-MM-DD`. */
  quarterEnd: string;
  /** First day of the fiscal year, ISO `YYYY-MM-DD`. */
  fiscalYearStart: string;
  /** Last day of the fiscal year, ISO `YYYY-MM-DD`. */
  fiscalYearEnd: string;
  /** Total number of days in the quarter (inclusive). */
  daysInQuarter: number;
  /** Days elapsed in the quarter up to and including the given date (1-based). */
  daysElapsed: number;
  /** Days remaining in the quarter after the given date. */
  daysRemaining: number;
  /** Percent of the quarter complete, rounded to one decimal place. */
  percentComplete: number;
  /** Human summary, e.g. `"Q2 2026 — 2026-04-01 to 2026-06-30"`. */
  summary: string;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

/** Format a calendar date as ISO, where `m` is a 0-based month index. */
function formatISO(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m + 1, 2)}-${pad(d, 2)}`;
}

/**
 * Strictly parse a `YYYY-MM-DD` string into UTC calendar parts.
 * Round-trips through `Date.UTC` to reject impossible dates (e.g. Feb 30).
 *
 * @returns `{ y, m, d }` where `m` is the 1-based month.
 * @throws {TypeError} when `value` is empty.
 * @throws {RangeError} when `value` is not a valid `YYYY-MM-DD` date.
 */
function parseISODate(value: string): { y: number; m: number; d: number } {
  if (!value) {
    throw new TypeError('date must be a non-empty ISO string (YYYY-MM-DD)');
  }
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new RangeError(`invalid date: "${value}" (expected YYYY-MM-DD)`);
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new RangeError(`invalid date: "${value}" (expected YYYY-MM-DD)`);
  }
  return { y, m, d };
}

/**
 * Determine the calendar or fiscal quarter, half, and period dates for a date.
 *
 * A fiscal year is labelled by the calendar year in which it *starts*. With a
 * January start the quarters coincide with calendar quarters and the fiscal
 * year is labelled by that single year; with any other start month the label
 * uses the span form (e.g. `"FY 2026-27"`).
 *
 * @param date - The date to inspect, as an ISO `YYYY-MM-DD` string.
 * @param fiscalYearStartMonth - 0-based month the fiscal year begins (0 = January,
 *   the default, yields calendar quarters; 3 = April; etc.). Must be 0-11.
 * @returns A {@link QuarterInfo} describing the quarter, half, fiscal year, and progress.
 * @throws {TypeError} when `date` is empty.
 * @throws {RangeError} when `date` is not a valid `YYYY-MM-DD` date, or
 *   `fiscalYearStartMonth` is not an integer in 0-11.
 *
 * @example
 * quarterOfDate('2026-06-02');
 * // => { quarter: 2, quarterLabel: 'Q2', quarterFullLabel: 'Q2 2026',
 * //      quarterStart: '2026-04-01', quarterEnd: '2026-06-30',
 * //      daysInQuarter: 91, percentComplete: 69.2, ... }
 *
 * @example
 * // April-start fiscal year: June falls in fiscal Q1.
 * quarterOfDate('2026-06-02', 3).quarterFullLabel; // => 'Q1 FY 2026-27'
 */
export function quarterOfDate(
  date: string,
  fiscalYearStartMonth: number = 0,
): QuarterInfo {
  const { y, m: month1, d } = parseISODate(date);
  const m = month1 - 1; // 0-based calendar month

  const fy = fiscalYearStartMonth;
  if (!Number.isInteger(fy) || fy < 0 || fy > 11) {
    throw new RangeError(
      `fiscalYearStartMonth must be an integer 0-11 (got ${fiscalYearStartMonth})`,
    );
  }

  // Offset of this month within the fiscal year (0..11).
  const offset = (m - fy + 12) % 12;
  const quarterIndex = Math.floor(offset / 3); // 0..3
  const halfIndex = Math.floor(offset / 6); // 0..1
  const quarterLabel = `Q${quarterIndex + 1}`;
  const halfLabel = `H${halfIndex + 1}`;

  // Fiscal year that contains this date, labelled by its start year.
  const fyStartYear = m >= fy ? y : y - 1;

  // Quarter start month (calendar month index) and its calendar year.
  const qStartOffset = quarterIndex * 3;
  const qStartMonthAbs = fy + qStartOffset; // may exceed 11
  const qStartYear = fyStartYear + Math.floor(qStartMonthAbs / 12);
  const qStartMonth = qStartMonthAbs % 12;
  const quarterStartDate = new Date(Date.UTC(qStartYear, qStartMonth, 1));
  const quarterEndDate = new Date(Date.UTC(qStartYear, qStartMonth + 3, 0)); // last day of quarter

  // Fiscal year start and end.
  const fyStartDate = new Date(Date.UTC(fyStartYear, fy, 1));
  const fyEndDate = new Date(Date.UTC(fyStartYear, fy + 12, 0));

  const today = new Date(Date.UTC(y, m, d));
  const qStartMs = quarterStartDate.getTime();
  const qEndMs = quarterEndDate.getTime();
  const totalDays = Math.round((qEndMs - qStartMs) / 86400000) + 1;
  const elapsed = Math.round((today.getTime() - qStartMs) / 86400000) + 1;
  const remaining = totalDays - elapsed;
  const percent = Number(((elapsed / totalDays) * 100).toFixed(1));

  const fyLabel =
    fy === 0
      ? `${fyStartYear}`
      : `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;

  const quarterFullLabel =
    fy === 0 ? `${quarterLabel} ${fyStartYear}` : `${quarterLabel} ${fyLabel}`;
  const halfFullLabel = `${halfLabel} ${fy === 0 ? fyStartYear : fyLabel}`;

  const quarterStart = formatISO(
    quarterStartDate.getUTCFullYear(),
    quarterStartDate.getUTCMonth(),
    quarterStartDate.getUTCDate(),
  );
  const quarterEnd = formatISO(
    quarterEndDate.getUTCFullYear(),
    quarterEndDate.getUTCMonth(),
    quarterEndDate.getUTCDate(),
  );

  return {
    quarter: quarterIndex + 1,
    quarterLabel,
    half: halfIndex + 1,
    halfLabel,
    fiscalYearStartYear: fyStartYear,
    fiscalYearLabel: fyLabel,
    quarterFullLabel,
    halfFullLabel,
    quarterStart,
    quarterEnd,
    fiscalYearStart: formatISO(
      fyStartDate.getUTCFullYear(),
      fyStartDate.getUTCMonth(),
      fyStartDate.getUTCDate(),
    ),
    fiscalYearEnd: formatISO(
      fyEndDate.getUTCFullYear(),
      fyEndDate.getUTCMonth(),
      fyEndDate.getUTCDate(),
    ),
    daysInQuarter: totalDays,
    daysElapsed: elapsed,
    daysRemaining: remaining,
    percentComplete: percent,
    summary: `${quarterFullLabel} — ${quarterStart} to ${quarterEnd}`,
  };
}
