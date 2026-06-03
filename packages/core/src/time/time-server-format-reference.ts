// Extracted from tools/time/time-server-format-reference. Pure, isomorphic
// rendering of one instant into a cheat-sheet of standard datetime formats.
// No DOM, no React — runs in the browser, Node 20+, and Bun.
//
// IMPORTANT: like the original UI, several rows are *time-zone dependent*
// because they read the instant in the host's local zone. The
// `ISO 8601 with local offset`, `RFC 2822 / email Date`,
// `JavaScript Date.toString()`, and `Local UTC offset` rows therefore vary by
// the host's `TZ`. The remaining rows are UTC-based and stable everywhere.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// .NET DateTime ticks are 100-ns intervals since 0001-01-01; this is the tick
// count at the Unix epoch (1970-01-01T00:00:00Z).
const DOTNET_EPOCH_OFFSET_TICKS = 621355968000000000n;

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

function p3(n: number): string {
  return String(n).padStart(3, '0');
}

// Guarded lookups so noUncheckedIndexedAccess is satisfied. The fallbacks
// mirror the original UI's `?? 'Sun'` / `?? 'Jan'` defaults; getDay/getMonth
// can never actually go out of range for a valid Date.
function dayName(index: number): string {
  const name = DAYS[index];
  return name === undefined ? 'Sun' : name;
}

function monthName(index: number): string {
  const name = MONTHS[index];
  return name === undefined ? 'Jan' : name;
}

/** The host-local UTC offset for `d`, as both `+05:30` and compact `+0530`. */
function offsetParts(d: Date): { colon: string; compact: string } {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const hh = p2(Math.floor(abs / 60));
  const mm = p2(abs % 60);
  return { colon: `${sign}${hh}:${mm}`, compact: `${sign}${hh}${mm}` };
}

/** Anything that can be turned into a concrete instant. */
export type DateInput = Date | string | number;

/** A single labeled datetime representation. */
export interface FormatReferenceRow {
  /** Human-readable name of the format (e.g. `'HTTP-date (RFC 7231, GMT)'`). */
  label: string;
  /** The instant rendered in that format. */
  value: string;
}

/** Resolves `input` to a valid `Date`, throwing on bad input. */
function coerceDate(input: DateInput): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new RangeError('Enter a valid datetime.');
    }
    return input;
  }
  if (typeof input === 'string' || typeof input === 'number') {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new RangeError('Enter a valid datetime.');
    }
    return d;
  }
  throw new TypeError('Expected a Date, ISO string, or epoch-millisecond number.');
}

/**
 * Renders a single instant as an ordered list of labeled datetime format
 * strings: RFC 3339, ISO 8601 (offset and basic), RFC 2822, HTTP-date, SQL,
 * `Date.toString()`/`Date.toUTCString()`, Unix seconds/milliseconds,
 * .NET DateTime ticks, cookie `expires`, W3C datetime, the local UTC offset,
 * and the millisecond component — fifteen rows in a fixed order.
 *
 * The arithmetic and string formatting are lifted verbatim from the original
 * tool, so the outputs match the UI exactly. Because some rows are read in the
 * host's local time zone, those rows depend on the runtime `TZ`; the UTC-based
 * rows are stable everywhere. The `JavaScript Date.toString()` row also carries
 * an engine-specific time-zone name in parentheses.
 *
 * @param input - The instant to render: a `Date`, a string parseable by
 *   `new Date(...)` (e.g. an ISO-8601 or `datetime-local` string), or a number
 *   of milliseconds since the Unix epoch.
 * @returns An ordered array of `{ label, value }` rows, one per format.
 * @throws {RangeError} If `input` is a string/number that does not parse to a
 *   valid date, or an already-invalid `Date`.
 * @throws {TypeError} If `input` is neither a `Date`, a string, nor a number.
 *
 * @example
 * ```ts
 * import { formatReferenceRows } from '@open-utility-tools/core/time/time-server-format-reference';
 *
 * const rows = formatReferenceRows('2026-03-09T17:05:09.042Z');
 * rows[0]; // → { label: 'ISO 8601 / RFC 3339 (UTC, Z)', value: '2026-03-09T17:05:09.042Z' }
 * rows.find((r) => r.label === 'Unix seconds')?.value; // → '1773075909'
 * rows.find((r) => r.label === 'HTTP-date (RFC 7231, GMT)')?.value;
 * // → 'Mon, 09 Mar 2026 17:05:09 GMT'
 * ```
 */
export function formatReferenceRows(input: DateInput): FormatReferenceRow[] {
  const d = coerceDate(input);

  const off = offsetParts(d);
  const dowUTC = dayName(d.getUTCDay());
  const monUTC = monthName(d.getUTCMonth());
  const dowLocal = dayName(d.getDay());
  const monLocal = monthName(d.getMonth());

  const isoUtc = d.toISOString(); // RFC 3339 with Z, ms
  const isoLocal = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${off.colon}`;
  const rfc2822 = `${dowLocal}, ${p2(d.getDate())} ${monLocal} ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${off.compact}`;
  const httpDate = `${dowUTC}, ${p2(d.getUTCDate())} ${monUTC} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`;
  const sqlUtc = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  const unixSec = Math.floor(d.getTime() / 1000);
  const unixMs = d.getTime();
  // .NET DateTime ticks: 100-ns intervals since 0001-01-01.
  const dotnetTicks = (BigInt(unixMs) * 10000n + DOTNET_EPOCH_OFFSET_TICKS).toString();
  const cookieExpires = `${dowUTC}, ${p2(d.getUTCDate())}-${monUTC}-${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`;
  const w3c = isoUtc.replace(/\.\d{3}Z$/, 'Z');
  const isoBasic = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

  return [
    { label: 'ISO 8601 / RFC 3339 (UTC, Z)', value: isoUtc },
    { label: 'ISO 8601 with local offset', value: isoLocal },
    { label: 'ISO 8601 basic (no separators)', value: isoBasic },
    { label: 'RFC 2822 / email Date', value: rfc2822 },
    { label: 'HTTP-date (RFC 7231, GMT)', value: httpDate },
    { label: 'SQL DATETIME (UTC)', value: sqlUtc },
    { label: 'JavaScript Date.toString()', value: d.toString() },
    { label: 'JavaScript Date.toUTCString()', value: d.toUTCString() },
    { label: 'Unix seconds', value: String(unixSec) },
    { label: 'Unix milliseconds', value: String(unixMs) },
    { label: '.NET DateTime ticks', value: dotnetTicks },
    { label: 'Cookie expires (RFC 6265)', value: cookieExpires },
    { label: 'W3C datetime', value: w3c },
    { label: 'Local UTC offset', value: `${off.colon} (${off.compact})` },
    { label: 'Milliseconds component', value: `${p3(d.getUTCMilliseconds())} ms` },
  ];
}
