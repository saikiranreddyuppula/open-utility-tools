// Extracted from tools/time/time-of-day-bucketer. Pure, isomorphic time
// classification — no React, no DOM. Runs in the browser, Node 20, and Bun.

export interface TimeBoundary {
  /** Display label for the segment, e.g. `"Morning"`. */
  label: string;
  /** Greeting for the segment, e.g. `"Good morning"`. */
  greeting: string;
  /**
   * Where the segment STARTS. Either minutes-since-midnight (number) or an
   * `HH:MM`/`HH:MM:SS` clock string. The first boundary is always anchored at
   * midnight (its `start` is ignored).
   */
  start: number | string;
}

export interface ClassifyTimeOfDayOptions {
  /**
   * Ordered, strictly-increasing segment boundaries. The first entry is
   * anchored at 00:00 regardless of its `start`. Defaults to the standard
   * Night / Morning / Afternoon / Evening / Night split.
   */
  boundaries?: TimeBoundary[];
}

export interface TimeOfDayResult {
  /** Part-of-day label of the matched segment, e.g. `"Afternoon"`. */
  label: string;
  /** Greeting of the matched segment, e.g. `"Good afternoon"`. */
  greeting: string;
  /** 12-hour clock form, e.g. `"2:35:00 PM"`. */
  time12: string;
  /** 24-hour clock form, e.g. `"14:35:00"`. */
  time24: string;
  /** Whole minutes since midnight for the input time. */
  minutesSinceMidnight: number;
  /** Minutes-since-midnight at which the matched segment starts. */
  segmentStart: number;
  /** Minutes-since-midnight at which the matched segment ends (1440 = end of day). */
  segmentEnd: number;
  /** Human range of the matched segment, e.g. `"12:00 – 17:00"`. */
  segmentRange: string;
}

/** Standard part-of-day split used when no custom boundaries are supplied. */
export const DEFAULT_BOUNDARIES: readonly TimeBoundary[] = [
  { label: 'Night', greeting: 'Good night', start: 0 },
  { label: 'Morning', greeting: 'Good morning', start: 6 * 60 },
  { label: 'Afternoon', greeting: 'Good afternoon', start: 12 * 60 },
  { label: 'Evening', greeting: 'Good evening', start: 17 * 60 },
  { label: 'Night', greeting: 'Good night', start: 21 * 60 },
];

/** Parse `HH:MM` or `HH:MM:SS` (24-hour) into seconds since midnight. */
function parseClock(value: string): number {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) {
    throw new RangeError(
      `Invalid clock time ${JSON.stringify(value)}: expected HH:MM or HH:MM:SS (24-hour).`,
    );
  }
  const h = Number(m[1] ?? '');
  const min = Number(m[2] ?? '');
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(s)) {
    throw new RangeError(`Invalid clock time ${JSON.stringify(value)}.`);
  }
  if (h > 23 || min > 59 || s > 59) {
    throw new RangeError(`Out-of-range clock time ${JSON.stringify(value)} (max 23:59:59).`);
  }
  return h * 3600 + min * 60 + s;
}

/** Render minutes-since-midnight as an `HH:MM` clock (wrapping at 1440). */
function minutesToClock(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Render seconds-since-midnight as a 12-hour `h:mm:ss AM/PM` clock. */
function format12h(totalSeconds: number): string {
  const h24 = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')} ${period}`;
}

/** Render seconds-since-midnight as a 24-hour `HH:mm:ss` clock. */
function format24h(totalSeconds: number): string {
  const h24 = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Classifies a 24-hour clock time into a part-of-day segment (with a matching
 * greeting) and reports its 12/24-hour forms, minutes since midnight, and the
 * segment range it falls in. Pure and isomorphic — no DOM, runs in the browser,
 * Node, and Bun.
 *
 * The first boundary is always anchored at midnight. The matched segment is the
 * last boundary whose start minute is `<= ` the input's minute-of-day.
 *
 * @param time - Clock time as `HH:MM` or `HH:MM:SS` (24-hour).
 * @param options - Optional custom, strictly-increasing segment boundaries.
 * @returns The matched segment label/greeting, formatted clock forms, minutes
 *   since midnight, and the segment's start/end minutes and human range.
 * @throws {RangeError} If `time` is not a valid clock time, a boundary string is
 *   invalid, no boundaries are supplied, or boundary starts do not strictly
 *   increase down the list.
 *
 * @example
 * ```ts
 * import { classifyTimeOfDay } from '@open-utility-tools/core/time/time-of-day-bucketer';
 * classifyTimeOfDay('14:35').label;        // → 'Afternoon'
 * classifyTimeOfDay('06:00').greeting;     // → 'Good morning'
 * classifyTimeOfDay('23:59:59').segmentRange; // → '21:00 – 00:00'
 * ```
 */
export function classifyTimeOfDay(
  time: string,
  options: ClassifyTimeOfDayOptions = {},
): TimeOfDayResult {
  const secs = parseClock(time);

  const source = options.boundaries ?? DEFAULT_BOUNDARIES;
  if (source.length === 0) {
    throw new RangeError('At least one boundary is required.');
  }

  // Resolve boundary metadata. The first start is anchored at 0.
  const labels: string[] = [];
  const greetings: string[] = [];
  const starts: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const b = source[i];
    if (b === undefined) throw new RangeError(`Boundary ${i + 1} is missing.`);
    labels.push(b.label);
    greetings.push(b.greeting);
    if (i === 0) {
      starts.push(0);
      continue;
    }
    const startMin =
      typeof b.start === 'number'
        ? Math.floor(b.start)
        : Math.floor(parseClock(b.start) / 60);
    starts.push(startMin);
  }

  // Validate monotonic increasing starts.
  for (let i = 1; i < starts.length; i++) {
    const prev = starts[i - 1] ?? 0;
    const cur = starts[i] ?? 0;
    if (cur <= prev) {
      throw new RangeError('Boundary start times must strictly increase down the list.');
    }
  }

  const totalMin = Math.floor(secs / 60);

  // Find the last boundary whose start <= totalMin.
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i] ?? 0;
    if (totalMin >= start) idx = i;
  }
  const label = labels[idx] ?? labels[0] ?? '';
  const greeting = greetings[idx] ?? greetings[0] ?? '';
  const segStart = starts[idx] ?? 0;
  const nextStart = idx + 1 < starts.length ? starts[idx + 1] ?? 1440 : 1440;

  return {
    label,
    greeting,
    time12: format12h(secs),
    time24: format24h(secs),
    minutesSinceMidnight: totalMin,
    segmentStart: segStart,
    segmentEnd: nextStart,
    segmentRange: `${minutesToClock(segStart)} – ${minutesToClock(nextStart)}`,
  };
}