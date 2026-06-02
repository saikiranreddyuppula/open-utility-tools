// Extracted from tools/time/iso-8601-parser. Pure, isomorphic ISO 8601 parsing
// and validation. No DOM — runs in the browser, Node 20+, and Bun.

const ISO_RE =
  /^(?<year>[+-]?\d{4,6})-(?<month>\d{2})-(?<day>\d{2})(?:[T ](?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:[.,](?<fraction>\d+))?)?\s*(?<offset>Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** ISO week date (Thursday-based), lifted verbatim from the original tool. */
function isoWeek(d: Date): { week: number; weekYear: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { week, weekYear };
}

/** Structured breakdown of an ISO 8601 date-time string. */
export interface ParsedIso8601 {
  /** Numeric year (sign-aware), e.g. `2024`. */
  year: number;
  /** Year exactly as written in the input, e.g. `"2024"` or `"+002024"`. */
  yearText: string;
  /** Numeric month, 1-based. */
  month: number;
  /** Numeric day of month. */
  day: number;
  /** Hour, or `null` when the input is date-only. */
  hour: number | null;
  /** Minute, or `null` when absent. */
  minute: number | null;
  /** Second, or `null` when absent. */
  second: number | null;
  /** Fractional-seconds digits exactly as written (e.g. `"500"`), or `null`. */
  fraction: string | null;
  /** Fractional seconds rounded to whole milliseconds, or `null`. */
  fractionMs: number | null;
  /** Offset token as written (`"Z"`, `"+05:30"`, …), or `null` when absent. */
  offsetText: string | null;
  /** Human label for the offset, e.g. `"+05:30 (5h 30m)"` or `"Z (UTC, +00:00)"`. */
  offsetLabel: string;
  /** Offset in minutes (east positive), or `null` when no offset is present. */
  offsetMinutes: number | null;
  /** `true` when no validation issues were found. */
  valid: boolean;
  /** Validation problems; empty when {@link valid} is `true`. */
  issues: string[];
  /** Weekday name (UTC), or `null` when the value isn't a parseable instant. */
  weekday: string | null;
  /** 1-based day of year (UTC), or `null`. */
  dayOfYear: number | null;
  /** ISO week number, or `null`. */
  isoWeek: number | null;
  /** ISO week-numbering year, or `null`. */
  isoWeekYear: number | null;
  /** Unix time in whole seconds, or `null`. */
  unixSeconds: number | null;
  /** Unix time in milliseconds, or `null`. */
  unixMilliseconds: number | null;
  /** Canonical UTC ISO string from `Date.toISOString()`, or `null`. */
  normalizedUtc: string | null;
}

/**
 * Parses an ISO 8601 date-time string into its components and validates it,
 * deriving weekday, day-of-year, ISO week, Unix time, and a normalized UTC form.
 *
 * Faithfully lifted from the ISO 8601 Parser tool: range checks on
 * month/day/hour/minute/second, a calendar round-trip check for date-only input
 * (catching e.g. `2023-02-30`), and the same Thursday-based ISO-week math. Like
 * the original, derived fields are populated whenever the underlying `Date` is
 * parseable even if `valid` is `false` (e.g. a rolled-over invalid calendar
 * date still reports the rolled-over instant).
 *
 * @param input - The candidate ISO 8601 string; surrounding whitespace is trimmed.
 * @returns A {@link ParsedIso8601} breakdown with components and derived fields.
 * @throws {RangeError} If `input` does not match a recognized ISO 8601 shape.
 *
 * @example
 * ```ts
 * import { parseIso8601 } from '@open-utility-tools/core/time/iso-8601-parser';
 * const r = parseIso8601('2024-01-31T10:30:00.500+05:30');
 * r.offsetMinutes;  // → 330
 * r.normalizedUtc;  // → '2024-01-31T05:00:00.500Z'
 * r.isoWeek;        // → 5
 * ```
 */
export function parseIso8601(input: string): ParsedIso8601 {
  const trimmed = input.trim();
  const match = ISO_RE.exec(trimmed);
  if (!match || !match.groups) {
    throw new RangeError(
      'Not a recognized ISO 8601 date-time. Expected e.g. 2024-01-31, 2024-01-31T10:30:00Z, or 2024-01-31T10:30:00.500+05:30',
    );
  }

  const g = match.groups;
  const yearStr = g['year'] ?? '';
  const monthStr = g['month'] ?? '';
  const dayStr = g['day'] ?? '';
  const hourStr = g['hour'];
  const minuteStr = g['minute'];
  const secondStr = g['second'];
  const fractionStr = g['fraction'];
  const offsetStr = g['offset'];

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const issues: string[] = [];
  if (month < 1 || month > 12) issues.push(`month ${month} out of range (1-12)`);
  if (day < 1 || day > 31) issues.push(`day ${day} out of range (1-31)`);

  let hour: number | null = null;
  let minute: number | null = null;
  let second: number | null = null;
  if (hourStr != null) {
    hour = Number(hourStr);
    if (hour > 24) issues.push(`hour ${hour} out of range (0-24)`);
  }
  if (minuteStr != null) {
    minute = Number(minuteStr);
    if (minute > 59) issues.push(`minute ${minute} out of range (0-59)`);
  }
  if (secondStr != null) {
    second = Number(secondStr);
    if (second > 60) issues.push(`second ${second} out of range (0-60)`);
  }

  // Build a Date to validate the calendar date and compute derived fields.
  const isoForDate =
    hourStr != null
      ? trimmed.replace(' ', 'T')
      : `${yearStr}-${monthStr}-${dayStr}T00:00:00Z`;
  const d = new Date(isoForDate);
  const dateValid = !Number.isNaN(d.getTime());
  if (!dateValid) issues.push('value is not a valid calendar date/time');

  // Calendar-day round-trip check (catches things like Feb 30).
  if (dateValid && hourStr == null) {
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day
    ) {
      issues.push(`${yearStr}-${monthStr}-${dayStr} does not exist on the calendar`);
    }
  }

  let offsetLabel = 'none (local / unspecified)';
  let offsetMinutes: number | null = null;
  if (offsetStr === 'Z') {
    offsetLabel = 'Z (UTC, +00:00)';
    offsetMinutes = 0;
  } else if (offsetStr) {
    const sign = offsetStr.startsWith('-') ? -1 : 1;
    const body = offsetStr.slice(1).replace(':', '');
    const oh = Number(body.slice(0, 2));
    const om = Number(body.slice(2, 4) || '0');
    offsetMinutes = sign * (oh * 60 + om);
    offsetLabel = `${offsetStr} (${oh}h ${om}m)`;
  }

  let fractionMs: number | null = null;
  if (fractionStr != null) {
    fractionMs = Math.round(Number(`0.${fractionStr}`) * 1000);
  }

  let weekday: string | null = null;
  let dayOfYear: number | null = null;
  let isoWeekNum: number | null = null;
  let isoWeekYear: number | null = null;
  let unixSeconds: number | null = null;
  let unixMilliseconds: number | null = null;
  let normalizedUtc: string | null = null;
  if (dateValid) {
    const w = isoWeek(d);
    isoWeekNum = w.week;
    isoWeekYear = w.weekYear;
    weekday = WEEKDAYS[d.getUTCDay()] ?? '?';
    dayOfYear = Math.floor(
      (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
        Date.UTC(d.getUTCFullYear(), 0, 0)) /
        86400000,
    );
    unixSeconds = Math.floor(d.getTime() / 1000);
    unixMilliseconds = d.getTime();
    normalizedUtc = d.toISOString();
  }

  return {
    year,
    yearText: yearStr,
    month,
    day,
    hour,
    minute,
    second,
    fraction: fractionStr ?? null,
    fractionMs,
    offsetText: offsetStr ?? null,
    offsetLabel,
    offsetMinutes,
    valid: issues.length === 0,
    issues,
    weekday,
    dayOfYear,
    isoWeek: isoWeekNum,
    isoWeekYear,
    unixSeconds,
    unixMilliseconds,
    normalizedUtc,
  };
}

