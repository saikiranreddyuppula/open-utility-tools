// Extracted from tools/time/strftime-playground. Pure, isomorphic strftime
// rendering. No DOM, no React — runs in the browser, Node 20, and Bun.
//
// Faithful to the UI: the supplied wall-clock components are interpreted as a
// UTC instant for deterministic, offline output, and `offsetMinutes` is used
// verbatim for the %z / %Z directives (the UI feeds it the user's local UTC
// offset). All directive math is copied from the original UI implementation.

const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_ABBR = [
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
];

/** Human-readable description for each supported strftime directive. */
const DIRECTIVE_DESC: Record<string, string> = {
  Y: 'Year with century',
  y: 'Year without century (00-99)',
  m: 'Month as zero-padded number (01-12)',
  d: 'Day of month, zero-padded (01-31)',
  e: 'Day of month, space-padded',
  H: 'Hour, 24-hour, zero-padded (00-23)',
  I: 'Hour, 12-hour, zero-padded (01-12)',
  M: 'Minute, zero-padded (00-59)',
  S: 'Second, zero-padded (00-59)',
  p: 'AM or PM',
  a: 'Abbreviated weekday name',
  A: 'Full weekday name',
  b: 'Abbreviated month name',
  B: 'Full month name',
  j: 'Day of year, zero-padded (001-366)',
  w: 'Weekday as number (0=Sunday..6)',
  u: 'ISO weekday (1=Monday..7)',
  U: 'Week of year, Sunday first (00-53)',
  W: 'Week of year, Monday first (00-53)',
  Z: 'Time zone offset name (UTC±HH:MM)',
  z: 'UTC offset (+HHMM)',
  '%': 'Literal percent sign',
};

function pad(n: number, width: number, ch = '0'): string {
  return n.toString().padStart(width, ch);
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000) + 1;
}

// Week of year. Sunday-first (%U) or Monday-first (%W).
function weekOfYear(date: Date, mondayFirst: boolean): number {
  const doy = dayOfYear(date);
  const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).getUTCDay();
  // Offset of week start relative to Jan 1.
  const startDow = mondayFirst ? (jan1 + 6) % 7 : jan1; // days before first full week
  return Math.floor((doy + startDow - 1) / 7);
}

function offsetString(offsetMinutes: number, colon: boolean): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = pad(Math.floor(abs / 60), 2);
  const mm = pad(abs % 60, 2);
  return colon ? `${sign}${hh}:${mm}` : `${sign}${hh}${mm}`;
}

/** The calendar/wall-clock components to render, interpreted as a UTC instant. */
export interface DateTimeParts {
  /** Full year with century, e.g. `2024`. */
  year: number;
  /** Month, 1-12 (1 = January). */
  month: number;
  /** Day of month, 1-31. */
  day: number;
  /** Hour, 0-23. Defaults to `0` when omitted. */
  hour?: number;
  /** Minute, 0-59. Defaults to `0` when omitted. */
  minute?: number;
  /** Second, 0-59. Defaults to `0` when omitted. */
  second?: number;
}

/** Options controlling time-zone-dependent directives. */
export interface StrftimeOptions {
  /**
   * UTC offset in minutes used to render the `%z` and `%Z` directives. Positive
   * is east of UTC (e.g. `330` for `+05:30`). Defaults to `0` (UTC).
   */
  offsetMinutes?: number;
}

/** One rendered directive, for building a token legend / explanation table. */
export interface StrftimeLegendEntry {
  /** The matched directive token, e.g. `'%Y'`. */
  token: string;
  /** The string this directive produced for the given datetime. */
  produced: string;
  /** A human-readable description of the directive. */
  desc: string;
}

/** Result of {@link formatStrftime}. */
export interface StrftimeResult {
  /** The fully rendered output string. */
  output: string;
  /** One entry per directive encountered, in order of appearance. */
  legend: StrftimeLegendEntry[];
}

