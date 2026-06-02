// Extracted from tools/time/add-business-days. Pure, isomorphic date math.

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function formatDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(value: string): Date | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export interface AddBusinessDaysOptions {
  /** Weekday indices treated as weekend (0 = Sunday … 6 = Saturday). Default `[0, 6]`. */
  weekend?: number[];
  /** ISO dates (`YYYY-MM-DD`) to skip as holidays. */
  holidays?: string[];
}

export interface BusinessDaysResult {
  /** Resulting date as `YYYY-MM-DD`. */
  date: string;
  /** Weekday name of the resulting date, e.g. `"Monday"`. */
  weekday: string;
  /** Number of calendar days traversed (including skipped weekends/holidays). */
  calendarSpan: number;
  /** Labels of the dates skipped along the way (weekends and holidays). */
  skipped: string[];
}

/**
 * Adds (or subtracts, for negative `count`) a number of business days to an ISO
 * date, skipping weekends and holidays. Pure and isomorphic — no DOM, runs in
 * the browser, Node, and Bun.
 *
 * @param start - Start date as `YYYY-MM-DD`.
 * @param count - Business days to add; negative subtracts.
 * @param options - Custom weekend days and holiday list.
 * @returns The resulting date, its weekday, the calendar span, and skipped days.
 * @throws {RangeError} If `start` is not a valid `YYYY-MM-DD` date, `count` is
 *   not an integer, every weekday is a weekend, or `count` is too large.
 *
 * @example
 * ```ts
 * import { addBusinessDays } from '@open-utility-tools/core/time/add-business-days';
 * addBusinessDays('2026-06-01', 10).date; // → '2026-06-15' (Mon, skipping weekends)
 * addBusinessDays('2026-06-01', 3, { holidays: ['2026-06-03'] }).date; // → '2026-06-05'
 * ```
 */
export function addBusinessDays(
  start: string,
  count: number,
  options: AddBusinessDaysOptions = {},
): BusinessDaysResult {
  const startDate = parseISODate(start);
  if (!startDate) throw new RangeError(`Invalid start date: ${JSON.stringify(start)} (expected YYYY-MM-DD)`);
  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    throw new RangeError('count must be a whole number');
  }

  const weekendDays = options.weekend ?? [0, 6];
  const isWeekend = [false, false, false, false, false, false, false];
  for (const day of weekendDays) {
    if (day >= 0 && day <= 6) isWeekend[day] = true;
  }
  if (isWeekend.every((w) => w)) {
    throw new RangeError('Every weekday is marked as a weekend — no business days exist.');
  }

  const holidaySet = new Set<string>();
  for (const raw of options.holidays ?? []) {
    const h = parseISODate(raw.trim());
    if (h) holidaySet.add(formatDate(h));
  }

  const isBusiness = (d: Date): boolean =>
    !isWeekend[d.getDay()] && !holidaySet.has(formatDate(d));

  if (count === 0) {
    return {
      date: formatDate(startDate),
      weekday: WEEKDAY_NAMES[startDate.getDay()] ?? '',
      calendarSpan: 0,
      skipped: [],
    };
  }

  const step = count > 0 ? 1 : -1;
  let remaining = Math.abs(count);
  const cursor = new Date(startDate.getTime());
  const skipped: string[] = [];
  let calendarSpan = 0;
  let guard = 0;
  const MAX = 200000;

  while (remaining > 0 && guard < MAX) {
    cursor.setDate(cursor.getDate() + step);
    calendarSpan += 1;
    guard += 1;
    if (isBusiness(cursor)) {
      remaining -= 1;
    } else {
      const label = isWeekend[cursor.getDay()]
        ? `${formatDate(cursor)} (${WEEKDAY_NAMES[cursor.getDay()] ?? ''})`
        : `${formatDate(cursor)} (holiday)`;
      skipped.push(label);
    }
  }

  if (guard >= MAX) throw new RangeError('count is too large to compute');

  return {
    date: formatDate(cursor),
    weekday: WEEKDAY_NAMES[cursor.getDay()] ?? '',
    calendarSpan,
    skipped,
  };
}
