/** A single time-storage overflow milestone in the reference table. */
export interface RolloverMilestone {
  /** Human-readable name of the overflow boundary. */
  readonly name: string;
  /** The raw limit value as displayed (e.g. "2147483647 s"). */
  readonly value: string;
  /** The UTC datetime (ISO 8601) at which the rollover occurs, or an approximate label. */
  readonly datetime: string;
  /** Explanatory note describing the milestone. */
  readonly note: string;
}

/** Result of interpreting an integer as both a Unix-seconds and a Unix-milliseconds timestamp. */
export interface RolloverProbeResult {
  /** The input integer, normalized to a decimal string. */
  readonly value: string;
  /**
   * ISO 8601 UTC datetime when the input is read as seconds since the Unix epoch,
   * or "Out of representable JS Date range" when it falls outside ±8.64e15 ms.
   */
  readonly asSeconds: string;
  /**
   * ISO 8601 UTC datetime when the input is read as milliseconds since the Unix epoch,
   * or "Out of representable JS Date range" when it falls outside ±8.64e15 ms.
   */
  readonly asMilliseconds: string;
}

/** Sentinel used when a value cannot be represented as a JavaScript {@link Date}. */
export const OUT_OF_RANGE = 'Out of representable JS Date range';

/** Maximum absolute time (in ms) a JavaScript Date can represent: ±100,000,000 days. */
const JS_DATE_LIMIT_MS = 8640000000000000n;

/** Format an epoch-millisecond value as a compact ISO 8601 UTC string (trailing ".000Z" → "Z"). */
function utc(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/**
 * Build the static reference table of well-known time-storage overflow milestones
 * (Year 2038, 2-digit Y2K, 32-bit and 64-bit limits, NTP/GPS rollovers, FILETIME, …).
 *
 * The computed UTC instants (the 32-bit overflow rows) are derived from their numeric
 * limits; the remaining rows carry fixed, well-known datetimes or approximate labels.
 *
 * @returns A fresh array of {@link RolloverMilestone} entries, ordered as displayed in the UI.
 * @example
 * const table = buildRolloverMilestones();
 * table[0]?.datetime; // "2038-01-19T03:14:07Z" (signed 32-bit Unix overflow)
 */
export function buildRolloverMilestones(): RolloverMilestone[] {
  const I32_MAX = 2147483647; // seconds
  const U32_MAX = 4294967295; // seconds
  return [
    {
      name: 'Signed 32-bit Unix overflow (Y2038)',
      value: `${I32_MAX} s`,
      datetime: utc(I32_MAX * 1000),
      note: 'time_t as int32 wraps to negative; affects legacy C, embedded, old filesystems.',
    },
    {
      name: 'Unsigned 32-bit Unix overflow',
      value: `${U32_MAX} s`,
      datetime: utc(U32_MAX * 1000),
      note: 'Unsigned 32-bit second counters (some protocols) saturate here.',
    },
    {
      name: 'Year 2000 problem (Y2K)',
      value: '2-digit year 99 → 00',
      datetime: '2000-01-01T00:00:00Z',
      note: 'Two-digit year storage rolled 99 to 00; mostly remediated by 1999.',
    },
    {
      name: 'NTP era rollover (era 0 → 1)',
      value: '2^32 seconds since 1900',
      datetime: '2036-02-07T06:28:16Z',
      note: 'NTP 32-bit seconds field since 1900-01-01 wraps; NTPv4 uses era numbering.',
    },
    {
      name: 'GPS week number rollover (10-bit)',
      value: '1024 weeks',
      datetime: '2038-11-21T00:00:00Z',
      note: 'Legacy 10-bit GPS week counter wraps every 1024 weeks; modern receivers use 13-bit.',
    },
    {
      name: 'Signed 64-bit Unix overflow',
      value: '9223372036854775807 s',
      datetime: '~year 292,277,026,596',
      note: 'int64 time_t — effectively never; this is the modern standard.',
    },
    {
      name: 'Signed 64-bit milliseconds (JS Date max)',
      value: '8640000000000000 ms',
      datetime: '+275760-09-13T00:00:00Z',
      note: 'JavaScript Date caps at ±8.64e15 ms (±100,000,000 days from epoch).',
    },
    {
      name: 'Windows FILETIME (64-bit, 100 ns since 1601)',
      value: '2^64 × 100 ns',
      datetime: '~year 60056',
      note: '100-nanosecond ticks since 1601-01-01 UTC; overflow is far future.',
    },
  ];
}

/**
 * Interpret an arbitrary integer as a Unix timestamp, both as seconds and as milliseconds
 * since the epoch, returning the corresponding UTC datetimes. Inputs are parsed with
 * {@link BigInt}, so arbitrarily large magnitudes are accepted; values that fall outside
 * the representable JavaScript Date range (±8.64e15 ms) yield {@link OUT_OF_RANGE} for that
 * interpretation rather than throwing.
 *
 * @param input - A whole integer, as a string (optionally signed, surrounding whitespace ignored) or a `number`/`bigint`.
 * @returns A {@link RolloverProbeResult} with the normalized value and both UTC interpretations.
 * @throws {TypeError} If `input` is an empty/blank string, or a `number` that is not a finite integer.
 * @throws {RangeError} If `input` is a string that is not a whole integer (digits with optional leading `-`).
 * @example
 * probeRolloverTimestamp('2147483647');
 * // {
 * //   value: '2147483647',
 * //   asSeconds: '2038-01-19T03:14:07Z',
 * //   asMilliseconds: '1970-01-25T20:31:23.647Z',
 * // }
 */
export function probeRolloverTimestamp(input: string | number | bigint): RolloverProbeResult {
  let n: bigint;
  if (typeof input === 'bigint') {
    n = input;
  } else if (typeof input === 'number') {
    if (!Number.isInteger(input)) {
      throw new TypeError(`Expected a whole integer, received: ${input}`);
    }
    n = BigInt(input);
  } else {
    const s = input.trim();
    if (!s) {
      throw new TypeError('Expected a whole integer, received an empty string.');
    }
    if (!/^-?\d+$/.test(s)) {
      throw new RangeError(`Enter a whole integer (digits only), received: ${input}`);
    }
    n = BigInt(s);
  }

  const asSecMs = n * 1000n;
  const asMs = n;
  const asSeconds =
    asSecMs > JS_DATE_LIMIT_MS || asSecMs < -JS_DATE_LIMIT_MS ? OUT_OF_RANGE : utc(Number(asSecMs));
  const asMilliseconds =
    asMs > JS_DATE_LIMIT_MS || asMs < -JS_DATE_LIMIT_MS ? OUT_OF_RANGE : utc(Number(asMs));

  return { value: n.toString(), asSeconds, asMilliseconds };
}
