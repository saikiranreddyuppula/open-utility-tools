// Extracted from tools/time/recurring-event-dates. Pure, isomorphic recurrence
// date generation. No DOM — runs in the browser, Node, and Bun. Uses only
// `Date`, `Math`, and `Number`. The arithmetic and clamping behavior is lifted
// verbatim from the original UI so outputs match exactly.
//
// Note on time zones: like the original tool, dates are constructed in the host's
// LOCAL time zone (`new Date("YYYY-MM-DDT00:00:00")` and `new Date(y, m, d)`),
// and weekday/formatting use local getters. For the weekly weekday-filter mode
// with an interval > 1, the interval "phase" is derived from the UTC epoch while
// weekdays come from local time, so results in that specific mode can differ by
// host time zone — this matches the original UI's behavior and is preserved here.

/** Recurrence cadence. */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Options for {@link generateRecurringDates}. */
export interface RecurrenceOptions {
  /** Start date as an ISO calendar date string, e.g. `"2026-01-01"`. */
  start: string;
  /** Recurrence cadence. */
  frequency: RecurrenceFrequency;
  /**
   * How many cadence units between occurrences (e.g. `2` weekly = every other
   * week). Whole number `>= 1`. Defaults to `1`.
   */
  interval?: number;
  /** How many occurrences to generate. Whole number between `1` and `500`. */
  count: number;
  /**
   * Optional inclusive end date (ISO calendar date string). Generation stops
   * once an occurrence would fall after this date. `null`/`undefined` = no end.
   */
  end?: string | null;
  /**
   * Only meaningful for `frequency: 'weekly'`. A set of weekday indices
   * (`0` = Sunday … `6` = Saturday) to emit within each active week. When empty,
   * `null`, or for non-weekly frequencies, the start date's own weekday is used.
   */
  weekdays?: ReadonlyArray<number> | null;
}

/** A single generated occurrence. */
export interface RecurrenceOccurrence {
  /** Occurrence date as `YYYY-MM-DD`. */
  date: string;
  /** English weekday name of {@link RecurrenceOccurrence.date}, e.g. `"Monday"`. */
  weekday: string;
  /** Whole days since the previous occurrence; `0` for the first occurrence. */
  gapDays: number;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MS_DAY = 1000 * 60 * 60 * 24;

/** Parse an ISO calendar date in local time; returns `null` if invalid. */
function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a `Date` as `YYYY-MM-DD` using local calendar fields. */
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Add `n` months, clamping the day to the target month's last day. */
function addMonths(base: Date, n: number, anchorDay: number): Date {
  const total = base.getFullYear() * 12 + base.getMonth() + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchorDay, dim));
}

/** Core generator, lifted verbatim from the UI. */
function generate(
  start: Date,
  freq: RecurrenceFrequency,
  interval: number,
  count: number,
  weekdayFilter: Set<number>,
  end: Date | null,
): RecurrenceOccurrence[] {
  const out: RecurrenceOccurrence[] = [];
  const anchorDay = start.getDate();
  let prev: Date | null = null;
  let guard = 0;
  const maxGuard = 20000;

  if (freq === 'weekly' && weekdayFilter.size > 0) {
    // Step day-by-day across weeks of width `interval`; include selected weekdays.
    const startWeekIndex = Math.floor(start.getTime() / (MS_DAY * 7));
    const cursor = new Date(start.getTime());
    while (out.length < count && guard < maxGuard) {
      guard += 1;
      if (cursor.getTime() < start.getTime()) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      if (end && cursor.getTime() > end.getTime()) break;
      const weekIndex = Math.floor(cursor.getTime() / (MS_DAY * 7));
      const onInterval = (weekIndex - startWeekIndex) % interval === 0;
      if (onInterval && weekdayFilter.has(cursor.getDay())) {
        const cur = new Date(cursor.getTime());
        const gap = prev ? Math.round((cur.getTime() - prev.getTime()) / MS_DAY) : 0;
        out.push({ date: fmt(cur), weekday: WEEKDAYS[cur.getDay()] ?? '', gapDays: gap });
        prev = cur;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  // Non-filtered: step the date by interval * frequency.
  let step = 0;
  while (out.length < count && guard < maxGuard) {
    guard += 1;
    let cur: Date;
    if (freq === 'daily') cur = new Date(start.getTime() + step * interval * MS_DAY);
    else if (freq === 'weekly') cur = new Date(start.getTime() + step * interval * 7 * MS_DAY);
    else if (freq === 'monthly') cur = addMonths(start, step * interval, anchorDay);
    else cur = addMonths(start, step * interval * 12, anchorDay); // yearly
    step += 1;
    if (end && cur.getTime() > end.getTime()) break;
    const gap = prev ? Math.round((cur.getTime() - prev.getTime()) / MS_DAY) : 0;
    out.push({ date: fmt(cur), weekday: WEEKDAYS[cur.getDay()] ?? '', gapDays: gap });
    prev = cur;
  }
  return out;
}

/**
 * Generate the next `count` dates for a simple recurrence rule (daily, weekly,
 * monthly, or yearly with an interval), optionally bounded by an end date and,
 * for weekly recurrences, filtered to specific weekdays.
 *
 * Monthly/yearly steps clamp the day-of-month to the target month's last day
 * (so a start of `2026-01-31` yields `2026-02-28`, `2026-03-31`, …). Generation
 * stops early when the next occurrence would fall after `end`. An internal guard
 * caps iteration, so the result may contain fewer than `count` entries when an
 * `end` date or weekday filter excludes occurrences.
 *
 * @param options - Recurrence configuration. See {@link RecurrenceOptions}.
 * @returns Up to `count` occurrences, each with its ISO date, English weekday
 *   name, and the whole-day gap from the previous occurrence (`0` for the first).
 * @throws {RangeError} If `start` (or a non-null `end`) is not a valid ISO date,
 *   if `interval` is not a whole number `>= 1`, if `count` is not a whole number
 *   in `[1, 500]`, if `end` is before `start`, or if `weekdays` contains a value
 *   outside `0..6`.
 *
 * @example
 * ```ts
 * generateRecurringDates({
 *   start: '2026-01-31',
 *   frequency: 'monthly',
 *   interval: 1,
 *   count: 3,
 * });
 * // [
 * //   { date: '2026-01-31', weekday: 'Saturday', gapDays: 0 },
 * //   { date: '2026-02-28', weekday: 'Saturday', gapDays: 28 },
 * //   { date: '2026-03-31', weekday: 'Tuesday',  gapDays: 31 },
 * // ]
 * ```
 */
export function generateRecurringDates(options: RecurrenceOptions): RecurrenceOccurrence[] {
  const start = parseDate(options.start);
  if (!start) {
    throw new RangeError('start must be a valid ISO date (YYYY-MM-DD).');
  }

  const interval = options.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new RangeError('interval must be a whole number >= 1.');
  }

  const { count } = options;
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new RangeError('count must be a whole number between 1 and 500.');
  }

  const endRaw = options.end ?? null;
  let end: Date | null = null;
  if (endRaw) {
    end = parseDate(endRaw);
    if (!end) {
      throw new RangeError('end must be a valid ISO date (YYYY-MM-DD) or null.');
    }
    if (end.getTime() < start.getTime()) {
      throw new RangeError('end must be on or after start.');
    }
  }

  const filter = new Set<number>();
  if (options.frequency === 'weekly' && options.weekdays) {
    for (const d of options.weekdays) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new RangeError('weekdays must contain integers 0 (Sunday) through 6 (Saturday).');
      }
      filter.add(d);
    }
  }

  return generate(start, options.frequency, interval, count, filter, end);
}
