/**
 * Date Range Splitter — split a date range into equal chunks or fixed-length
 * intervals (e.g. weekly buckets).
 *
 * Isomorphic pure transform lifted verbatim from the open-utility-tools UI.
 * Uses only `Date`, `Math`, and string formatting — safe in browsers, Node 20+,
 * and Bun.
 *
 * Note on time zones: dates are parsed with `Date.parse` (which treats bare
 * `YYYY-MM-DD` strings as UTC) and formatted with the local-time getters
 * (`getFullYear`/`getMonth`/`getDate`). The emitted `start`/`end` strings
 * therefore depend on the host time zone, exactly as in the original tool. For
 * deterministic, zone-independent output, run with `TZ=UTC`.
 *
 * @module
 */

/** How the range is divided. */
export type SplitMode = 'equal' | 'fixed';

/** Unit used for fixed-length bucketing. */
export type IntervalUnit = 'days' | 'weeks' | 'months';

/** A single resulting sub-range. */
export interface DateSubRange {
  /** Inclusive start date, formatted `YYYY-MM-DD`. */
  start: string;
  /** End date, formatted `YYYY-MM-DD` (the start of the next bucket). */
  end: string;
  /** Whole-day length of this sub-range (rounded). */
  days: number;
}

/** Result of {@link splitDateRange}. */
export interface DateRangeSplitResult {
  /** Ordered list of sub-ranges that tile the input range. */
  chunks: DateSubRange[];
  /** Total length of the whole input range in whole days (rounded). */
  total: number;
}

/** Options for splitting into a fixed number of equal-span chunks. */
export interface SplitEqualOptions {
  /** Start date — any string parseable by `Date.parse` (e.g. `2026-01-01`). */
  start: string;
  /** End date — must parse to a value strictly after `start`. */
  end: string;
  mode: 'equal';
  /** Number of equal chunks to produce. Floored; must be 1..1000. */
  count: number;
}

/** Options for splitting into fixed-length buckets. */
export interface SplitFixedOptions {
  /** Start date — any string parseable by `Date.parse` (e.g. `2026-01-01`). */
  start: string;
  /** End date — must parse to a value strictly after `start`. */
  end: string;
  mode: 'fixed';
  /** Bucket length, in `unit`s. Floored; must be >= 1. */
  length: number;
  /** Unit the `length` is measured in. */
  unit: IntervalUnit;
}

/** Discriminated union of the two splitting strategies. */
export type SplitDateRangeOptions = SplitEqualOptions | SplitFixedOptions;

const DAY = 86400000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const targetMonth = r.getMonth() + n;
  r.setDate(1);
  r.setMonth(targetMonth);
  // clamp day to month length
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), lastDay));
  return r;
}

/**
 * Split a date range into either N equal-span chunks or fixed-length buckets.
 *
 * In `equal` mode the range `[start, end]` is divided into `count` chunks whose
 * boundaries are computed by proportional rounding, so individual chunk lengths
 * may differ by a day. In `fixed` mode buckets of `length` `unit`s are laid down
 * from `start`; the final bucket is truncated at `end`. Month buckets clamp the
 * day-of-month to the target month's length (e.g. Jan 31 → Feb 28).
 *
 * @param options - Discriminated options object; `mode` selects the strategy.
 * @returns The ordered sub-ranges plus the total span of the input in days.
 * @throws {RangeError} If `start` or `end` is unparseable, if `end <= start`,
 *   if `count` is < 1 or > 1000 (equal mode), if `length` is < 1 (fixed mode),
 *   or if a fixed split would exceed 10000 buckets.
 *
 * @example
 * // Weekly buckets across a quarter (run with TZ=UTC for these exact values):
 * splitDateRange({
 *   start: '2026-01-01',
 *   end: '2026-04-01',
 *   mode: 'fixed',
 *   length: 1,
 *   unit: 'weeks',
 * });
 * // => {
 * //   total: 90,
 * //   chunks: [
 * //     { start: '2026-01-01', end: '2026-01-08', days: 7 },
 * //     // ...11 more 7-day buckets...
 * //     { start: '2026-03-26', end: '2026-04-01', days: 6 },
 * //   ],
 * // }
 */
export function splitDateRange(options: SplitDateRangeOptions): DateRangeSplitResult {
  const { start: startStr, end: endStr } = options;

  const sMs = Date.parse(startStr);
  const eMs = Date.parse(endStr);
  if (!Number.isFinite(sMs)) throw new RangeError('Enter a valid start date.');
  if (!Number.isFinite(eMs)) throw new RangeError('Enter a valid end date.');
  if (eMs <= sMs) throw new RangeError('End date must be after start date.');

  const start = new Date(sMs);
  const end = new Date(eMs);
  const totalDays = Math.round((eMs - sMs) / DAY);
  const chunks: DateSubRange[] = [];

  if (options.mode === 'equal') {
    const n = Math.floor(Number(options.count));
    if (!Number.isFinite(n) || n < 1) throw new RangeError('Enter a chunk count of at least 1.');
    if (n > 1000) throw new RangeError('Chunk count too large (max 1000).');
    const span = eMs - sMs;
    for (let i = 0; i < n; i++) {
      const cs = new Date(sMs + Math.round((span * i) / n));
      const ce = new Date(sMs + Math.round((span * (i + 1)) / n));
      chunks.push({
        start: fmt(cs),
        end: fmt(ce),
        days: Math.round((ce.getTime() - cs.getTime()) / DAY),
      });
    }
    return { chunks, total: totalDays };
  }

  // fixed buckets
  const k = Math.floor(Number(options.length));
  if (!Number.isFinite(k) || k < 1) throw new RangeError('Enter a bucket length of at least 1.');
  const unit = options.unit;
  let cursor = new Date(start.getTime());
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 10000) {
    let next: Date;
    if (unit === 'days') next = new Date(cursor.getTime() + k * DAY);
    else if (unit === 'weeks') next = new Date(cursor.getTime() + k * 7 * DAY);
    else next = addMonths(cursor, k);
    if (next.getTime() > end.getTime()) next = new Date(end.getTime());
    chunks.push({
      start: fmt(cursor),
      end: fmt(next),
      days: Math.round((next.getTime() - cursor.getTime()) / DAY),
    });
    cursor = next;
    guard++;
  }
  if (guard >= 10000) throw new RangeError('Too many buckets — increase the bucket length.');
  return { chunks, total: totalDays };
}
