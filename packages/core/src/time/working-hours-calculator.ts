const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MS_MIN = 60 * 1000;

/** Options for {@link calculateWorkingHours}. */
export interface WorkingHoursOptions {
  /**
   * Start of the overall span. A `Date`, or an ISO-like string (e.g.
   * `'2026-05-25T09:00'`). Naive strings (no offset) are interpreted in the
   * host's local time zone, matching the day boundaries used internally.
   */
  start: string | Date;
  /** End of the overall span. Must be strictly after {@link start}. */
  end: string | Date;
  /** Daily work-window start as `'HH:MM'` (00:00-23:59). Defaults to `'09:00'`. */
  workDayStart?: string;
  /** Daily work-window end as `'HH:MM'`. Must be after {@link workDayStart}. Defaults to `'17:00'`. */
  workDayEnd?: string;
  /**
   * Length of the daily unpaid lunch break in minutes. Deducted from the
   * portion that overlaps the worked interval; the lunch is centered within the
   * work window. Must be `>= 0` and no longer than the daily work window.
   * Defaults to `0`.
   */
  lunchMinutes?: number;
  /**
   * Days of the week that count as working days, as integers `0` (Sun) through
   * `6` (Sat). Duplicates are ignored. Defaults to `[1, 2, 3, 4, 5]` (Mon-Fri).
   */
  workingDays?: readonly number[];
}

/** Per-day net working time for a single counted day. */
export interface WorkingDayBreakdown {
  /** Local calendar date as `'YYYY-MM-DD'`. */
  date: string;
  /** Three-letter day-of-week label, e.g. `'Mon'`. */
  dayOfWeek: string;
  /** Net working minutes on this day (after lunch deduction). */
  minutes: number;
}

/** Result of {@link calculateWorkingHours}. */
export interface WorkingHoursResult {
  /** Total net working minutes across all counted days. */
  totalMinutes: number;
  /** Total net working time in hours (`totalMinutes / 60`). */
  totalHours: number;
  /** Number of days that contributed any working time. */
  workingDays: number;
  /** Per-day breakdown, in chronological order. Empty when no time was worked. */
  days: WorkingDayBreakdown[];
}

/** Parse `'HH:MM'` into minutes since midnight, or `null` if invalid. */
function parseHM(v: string): number | null {
  const parts = v.split(':');
  const hStr = parts[0];
  const mStr = parts[1];
  if (hStr === undefined || mStr === undefined) return null;
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Format a `Date` as a local `'YYYY-MM-DD'` string. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Coerce input to a valid `Date`, throwing `TypeError` otherwise. */
function toDate(v: string | Date, label: string): Date {
  const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`Enter a valid ${label} datetime.`);
  }
  return d;
}

/**
 * Compute net working time between two datetimes, excluding nights (outside the
 * daily work window), non-working weekdays, and a centered daily lunch break.
 *
 * The span is walked day by day from the start day's local midnight to the end
 * day's local midnight. For each working day, the worked interval is the
 * intersection of the day's work window with the overall `[start, end]` span;
 * the lunch break (centered in the work window) is then subtracted to the
 * extent it overlaps that worked interval. Minute counts are rounded to whole
 * minutes, matching the source UI exactly.
 *
 * @param options - The span, daily work window, lunch length, and working days.
 * @returns Total minutes/hours, the count of contributing days, and a per-day breakdown.
 * @throws {TypeError} If `start` or `end` is not a valid datetime.
 * @throws {RangeError} If `end` is not after `start`; if `workDayStart`/`workDayEnd`
 *   are not valid `'HH:MM'` or out of order; if `lunchMinutes` is negative,
 *   non-finite, or longer than the work window; or if `workingDays` is empty or
 *   contains values outside `0..6`.
 * @example
 * ```ts
 * const r = calculateWorkingHours({
 *   start: '2026-05-25T09:00',
 *   end: '2026-05-29T17:00',
 *   workDayStart: '09:00',
 *   workDayEnd: '17:00',
 *   lunchMinutes: 60,
 *   workingDays: [1, 2, 3, 4, 5],
 * });
 * // r.totalMinutes === 2100, r.totalHours === 35, r.workingDays === 5
 * // r.days[0] === { date: '2026-05-25', dayOfWeek: 'Mon', minutes: 420 }
 * ```
 */
export function calculateWorkingHours(options: WorkingHoursOptions): WorkingHoursResult {
  const {
    start: startInput,
    end: endInput,
    workDayStart = '09:00',
    workDayEnd = '17:00',
    lunchMinutes = 0,
    workingDays = [1, 2, 3, 4, 5],
  } = options;

  const start = toDate(startInput, 'start');
  const end = toDate(endInput, 'end');
  if (end.getTime() <= start.getTime()) {
    throw new RangeError('End must be after start.');
  }

  const winStart = parseHM(workDayStart);
  if (winStart === null) throw new RangeError('Window start must be HH:MM (00:00-23:59).');
  const winEnd = parseHM(workDayEnd);
  if (winEnd === null) throw new RangeError('Window end must be HH:MM (00:00-23:59).');
  if (winEnd <= winStart) throw new RangeError('Work-window end must be after its start.');

  if (!Number.isFinite(lunchMinutes) || lunchMinutes < 0) {
    throw new RangeError('Lunch minutes must be 0 or more.');
  }
  if (lunchMinutes > winEnd - winStart) {
    throw new RangeError('Lunch is longer than the daily work window.');
  }

  const activeDows = new Set<number>();
  for (const d of workingDays) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new RangeError('Working days must be integers 0 (Sun) through 6 (Sat).');
    }
    activeDows.add(d);
  }
  if (activeDows.size === 0) {
    throw new RangeError('Select at least one working weekday.');
  }

  // Center the lunch window in the middle of the work day.
  const span = winEnd - winStart;
  const lunchStart = winStart + Math.floor((span - lunchMinutes) / 2);
  const lunchEnd = lunchStart + lunchMinutes;

  const days: WorkingDayBreakdown[] = [];
  let totalMinutes = 0;
  let workingDaysCount = 0;

  // Iterate from the start day's midnight to the end day's midnight.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let guard = 0;
  while (cursor.getTime() <= lastDay.getTime() && guard < 4000) {
    guard += 1;
    const dow = cursor.getDay();
    if (activeDows.has(dow)) {
      const dayMid = cursor.getTime();
      const winA = dayMid + winStart * MS_MIN;
      const winB = dayMid + winEnd * MS_MIN;
      const lo = Math.max(winA, start.getTime());
      const hi = Math.min(winB, end.getTime());
      let mins = Math.max(0, Math.round((hi - lo) / MS_MIN));
      // Subtract the portion of the lunch window that overlaps the worked interval.
      if (lunchMinutes > 0 && mins > 0) {
        const lunchA = dayMid + lunchStart * MS_MIN;
        const lunchB = dayMid + lunchEnd * MS_MIN;
        const overlap = Math.max(0, Math.min(hi, lunchB) - Math.max(lo, lunchA)) / MS_MIN;
        mins -= Math.round(Math.min(lunchMinutes, overlap));
        if (mins < 0) mins = 0;
      }
      if (mins > 0) {
        const label = DOW_LABELS[dow] ?? '';
        days.push({ date: fmtDate(cursor), dayOfWeek: label, minutes: mins });
        totalMinutes += mins;
        workingDaysCount += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    totalMinutes,
    totalHours: totalMinutes / 60,
    workingDays: workingDaysCount,
    days,
  };
}