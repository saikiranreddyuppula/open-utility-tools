/**
 * Countdown Snapshot Builder — pure, isomorphic core transform.
 *
 * Lifted verbatim from the app's `time/countdown-timer-builder` UI: given a
 * target `datetime-local` string and a reference ("from") instant, it computes
 * the absolute time difference and decomposes it into both a unit breakdown
 * (weeks/days/hours/minutes/seconds) and cumulative totals, along with a
 * human-readable summary line.
 *
 * No React, DOM, or Web APIs beyond Date/Math/Intl. Works in browser, Node, Bun.
 */

/** Unit-by-unit decomposition of the absolute time difference. */
export interface CountdownBreakdown {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Cumulative totals of the absolute time difference, each floored. */
export interface CountdownTotals {
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
}

/** Full computed snapshot returned by {@link buildCountdownSnapshot}. */
export interface CountdownSnapshot {
  /** `true` when the target is at or after the reference instant. */
  future: boolean;
  /** Unit breakdown of the absolute difference. */
  breakdown: CountdownBreakdown;
  /** Cumulative (floored) totals of the absolute difference. */
  totals: CountdownTotals;
  /** Human-readable one-line summary (e.g. `"Launch in 43d 01h 30m"`). */
  summary: string;
  /** Absolute difference in milliseconds. */
  absMs: number;
}

/** Options for {@link buildCountdownSnapshot}. */
export interface CountdownSnapshotOptions {
  /**
   * Reference instant as a `datetime-local` string ("YYYY-MM-DDTHH:mm",
   * optionally with ":ss"), interpreted in the host's local time zone.
   * Defaults to the current time (`new Date()`) when omitted.
   */
  from?: string;
  /** Optional label used in the summary string. Defaults to `"Target"`. */
  label?: string;
}

/** Left-pads a non-negative integer with leading zeros to a fixed width. */
function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

/**
 * Parses a `datetime-local` value ("YYYY-MM-DDTHH:mm", optionally ":ss") into a
 * Date in the host's local time zone.
 *
 * @throws {TypeError} when the string does not match the expected shape.
 * @throws {RangeError} when the components do not resolve to a real date.
 */
function parseLocalInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (m === null) {
    throw new TypeError(
      `Invalid datetime-local string: "${value}". Expected "YYYY-MM-DDTHH:mm" (optionally ":ss").`,
    );
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const rawSeconds = m[6];
  const ss = Number(rawSeconds === undefined ? '0' : rawSeconds);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    throw new TypeError(`Invalid datetime-local string: "${value}".`);
  }
  const d = new Date(y, mo - 1, day, hh, mm, Number.isFinite(ss) ? ss : 0, 0);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`datetime-local string "${value}" does not resolve to a real date.`);
  }
  return d;
}

/**
 * Builds a countdown snapshot: the exact remaining (or elapsed) time from a
 * reference instant to a target datetime, decomposed into units and totals.
 *
 * Both inputs are `datetime-local` strings interpreted in the host's local time
 * zone. The difference is taken as `target - from`; a non-negative difference is
 * reported as `future: true`. All unit values are derived from the absolute
 * difference, so they are never negative.
 *
 * @param target - Target datetime as "YYYY-MM-DDTHH:mm" (optionally ":ss").
 * @param options - Optional `from` reference (defaults to now) and `label`.
 * @returns A {@link CountdownSnapshot} with the unit breakdown, totals, summary,
 *   `future` flag, and absolute millisecond difference.
 * @throws {TypeError} when `target` or `from` is not a valid datetime-local string.
 * @throws {RangeError} when a datetime-local string does not resolve to a real date.
 *
 * @example
 * ```ts
 * buildCountdownSnapshot('2026-07-15T09:30:00', {
 *   from: '2026-06-02T08:00:00',
 *   label: 'Launch',
 * });
 * // => {
 * //   future: true,
 * //   breakdown: { weeks: 6, days: 1, hours: 1, minutes: 30, seconds: 0 },
 * //   totals: { totalWeeks: 6, totalDays: 43, totalHours: 1033,
 * //             totalMinutes: 62010, totalSeconds: 3720600 },
 * //   summary: 'Launch in 43d 01h 30m',
 * //   absMs: 3720600000,
 * // }
 * ```
 */
export function buildCountdownSnapshot(
  target: string,
  options: CountdownSnapshotOptions = {},
): CountdownSnapshot {
  const label = options.label ?? '';
  const fromValue = options.from;

  const targetDate = parseLocalInput(target);
  const fromDate = fromValue === undefined ? new Date() : parseLocalInput(fromValue);

  const deltaMs = targetDate.getTime() - fromDate.getTime();
  const future = deltaMs >= 0;
  const absMs = Math.abs(deltaMs);

  let rem = Math.floor(absMs / 1000); // seconds
  const totalSeconds = rem;
  const totalMinutes = Math.floor(rem / 60);
  const totalHours = Math.floor(rem / 3600);
  const totalDays = Math.floor(rem / 86400);
  const totalWeeks = Math.floor(rem / 604800);

  const weeks = Math.floor(rem / 604800);
  rem -= weeks * 604800;
  const days = Math.floor(rem / 86400);
  rem -= days * 86400;
  const hours = Math.floor(rem / 3600);
  rem -= hours * 3600;
  const minutes = Math.floor(rem / 60);
  rem -= minutes * 60;
  const seconds = rem;

  const dShown = totalDays;
  const verb = future ? 'in' : 'ago';
  const summary = future
    ? `${label || 'Target'} in ${dShown}d ${pad(hours)}h ${pad(minutes)}m`
    : `${label || 'Target'} was ${dShown}d ${pad(hours)}h ${pad(minutes)}m ${verb}`;

  return {
    future,
    breakdown: { weeks, days, hours, minutes, seconds },
    totals: { totalWeeks, totalDays, totalHours, totalMinutes, totalSeconds },
    summary,
    absMs,
  };
}
