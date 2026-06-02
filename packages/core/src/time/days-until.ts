// Extracted from tools/time/days-until. Pure, isomorphic date math — no DOM,
// runs in the browser, Node, and Bun. The diff is computed on absolute epoch
// milliseconds, so the result is independent of the host time zone.

/** Matches a strict `YYYY-MM-DD` calendar date string (the format an
 * `<input type="date">` emits). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DaysUntilResult {
  /** `true` when the target date is before `now` (the date is in the past). */
  past: boolean;
  /** Whole calendar days between the two instants (always non-negative). */
  days: number;
  /** Whole weeks within `days` (`Math.floor(days / 7)`). */
  weeks: number;
  /** Leftover days after removing whole weeks (`days % 7`). */
  remDays: number;
  /** Hour component of the sub-day remainder (`0`–`23`). */
  hours: number;
  /** Minute component of the sub-hour remainder (`0`–`59`). */
  minutes: number;
  /** Total whole hours across the entire span (always non-negative). */
  totalHours: number;
  /** Total whole minutes across the entire span (always non-negative). */
  totalMinutes: number;
  /** Human-readable summary, e.g. `"10 days remaining"`, `"1 day ago"`, or
   * `"That date is today"`. Uses `Number#toLocaleString`, so large counts may
   * include locale-specific grouping separators. */
  headline: string;
}

/**
 * Counts the time between a target calendar date and `now`, broken down into
 * days, weeks, hours, and minutes, plus a human-readable headline.
 *
 * The target date is interpreted at the start of its day (`00:00:00`) in the
 * host's local time zone — matching the original UI, where the date comes from
 * an `<input type="date">`. The difference itself is measured in absolute epoch
 * milliseconds, so the numeric breakdown is time-zone independent.
 *
 * @param targetDate - Target date as a `YYYY-MM-DD` string.
 * @param now - Instant to measure from. Defaults to `new Date()`.
 * @returns The countdown breakdown and a headline string.
 * @throws {TypeError} If `targetDate` is not a string.
 * @throws {RangeError} If `targetDate` is not a valid `YYYY-MM-DD` date, or if
 *   `now` is an invalid `Date`.
 *
 * @example
 * ```ts
 * import { daysUntil } from '@open-utility-tools/core/time/days-until';
 *
 * daysUntil('2026-06-12', new Date('2026-06-02T00:00:00')).headline;
 * // → '10 days remaining'
 *
 * daysUntil('2026-05-23', new Date('2026-06-02T12:30:00')).past; // → true
 * daysUntil('2026-06-02', new Date('2026-06-02T00:00:00')).headline;
 * // → 'That date is today'
 * ```
 */
export function daysUntil(targetDate: string, now: Date = new Date()): DaysUntilResult {
  if (typeof targetDate !== 'string') {
    throw new TypeError('targetDate must be a string in YYYY-MM-DD format.');
  }
  if (!ISO_DATE_RE.test(targetDate)) {
    throw new RangeError(
      `Invalid target date ${JSON.stringify(targetDate)}. Expected YYYY-MM-DD format.`,
    );
  }

  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    throw new RangeError(`Invalid target date ${JSON.stringify(targetDate)}.`);
  }
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('now must be a valid Date.');
  }

  const diffMs = target.getTime() - now.getTime();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);

  const totalMinutes = Math.floor(abs / (1000 * 60));
  const totalHours = Math.floor(abs / (1000 * 60 * 60));
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  const headline =
    days === 0
      ? 'That date is today'
      : `${days.toLocaleString()} day${days === 1 ? '' : 's'} ${past ? 'ago' : 'remaining'}`;

  return { past, days, weeks, remDays, hours, minutes, totalHours, totalMinutes, headline };
}
