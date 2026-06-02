// Extracted from tools/time/time-meeting-cost-calculator. Pure, isomorphic
// meeting-cost arithmetic — no React, no DOM. Runs in the browser, Node, and Bun.

/** Rate input strategy: a single average rate × N attendees, or an explicit per-person list. */
export type RateMode = 'average' | 'list';

/** Per-attendee average-rate inputs. */
export interface AverageRateInput {
  mode: 'average';
  /** Number of attendees. Floored to a whole person; must be > 0. */
  attendees: number;
  /** Average loaded hourly rate per attendee; must be ≥ 0. */
  averageRate: number;
}

/** Explicit per-person hourly-rate inputs. */
export interface ListRateInput {
  mode: 'list';
  /**
   * Hourly rates, either as an array of numbers or as a raw string of values
   * separated by newlines and/or commas (e.g. `"120\n90, 75"`). Non-finite or
   * negative entries are ignored; at least one valid rate is required.
   */
  rates: readonly number[] | string;
}

/** Discriminated union of the two rate modes. */
export type MeetingRateInput = AverageRateInput | ListRateInput;

/** Options shared by both rate modes. */
export interface MeetingCostOptions {
  /** Meeting duration in minutes; must be a positive, finite number. */
  minutes: number;
  /**
   * Burden/overhead multiplier applied to the base hourly sum (e.g. `1.4` to
   * account for benefits and overhead). Non-finite or non-positive values fall
   * back to `1`, matching the original tool. Default `1`.
   */
  overhead?: number;
}

/** Computed cost breakdown for a meeting. */
export interface MeetingCostResult {
  /** Total cost of the meeting (combined hourly burn × hours). */
  totalCost: number;
  /** Cost accrued per minute of the meeting. */
  perMinute: number;
  /** Total cost divided across attendees. */
  perAttendee: number;
  /** Effective attendee count used (list length, or floored average count). */
  attendees: number;
  /** Meeting duration expressed in hours. */
  hours: number;
  /** Combined hourly burn after overhead — what the room costs per hour. */
  ratesSum: number;
  /** Combined hourly rate sum before overhead is applied. */
  baseSum: number;
}

/**
 * Parses a free-form string of hourly rates into numbers. Values may be
 * separated by newlines and/or commas. Each token is trimmed and coerced with
 * `Number`; non-finite or negative results are dropped.
 *
 * @param text - Raw rate string, e.g. `"120\n90, 75"`.
 * @returns The finite, non-negative rates in input order.
 *
 * @example
 * ```ts
 * parseRates('120, 90, abc, -5, 60'); // → [120, 90, 60]
 * ```
 */
export function parseRates(text: string): number[] {
  return text
    .split(/[\n,]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/**
 * Formats a numeric amount as a currency string using `en-US` grouping and
 * exactly two fraction digits, e.g. `formatMeetingCost('$', 12345.678)` →
 * `"$12,345.68"`. Negative values are rendered with a leading `-` before the
 * symbol.
 *
 * @param symbol - Currency symbol/prefix to use (e.g. `'$'`, `'€'`).
 * @param value - Amount to format.
 * @returns The formatted currency string.
 *
 * @example
 * ```ts
 * formatMeetingCost('$', 450);   // → '$450.00'
 * formatMeetingCost('€', -50);   // → '-€50.00'
 * ```
 */
export function formatMeetingCost(symbol: string, value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${symbol}${fixed}`;
}

/**
 * Estimates the cost of a meeting from attendee rates, duration, and an
 * optional overhead (burden) multiplier. Pure and isomorphic — no DOM, runs in
 * the browser, Node, and Bun.
 *
 * In `'average'` mode the base hourly sum is `floor(attendees) × averageRate`.
 * In `'list'` mode it is the sum of the supplied per-person rates (parsed and
 * filtered to finite, non-negative values). The base sum is multiplied by the
 * overhead to get the combined hourly burn, then by the duration in hours to
 * get the total cost.
 *
 * @param rates - Rate inputs: `{ mode: 'average', attendees, averageRate }` or
 *   `{ mode: 'list', rates }`.
 * @param options - Duration in minutes and an optional overhead multiplier.
 * @returns The cost breakdown: total, per-minute, per-attendee, attendee count,
 *   hours, combined hourly burn (`ratesSum`), and pre-overhead base (`baseSum`).
 * @throws {RangeError} If `minutes` is not a positive finite number; if (average
 *   mode) `attendees` is not positive or `averageRate` is negative/non-finite;
 *   or if (list mode) no valid rate is supplied.
 *
 * @example
 * ```ts
 * import { calculateMeetingCost } from '@open-utility-tools/core/time/time-meeting-cost-calculator';
 *
 * // 6 people at $75/hr for an hour:
 * calculateMeetingCost(
 *   { mode: 'average', attendees: 6, averageRate: 75 },
 *   { minutes: 60 },
 * ).totalCost; // → 450
 *
 * // Per-person rates with a 1.4× benefits overhead over 90 minutes:
 * calculateMeetingCost(
 *   { mode: 'list', rates: '120, 90, 75' },
 *   { minutes: 90, overhead: 1.4 },
 * ).totalCost; // → 598.5
 * ```
 */
export function calculateMeetingCost(
  rates: MeetingRateInput,
  options: MeetingCostOptions,
): MeetingCostResult {
  const mins = options.minutes;
  if (!Number.isFinite(mins) || mins <= 0) {
    throw new RangeError('minutes must be a positive, finite number.');
  }

  const ohRaw = options.overhead ?? 1;
  const oh = Number.isFinite(ohRaw) && ohRaw > 0 ? ohRaw : 1;

  const hours = mins / 60;

  let baseSum: number;
  let count: number;

  if (rates.mode === 'average') {
    const n = rates.attendees;
    const rate = rates.averageRate;
    if (!Number.isFinite(n) || n <= 0) {
      throw new RangeError('attendees must be a positive number.');
    }
    if (!Number.isFinite(rate) || rate < 0) {
      throw new RangeError('averageRate must be a finite, non-negative number.');
    }
    count = Math.floor(n);
    baseSum = count * rate;
  } else {
    const parsed: number[] = Array.isArray(rates.rates)
      ? rates.rates.filter((r): r is number => Number.isFinite(r) && r >= 0)
      : parseRates(rates.rates as string);
    if (parsed.length === 0) {
      throw new RangeError('Provide at least one valid hourly rate (finite and ≥ 0).');
    }
    count = parsed.length;
    baseSum = parsed.reduce((acc, r) => acc + r, 0);
  }

  const ratesSum = baseSum * oh;
  const totalCost = ratesSum * hours;
  const perMinute = totalCost / mins;
  const perAttendee = count > 0 ? totalCost / count : 0;

  return {
    totalCost,
    perMinute,
    perAttendee,
    attendees: count,
    hours,
    ratesSum,
    baseSum,
  };
}