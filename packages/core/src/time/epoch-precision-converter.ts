// Extracted from tools/time/epoch-precision-converter. Pure, isomorphic epoch
// precision conversion. No DOM — runs in the browser, Node, and Bun. All
// arithmetic is done with BigInt so nanosecond-scale timestamps stay exact.

/** Precision unit of a Unix timestamp, or `'auto'` to detect it by digit count. */
export type EpochUnit = 'auto' | 's' | 'ms' | 'us' | 'ns';

/** A concrete precision unit (the `'auto'` sentinel resolved to a real unit). */
export type ResolvedEpochUnit = Exclude<EpochUnit, 'auto'>;

// Multiplier (in nanoseconds) for each precision unit.
const NS_PER: Record<ResolvedEpochUnit, bigint> = {
  s: 1_000_000_000n,
  ms: 1_000_000n,
  us: 1_000n,
  ns: 1n,
};

/** Largest absolute millisecond value the ECMAScript `Date` can represent. */
const MAX_DATE_MS = 8.64e15;

/**
 * Detects a timestamp's precision unit from its digit count, using the same
 * heuristic the UI uses for modern (post-1970) timestamps.
 *
 * @param digits - Number of digits in the integer (excluding any sign).
 * @returns The detected precision unit.
 */
function detectUnit(digits: number): ResolvedEpochUnit {
  // Heuristic by digit count for modern timestamps.
  if (digits <= 11) return 's';
  if (digits <= 14) return 'ms';
  if (digits <= 17) return 'us';
  return 'ns';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Result of {@link convertEpochPrecision}. */
export interface EpochPrecisionResult {
  /** The unit the input was interpreted as (the resolved value of `'auto'`). */
  detected: ResolvedEpochUnit;
  /** The timestamp expressed in whole seconds (truncated toward zero). */
  seconds: string;
  /** The timestamp expressed in whole milliseconds (truncated toward zero). */
  ms: string;
  /** The timestamp expressed in whole microseconds (truncated toward zero). */
  us: string;
  /** The timestamp expressed in whole nanoseconds (exact). */
  ns: string;
  /**
   * The instant as an ISO-8601 UTC string (e.g. `2023-11-14T22:13:20.000Z`),
   * or `'Out of representable range'` when the millisecond value exceeds the
   * range a JavaScript `Date` can hold.
   */
  utc: string;
  /**
   * The instant formatted in the host's local time zone as
   * `YYYY-MM-DD HH:mm:ss`, or `'Out of representable range'` when out of range.
   * This value is time-zone dependent.
   */
  local: string;
}

/**
 * Converts a Unix timestamp between seconds, milliseconds, microseconds, and
 * nanoseconds, optionally auto-detecting the source precision by digit count.
 *
 * The input is canonicalized to a nanosecond count with BigInt (so even
 * nanosecond-scale values stay exact), and every precision plus a UTC and a
 * local date string are derived from it. Sub-unit remainders are truncated
 * toward zero, matching BigInt division. The `local` string is rendered in the
 * host's time zone and is therefore environment-dependent; `utc` is not.
 *
 * Underscores, commas, and inner whitespace in `raw` are stripped before
 * parsing, so grouped input like `1,700,000,000` is accepted.
 *
 * @param raw - The timestamp as a string of digits (optionally signed, and
 *   optionally grouped with `_`, `,`, or spaces).
 * @param unit - Source precision, or `'auto'` (the default) to detect it from
 *   the digit count.
 * @returns Every precision as a decimal string plus UTC and local date strings.
 * @throws {TypeError} If `raw` is empty after trimming separators.
 * @throws {RangeError} If `raw` is not an integer (digits with an optional
 *   leading `-`).
 *
 * @example
 * ```ts
 * import { convertEpochPrecision } from '@open-utility-tools/core/time/epoch-precision-converter';
 *
 * convertEpochPrecision('1700000000');
 * // → {
 * //   detected: 's',
 * //   seconds: '1700000000',
 * //   ms: '1700000000000',
 * //   us: '1700000000000000',
 * //   ns: '1700000000000000000',
 * //   utc: '2023-11-14T22:13:20.000Z',
 * //   local: '<host-local time>',
 * // }
 *
 * // Force the source unit instead of auto-detecting:
 * convertEpochPrecision('1700000000123456789', 'ns').ms; // → '1700000000123'
 * ```
 */
export function convertEpochPrecision(
  raw: string,
  unit: EpochUnit = 'auto',
): EpochPrecisionResult {
  const text = raw.trim().replace(/[_,\s]/g, '');
  if (!text) throw new TypeError('Enter a Unix timestamp integer.');
  if (!/^-?\d+$/.test(text)) {
    throw new RangeError('Timestamp must be an integer (digits only).');
  }

  const value = BigInt(text);

  const digitCount = text.replace('-', '').length;
  const resolved: ResolvedEpochUnit = unit === 'auto' ? detectUnit(digitCount) : unit;

  // Convert to a canonical nanosecond count, then derive every unit.
  const totalNs = value * NS_PER[resolved];

  const seconds = totalNs / 1_000_000_000n;
  const ms = totalNs / 1_000_000n;
  const us = totalNs / 1_000n;
  const ns = totalNs;

  // For the human date, JS Date works in ms (Number is safe for any realistic ms epoch).
  const msNumber = Number(ms);
  let utc = 'Out of representable range';
  let local = 'Out of representable range';
  if (Number.isFinite(msNumber) && Math.abs(msNumber) < MAX_DATE_MS) {
    const d = new Date(msNumber);
    if (!Number.isNaN(d.getTime())) {
      utc = d.toISOString();
      local =
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
        `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
  }

  return {
    detected: resolved,
    seconds: seconds.toString(),
    ms: ms.toString(),
    us: us.toString(),
    ns: ns.toString(),
    utc,
    local,
  };
}
