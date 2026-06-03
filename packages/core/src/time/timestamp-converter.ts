/**
 * Unix Timestamp Converter — isomorphic core transform.
 *
 * Lifted verbatim from the open-utility-tools `timestamp-converter` UI. Parses a
 * Unix timestamp (seconds or milliseconds, auto-detected) or any string accepted
 * by the `Date` constructor, and renders the canonical representations the UI
 * shows. No React, no DOM, no Web APIs beyond Date / Intl / Math.
 *
 * @module time/timestamp-converter
 */

/** Canonical representations of a single instant in time. */
export interface TimestampConversion {
  /** Unix time in whole seconds (floored), e.g. `1716239022`. */
  unixSeconds: number;
  /** Unix time in milliseconds, e.g. `1716239022000`. */
  unixMilliseconds: number;
  /** ISO 8601 string in UTC, e.g. `"2024-05-20T21:03:42.000Z"`. */
  iso8601: string;
  /** RFC-1123 style UTC string, e.g. `"Mon, 20 May 2024 21:03:42 GMT"`. */
  utc: string;
  /**
   * The runtime's local-timezone string from `Date.prototype.toString()`,
   * e.g. `"Mon May 20 2024 14:23:42 GMT-0400 (Eastern Daylight Time)"`.
   * This value depends on the host timezone.
   */
  local: string;
}

/**
 * Parse a raw string into a `Date`, returning `null` when it cannot be parsed.
 *
 * Mirrors the UI heuristic exactly: a purely numeric string (optionally signed)
 * is treated as a Unix timestamp — 13 or more digits means milliseconds,
 * otherwise seconds. Anything else is handed to the `Date` constructor.
 */
function parseInput(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // Heuristic: 13+ digits = ms, else seconds.
    const ms = s.replace('-', '').length >= 13 ? n : n * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a timestamp/date string into a `Date`.
 *
 * Numeric strings are interpreted as Unix time (>= 13 digits = milliseconds,
 * otherwise seconds); all other strings are parsed by the `Date` constructor.
 *
 * @param input - A Unix timestamp (seconds or milliseconds) or a `Date`-parseable string.
 * @returns The parsed `Date`.
 * @throws {TypeError} If `input` is not a string.
 * @throws {RangeError} If `input` is empty or cannot be parsed.
 * @example
 * parseTimestamp('1716239022').toISOString(); // "2024-05-20T21:03:42.000Z"
 */
export function parseTimestamp(input: string): Date {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  if (!input.trim()) {
    throw new RangeError('input is empty');
  }
  const d = parseInput(input);
  if (d === null) {
    throw new RangeError(`Could not parse "${input}" as a timestamp or date.`);
  }
  return d;
}

/**
 * Human-readable relative time between two instants (in milliseconds), e.g.
 * `"in 1 minute"`, `"2 days ago"`, or `"now"`.
 *
 * Lifted verbatim from the UI. The difference is rounded to whole seconds, then
 * stepped down through second → minute → hour → day → month → year using fixed
 * ratios (60, 60, 24, 30, 12), and rendered with `Intl.RelativeTimeFormat`
 * using `numeric: 'auto'`.
 *
 * @param then - The target instant, in milliseconds since the Unix epoch.
 * @param now - The reference instant, in milliseconds since the Unix epoch.
 * @returns A localized (en) relative-time phrase.
 * @throws {TypeError} If `then` or `now` is not a finite number.
 * @example
 * relativeTime(90_000, 0);                    // "in 1 minute"
 * relativeTime(0, 2 * 24 * 60 * 60 * 1000);   // "2 days ago"
 */
export function relativeTime(then: number, now: number): string {
  if (!Number.isFinite(then) || !Number.isFinite(now)) {
    throw new TypeError('then and now must be finite numbers');
  }
  const diff = Math.round((then - now) / 1000);
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let value = abs;
  let unit = 'second';
  for (const entry of units) {
    const size = entry[0];
    const name = entry[1];
    if (value < size) {
      unit = name;
      break;
    }
    value = Math.floor(value / size);
    unit = name;
  }
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(diff < 0 ? -value : value, unit as Intl.RelativeTimeFormatUnit);
}

/**
 * Convert a Unix timestamp or date string into its canonical representations.
 *
 * This is the core transform behind the Unix Timestamp Converter tool. Numeric
 * input is auto-detected as seconds or milliseconds (>= 13 digits = ms). The
 * returned `unixSeconds`, `unixMilliseconds`, `iso8601`, and `utc` fields are
 * timezone-independent; `local` reflects the host runtime's timezone.
 *
 * @param input - A Unix timestamp (seconds or milliseconds) or a `Date`-parseable string.
 * @returns The {@link TimestampConversion} for the parsed instant.
 * @throws {TypeError} If `input` is not a string.
 * @throws {RangeError} If `input` is empty or cannot be parsed as a timestamp or date.
 * @example
 * convertTimestamp('1716239022');
 * // {
 * //   unixSeconds: 1716239022,
 * //   unixMilliseconds: 1716239022000,
 * //   iso8601: '2024-05-20T21:03:42.000Z',
 * //   utc: 'Mon, 20 May 2024 21:03:42 GMT',
 * //   local: 'Mon May 20 2024 14:03:42 GMT-0700 (Pacific Daylight Time)',
 * // }
 */
export function convertTimestamp(input: string): TimestampConversion {
  const date = parseTimestamp(input);
  return {
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMilliseconds: date.getTime(),
    iso8601: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
  };
}