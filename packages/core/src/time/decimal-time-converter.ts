// Extracted from tools/time/decimal-time-converter. Pure, isomorphic time math.

const SECONDS_PER_DAY = 86400;
const DECIMAL_SECONDS_PER_DAY = 100000; // 10 h × 100 m × 100 s

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export interface StandardToDecimalResult {
  /** Decimal clock time formatted as `H:MM:SS` (decimal hours 0–9). */
  decimalTime: string;
  /** Number of decimal hours elapsed since midnight, e.g. `6.04167`. */
  decimalHours: string;
  /** Portion of the day elapsed, formatted as a percentage string, e.g. `60.41667%`. */
  fractionOfDay: string;
  /** Echo of the normalized standard time, formatted `HH:MM:SS`. */
  standardTime: string;
}

export interface DecimalToStandardResult {
  /** Standard clock time formatted as `HH:MM:SS`. */
  standardTime: string;
  /** Portion of the day elapsed, formatted as a percentage string, e.g. `60.41600%`. */
  fractionOfDay: string;
  /** Whole seconds elapsed since midnight, e.g. `52199`. */
  secondsSinceMidnight: number;
  /** Echo of the decimal time, formatted `H:MM:SS`. */
  decimalTime: string;
}

function parseTimeParts(input: string, kind: 'standard' | 'decimal'): [number, number, number] {
  const parts = input.trim().split(':');
  if (parts.length < 2 || parts.length > 3) {
    const fmt = kind === 'standard' ? 'HH:MM or HH:MM:SS' : 'H:MM or H:MM:SS';
    throw new RangeError(`Enter ${kind} time as ${fmt}.`);
  }
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  const c = parts.length === 3 ? Number(parts[2]) : 0;
  if (![a, b, c].every((x) => Number.isFinite(x))) {
    throw new TypeError('Time parts must be numbers.');
  }
  return [a, b, c];
}

/**
 * Converts a standard 24-hour clock time to French Revolutionary decimal time,
 * in which a day is divided into 10 decimal hours × 100 decimal minutes × 100
 * decimal seconds (100000 decimal seconds per day). Pure and isomorphic — no
 * DOM, runs in the browser, Node, and Bun.
 *
 * @param input - Standard time as `HH:MM` or `HH:MM:SS`. Seconds default to `0`.
 * @returns The decimal time, decimal hours, fraction of day, and echoed standard time.
 * @throws {RangeError} If `input` is not 2–3 colon-separated parts, or hours
 *   (0–23), minutes (0–59), or seconds (0–59) are out of range.
 * @throws {TypeError} If any time part is not a finite number.
 *
 * @example
 * ```ts
 * import { standardToDecimal } from '@open-utility-tools/core/time/decimal-time-converter';
 * standardToDecimal('14:30:00').decimalTime; // → '6:04:16'
 * standardToDecimal('14:30:00').fractionOfDay; // → '60.41667%'
 * ```
 */
export function standardToDecimal(input: string): StandardToDecimalResult {
  const [h, m, s] = parseTimeParts(input, 'standard');
  if (h < 0 || h > 23) throw new RangeError('Hours must be 0-23.');
  if (m < 0 || m > 59) throw new RangeError('Minutes must be 0-59.');
  if (s < 0 || s > 59) throw new RangeError('Seconds must be 0-59.');

  const secsSinceMidnight = h * 3600 + m * 60 + s;
  const fraction = secsSinceMidnight / SECONDS_PER_DAY;
  const decTotal = Math.floor(fraction * DECIMAL_SECONDS_PER_DAY);
  const dh = Math.floor(decTotal / 10000);
  const dm = Math.floor((decTotal % 10000) / 100);
  const ds = decTotal % 100;

  return {
    decimalTime: `${dh}:${pad(dm)}:${pad(ds)}`,
    decimalHours: (fraction * 10).toFixed(5),
    fractionOfDay: `${(fraction * 100).toFixed(5)}%`,
    standardTime: `${pad(h)}:${pad(m)}:${pad(s)}`,
  };
}

/**
 * Converts a French Revolutionary decimal time (10 decimal hours × 100 decimal
 * minutes × 100 decimal seconds per day) back to a standard 24-hour clock time.
 * The conversion rounds to whole seconds, so it is not a lossless inverse of
 * {@link standardToDecimal}. Pure and isomorphic — no DOM, runs in the browser,
 * Node, and Bun.
 *
 * @param input - Decimal time as `H:MM` or `H:MM:SS`. Decimal seconds default to `0`.
 * @returns The standard time, fraction of day, seconds since midnight, and echoed decimal time.
 * @throws {RangeError} If `input` is not 2–3 colon-separated parts, or decimal
 *   hours (0–9), decimal minutes (0–99), or decimal seconds (0–99) are out of range.
 * @throws {TypeError} If any time part is not a finite number.
 *
 * @example
 * ```ts
 * import { decimalToStandard } from '@open-utility-tools/core/time/decimal-time-converter';
 * decimalToStandard('5:00').standardTime; // → '12:00:00'
 * decimalToStandard('5:00').secondsSinceMidnight; // → 43200
 * ```
 */
export function decimalToStandard(input: string): DecimalToStandardResult {
  const [dh, dm, ds] = parseTimeParts(input, 'decimal');
  if (dh < 0 || dh > 9) throw new RangeError('Decimal hours must be 0-9.');
  if (dm < 0 || dm > 99) throw new RangeError('Decimal minutes must be 0-99.');
  if (ds < 0 || ds > 99) throw new RangeError('Decimal seconds must be 0-99.');

  const decTotal = dh * 10000 + dm * 100 + ds;
  const fraction = decTotal / DECIMAL_SECONDS_PER_DAY;
  const secsSinceMidnight = Math.round(fraction * SECONDS_PER_DAY);
  const h = Math.floor(secsSinceMidnight / 3600) % 24;
  const m = Math.floor((secsSinceMidnight % 3600) / 60);
  const s = secsSinceMidnight % 60;

  return {
    standardTime: `${pad(h)}:${pad(m)}:${pad(s)}`,
    fractionOfDay: `${(fraction * 100).toFixed(5)}%`,
    secondsSinceMidnight: secsSinceMidnight,
    decimalTime: `${dh}:${pad(dm)}:${pad(ds)}`,
  };
}
