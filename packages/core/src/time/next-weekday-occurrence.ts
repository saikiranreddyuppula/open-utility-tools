/**
 * Next Weekday Occurrence
 *
 * Find the next (or Nth) date that falls on a chosen weekday from a starting
 * date, in either direction. All arithmetic is done in UTC so results are
 * independent of the host time zone.
 *
 * Lifted verbatim from the open-utility-tools `next-weekday-occurrence` UI.
 */

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Direction to search relative to the start date. */
export type Direction = 'next' | 'previous';

/** A single computed occurrence of the target weekday. */
export interface Occurrence {
  /** Date in `YYYY-MM-DD` form (UTC). */
  iso: string;
  /** English weekday name (always equal to the requested target weekday). */
  weekday: string;
  /** Signed day offset from the start date (positive = after, negative = before). */
  daysFromStart: number;
}

/** Result of {@link nextWeekdayOccurrence}. */
export interface NextWeekdayOccurrenceResult {
  /** The requested Nth occurrence. */
  target: Occurrence;
  /** The first eight occurrences in the chosen direction (index 0 = nearest). */
  list: Occurrence[];
  /** English weekday name of the start date. */
  startWeekday: string;
}

/** Options for {@link nextWeekdayOccurrence}. */
export interface NextWeekdayOccurrenceOptions {
  /** Search forward (`'next'`, default) or backward (`'previous'`). */
  direction?: Direction;
  /** Which occurrence to return as `target` (1-based, default `1`, max `520`). */
  n?: number;
  /** Whether the start date itself counts as occurrence #1 when it already falls on the target weekday (default `false`). */
  includeStart?: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Find the Nth date that falls on a given weekday, searching forward or
 * backward from a start date, and list the nearest eight occurrences.
 *
 * The start date is interpreted in UTC. `targetWeekday` uses JavaScript's
 * `Date.getUTCDay()` convention: `0` = Sunday … `6` = Saturday.
 *
 * @param startDate - Start date as a `YYYY-MM-DD` string.
 * @param targetWeekday - Weekday to find, `0` (Sunday) through `6` (Saturday).
 * @param options - Optional {@link NextWeekdayOccurrenceOptions}.
 * @returns The requested {@link Occurrence} as `target`, the first eight
 *   occurrences as `list`, and the start date's weekday name.
 * @throws {RangeError} If `startDate` is blank, malformed, or a non-existent
 *   calendar date; if `targetWeekday` is not an integer in `0..6`; if
 *   `direction` is not `'next'`/`'previous'`; or if `n` is not a positive
 *   integer in `1..520`.
 *
 * @example
 * // 2026-06-02 is a Tuesday; the next Monday is 2026-06-08.
 * const { target } = nextWeekdayOccurrence('2026-06-02', 1);
 * target.iso;           // '2026-06-08'
 * target.daysFromStart; // 6
 *
 * @example
 * // Third upcoming Sunday from a Tuesday start.
 * nextWeekdayOccurrence('2026-06-02', 0, { n: 3 }).target.iso; // '2026-06-21'
 */
export function nextWeekdayOccurrence(
  startDate: string,
  targetWeekday: number,
  options: NextWeekdayOccurrenceOptions = {},
): NextWeekdayOccurrenceResult {
  const direction = options.direction ?? 'next';
  const n = options.n ?? 1;
  const includeStart = options.includeStart ?? false;

  const text = startDate.trim();
  if (!text) throw new RangeError('Pick a start date.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError('Start date must be YYYY-MM-DD.');
  const y = Number(m[1] ?? '');
  const mo = Number(m[2] ?? '');
  const da = Number(m[3] ?? '');
  if (![y, mo, da].every(Number.isFinite)) throw new RangeError('Invalid start date.');

  if (!Number.isInteger(targetWeekday) || targetWeekday < 0 || targetWeekday > 6) {
    throw new RangeError('targetWeekday must be an integer 0-6 (0=Sunday).');
  }
  if (direction !== 'next' && direction !== 'previous') {
    throw new RangeError("direction must be 'next' or 'previous'.");
  }
  if (!Number.isInteger(n) || n < 1) throw new RangeError('Occurrence N must be a positive integer.');
  if (n > 520) throw new RangeError('Occurrence N is too large (max 520).');

  const startMs = Date.UTC(y, mo - 1, da);
  const start = new Date(startMs);
  if (Number.isNaN(start.getTime()) || start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== da) {
    throw new RangeError('That start date does not exist.');
  }
  const startDow = start.getUTCDay();

  // Days to the first occurrence in the chosen direction.
  let firstDelta: number;
  if (direction === 'next') {
    firstDelta = (targetWeekday - startDow + 7) % 7;
    if (firstDelta === 0 && !includeStart) firstDelta = 7;
  } else {
    firstDelta = -((startDow - targetWeekday + 7) % 7);
    if (firstDelta === 0 && !includeStart) firstDelta = -7;
  }

  const step = direction === 'next' ? 7 : -7;

  const makeOcc = (k: number): Occurrence => {
    const delta = firstDelta + step * k;
    const d = new Date(startMs + delta * 86400000);
    const weekday = WEEKDAYS[d.getUTCDay()];
    return {
      iso: fmtIso(d),
      weekday: weekday ?? '',
      daysFromStart: delta,
    };
  };

  const target = makeOcc(n - 1);
  const list: Occurrence[] = [];
  for (let k = 0; k < 8; k++) list.push(makeOcc(k));

  const startWeekday = WEEKDAYS[startDow];
  return { target, list, startWeekday: startWeekday ?? '' };
}
