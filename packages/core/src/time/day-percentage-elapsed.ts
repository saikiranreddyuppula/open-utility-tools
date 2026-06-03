/**
 * Day Percentage Elapsed — compute how much of each calendar period
 * (minute, hour, day, week, month, quarter, year) has elapsed at a given moment.
 *
 * Lifted verbatim from the open-utility-tools UI. All period boundaries are
 * computed in **local time** (matching an HTML `datetime-local` input): the
 * day/week/month/quarter/year starts are built with the local-time `Date`
 * constructor, and a plain date-time string is interpreted in the host's
 * timezone via `Date.parse`. The numeric results therefore depend on the
 * runtime timezone exactly as they do in the browser UI.
 */

/** The fixed set of periods reported, in display order. */
export type PeriodName =
  | 'Minute'
  | 'Hour'
  | 'Day'
  | 'Week (Mon)'
  | 'Month'
  | 'Quarter'
  | 'Year';

/** Elapsed/remaining breakdown for a single period. */
export interface PeriodElapsed {
  /** Human-readable period label. */
  period: PeriodName;
  /** Percent of the period elapsed at the moment (typically 0–100). */
  pctElapsed: number;
  /** `100 - pctElapsed`. */
  pctRemaining: number;
  /** Time elapsed since the period start, as a compact `1d 2h 3m 4s` string. */
  elapsed: string;
  /** Time remaining until the period end, as a compact `1d 2h 3m 4s` string. */
  remaining: string;
}

/** Result of {@link dayPercentageElapsed}. */
export interface DayPercentageResult {
  /** One entry per period, in the order Minute → Year. */
  rows: PeriodElapsed[];
  /** Epoch milliseconds of the parsed moment. */
  epochMs: number;
  /** `Date.prototype.toString()` of the moment (locale/timezone dependent display string). */
  iso: string;
}

/** Accepted moment inputs: an epoch-ms number, a `Date`, or a parseable date-time string. */
export type MomentInput = string | number | Date;

/**
 * Format a signed duration in milliseconds as a compact string such as
 * `1d 2h 3m 4s`. Zero-valued leading units are omitted; a bare `0s` is
 * emitted when every unit is zero. Negative durations are prefixed with `-`.
 */
function humanDuration(ms: number): string {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return (neg ? '-' : '') + parts.join(' ');
}

interface Row {
  period: PeriodName;
  start: number;
  end: number;
}

/**
 * Build the seven period windows around a moment, using local-time boundaries.
 * Each window is `[start, end)` in epoch milliseconds.
 */
function buildRows(d: Date): Row[] {
  const t = d.getTime();
  const y = d.getFullYear();
  const mo = d.getMonth();

  const minStart = new Date(t);
  minStart.setSeconds(0, 0);
  const hourStart = new Date(t);
  hourStart.setMinutes(0, 0, 0);
  const dayStart = new Date(y, mo, d.getDate());
  // week starts Monday
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(y, mo, d.getDate() - dow);
  const monthStart = new Date(y, mo, 1);
  const quarter = Math.floor(mo / 3);
  const quarterStart = new Date(y, quarter * 3, 1);
  const yearStart = new Date(y, 0, 1);

  return [
    { period: 'Minute', start: minStart.getTime(), end: minStart.getTime() + 60000 },
    { period: 'Hour', start: hourStart.getTime(), end: hourStart.getTime() + 3600000 },
    { period: 'Day', start: dayStart.getTime(), end: new Date(y, mo, d.getDate() + 1).getTime() },
    { period: 'Week (Mon)', start: weekStart.getTime(), end: new Date(weekStart.getTime() + 7 * 86400000).getTime() },
    { period: 'Month', start: monthStart.getTime(), end: new Date(y, mo + 1, 1).getTime() },
    { period: 'Quarter', start: quarterStart.getTime(), end: new Date(y, quarter * 3 + 3, 1).getTime() },
    { period: 'Year', start: yearStart.getTime(), end: new Date(y + 1, 0, 1).getTime() },
  ];
}

/**
 * Parse a {@link MomentInput} into epoch milliseconds, mirroring the UI's
 * `Date.parse` behavior for strings (a `datetime-local` value is interpreted
 * in the host timezone).
 *
 * @throws {RangeError} if the input cannot be parsed into a finite timestamp.
 */
function toEpochMs(moment: MomentInput): number {
  let ms: number;
  if (moment instanceof Date) {
    ms = moment.getTime();
  } else if (typeof moment === 'number') {
    ms = moment;
  } else {
    ms = Date.parse(moment);
  }
  if (!Number.isFinite(ms)) {
    throw new RangeError(
      `Invalid moment: ${typeof moment === 'string' ? JSON.stringify(moment) : String(moment)}`,
    );
  }
  return ms;
}

/**
 * Compute how much of each calendar period (minute, hour, day, week, month,
 * quarter, year) has elapsed at the given moment.
 *
 * Period boundaries are computed in **local time**, so results depend on the
 * runtime timezone — identical to the browser tool driven by a
 * `datetime-local` input. For deterministic results across environments, set
 * the process timezone (e.g. `TZ=UTC`) or pass a moment whose period boundaries
 * are unaffected by zone.
 *
 * @param moment - The moment to evaluate: epoch-ms number, a `Date`, or a
 *   parseable date-time string (e.g. `'2026-06-02T12:00'`).
 * @returns A {@link DayPercentageResult} with one row per period (Minute → Year),
 *   each carrying percent elapsed/remaining and compact duration strings, plus
 *   the parsed `epochMs` and a display `iso` string.
 * @throws {RangeError} if `moment` is a string/number that cannot be parsed into
 *   a finite timestamp.
 *
 * @example
 * // With TZ=UTC:
 * const r = dayPercentageElapsed('2026-06-02T12:00:00.000Z');
 * const day = r.rows.find((x) => x.period === 'Day');
 * day?.pctElapsed; // 50
 * day?.elapsed;    // '12h'
 */
export function dayPercentageElapsed(moment: MomentInput): DayPercentageResult {
  const ms = toEpochMs(moment);
  const d = new Date(ms);
  const rows = buildRows(d).map((r): PeriodElapsed => {
    const len = r.end - r.start;
    const elapsedMs = ms - r.start;
    const pct = len > 0 ? (elapsedMs / len) * 100 : 0;
    return {
      period: r.period,
      pctElapsed: pct,
      pctRemaining: 100 - pct,
      elapsed: humanDuration(elapsedMs),
      remaining: humanDuration(r.end - ms),
    };
  });
  return { rows, epochMs: ms, iso: d.toString() };
}