/**
 * Renders the parsed components as the same aligned two-column text table the
 * ISO 8601 Parser tool's UI produces.
 *
 * @param input - The candidate ISO 8601 string.
 * @returns A newline-separated, label-padded breakdown.
 * @throws {RangeError} If `input` does not match a recognized ISO 8601 shape.
 *
 * @example
 * ```ts
 * import { formatIso8601Components } from '@open-utility-tools/core/time/iso-8601-parser';
 * formatIso8601Components('2024-01-31');
 * // → "Year               2024\nMonth              01 (1)\n…"
 * ```
 */
export function formatIso8601Components(input: string): string {
  const p = parseIso8601(input);

  // Re-derive the raw month/day text so the `NN (N)` display matches the input
  // exactly (e.g. "01 (1)"), as the original UI did.
  const match = ISO_RE.exec(input.trim());
  const groups = match?.groups ?? {};
  const monthStr = groups['month'] ?? '';
  const dayStr = groups['day'] ?? '';

  const rows: [string, string][] = [
    ['Year', p.yearText],
    ['Month', `${monthStr} (${p.month})`],
    ['Day', `${dayStr} (${p.day})`],
  ];
  if (p.hour != null) rows.push(['Hour', String(p.hour)]);
  if (p.minute != null) rows.push(['Minute', String(p.minute)]);
  if (p.second != null) rows.push(['Second', String(p.second)]);
  if (p.fraction != null) {
    rows.push(['Fractional sec', `.${p.fraction} (${p.fractionMs} ms)`]);
  }
  rows.push(['Offset', p.offsetLabel]);
  if (p.offsetMinutes != null) {
    rows.push(['Offset minutes', String(p.offsetMinutes)]);
  }
  if (p.normalizedUtc != null) {
    rows.push(['Weekday', p.weekday ?? '?']);
    rows.push(['Day of year', String(p.dayOfYear)]);
    rows.push(['ISO week', `${p.isoWeekYear}-W${String(p.isoWeek).padStart(2, '0')}`]);
    rows.push(['Unix seconds', String(p.unixSeconds)]);
    rows.push(['Unix milliseconds', String(p.unixMilliseconds)]);
    rows.push(['Normalized (UTC)', p.normalizedUtc]);
  }
  rows.push(['Valid', p.issues.length === 0 ? 'yes' : `no — ${p.issues.join('; ')}`]);

  const labelWidth = Math.max(...rows.map(([l]) => l.length));
  return rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`).join('\n');
}