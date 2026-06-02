/**
 * Relative Time Formatter — isomorphic core.
 *
 * Turns a timestamp or date into human-friendly relative phrasing like
 * "3 hours ago" or "in 2 days", across locales, using Intl.RelativeTimeFormat.
 *
 * Pure TypeScript: no React, no DOM, no Web APIs beyond Date/Intl/Math.
 */

/** Presentation width passed through to {@link Intl.RelativeTimeFormat}. */
export type RelativeTimeStyle = 'long' | 'short' | 'narrow';

/** Options controlling locale, style, and the reference "now" instant. */
export interface FormatRelativeTimeOptions {
  /** BCP 47 locale tag, e.g. "en", "fr", "ja". Defaults to "en". */
  locale?: string;
  /** Width of the formatted phrase. Defaults to "long". */
  style?: RelativeTimeStyle;
  /**
   * Reference instant in epoch milliseconds that the input is compared
   * against. Defaults to `Date.now()`. Pass an explicit value for
   * deterministic output.
   */
  now?: number;
}

/** Structured result describing the parsed date and its relative phrasing. */
export interface RelativeTimeResult {
  /** The locale-formatted relative phrase, e.g. "3 hours ago". */
  phrase: string;
  /** The parsed date. */
  date: Date;
  /** ISO 8601 string of the parsed date. */
  iso: string;
  /** Locale-formatted local date-time string of the parsed date. */
  localTime: string;
  /** Parsed date as whole unix seconds (floored). */
  unixSeconds: number;
  /** Signed magnitude in the chosen unit (negative = past, positive = future). */
  value: number;
  /** The time unit chosen for the phrase. */
  unit: Intl.RelativeTimeFormatUnit;
  /** Whether the parsed date is in the future or past relative to `now`. */
  direction: 'future' | 'past';
  /** Multi-line human-readable summary (phrase plus diagnostic detail lines). */
  text: string;
}

/** Unit thresholds, largest first, matching the original UI implementation. */
const UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

/**
 * Parse a raw string into a Date.
 *
 * A pure integer is treated as a unix timestamp: up to 10 digits (ignoring a
 * leading minus) is interpreted as seconds, otherwise as milliseconds. Any
 * other string is handed to the `Date` constructor.
 *
 * @returns the parsed Date, or `null` if the string is empty or unparseable.
 */
function parseInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pure integer: treat as unix timestamp. 10 digits = seconds, 13 = ms.
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    const ms = trimmed.replace('-', '').length <= 10 ? n * 1000 : n;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a timestamp or date string as locale-aware relative time.
 *
 * Accepts an ISO 8601 date string (e.g. `2024-01-15T10:30:00Z`) or a unix
 * timestamp (10 or fewer digits = seconds, more = milliseconds). The largest
 * unit whose threshold the absolute difference meets is chosen, the signed
 * value is rounded, and the result is rendered with
 * {@link Intl.RelativeTimeFormat} using `numeric: 'auto'`.
 *
 * @param input - ISO date string or unix timestamp to describe.
 * @param options - Locale, style, and the reference `now` instant.
 * @returns A {@link RelativeTimeResult} with the phrase plus parsed details.
 * @throws {RangeError} If `input` is empty/blank, cannot be parsed as a date,
 *   or `options.locale` is not a valid BCP 47 tag.
 *
 * @example
 * ```ts
 * formatRelativeTime('2024-01-15T10:30:00Z', {
 *   locale: 'en',
 *   style: 'long',
 *   now: Date.UTC(2024, 0, 15, 13, 30, 0),
 * }).phrase;
 * // => '3 hours ago'
 * ```
 */
export function formatRelativeTime(
  input: string,
  options: FormatRelativeTimeOptions = {}
): RelativeTimeResult {
  const locale = options.locale ?? 'en';
  const style: RelativeTimeStyle = options.style ?? 'long';
  const now = options.now ?? Date.now();

  if (!input.trim()) {
    throw new RangeError('Input is empty. Provide an ISO date or a unix timestamp.');
  }

  const date = parseInput(input);
  if (!date) {
    throw new RangeError(
      'Could not parse the date. Try an ISO date (2024-01-15T10:30:00Z) or a unix timestamp.'
    );
  }

  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(locale || 'en', { numeric: 'auto', style });
  } catch {
    throw new RangeError(`Invalid locale: "${locale}". Try "en", "fr", "es", "de", "ja".`);
  }

  const diffSeconds = (date.getTime() - now) / 1000;
  const absSeconds = Math.abs(diffSeconds);

  const fallback = UNITS[UNITS.length - 1];
  let chosen: { unit: Intl.RelativeTimeFormatUnit; seconds: number } =
    fallback ?? { unit: 'second', seconds: 1 };
  for (const u of UNITS) {
    if (absSeconds >= u.seconds) {
      chosen = u;
      break;
    }
  }

  const value = Math.round(diffSeconds / chosen.seconds);
  const phrase = rtf.format(value, chosen.unit);
  const direction: 'future' | 'past' = diffSeconds >= 0 ? 'future' : 'past';
  const iso = date.toISOString();
  const localTime = date.toLocaleString(locale || 'en');
  const unixSeconds = Math.floor(date.getTime() / 1000);

  const text = [
    phrase,
    '',
    `Parsed date: ${iso}`,
    `Local time:  ${localTime}`,
    `Unix (s):    ${unixSeconds}`,
    `Difference:  ${value} ${chosen.unit}${Math.abs(value) === 1 ? '' : 's'} (${direction})`,
  ].join('\n');

  return {
    phrase,
    date,
    iso,
    localTime,
    unixSeconds,
    value,
    unit: chosen.unit,
    direction,
    text,
  };
}