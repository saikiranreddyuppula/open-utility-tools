/**
 * Business Days Calculator — isomorphic core.
 *
 * Two operations lifted verbatim from the open-utility-tools UI:
 *  - {@link countBusinessDays}: count working days between two dates (excludes weekends).
 *  - {@link addBusinessDays}: add (or subtract) a number of business days to a start date.
 *
 * "Weekend" means Saturday or Sunday in the host's local time zone (matches the original
 * UI, which uses local `Date` getters). No holiday calendar is applied.
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

/** Result of {@link countBusinessDays}. */
export interface BusinessDayCount {
  /** Number of weekdays (Mon–Fri) in the counted range. */
  business: number;
  /** Number of weekend days (Sat/Sun) in the counted range. */
  weekend: number;
  /** Total calendar days counted (business + weekend). */
  total: number;
  /** True when the end date was earlier than the start date and the range was swapped. */
  reversed: boolean;
}

/** Result of {@link addBusinessDays}. */
export interface AddBusinessDaysResult {
  /** Resulting date as a `YYYY-MM-DD` string. */
  resultDate: string;
  /** Day-of-week name of the resulting date (e.g. "Monday"). */
  weekday: string;
}

/**
 * Parse a `YYYY-MM-DD` string into a local-midnight `Date`, validating that the
 * parsed calendar fields round-trip (rejects e.g. `2024-02-31`).
 *
 * @internal Lifted from the UI's `parseDate`; throws instead of returning null.
 */
function parseDate(value: string, label: string): Date {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RangeError(`Invalid ${label}: expected a YYYY-MM-DD string.`);
  }
  const parts = value.split('-');
  const rawY = parts[0];
  const rawM = parts[1];
  const rawD = parts[2];
  if (rawY === undefined || rawM === undefined || rawD === undefined) {
    throw new RangeError(`Invalid ${label}: expected a YYYY-MM-DD string, got "${value}".`);
  }
  const y = Number(rawY);
  const m = Number(rawM);
  const d = Number(rawD);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new RangeError(`Invalid ${label}: expected a YYYY-MM-DD string, got "${value}".`);
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new RangeError(`Invalid ${label}: "${value}" is not a real calendar date.`);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/** True if the date falls on Saturday or Sunday (local time). */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Format a `Date` as `YYYY-MM-DD` using local calendar fields. */
function formatDate(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Count the working days between two calendar dates, excluding weekends.
 *
 * If `endDate` is earlier than `startDate` the range is swapped automatically and
 * `reversed` is set to `true`; the counts are otherwise identical. When
 * `includeStart` is `false` the start date itself is omitted from every count.
 *
 * @param startDate    Start date as a `YYYY-MM-DD` string.
 * @param endDate      End date as a `YYYY-MM-DD` string.
 * @param includeStart Whether to count the start date itself. Defaults to `true`.
 * @returns A {@link BusinessDayCount} with business/weekend/total day counts and the `reversed` flag.
 * @throws {RangeError} If either date is missing, malformed, or not a real calendar date.
 *
 * @example
 * ```ts
 * countBusinessDays('2024-01-01', '2024-01-31');
 * // => { business: 23, weekend: 8, total: 31, reversed: false }
 *
 * countBusinessDays('2024-01-01', '2024-01-05', false);
 * // => { business: 4, weekend: 0, total: 4, reversed: false }
 * ```
 */
export function countBusinessDays(
  startDate: string,
  endDate: string,
  includeStart = true,
): BusinessDayCount {
  const start = parseDate(startDate, 'start date');
  const end = parseDate(endDate, 'end date');

  let from = start;
  let to = end;
  let reversed = false;
  if (from.getTime() > to.getTime()) {
    [from, to] = [to, from];
    reversed = true;
  }

  let business = 0;
  let weekend = 0;
  let total = 0;
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    const sameAsStart = cursor.getTime() === from.getTime();
    const include = includeStart || !sameAsStart;
    if (include) {
      total += 1;
      if (isWeekend(cursor)) weekend += 1;
      else business += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { business, weekend, total, reversed };
}

/**
 * Add (or subtract) a whole number of business days to a start date, skipping weekends.
 *
 * A positive `days` count steps forward, a negative count steps backward. Each step
 * lands on a weekday; weekend days encountered along the way do not consume the count.
 * A `days` value of `0` returns the start date unchanged (even if it is a weekend),
 * matching the original UI behavior.
 *
 * @param startDate Start date as a `YYYY-MM-DD` string.
 * @param days      Whole number of business days to add (negative goes backwards).
 * @returns An {@link AddBusinessDaysResult} with the resulting `YYYY-MM-DD` date and its weekday name.
 * @throws {RangeError} If `startDate` is missing, malformed, or not a real calendar date.
 * @throws {TypeError}  If `days` is not a finite integer.
 *
 * @example
 * ```ts
 * addBusinessDays('2024-01-01', 5);
 * // => { resultDate: '2024-01-08', weekday: 'Monday' }
 *
 * addBusinessDays('2024-01-15', -3);
 * // => { resultDate: '2024-01-10', weekday: 'Wednesday' }
 * ```
 */
export function addBusinessDays(startDate: string, days: number): AddBusinessDaysResult {
  const start = parseDate(startDate, 'start date');
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new TypeError('Expected a whole number of business days.');
  }

  const step = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  const cursor = new Date(start.getTime());
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + step);
    if (!isWeekend(cursor)) remaining -= 1;
  }

  const resultDate = formatDate(cursor);
  const weekday = WEEKDAY_NAMES[cursor.getDay()] ?? '';
  return { resultDate, weekday };
}