// Validate a single numeric component, throwing on non-finite / non-integer.
function requireInt(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer.`);
  }
  return value;
}

/**
 * Applies a C/Python `strftime` format string to a wall-clock datetime and
 * returns the rendered output plus a per-directive legend.
 *
 * The supplied components are interpreted as a UTC instant (matching the
 * playground UI's deterministic, offline behavior), so the output does not
 * depend on the host time zone. The `%z` and `%Z` directives are rendered from
 * `options.offsetMinutes` instead. Unknown directives (e.g. `%Q`) are kept
 * literally as `%Q`; a trailing bare `%` is emitted as a literal `%` and does
 * not add a legend entry.
 *
 * Supported directives: `%Y %y %m %d %e %H %I %M %S %p %a %A %b %B %j %w %u %U
 * %W %Z %z %%`.
 *
 * @param pattern - The strftime format string (e.g. `'%Y-%m-%d %H:%M:%S'`).
 * @param parts - The datetime components to format. `hour`/`minute`/`second`
 *   default to `0`.
 * @param options - Optional settings; `offsetMinutes` drives `%z` / `%Z`.
 * @returns The rendered `output` string and a `legend` of matched directives.
 * @throws {TypeError} If any provided component is not a finite number.
 * @throws {RangeError} If any provided component is not an integer.
 *
 * @example
 * ```ts
 * import { formatStrftime } from '@open-utility-tools/core/time/strftime-playground';
 *
 * formatStrftime('%A, %B %d, %Y at %I:%M %p', {
 *   year: 2024, month: 3, day: 15, hour: 14, minute: 30, second: 45,
 * }).output;
 * // → 'Friday, March 15, 2024 at 02:30 PM'
 *
 * formatStrftime('%Y %z %Z', { year: 2023, month: 12, day: 31 }, {
 *   offsetMinutes: 330,
 * }).output;
 * // → '2023 +0530 UTC+05:30'
 * ```
 */
export function formatStrftime(
  pattern: string,
  parts: DateTimeParts,
  options: StrftimeOptions = {},
): StrftimeResult {
  if (typeof pattern !== 'string') {
    throw new TypeError('pattern must be a string.');
  }

  const year = requireInt(parts.year, 'year');
  const month = requireInt(parts.month, 'month');
  const day = requireInt(parts.day, 'day');
  const hour = requireInt(parts.hour ?? 0, 'hour');
  const minute = requireInt(parts.minute ?? 0, 'minute');
  const second = requireInt(parts.second ?? 0, 'second');
  const offsetMinutes = requireInt(options.offsetMinutes ?? 0, 'offsetMinutes');

  // Interpret the wall-clock components as a UTC instant for deterministic output.
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  const dow = date.getUTCDay();
  const monthIndex = date.getUTCMonth();
  const hours24 = date.getUTCHours();
  const hours12raw = hours24 % 12;
  const hours12 = hours12raw === 0 ? 12 : hours12raw;
  const legend: StrftimeLegendEntry[] = [];

  const directive = (ch: string): string => {
    switch (ch) {
      case 'Y':
        return pad(date.getUTCFullYear(), 4);
      case 'y':
        return pad(date.getUTCFullYear() % 100, 2);
      case 'm':
        return pad(monthIndex + 1, 2);
      case 'd':
        return pad(date.getUTCDate(), 2);
      case 'e':
        return pad(date.getUTCDate(), 2, ' ');
      case 'H':
        return pad(hours24, 2);
      case 'I':
        return pad(hours12, 2);
      case 'M':
        return pad(date.getUTCMinutes(), 2);
      case 'S':
        return pad(date.getUTCSeconds(), 2);
      case 'p':
        return hours24 < 12 ? 'AM' : 'PM';
      case 'a':
        return WEEKDAY_ABBR[dow] ?? '';
      case 'A':
        return WEEKDAY_FULL[dow] ?? '';
      case 'b':
        return MONTH_ABBR[monthIndex] ?? '';
      case 'B':
        return MONTH_FULL[monthIndex] ?? '';
      case 'j':
        return pad(dayOfYear(date), 3);
      case 'w':
        return String(dow);
      case 'u':
        return String(dow === 0 ? 7 : dow);
      case 'U':
        return pad(weekOfYear(date, false), 2);
      case 'W':
        return pad(weekOfYear(date, true), 2);
      case 'Z':
        return `UTC${offsetString(offsetMinutes, true)}`;
      case 'z':
        return offsetString(offsetMinutes, false);
      case '%':
        return '%';
      default:
        return `%${ch}`;
    }
  };

  let output = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '%') {
      const next = pattern[i + 1];
      if (next === undefined) {
        output += '%';
        break;
      }
      const produced = directive(next);
      output += produced;
      const desc = DIRECTIVE_DESC[next] ?? `Unknown directive %${next} (kept literally)`;
      legend.push({ token: `%${next}`, produced, desc });
      i++;
    } else {
      output += ch ?? '';
    }
  }

  return { output, legend };
}
