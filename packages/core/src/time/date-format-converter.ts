// Extracted from tools/time/date-format-converter. Pure, isomorphic date
// formatting — no React, no DOM. Locale-, offset-, and Intl-dependent outputs
// reflect the host's local time zone and locale, exactly as the original UI.

function pad(n: number, width = 2): string {
  return Math.abs(n).toString().padStart(width, '0');
}

/** Local time-zone offset like `"+05:30"` for the given date. */
function offsetString(d: Date): string {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const RFC2822_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const RFC2822_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function rfc2822(d: Date): string {
  const day = RFC2822_DAYS[d.getDay()] ?? '???';
  const month = RFC2822_MONTHS[d.getMonth()] ?? '???';
  const off = offsetString(d).replace(':', '');
  return `${day}, ${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${off}`;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offsetString(d)}`;
}

function safeIntl(opts: Intl.DateTimeFormatOptions, d: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(d);
  } catch {
    return '(unavailable)';
  }
}

/** A single labelled date representation. */
export interface DateFormatEntry {
  /** Human-readable name of the format, e.g. `"ISO 8601 (UTC)"`. */
  label: string;
  /** The date rendered in that format. */
  value: string;
}

/** Result of {@link convertDateFormats}. */
export interface DateFormatResult {
  /** The parsed `Date` (also useful for further computation). */
  date: Date;
  /** All format entries, in display order. */
  formats: DateFormatEntry[];
}

/**
 * Parses a single date-ish string into a `Date`. Accepts anything the platform
 * `Date` constructor understands (ISO 8601, RFC 2822, locale strings, …) plus a
 * bare Unix timestamp: values whose magnitude is below `1e12` are treated as
 * seconds, otherwise as milliseconds — matching the original tool's heuristic.
 *
 * @param input - The raw date string. Surrounding whitespace is trimmed.
 * @returns A valid `Date`.
 * @throws {TypeError} If `input` is empty (or only whitespace).
 * @throws {RangeError} If `input` cannot be parsed as a date.
 *
 * @example
 * ```ts
 * parseDateInput('1706697000').toISOString(); // → '2024-01-31T10:30:00.000Z'
 * ```
 */
export function parseDateInput(input: string): Date {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new TypeError('Date input is empty.');
  }

  // Accept a bare Unix timestamp (seconds or milliseconds) too.
  let d: Date;
  if (/^-?\d{1,}$/.test(trimmed)) {
    const n = Number(trimmed);
    // Heuristic: magnitude below 1e12 => seconds, otherwise milliseconds.
    const asMs = Math.abs(n) < 1e12 ? n * 1000 : n;
    d = new Date(asMs);
  } else {
    d = new Date(trimmed);
  }

  if (Number.isNaN(d.getTime())) {
    throw new RangeError(
      `Could not parse "${trimmed}" as a date. Try ISO 8601 (2024-01-31T10:00:00Z), RFC 2822, a locale date, or a Unix timestamp.`,
    );
  }
  return d;
}

/**
 * Parses a date string (or Unix timestamp) and reformats it into the full set
 * of common representations: ISO 8601 (UTC and local), ISO date/time fragments,
 * RFC 2822, Unix seconds/milliseconds, US/EU numeric dates, the UTC string, and
 * locale/Intl strings. Pure and isomorphic — runs in the browser, Node, and
 * Bun.
 *
 * Note: `ISO 8601 (local)`, the `RFC 2822` offset, `US`/`EU`, and the locale and
 * `Intl`-based entries reflect the host's local time zone and locale, identical
 * to the original interactive tool. UTC-anchored entries (`ISO 8601 (UTC)`,
 * Unix timestamps, `UTC string`) are independent of the host zone.
 *
 * @param input - The raw date string. Surrounding whitespace is trimmed.
 * @returns The parsed `Date` and an ordered list of labelled format entries.
 * @throws {TypeError} If `input` is empty (or only whitespace).
 * @throws {RangeError} If `input` cannot be parsed as a date.
 *
 * @example
 * ```ts
 * import { convertDateFormats } from '@open-utility-tools/core/time/date-format-converter';
 * const { formats } = convertDateFormats('2024-01-31T10:30:00Z');
 * formats[0]; // → { label: 'ISO 8601 (UTC)', value: '2024-01-31T10:30:00.000Z' }
 * formats.find((f) => f.label === 'Unix seconds')?.value; // → '1706697000'
 * ```
 */
export function convertDateFormats(input: string): DateFormatResult {
  const d = parseDateInput(input);

  const formats: DateFormatEntry[] = [
    { label: 'ISO 8601 (UTC)', value: d.toISOString() },
    { label: 'ISO 8601 (local)', value: localIso(d) },
    { label: 'ISO date only', value: d.toISOString().slice(0, 10) },
    { label: 'ISO time only', value: d.toISOString().slice(11, 23) },
    { label: 'RFC 2822', value: rfc2822(d) },
    { label: 'Unix seconds', value: Math.floor(d.getTime() / 1000).toString() },
    { label: 'Unix milliseconds', value: d.getTime().toString() },
    {
      label: 'US (MM/DD/YYYY)',
      value: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
    },
    {
      label: 'EU (DD/MM/YYYY)',
      value: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    },
    { label: 'UTC string', value: d.toUTCString() },
    { label: 'Locale string', value: d.toLocaleString() },
    { label: 'Locale date', value: d.toLocaleDateString() },
    { label: 'Locale time', value: d.toLocaleTimeString() },
    { label: 'Long date', value: safeIntl({ dateStyle: 'full', timeStyle: 'long' }, d) },
    { label: 'Day of week', value: safeIntl({ weekday: 'long' }, d) },
  ];

  return { date: d, formats };
}

/**
 * Renders the result of {@link convertDateFormats} as the aligned, monospace
 * text block the original tool displayed: `label` padded to a common width, two
 * spaces, then `value`, one entry per line.
 *
 * @param formats - The entries to render (typically `convertDateFormats(...).formats`).
 * @returns A newline-joined, column-aligned table. Empty string for no entries.
 *
 * @example
 * ```ts
 * formatDateTable(convertDateFormats('2024-01-31T10:30:00Z').formats);
 * // → 'ISO 8601 (UTC)     2024-01-31T10:30:00.000Z\nISO 8601 (local)   …'
 * ```
 */
export function formatDateTable(formats: DateFormatEntry[]): string {
  if (formats.length === 0) return '';
  const labelWidth = Math.max(...formats.map((f) => f.label.length));
  return formats
    .map((f) => `${f.label.padEnd(labelWidth)}  ${f.value}`)
    .join('\n');
}