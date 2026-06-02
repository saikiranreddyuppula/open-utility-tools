/**
 * One row of the date-format token cheatsheet, mapping a single date/time
 * concept to its token spelling across the major formatting libraries.
 */
export interface DateFormatTokenRow {
  /** Human-readable concept, e.g. `"4-digit year"`. */
  concept: string;
  /** Rendered example for the sample instant ({@link DATE_FORMAT_TOKEN_SAMPLE}). */
  example: string;
  /** Moment.js / Day.js token. */
  moment: string;
  /** date-fns token. */
  datefns: string;
  /** C `strftime` directive. */
  strftime: string;
  /** Java `DateTimeFormatter` pattern letter(s). */
  java: string;
  /** Unicode LDML / CLDR pattern letter(s). */
  ldml: string;
}

/**
 * The reference instant the {@link DateFormatTokenRow.example} column is rendered against.
 */
export const DATE_FORMAT_TOKEN_SAMPLE = '2026-03-09, 17:05:09 (Mon), tz +05:30';

/**
 * The full date-format token cheatsheet. A `'—'` value means the concept has no
 * direct token in that library.
 */
export const DATE_FORMAT_TOKENS: readonly DateFormatTokenRow[] = [
  { concept: '4-digit year', example: '2026', moment: 'YYYY', datefns: 'yyyy', strftime: '%Y', java: 'yyyy', ldml: 'yyyy' },
  { concept: '2-digit year', example: '26', moment: 'YY', datefns: 'yy', strftime: '%y', java: 'yy', ldml: 'yy' },
  { concept: 'Month, zero-padded', example: '03', moment: 'MM', datefns: 'MM', strftime: '%m', java: 'MM', ldml: 'MM' },
  { concept: 'Month, no pad', example: '3', moment: 'M', datefns: 'M', strftime: '%-m', java: 'M', ldml: 'M' },
  { concept: 'Month full name', example: 'March', moment: 'MMMM', datefns: 'MMMM', strftime: '%B', java: 'MMMM', ldml: 'MMMM' },
  { concept: 'Month abbreviated', example: 'Mar', moment: 'MMM', datefns: 'MMM', strftime: '%b', java: 'MMM', ldml: 'MMM' },
  { concept: 'Day of month, padded', example: '09', moment: 'DD', datefns: 'dd', strftime: '%d', java: 'dd', ldml: 'dd' },
  { concept: 'Day of month, no pad', example: '9', moment: 'D', datefns: 'd', strftime: '%-d', java: 'd', ldml: 'd' },
  { concept: 'Day of year', example: '068', moment: 'DDDD', datefns: 'DDD', strftime: '%j', java: 'DDD', ldml: 'DDD' },
  { concept: 'Weekday full name', example: 'Monday', moment: 'dddd', datefns: 'EEEE', strftime: '%A', java: 'EEEE', ldml: 'EEEE' },
  { concept: 'Weekday abbreviated', example: 'Mon', moment: 'ddd', datefns: 'EEE', strftime: '%a', java: 'EEE', ldml: 'EEE' },
  { concept: 'Weekday number (0-6/1-7)', example: '1', moment: 'd / E', datefns: 'i', strftime: '%u', java: 'e', ldml: 'e' },
  { concept: 'Hour 24h, padded', example: '17', moment: 'HH', datefns: 'HH', strftime: '%H', java: 'HH', ldml: 'HH' },
  { concept: 'Hour 24h, no pad', example: '17', moment: 'H', datefns: 'H', strftime: '%-H', java: 'H', ldml: 'H' },
  { concept: 'Hour 12h, padded', example: '05', moment: 'hh', datefns: 'hh', strftime: '%I', java: 'hh', ldml: 'hh' },
  { concept: 'Hour 12h, no pad', example: '5', moment: 'h', datefns: 'h', strftime: '%-I', java: 'h', ldml: 'h' },
  { concept: 'Minute, padded', example: '05', moment: 'mm', datefns: 'mm', strftime: '%M', java: 'mm', ldml: 'mm' },
  { concept: 'Second, padded', example: '09', moment: 'ss', datefns: 'ss', strftime: '%S', java: 'ss', ldml: 'ss' },
  { concept: 'Milliseconds (3)', example: '042', moment: 'SSS', datefns: 'SSS', strftime: '%3N', java: 'SSS', ldml: 'SSS' },
  { concept: 'AM/PM uppercase', example: 'PM', moment: 'A', datefns: 'a', strftime: '%p', java: 'a', ldml: 'a' },
  { concept: 'am/pm lowercase', example: 'pm', moment: 'a', datefns: 'aaaa', strftime: '%P', java: '—', ldml: 'a' },
  { concept: 'Timezone offset ±HH:MM', example: '+05:30', moment: 'Z', datefns: 'xxx', strftime: '%:z', java: 'XXX', ldml: 'xxx' },
  { concept: 'Timezone offset ±HHMM', example: '+0530', moment: 'ZZ', datefns: 'xx', strftime: '%z', java: 'Z', ldml: 'Z' },
  { concept: 'Timezone name/abbr', example: 'IST', moment: 'z (plugin)', datefns: 'zzz', strftime: '%Z', java: 'zzz', ldml: 'zzz' },
  { concept: 'ISO week of year', example: '11', moment: 'W', datefns: 'I', strftime: '%V', java: 'w', ldml: 'w' },
  { concept: 'ISO week-numbering year', example: '2026', moment: 'GGGG', datefns: 'RRRR', strftime: '%G', java: 'YYYY', ldml: 'YYYY' },
  { concept: 'Quarter (1-4)', example: '1', moment: 'Q', datefns: 'Q', strftime: '—', java: 'Q', ldml: 'Q' },
  { concept: 'Unix timestamp (sec)', example: '1773327309', moment: 'X', datefns: 't', strftime: '%s', java: '—', ldml: '—' },
  { concept: 'Era (AD/BC)', example: 'AD', moment: '—', datefns: 'G', strftime: '—', java: 'G', ldml: 'G' },
  { concept: 'Ordinal day', example: '9th', moment: 'Do', datefns: 'do', strftime: '—', java: '—', ldml: '—' },
];

