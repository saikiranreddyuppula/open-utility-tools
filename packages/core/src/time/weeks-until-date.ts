const MS_DAY = 1000 * 60 * 60 * 24;

/**
 * The span breakdown between two dates, broken into the same units the
 * Weeks &amp; Months Until Date tool reports.
 */
export interface WeeksUntilDateResult {
  /** True when `to` is earlier than `from` (the span was measured backwards). */
  reversed: boolean;
  /** Total whole calendar days between the two dates (always non-negative). */
  totalDays: number;
  /** Number of complete 7-day weeks in the span. */
  fullWeeks: number;
  /** Days left over after removing the full weeks (`totalDays % 7`). */
  leftoverDays: number;
  /** Number of complete calendar months in the span (month-end overflow clamped). */
  fullMonths: number;
  /** Days left over after removing the full months. */
  leftoverMonthDays: number;
  /** Count of Saturdays + Sundays in the span (start day excluded, end day included). */
  weekendDays: number;
  /** Count of Mon-Fri days in the span (start day excluded, end day included). */
  businessDays: number;
}

/** A calendar date with no time-of-day or timezone component. */
interface YMD {
  /** Full (four-digit) year. */
  year: number;
  /** Month of the year, 1-12. */
  month: number;
  /** Day of the month, 1-31. */
  day: number;
}

/**
 * Parse a strict `"YYYY-MM-DD"` string into its calendar components.
 *
 * The value is validated against a fixed `YYYY-MM-DD` shape and re-checked by
 * round-tripping through a UTC date, so out-of-range parts (e.g. `2026-02-30`)
 * are rejected rather than silently rolled over. Parsing is done with no
 * timezone component so all downstream day-of-week and span math is
 * timezone-independent (a UTC anchor is used everywhere instead of local
 * midnight, which avoids daylight-saving drift).
 *
 * @throws {TypeError} when `value` is empty or not a string.
 * @throws {RangeError} when `value` is not a valid `"YYYY-MM-DD"` date.
 */
function parseISODate(value: string, label: string): YMD {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty date string (expected "YYYY-MM-DD").`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    throw new RangeError(`${label} is not a valid date: "${value}" (expected "YYYY-MM-DD").`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new RangeError(`${label} is not a valid date: "${value}" (expected "YYYY-MM-DD").`);
  }
  return { year, month, day };
}

/** Number of whole days from the Unix epoch to the given calendar date (UTC). */
function toEpochDays(ymd: YMD): number {
  return Math.round(Date.UTC(ymd.year, ymd.month - 1, ymd.day) / MS_DAY);
}

/** Days in the month containing 1-based `month` of `year`. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute the full breakdown of the span between two dates: total calendar
 * days, full weeks + leftover days, full months + leftover days, and the
 * weekend / business day counts across the span.
 *
 * The span is measured in whole calendar days (computed from UTC anchors, so it
 * is unaffected by daylight-saving transitions in the host timezone). Weekend
 * and business days are counted over the day *after* the start through the end
 * day (start day excluded, end day included), so they always sum to
 * `totalDays`. If `to` is before `from`, the span is measured backwards and
 * {@link WeeksUntilDateResult.reversed} is `true` (all magnitudes stay
 * non-negative).
 *
 * @param from - Start date as an ISO `"YYYY-MM-DD"` string.
 * @param to - Target date as an ISO `"YYYY-MM-DD"` string.
 * @returns The {@link WeeksUntilDateResult} breakdown of the span.
 * @throws {TypeError} when either argument is empty or not a string.
 * @throws {RangeError} when either argument is not a valid `"YYYY-MM-DD"` date.
 *
 * @example
 * ```ts
 * weeksUntilDate('2026-06-02', '2026-12-25');
 * // {
 * //   reversed: false,
 * //   totalDays: 206,
 * //   fullWeeks: 29,
 * //   leftoverDays: 3,
 * //   fullMonths: 6,
 * //   leftoverMonthDays: 23,
 * //   weekendDays: 58,
 * //   businessDays: 148,
 * // }
 * ```
 */
export function weeksUntilDate(from: string, to: string): WeeksUntilDateResult {
  const fromYMD = parseISODate(from, 'from');
  const toYMD = parseISODate(to, 'to');

  const fromDays = toEpochDays(fromYMD);
  const toDays = toEpochDays(toYMD);

  const reversed = toDays < fromDays;
  const a = reversed ? toYMD : fromYMD;
  const aDays = reversed ? toDays : fromDays;
  const bDays = reversed ? fromDays : toDays;

  const totalDays = bDays - aDays;
  const fullWeeks = Math.floor(totalDays / 7);
  const leftoverDays = totalDays % 7;

  // Month-step from a toward b, clamping month-end overflow (e.g. stepping from
  // Jan 31 lands on the last valid day of the next month, not into March).
  let fullMonths = 0;
  let cursorYear = a.year;
  let cursorMonth = a.month; // 1-12
  const dayOfMonth = a.day;
  for (;;) {
    let nextYear = cursorYear;
    let nextMonth = cursorMonth + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextDay = Math.min(dayOfMonth, daysInMonth(nextYear, nextMonth));
    const nextDays = Math.round(Date.UTC(nextYear, nextMonth - 1, nextDay) / MS_DAY);
    if (nextDays > bDays) break;
    cursorYear = nextYear;
    cursorMonth = nextMonth;
    fullMonths += 1;
  }
  const cursorDay = Math.min(dayOfMonth, daysInMonth(cursorYear, cursorMonth));
  const cursorDays = Math.round(Date.UTC(cursorYear, cursorMonth - 1, cursorDay) / MS_DAY);
  const leftoverMonthDays = bDays - cursorDays;

  // Count weekend days and business days across the span (exclusive of start
  // day, inclusive through the end day so the span covers totalDays calendar
  // days). Day-of-week is read from a fixed UTC anchor, immune to DST.
  let weekendDays = 0;
  let businessDays = 0;
  for (let i = 1; i <= totalDays; i += 1) {
    const dow = new Date((aDays + i) * MS_DAY).getUTCDay();
    if (dow === 0 || dow === 6) weekendDays += 1;
    else businessDays += 1;
  }

  return {
    reversed,
    totalDays,
    fullWeeks,
    leftoverDays,
    fullMonths,
    leftoverMonthDays,
    weekendDays,
    businessDays,
  };
}
