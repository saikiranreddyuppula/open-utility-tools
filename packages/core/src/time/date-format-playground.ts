/**
 * Unicode Date Pattern Playground — core transform.
 *
 * Renders a datetime either through an `Intl.DateTimeFormat` preset
 * (`dateStyle` / `timeStyle`) or through a small LDML-style token pattern that
 * uses `Intl` parts for locale-aware month/weekday names. Lifted verbatim from
 * the app's UI so outputs match exactly.
 *
 * @module time/date-format-playground
 */

/** Which rendering strategy to use. */
export type FormatMode = 'preset' | 'ldml';

/** The four `Intl.DateTimeFormat` preset widths. */
export type DateStyle = 'full' | 'long' | 'medium' | 'short';

/** Options for `Intl.DateTimeFormat` preset rendering. */
export interface PresetFormatOptions {
  mode: 'preset';
  dateStyle: DateStyle;
  timeStyle: DateStyle;
}

/** Options for LDML token-pattern rendering. */
export interface LdmlFormatOptions {
  mode: 'ldml';
  /** LDML-ish pattern, e.g. `EEEE, dd MMM yyyy HH:mm:ss`. Quote literals with `'…'`. */
  pattern: string;
}

/** Discriminated union of supported render modes. */
export type DateFormatOptions = PresetFormatOptions | LdmlFormatOptions;

/** Result of formatting: the rendered string plus a human-readable summary. */
export interface DateFormatResult {
  /** The formatted datetime string. */
  output: string;
  /** A summary of the resolved locale/options used to produce `output`. */
  resolved: string;
}

/** Left-pad the absolute value of `n` with zeros to width `w`. */
function pad(n: number, w = 2): string {
  return Math.abs(n).toString().padStart(w, '0');
}

/**
 * Render an LDML-ish `pattern` for `date` using `locale` for the locale-aware
 * name tokens (`MMMM`, `MMM`, `EEEE`, `EEE`). Longer tokens are matched before
 * shorter ones; text inside single quotes is emitted literally (and `''`
 * produces a single quote). Numeric tokens use the date's local-time fields.
 */
function renderLdml(pattern: string, date: Date, locale: string): string {
  const lookup = (opts: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat(locale, opts).format(date);
    } catch {
      return '';
    }
  };
  const tokens: { tok: string; fn: () => string }[] = [
    { tok: 'yyyy', fn: () => pad(date.getFullYear(), 4) },
    { tok: 'yy', fn: () => pad(date.getFullYear() % 100) },
    { tok: 'MMMM', fn: () => lookup({ month: 'long' }) },
    { tok: 'MMM', fn: () => lookup({ month: 'short' }) },
    { tok: 'MM', fn: () => pad(date.getMonth() + 1) },
    { tok: 'M', fn: () => (date.getMonth() + 1).toString() },
    { tok: 'dd', fn: () => pad(date.getDate()) },
    { tok: 'd', fn: () => date.getDate().toString() },
    { tok: 'EEEE', fn: () => lookup({ weekday: 'long' }) },
    { tok: 'EEE', fn: () => lookup({ weekday: 'short' }) },
    { tok: 'HH', fn: () => pad(date.getHours()) },
    { tok: 'H', fn: () => date.getHours().toString() },
    { tok: 'hh', fn: () => pad(((date.getHours() + 11) % 12) + 1) },
    { tok: 'h', fn: () => (((date.getHours() + 11) % 12) + 1).toString() },
    { tok: 'mm', fn: () => pad(date.getMinutes()) },
    { tok: 'm', fn: () => date.getMinutes().toString() },
    { tok: 'ss', fn: () => pad(date.getSeconds()) },
    { tok: 's', fn: () => date.getSeconds().toString() },
    { tok: 'a', fn: () => (date.getHours() < 12 ? 'AM' : 'PM') },
  ];

  let out = '';
  let i = 0;
  while (i < pattern.length) {
    // literal text between single quotes
    if (pattern[i] === "'") {
      const end = pattern.indexOf("'", i + 1);
      if (end < 0) {
        out += pattern.slice(i + 1);
        break;
      }
      const lit = pattern.slice(i + 1, end);
      out += lit === '' ? "'" : lit;
      i = end + 1;
      continue;
    }
    let matched = false;
    for (const entry of tokens) {
      if (pattern.startsWith(entry.tok, i)) {
        out += entry.fn();
        i += entry.tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += pattern[i] ?? '';
      i++;
    }
  }
  return out;
}

/**
 * Format a datetime string in either `Intl` preset mode or LDML pattern mode.
 *
 * The `dateStr` is parsed with `Date.parse`. A string without a timezone offset
 * (e.g. `2026-06-02T14:30:45`) is interpreted in the host's local time, and all
 * field/format access also uses local time — so the rendered wall-clock values
 * are stable across timezones.
 *
 * In `preset` mode the result is `Intl.DateTimeFormat(locale, { dateStyle,
 * timeStyle }).format(date)`. In `ldml` mode the `pattern` is rendered token by
 * token (see {@link LdmlFormatOptions}).
 *
 * @param dateStr - A datetime string parseable by `Date.parse` (e.g. ISO 8601).
 * @param locale - A BCP-47 locale tag (e.g. `'en-US'`, `'de-DE'`).
 * @param options - Either a preset config or an LDML-pattern config.
 * @returns The formatted `output` plus a `resolved` summary of the options used.
 * @throws {RangeError} If `dateStr` is not a valid datetime, if the locale/options
 *   are rejected by `Intl.DateTimeFormat`, or (in `ldml` mode) if `pattern` is blank.
 * @example
 * formatDatePlayground('2026-06-02T14:30:45', 'en-US', {
 *   mode: 'ldml',
 *   pattern: 'EEEE, dd MMM yyyy HH:mm:ss',
 * });
 * // => { output: 'Tuesday, 02 Jun 2026 14:30:45',
 * //      resolved: 'locale=en-US, pattern="EEEE, dd MMM yyyy HH:mm:ss"' }
 */
export function formatDatePlayground(
  dateStr: string,
  locale: string,
  options: DateFormatOptions,
): DateFormatResult {
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Invalid datetime: ${JSON.stringify(dateStr)}`);
  }
  const date = new Date(ms);

  if (options.mode === 'preset') {
    const { dateStyle, timeStyle } = options;
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat(locale, { dateStyle, timeStyle });
    } catch (e) {
      throw new RangeError(e instanceof Error ? e.message : 'Formatting failed.');
    }
    const resolvedOpts = fmt.resolvedOptions();
    const resolved =
      `locale=${resolvedOpts.locale}, calendar=${resolvedOpts.calendar}, ` +
      `numberingSystem=${resolvedOpts.numberingSystem}, ` +
      `dateStyle=${dateStyle}, timeStyle=${timeStyle}`;
    return { output: fmt.format(date), resolved };
  }

  const { pattern } = options;
  if (!pattern.trim()) {
    throw new RangeError('Enter an LDML pattern (e.g. EEEE, dd MMM yyyy HH:mm).');
  }
  const output = renderLdml(pattern, date, locale);
  return { output, resolved: `locale=${locale}, pattern="${pattern}"` };
}