/**
 * Filters the date-format token cheatsheet by a free-text query.
 *
 * The query is trimmed and lower-cased, then matched as a case-insensitive
 * substring against the concatenation of every column in each row
 * (`concept`, `example`, `moment`, `datefns`, `strftime`, `java`, `ldml`).
 * An empty (or whitespace-only) query returns a copy of the entire table.
 * Matching mirrors the in-app table filter exactly, so e.g. searching `"EEE"`
 * also matches the full-name weekday row whose token is `"EEEE"`.
 *
 * @param query - Free-text filter such as `"year"`, `"%H"`, or `"EEE"`. Leading/trailing
 *   whitespace is ignored and matching is case-insensitive.
 * @returns A new array of {@link DateFormatTokenRow} whose any-column text contains
 *   the query; the full table (as a fresh array) when the query is empty.
 * @throws {TypeError} If `query` is not a string.
 *
 * @example
 * ```ts
 * searchDateFormatTokens('year').map((r) => r.concept);
 * // => ['4-digit year', '2-digit year', 'Day of year',
 * //     'ISO week of year', 'ISO week-numbering year']
 *
 * searchDateFormatTokens('%H');
 * // => [{ concept: 'Hour 24h, padded', ... }]
 *
 * searchDateFormatTokens('').length; // => 30 (full table)
 * ```
 */
export function searchDateFormatTokens(query: string): DateFormatTokenRow[] {
  if (typeof query !== 'string') {
    throw new TypeError('query must be a string');
  }
  const s = query.trim().toLowerCase();
  if (!s) return DATE_FORMAT_TOKENS.slice();
  return DATE_FORMAT_TOKENS.filter((d) =>
    `${d.concept} ${d.example} ${d.moment} ${d.datefns} ${d.strftime} ${d.java} ${d.ldml}`
      .toLowerCase()
      .includes(s),
  );
}
