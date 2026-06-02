/**
 * Unix Nanoseconds Converter — core transform.
 *
 * Convert nanosecond-precision Unix timestamps to UTC date-time and back
 * without floating-point loss, using BigInt math. Lifted verbatim from the
 * open-utility-tools `time/unix-nanoseconds-converter` UI.
 *
 * Isomorphic: pure TypeScript, no React/DOM/Web APIs beyond Date/Math/JSON.
 */

const NS_PER_SEC = 1_000_000_000n;
const NS_PER_MS = 1_000_000n;

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

/**
 * The shared, fully-decomposed conversion result.
 */
export interface NanosecondConversion {
  /** Full nanosecond integer (signed) as a decimal string. */
  fullNs: string;
  /** Seconds.fraction form, e.g. `"1700000000.123456789"` (9 fractional digits). */
  secFrac: string;
  /** UTC datetime with 9-digit fractional seconds and trailing `Z`. */
  iso: string;
  /** Whole seconds component (floored toward negative infinity), as a string. */
  wholeSeconds: string;
  /** Sub-second nanoseconds in `[0, 999999999]`, zero-padded to 9 digits. */
  subSecond: string;
}

/**
 * Format a UTC datetime with 9-digit fractional seconds from a total ns BigInt.
 *
 * Uses floor division toward negative infinity for the seconds part so that
 * negative timestamps produce a normalized fractional component in
 * `[0, 999999999]`.
 *
 * @internal
 */
function formatNs(totalNs: bigint): { iso: string; secFrac: string } {
  // Floor division toward negative infinity for the seconds part.
  let seconds = totalNs / NS_PER_SEC;
  let frac = totalNs % NS_PER_SEC;
  if (frac < 0n) {
    frac += NS_PER_SEC;
    seconds -= 1n;
  }
  const ms = Number(seconds * 1000n);
  const date = new Date(ms);
  const fracStr = frac.toString().padStart(9, '0');
  const iso =
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `.${fracStr}Z`;
  const secFrac = `${seconds.toString()}.${fracStr}`;
  return { iso, secFrac };
}

/**
 * Convert a nanosecond-precision Unix timestamp into a fully-decomposed UTC
 * date-time, without floating-point loss.
 *
 * The input is parsed as a signed BigInt; underscores are stripped first so
 * grouped literals such as `"1_700_000_000_123_456_789"` are accepted. Negative
 * timestamps (before the Unix epoch) are supported and the fractional/whole
 * components are normalized via floor division toward negative infinity.
 *
 * @param nanoseconds - An integer number of nanoseconds since the Unix epoch,
 *   as a string. May be negative and may contain `_` digit separators.
 * @returns A {@link NanosecondConversion} describing the timestamp.
 * @throws {TypeError} If the input is not a valid (optionally signed) integer.
 *
 * @example
 * nanosecondsToDateTime('1700000000123456789');
 * // => {
 * //   fullNs: '1700000000123456789',
 * //   secFrac: '1700000000.123456789',
 * //   iso: '2023-11-14T22:13:20.123456789Z',
 * //   wholeSeconds: '1700000000',
 * //   subSecond: '123456789',
 * // }
 */
export function nanosecondsToDateTime(nanoseconds: string): NanosecondConversion {
  const t = nanoseconds.trim().replace(/_/g, '');
  if (!/^-?\d+$/.test(t)) {
    throw new TypeError('Enter an integer number of nanoseconds.');
  }
  let ns: bigint;
  try {
    ns = BigInt(t);
  } catch {
    throw new TypeError('Could not parse the nanosecond value.');
  }
  const { iso, secFrac } = formatNs(ns);
  let wholeSec = ns / NS_PER_SEC;
  let rem = ns % NS_PER_SEC;
  if (rem < 0n) {
    rem += NS_PER_SEC;
    wholeSec -= 1n;
  }
  return {
    fullNs: ns.toString(),
    secFrac,
    iso,
    wholeSeconds: wholeSec.toString(),
    subSecond: rem.toString().padStart(9, '0'),
  };
}

/**
 * Convert an ISO datetime (parsed to whole milliseconds) plus a sub-second
 * nanosecond component into a nanosecond-precision Unix timestamp.
 *
 * `Date.parse` only yields whole-millisecond resolution, so the `subSecond`
 * value REPLACES the entire sub-second portion of the parsed instant: any
 * millisecond fraction present in `dateInput` (e.g. the `.500` in
 * `2023-11-14T22:13:20.500Z`) is discarded and overwritten by `subSecond`.
 *
 * @param dateInput - Any datetime string accepted by `Date.parse`
 *   (e.g. `'2023-11-14T22:13:20Z'`).
 * @param subSecond - Sub-second nanoseconds as 1–9 digits in
 *   `[0, 999999999]`; left-padded to 9 digits. Defaults to `'0'`. An empty
 *   string is treated as `'0'`.
 * @returns A {@link NanosecondConversion} describing the resulting timestamp.
 * @throws {RangeError} If `dateInput` is not parseable, if `subSecond` is not
 *   1–9 digits, or if `subSecond` represents one second or more.
 *
 * @example
 * dateTimeToNanoseconds('2023-11-14T22:13:20Z', '123456789');
 * // => {
 * //   fullNs: '1700000000123456789',
 * //   secFrac: '1700000000.123456789',
 * //   iso: '2023-11-14T22:13:20.123456789Z',
 * //   wholeSeconds: '1700000000',
 * //   subSecond: '123456789',
 * // }
 */
export function dateTimeToNanoseconds(
  dateInput: string,
  subSecond: string = '0',
): NanosecondConversion {
  const ms = Date.parse(dateInput.trim());
  if (Number.isNaN(ms)) {
    throw new RangeError('Enter a parseable ISO datetime (e.g. 2023-11-14T22:13:20Z).');
  }
  const subRaw = subSecond.trim() || '0';
  if (!/^\d{1,9}$/.test(subRaw)) {
    throw new RangeError('Sub-millisecond nanoseconds must be 0–999999999 (up to 9 digits).');
  }
  // Date.parse gives whole milliseconds. The sub-ns field replaces the
  // sub-millisecond portion of the timestamp (the extra 6 digits beyond ms).
  const sub = BigInt(subRaw.padStart(9, '0'));
  if (sub >= NS_PER_SEC) {
    throw new RangeError('Sub-second nanoseconds exceed one second.');
  }
  const wholeMs = BigInt(ms);
  const fracMsPart = ((wholeMs % 1000n) + 1000n) % 1000n; // ms component already in the date
  const baseSecMs = wholeMs - fracMsPart;
  const totalNs = baseSecMs * NS_PER_MS + sub;
  const { iso, secFrac } = formatNs(totalNs);
  return {
    fullNs: totalNs.toString(),
    secFrac,
    iso,
    wholeSeconds: (totalNs / NS_PER_SEC).toString(),
    subSecond: (totalNs % NS_PER_SEC).toString().padStart(9, '0'),
  };
}
