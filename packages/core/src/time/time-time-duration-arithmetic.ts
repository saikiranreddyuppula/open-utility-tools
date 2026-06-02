// Extracted from tools/time/time-time-duration-arithmetic. Pure, isomorphic
// duration math lifted verbatim from the tool's UI. No React, DOM, or Web APIs.

/** Output rendering formats for a duration value. */
export type DurationOutputFormat = 'hms' | 'seconds' | 'decimal';

export interface DurationOptions {
  /** Allow a negative grand total. When `false`, a negative total is clamped to `0`. Default `true`. */
  allowNegative?: boolean;
  /** Round the grand total to the nearest whole minute. Default `false`. */
  roundToMinute?: boolean;
}

/** One row of the running tape, one per non-blank input line. */
export interface DurationTapeRow {
  /** The trimmed source line. */
  line: string;
  /** Signed seconds contributed by this line (`0` when `bad`). */
  seconds: number;
  /** Running total in seconds after applying this line. */
  running: number;
  /** `true` when the line could not be parsed (it is ignored in the totals). */
  bad: boolean;
}

export interface DurationArithmeticResult {
  /** Per-line breakdown, including unparseable lines (flagged `bad`). */
  tape: DurationTapeRow[];
  /** Final total in seconds after `roundToMinute` / `allowNegative` adjustments. */
  total: number;
  /** Alias of `total`, in seconds (matches the UI field name). */
  totalSeconds: number;
  /** The total expressed in decimal hours (`total / 3600`). */
  decimalHours: number;
}

/**
 * Parse a single signed duration line. Returns `null` on syntax error.
 *
 * Accepts an optional leading `+` / `-` sign, then one of:
 * - colon form `HH:MM:SS` or `MM:SS` (each part must be a finite, non-negative number),
 * - unit form `1h2m3s` (any subset; values may be fractional; stray characters reject the line),
 * - a bare number, interpreted as seconds.
 */
function parseLine(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  let sign = 1;
  if (text.startsWith('+')) {
    text = text.slice(1).trim();
  } else if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1).trim();
  }
  if (!text) return null;

  // Colon-separated form: HH:MM:SS or MM:SS (also H:MM).
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    const nums = parts.map((p) => Number(p));
    for (const n of nums) {
      if (!Number.isFinite(n) || n < 0) return null;
    }
    let h = 0;
    let m = 0;
    let s = 0;
    if (parts.length === 3) {
      h = nums[0] ?? 0;
      m = nums[1] ?? 0;
      s = nums[2] ?? 0;
    } else {
      m = nums[0] ?? 0;
      s = nums[1] ?? 0;
    }
    return sign * (h * 3600 + m * 60 + s);
  }

  // Unit form: 1h2m3s (any subset). Require at least one unit token.
  const unitRe = /(\d+(?:\.\d+)?)\s*([hms])/gi;
  let total = 0;
  let matchedAny = false;
  let consumed = 0;
  let mt: RegExpExecArray | null = unitRe.exec(text);
  while (mt !== null) {
    matchedAny = true;
    consumed += (mt[0] ?? '').replace(/\s+/g, '').length;
    const val = Number(mt[1] ?? '');
    const unit = (mt[2] ?? '').toLowerCase();
    if (!Number.isFinite(val)) return null;
    if (unit === 'h') total += val * 3600;
    else if (unit === 'm') total += val * 60;
    else total += val;
    mt = unitRe.exec(text);
  }

  if (matchedAny) {
    // Reject lines with stray non-unit characters (anything but the matched units).
    if (text.replace(/\s+/g, '').length !== consumed) return null;
    return sign * total;
  }

  // Bare number with no unit and no colon → treat as seconds.
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

/**
 * Render a signed duration in seconds as `HH:MM:SS` (with a leading `-` for
 * negatives). Sub-second remainders are kept on the seconds field, trimmed of
 * trailing zeros (e.g. `1.75` seconds renders as `00:00:1.75`).
 *
 * @param totalSeconds - Signed duration in seconds.
 * @returns The `HH:MM:SS` string.
 *
 * @example
 * ```ts
 * formatDurationHMS(12630); // → '03:30:30'
 * formatDurationHMS(-900);  // → '-00:15:00'
 * ```
 */
export function formatDurationHMS(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds * 1000) / 1000);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const secStr = frac > 0 ? (s + frac).toFixed(3).replace(/\.?0+$/, '') : String(s);
  const sPad = secStr.padStart(2, '0');
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sPad}`;
}

/**
 * Render a signed duration in seconds in the requested {@link DurationOutputFormat}:
 * `'hms'` → `HH:MM:SS`, `'seconds'` → `"<n> s"`, `'decimal'` → `"<h.hhhh> h"`.
 *
 * @param totalSeconds - Signed duration in seconds.
 * @param format - The output format.
 * @returns The formatted string.
 *
 * @example
 * ```ts
 * formatDurationValue(12630, 'seconds'); // → '12630 s'
 * formatDurationValue(12630, 'decimal'); // → '3.5083 h'
 * ```
 */
export function formatDurationValue(totalSeconds: number, format: DurationOutputFormat): string {
  if (format === 'seconds') return `${Math.round(totalSeconds * 1000) / 1000} s`;
  if (format === 'decimal') return `${(totalSeconds / 3600).toFixed(4)} h`;
  return formatDurationHMS(totalSeconds);
}

/**
 * Add and subtract a list of signed durations, producing a per-line running
 * tape and the grand total. Each non-blank line may be signed (`+` / `-`) and
 * written as `HH:MM:SS`, `MM:SS`, a unit form like `1h2m3s` (fractions allowed),
 * or a bare number (interpreted as seconds). Unparseable lines are preserved in
 * the tape with `bad: true` and excluded from the totals. Pure and isomorphic —
 * no DOM; runs in the browser, Node, and Bun.
 *
 * @param input - Newline-separated duration lines.
 * @param options - Total adjustments: `allowNegative` (default `true`) and
 *   `roundToMinute` (default `false`).
 * @returns The running tape plus the total in seconds and decimal hours.
 * @throws {TypeError} If `input` is not a string.
 * @throws {RangeError} If no line parses to a valid duration.
 *
 * @example
 * ```ts
 * import { computeDurationArithmetic, formatDurationHMS }
 *   from '@open-utility-tools/core/time/time-time-duration-arithmetic';
 *
 * const r = computeDurationArithmetic('+01:30:00\n+0:45:30\n-00:15:00\n+90m');
 * r.total;                         // → 12630
 * r.decimalHours;                  // → 3.5083333333333333
 * formatDurationHMS(r.total);      // → '03:30:30'
 * ```
 */
export function computeDurationArithmetic(
  input: string,
  options: DurationOptions = {},
): DurationArithmeticResult {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string of newline-separated durations');
  }
  const allowNegative = options.allowNegative ?? true;
  const roundToMinute = options.roundToMinute ?? false;

  const lines = input.split('\n');
  const tape: DurationTapeRow[] = [];
  let running = 0;
  let anyValue = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed === null) {
      tape.push({ line: line.trim(), seconds: 0, running, bad: true });
      continue;
    }
    anyValue = true;
    running += parsed;
    tape.push({ line: line.trim(), seconds: parsed, running, bad: false });
  }

  if (!anyValue) {
    throw new RangeError(
      'Enter at least one valid duration line (e.g. +01:30:00, -15m, 1h2m3s).',
    );
  }

  let total = running;
  if (roundToMinute) total = Math.round(total / 60) * 60;
  if (!allowNegative && total < 0) total = 0;

  return { tape, total, totalSeconds: total, decimalHours: total / 3600 };
}
