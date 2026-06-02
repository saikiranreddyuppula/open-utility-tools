// Extracted from tools/time/duration-parser. Pure, isomorphic duration parsing.
// Algorithm lifted verbatim from the tool UI; behavior is identical, except
// invalid input throws instead of returning an {error} sentinel.

interface UnitDef {
  seconds: number;
  canonical: string;
}

/** Recognized unit spellings mapped to their second-value and canonical key. */
const UNITS: Record<string, UnitDef> = {
  w: { seconds: 604800, canonical: 'w' },
  week: { seconds: 604800, canonical: 'w' },
  weeks: { seconds: 604800, canonical: 'w' },
  d: { seconds: 86400, canonical: 'd' },
  day: { seconds: 86400, canonical: 'd' },
  days: { seconds: 86400, canonical: 'd' },
  h: { seconds: 3600, canonical: 'h' },
  hr: { seconds: 3600, canonical: 'h' },
  hrs: { seconds: 3600, canonical: 'h' },
  hour: { seconds: 3600, canonical: 'h' },
  hours: { seconds: 3600, canonical: 'h' },
  // 'm' is treated as minutes (the common convention for duration strings).
  m: { seconds: 60, canonical: 'm' },
  min: { seconds: 60, canonical: 'm' },
  mins: { seconds: 60, canonical: 'm' },
  minute: { seconds: 60, canonical: 'm' },
  minutes: { seconds: 60, canonical: 'm' },
  s: { seconds: 1, canonical: 's' },
  sec: { seconds: 1, canonical: 's' },
  secs: { seconds: 1, canonical: 's' },
  second: { seconds: 1, canonical: 's' },
  seconds: { seconds: 1, canonical: 's' },
  ms: { seconds: 0.001, canonical: 'ms' },
  msec: { seconds: 0.001, canonical: 'ms' },
  millisecond: { seconds: 0.001, canonical: 'ms' },
  milliseconds: { seconds: 0.001, canonical: 'ms' },
};

/** Units in descending magnitude, used to build the canonical normalized form. */
const CANON_ORDER: ReadonlyArray<{ key: string; seconds: number }> = [
  { key: 'w', seconds: 604800 },
  { key: 'd', seconds: 86400 },
  { key: 'h', seconds: 3600 },
  { key: 'm', seconds: 60 },
  { key: 's', seconds: 1 },
  { key: 'ms', seconds: 0.001 },
];

/** One recognized number+unit pair from the input. */
export interface DurationMatch {
  /** The matched substring, e.g. `"2 days"`. */
  raw: string;
  /** The number of seconds this pair contributes. */
  seconds: number;
}

/** The result of parsing a human duration string. */
export interface ParsedDuration {
  /** Total duration in seconds. */
  totalSeconds: number;
  /** Total duration in milliseconds (`totalSeconds * 1000`). */
  totalMs: number;
  /** Total duration in minutes (`totalSeconds / 60`). */
  totalMinutes: number;
  /** Total duration in hours (`totalSeconds / 3600`). */
  totalHours: number;
  /** Normalized form built from the total, e.g. `"1m 30s"`; `"0s"` when zero. */
  canonical: string;
  /** Each recognized number+unit pair, in input order. */
  matched: DurationMatch[];
  /** Tokens that could not be interpreted as a number+unit pair. */
  unknown: string[];
}

/**
 * Parses a human-readable duration string (e.g. `"1h30m"`, `"2 days 4 hours"`,
 * `"90s"`) into its total magnitude across several units plus a normalized
 * canonical form. Unrecognized tokens are collected in `unknown` and ignored,
 * matching the behavior of the source tool. The unit `m` is interpreted as
 * minutes. Pure and isomorphic — no DOM; runs in the browser, Node, and Bun.
 *
 * @param input - The duration string to parse, e.g. `"1h 30m 15s"`.
 * @returns The total duration in seconds/ms/minutes/hours, a canonical
 *   normalized string, the matched pairs, and any ignored unknown tokens.
 * @throws {TypeError} If `input` is not a string.
 * @throws {RangeError} If `input` is empty/blank, or contains no recognizable
 *   number+unit pairs.
 *
 * @example
 * ```ts
 * import { parseDuration } from '@open-utility-tools/core/time/duration-parser';
 *
 * const r = parseDuration('1h 30m 15s');
 * r.totalSeconds; // → 5415
 * r.totalMs;      // → 5415000
 * r.canonical;    // → '1h 30m 15s'
 *
 * parseDuration('90s').canonical;            // → '1m 30s'
 * parseDuration('2 weeks foo 3d').unknown;   // → ['foo']
 * ```
 */
export function parseDuration(input: string): ParsedDuration {
  if (typeof input !== 'string') {
    throw new TypeError(`Expected a duration string, received ${typeof input}.`);
  }

  const text = input.trim();
  if (!text) {
    throw new RangeError('Enter a duration string, e.g. "1h30m" or "2 days 4 hours".');
  }

  // Match a number (with optional decimal) followed by an alphabetic unit.
  const tokenRe = /([0-9]*\.?[0-9]+)\s*([a-zA-Z]+)/g;
  let totalSeconds = 0;
  const matched: DurationMatch[] = [];
  const unknown: string[] = [];

  let m: RegExpExecArray | null = tokenRe.exec(text);
  while (m !== null) {
    const numStr = m[1] ?? '';
    const unitStr = (m[2] ?? '').toLowerCase();
    const num = Number(numStr);
    const def = UNITS[unitStr];
    if (def !== undefined && Number.isFinite(num)) {
      const secs = num * def.seconds;
      totalSeconds += secs;
      matched.push({ raw: m[0] ?? '', seconds: secs });
    } else {
      unknown.push(m[0] ?? unitStr);
    }
    m = tokenRe.exec(text);
  }

  // Find stray tokens that are not number+unit pairs (e.g. lone words).
  const leftover = text.replace(tokenRe, ' ').trim();
  if (leftover) {
    for (const piece of leftover.split(/\s+/)) {
      if (piece && !/^[,;:.\-+]+$/.test(piece)) unknown.push(piece);
    }
  }

  if (matched.length === 0) {
    throw new RangeError(
      'No recognizable number+unit pairs found. Use units like w, d, h, m, s, ms.',
    );
  }

  // Build the canonical normalized form from the total, working in integer ms.
  let remainder = Math.round(totalSeconds * 1000);
  const parts: string[] = [];
  for (const { key, seconds } of CANON_ORDER) {
    const unitMs = seconds * 1000;
    if (unitMs < 1) {
      // ms unit: take whatever is left.
      if (remainder > 0) parts.push(`${remainder}${key}`);
      remainder = 0;
      break;
    }
    const count = Math.floor(remainder / unitMs);
    if (count > 0) {
      parts.push(`${count}${key}`);
      remainder -= count * unitMs;
    }
  }
  const canonical = parts.length > 0 ? parts.join(' ') : '0s';

  return {
    totalSeconds,
    totalMs: totalSeconds * 1000,
    totalMinutes: totalSeconds / 60,
    totalHours: totalSeconds / 3600,
    canonical,
    matched,
    unknown,
  };
}