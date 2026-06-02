// Extracted from tools/time/days-between-units. Pure, isomorphic date math —
// no React, no DOM, no Web APIs beyond Date/Intl/Math/JSON.

/** A single datetime input: an ISO/parseable string, a `Date`, or epoch milliseconds. */
export type DateInput = string | number | Date;

/** The same span expressed simultaneously in several units. */
export interface SpanTotals {
  /** Whole-and-fractional years, using a flat 365-day year. */
  years365: number;
  /** Whole-and-fractional calendar months (accounts for variable month lengths). */
  months: number;
  /** Span in weeks (7 × 86 400 000 ms). */
  weeks: number;
  /** Span in days. */
  days: number;
  /** Span in hours. */
  hours: number;
  /** Span in minutes. */
  minutes: number;
  /** Span in seconds. */
  seconds: number;
}

/** Calendar Y/M/D h/m/s breakdown produced by borrowing across month lengths. */
export interface SpanBreakdown {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Full result of {@link daysBetweenUnits}. */
export interface DaysBetweenResult {
  /** The span in every unit. */
  totals: SpanTotals;
  /** Calendar breakdown (e.g. `3 months, 10 days`). */
  breakdown: SpanBreakdown;
  /** Compact human label built from the breakdown, e.g. `"3mo 10d"`. */
  human: string;
  /** Count of weekend calendar days (Sat/Sun) wholly inside the span. */
  weekendDays: number;
  /** Count of business calendar days (Mon–Fri) wholly inside the span. */
  businessDays: number;
  /** Absolute span in milliseconds. */
  ms: number;
}

const DAY_MS = 86400000;

function toEpochMs(value: DateInput, label: string): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (!Number.isFinite(ms)) throw new RangeError(`${label} is an invalid Date.`);
    return ms;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`${label} is not a finite timestamp.`);
    return value;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) throw new RangeError(`${label} is not a valid datetime: ${JSON.stringify(value)}`);
    return ms;
  }
  throw new TypeError(`${label} must be a string, number, or Date.`);
}

// Calendar Y/M/D breakdown by borrowing across month lengths.
function ymdBreakdown(a: Date, b: Date): SpanBreakdown {
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  let hours = b.getHours() - a.getHours();
  let mins = b.getMinutes() - a.getMinutes();
  let secs = b.getSeconds() - a.getSeconds();

  if (secs < 0) { secs += 60; mins -= 1; }
  if (mins < 0) { mins += 60; hours -= 1; }
  if (hours < 0) { hours += 24; days -= 1; }
  if (days < 0) {
    // borrow days from the previous month (relative to b)
    const prevMonthDays = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    days += prevMonthDays;
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }
  return { years, months, days, hours, minutes: mins, seconds: secs };
}

// Approx month count via calendar stepping.
function totalMonths(a: Date, b: Date): number {
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // fractional remainder
  const anchor = new Date(a.getTime());
  anchor.setMonth(anchor.getMonth() + whole);
  let frac = 0;
  if (b.getTime() >= anchor.getTime()) {
    const next = new Date(anchor.getTime());
    next.setMonth(next.getMonth() + 1);
    const span = next.getTime() - anchor.getTime();
    frac = span > 0 ? (b.getTime() - anchor.getTime()) / span : 0;
  } else {
    const prev = new Date(anchor.getTime());
    prev.setMonth(prev.getMonth() - 1);
    const span = anchor.getTime() - prev.getTime();
    frac = span > 0 ? (b.getTime() - anchor.getTime()) / span : 0;
  }
  return whole + frac;
}

function countDays(a: Date, b: Date): { weekend: number; business: number } {
  // iterate calendar days from start date (midnight) to end date (exclusive of partial)
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let weekend = 0;
  let business = 0;
  const cur = new Date(start.getTime());
  let guard = 0;
  while (cur.getTime() < end.getTime() && guard < 200000) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) weekend++;
    else business++;
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return { weekend, business };
}

/**
 * Measures the span between two datetimes and expresses it simultaneously in
 * years, months, weeks, days, hours, minutes, and seconds, plus a calendar
 * Y/M/D breakdown and a business-vs-weekend day tally.
 *
 * The order of the two inputs does not matter — the smaller is treated as the
 * start, so the result is always non-negative (mirroring the source tool).
 *
 * Calendar-based fields (`months`, the Y/M/D `breakdown`, and the
 * business/weekend day counts) read wall-clock components via the host
 * timezone. Pass timezone-explicit inputs (e.g. an ISO string ending in `Z`)
 * for reproducible results across environments.
 *
 * @param from - First datetime: a parseable string, epoch milliseconds, or `Date`.
 * @param to - Second datetime, same accepted forms.
 * @returns Totals in every unit, a calendar breakdown, a compact human label,
 *   and weekend/business day counts.
 * @throws {RangeError} If either input cannot be parsed into a finite datetime.
 * @throws {TypeError} If either input is not a string, number, or `Date`.
 *
 * @example
 * ```ts
 * import { daysBetweenUnits } from '@open-utility-tools/core/time/days-between-units';
 *
 * const r = daysBetweenUnits('2026-01-01T00:00:00Z', '2026-04-11T00:00:00Z');
 * r.totals.days;     // → 100
 * r.totals.weeks;    // → 14.285714285714286
 * r.human;           // → '3mo 10d'
 * r.businessDays;    // → 72
 * r.weekendDays;     // → 28
 * ```
 */
export function daysBetweenUnits(from: DateInput, to: DateInput): DaysBetweenResult {
  const aMs = toEpochMs(from, 'from');
  const bMs = toEpochMs(to, 'to');

  const lo = Math.min(aMs, bMs);
  const hi = Math.max(aMs, bMs);
  const a = new Date(lo);
  const b = new Date(hi);
  const ms = hi - lo;

  const totals: SpanTotals = {
    years365: ms / (365 * DAY_MS),
    months: totalMonths(a, b),
    weeks: ms / 604800000,
    days: ms / DAY_MS,
    hours: ms / 3600000,
    minutes: ms / 60000,
    seconds: ms / 1000,
  };

  const breakdown = ymdBreakdown(a, b);
  const humanParts: string[] = [];
  if (breakdown.years) humanParts.push(`${breakdown.years}y`);
  if (breakdown.months) humanParts.push(`${breakdown.months}mo`);
  if (breakdown.days) humanParts.push(`${breakdown.days}d`);
  if (breakdown.hours) humanParts.push(`${breakdown.hours}h`);
  if (breakdown.minutes) humanParts.push(`${breakdown.minutes}m`);
  if (breakdown.seconds || humanParts.length === 0) humanParts.push(`${breakdown.seconds}s`);

  const { weekend, business } = countDays(a, b);

  return {
    totals,
    breakdown,
    human: humanParts.join(' '),
    weekendDays: weekend,
    businessDays: business,
    ms,
  };
}
