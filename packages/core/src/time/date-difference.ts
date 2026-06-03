/**
 * Pure, isomorphic implementation of the "Date Difference" tool.
 *
 * Lifted verbatim from the original React UI: it parses two dates, computes the
 * absolute span between them, and produces both a human calendar breakdown
 * (years / months / days) and a set of grouped total-unit strings.
 *
 * Notes on faithfulness to the original:
 * - Dates are parsed with the native `Date` constructor, exactly as the UI did
 *   (e.g. an ISO `YYYY-MM-DD` string is interpreted as UTC midnight by the
 *   platform, while the calendar breakdown reads local-time fields). This
 *   behavior is preserved unchanged.
 * - The calendar breakdown borrows months from the prior month's day count and
 *   normalizes negative months, identical to the source algorithm.
 * - Total values are grouped with `Intl.NumberFormat('en-US')`, which yields the
 *   same comma-grouped strings the UI's `Number.toLocaleString()` produced in an
 *   en-US locale, but deterministically (locale-independent) for any host.
 */

export interface DateDifferenceResult {
  /** Calendar breakdown, e.g. `"20 years, 1 months, 24 days"`. */
  calendar: string;
  /** Whole days, comma-grouped, e.g. `"7,360"`. */
  totalDays: string;
  /** Total weeks with one decimal place, e.g. `"1051.4"`. */
  totalWeeks: string;
  /** Whole hours, comma-grouped. */
  totalHours: string;
  /** Whole minutes, comma-grouped. */
  totalMinutes: string;
  /** Whole seconds, comma-grouped. */
  totalSeconds: string;
}

/** Accepted input forms for a date endpoint. */
export type DateInput = string | number | Date;

const GROUP_FORMATTER = new Intl.NumberFormat('en-US');

/** Comma-group an integer the same way the UI's `toLocaleString()` did. */
function group(n: number): string {
  return GROUP_FORMATTER.format(n);
}

/** Coerce an arbitrary date input into a fresh `Date` (never mutating input). */
function toDate(value: DateInput): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

/**
 * Calculate the duration between two dates.
 *
 * The result is direction-independent: swapping `from` and `to` yields the same
 * output, because the span is measured as an absolute difference.
 *
 * @param from - The start date. A string (e.g. `"2000-01-15"`), epoch
 *   milliseconds, or a `Date`.
 * @param to - The end date, in any of the same forms as `from`.
 * @returns A {@link DateDifferenceResult} with a calendar breakdown and grouped
 *   total-unit strings.
 * @throws {RangeError} If either `from` or `to` cannot be parsed into a valid
 *   date.
 *
 * @example
 * ```ts
 * dateDifference('2000-01-15', '2020-03-10');
 * // {
 * //   calendar: '20 years, 1 months, 24 days',
 * //   totalDays: '7,360',
 * //   totalWeeks: '1051.4',
 * //   totalHours: '176,640',
 * //   totalMinutes: '10,598,400',
 * //   totalSeconds: '635,904,000',
 * // }
 * ```
 */
export function dateDifference(from: DateInput, to: DateInput): DateDifferenceResult {
  const a = toDate(from);
  const b = toDate(to);

  if (Number.isNaN(a.getTime())) {
    throw new RangeError(`Invalid "from" date: ${String(from)}`);
  }
  if (Number.isNaN(b.getTime())) {
    throw new RangeError(`Invalid "to" date: ${String(to)}`);
  }

  const ms = Math.abs(b.getTime() - a.getTime());
  const sec = ms / 1000;
  const days = ms / 86400000;

  // Calendar Y/M/D breakdown between the earlier (lo) and later (hi) date.
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  let years = hi.getFullYear() - lo.getFullYear();
  let months = hi.getMonth() - lo.getMonth();
  let dayDiff = hi.getDate() - lo.getDate();
  if (dayDiff < 0) {
    months -= 1;
    const prevMonth = new Date(hi.getFullYear(), hi.getMonth(), 0).getDate();
    dayDiff += prevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    calendar: `${years} years, ${months} months, ${dayDiff} days`,
    totalDays: group(Math.floor(days)),
    totalWeeks: (days / 7).toFixed(1),
    totalHours: group(Math.floor(sec / 3600)),
    totalMinutes: group(Math.floor(sec / 60)),
    totalSeconds: group(Math.floor(sec)),
  };
}
