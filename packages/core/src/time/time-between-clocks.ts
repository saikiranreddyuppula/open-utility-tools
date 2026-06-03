/**
 * Clock Time Difference — compute the duration between two times of day,
 * optionally wrapping past midnight.
 *
 * Isomorphic, dependency-free port of the open-utility-tools
 * `time-between-clocks` transform. Operates purely on clock-of-day strings
 * (no calendar dates), so results are deterministic regardless of timezone.
 *
 * @module time/time-between-clocks
 */

/** Number of seconds in one full day. */
const SECONDS_PER_DAY = 86400;

/** Options controlling how the difference is computed. */
export interface TimeBetweenClocksOptions {
  /**
   * When the end time is before the start time, wrap the duration to the
   * next day (treat it as an overnight span) instead of throwing.
   *
   * @default false
   */
  wrap?: boolean;
}

/** Structured result of {@link timeBetweenClocks}. */
export interface TimeBetweenClocksResult {
  /** Duration formatted as zero-padded `HH:MM:SS` (hours may exceed 23 are impossible here; max is 23:59:59). */
  durationHMS: string;
  /** Total seconds in the duration (integer, `0 .. 86399`). */
  totalSeconds: number;
  /** Total minutes as a string fixed to 2 decimal places. */
  totalMinutes: string;
  /** Total hours as a string fixed to 4 decimal places. */
  totalHoursDecimal: string;
  /** `true` when the span wrapped past midnight (end was before start and `wrap` was enabled). */
  crossesMidnight: boolean;
}

/**
 * Parse a clock-of-day string into seconds since 00:00:00.
 *
 * Accepts `HH:MM` or `HH:MM:SS`. Components must be integers within range
 * (hours `0–23`, minutes `0–59`, seconds `0–59`). Surrounding whitespace is
 * trimmed. Returns `null` for any malformed or out-of-range input.
 */
function parseClock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segs = trimmed.split(':');
  if (segs.length < 2 || segs.length > 3) return null;
  const hRaw = segs[0];
  const mRaw = segs[1];
  const sRaw = segs[2];
  if (hRaw === undefined || mRaw === undefined) return null;
  const h = Number(hRaw);
  const m = Number(mRaw);
  const s = sRaw === undefined ? 0 : Number(sRaw);
  if (!Number.isInteger(h) || !Number.isInteger(m) || !Number.isInteger(s)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

/** Zero-pad a non-negative integer to at least 2 digits. */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format a whole number of seconds as `HH:MM:SS`. */
function fmtHMS(totalSec: number): string {
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/**
 * Compute the elapsed duration between two clock times of day.
 *
 * The inputs are wall-clock times (no date component). When `end` is earlier
 * than `start`, the behaviour depends on `options.wrap`:
 * - `wrap: true` adds a full day (86400s), modelling an overnight shift.
 * - `wrap: false` (default) throws a {@link RangeError}.
 *
 * Equal start and end times yield a zero-length duration (not a full day).
 *
 * @param start - Start time of day as `HH:MM` or `HH:MM:SS` (24-hour).
 * @param end - End time of day as `HH:MM` or `HH:MM:SS` (24-hour).
 * @param options - Optional behaviour flags. See {@link TimeBetweenClocksOptions}.
 * @returns A {@link TimeBetweenClocksResult} with the formatted duration and totals.
 * @throws {TypeError} If `start` or `end` is not a parseable clock string
 *   (`HH:MM` or `HH:MM:SS` with in-range integer components).
 * @throws {RangeError} If `end` is before `start` and `wrap` is not enabled.
 *
 * @example
 * // Overnight shift wrapping past midnight
 * timeBetweenClocks('22:30', '06:15', { wrap: true });
 * // => {
 * //   durationHMS: '07:45:00',
 * //   totalSeconds: 27900,
 * //   totalMinutes: '465.00',
 * //   totalHoursDecimal: '7.7500',
 * //   crossesMidnight: true,
 * // }
 *
 * @example
 * // Same-day span
 * timeBetweenClocks('09:00', '17:30');
 * // => { durationHMS: '08:30:00', totalSeconds: 30600, ... crossesMidnight: false }
 */
export function timeBetweenClocks(
  start: string,
  end: string,
  options: TimeBetweenClocksOptions = {},
): TimeBetweenClocksResult {
  const wrap = options.wrap ?? false;

  const startSec = parseClock(start);
  if (startSec === null) {
    throw new TypeError('Enter a valid start time (HH:MM or HH:MM:SS).');
  }
  const endSec = parseClock(end);
  if (endSec === null) {
    throw new TypeError('Enter a valid end time (HH:MM or HH:MM:SS).');
  }

  let diff = endSec - startSec;
  let wrapped = false;
  if (diff < 0) {
    if (wrap) {
      diff += SECONDS_PER_DAY;
      wrapped = true;
    } else {
      throw new RangeError(
        'End time is before start time. Enable wrap to span past midnight.',
      );
    }
  }
  // diff === 0 is treated as a zero-length duration (not a full day).

  const totalMinutes = diff / 60;
  const totalHours = diff / 3600;

  return {
    durationHMS: fmtHMS(diff),
    totalSeconds: diff,
    totalMinutes: totalMinutes.toFixed(2),
    totalHoursDecimal: totalHours.toFixed(4),
    crossesMidnight: wrapped,
  };
}
