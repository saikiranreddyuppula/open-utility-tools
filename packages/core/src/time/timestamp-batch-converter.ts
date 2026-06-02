// Extracted from tools/time/timestamp-batch-converter. Pure, isomorphic batch
// timestamp <-> date conversion. No React, no DOM — runs in the browser, Node,
// and Bun. The per-line algorithm (unit auto-detection, the `->` rendering, and
// the blank-line passthrough) is lifted verbatim from the tool's UI so the
// output text is byte-for-byte identical to what the app produces.

/** Conversion direction: timestamps -> dates, or dates -> timestamps. */
export type ConversionDirection = 'toDate' | 'toTimestamp';

/**
 * How to interpret a numeric timestamp when converting `toDate`. `'auto'`
 * treats a magnitude `>= 1e12` as milliseconds and everything else as seconds.
 */
export type TimestampUnit = 'auto' | 's' | 'ms';

/** Time zone used to render dates when converting `toDate`. */
export type OutputZone = 'utc' | 'local';

/** Options for {@link convertTimestampBatch}. */
export interface TimestampBatchOptions {
  /** Conversion direction. Default `'toDate'`. */
  direction?: ConversionDirection;
  /**
   * Source unit for numeric timestamps (only used when `direction` is
   * `'toDate'`). Default `'auto'`.
   */
  unit?: TimestampUnit;
  /**
   * Output zone for rendered dates (only used when `direction` is `'toDate'`).
   * `'local'` output is host-time-zone dependent. Default `'utc'`.
   */
  zone?: OutputZone;
}

/** One converted line of input. */
export interface TimestampBatchLine {
  /** The trimmed source line. Empty string for blank lines. */
  input: string;
  /**
   * The rendered value (a date string, or `s | ms` pair), or one of the
   * sentinel strings `'[unparseable]'`, `'[out of range]'`,
   * `'[unparseable date]'` on failure. `null` for blank lines.
   */
  output: string | null;
  /** `true` when the source line was empty (passed through untouched). */
  blank: boolean;
  /** `true` when the line converted successfully. Blank lines are `false`. */
  ok: boolean;
}

/** Result of {@link convertTimestampBatch}. */
export interface TimestampBatchResult {
  /** One entry per input line, in order. Empty when `input` is blank. */
  lines: TimestampBatchLine[];
  /**
   * The full rendered text, exactly as the tool's UI emits it: each non-blank
   * line is `"<input>  ->  <output>"`, blank lines are preserved, and lines are
   * joined with `'\n'`. Empty string when `input` is blank.
   */
  text: string;
}

const DIRECTIONS = new Set<ConversionDirection>(['toDate', 'toTimestamp']);
const UNITS = new Set<TimestampUnit>(['auto', 's', 'ms']);
const ZONES = new Set<OutputZone>(['utc', 'local']);

function pad(n: number, w = 2): string {
  return Math.abs(n).toString().padStart(w, '0');
}

function isoUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  );
}

function isoLocal(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(offMin) / 60));
  const offM = pad(Math.abs(offMin) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

/**
 * Batch-converts a newline-separated list of Unix timestamps to human dates, or
 * a list of date strings back to epoch timestamps.
 *
 * When `direction` is `'toDate'`, each numeric line is interpreted using `unit`
 * (`'auto'` treats magnitude `>= 1e12` as milliseconds, otherwise seconds) and
 * rendered as an ISO-8601 string in the chosen `zone`. When `direction` is
 * `'toTimestamp'`, each line is parsed with `Date.parse` and rendered as
 * `"<seconds> s  |  <milliseconds> ms"`.
 *
 * Blank lines are preserved verbatim. Lines that fail to parse are rendered with
 * a bracketed sentinel (`[unparseable]`, `[out of range]`, or
 * `[unparseable date]`) instead of throwing, mirroring the tool's UI. The
 * structured `lines` array and the joined `text` describe the same result. A
 * fully blank `input` yields an empty result (`{ lines: [], text: '' }`).
 *
 * `'local'`-zone output depends on the host time zone and is therefore
 * environment-dependent; `'utc'` output is not.
 *
 * @param input - The raw multiline text to convert (one value per line).
 * @param options - Direction, source unit, and output zone. See
 *   {@link TimestampBatchOptions}.
 * @returns The per-line breakdown plus the joined rendered text. See
 *   {@link TimestampBatchResult}.
 * @throws {TypeError} If `input` is not a string.
 * @throws {RangeError} If `options.direction`, `options.unit`, or `options.zone`
 *   is not a recognized value.
 *
 * @example
 * ```ts
 * import { convertTimestampBatch } from '@open-utility-tools/core/time/timestamp-batch-converter';
 *
 * const { text } = convertTimestampBatch('1700000000\nnot-a-number', {
 *   direction: 'toDate',
 *   unit: 'auto',
 *   zone: 'utc',
 * });
 * // text === '1700000000  ->  2023-11-14T22:13:20Z\nnot-a-number  ->  [unparseable]'
 *
 * convertTimestampBatch('2021-01-01T00:00:00Z', { direction: 'toTimestamp' }).text;
 * // → '2021-01-01T00:00:00Z  ->  1609459200 s  |  1609459200000 ms'
 * ```
 */
export function convertTimestampBatch(
  input: string,
  options: TimestampBatchOptions = {},
): TimestampBatchResult {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string.');
  }

  const direction = options.direction ?? 'toDate';
  const unit = options.unit ?? 'auto';
  const zone = options.zone ?? 'utc';

  if (!DIRECTIONS.has(direction)) {
    throw new RangeError(
      `Unknown direction "${String(direction)}". Use "toDate" or "toTimestamp".`,
    );
  }
  if (!UNITS.has(unit)) {
    throw new RangeError(`Unknown unit "${String(unit)}". Use "auto", "s", or "ms".`);
  }
  if (!ZONES.has(zone)) {
    throw new RangeError(`Unknown zone "${String(zone)}". Use "utc" or "local".`);
  }

  if (!input.trim()) {
    return { lines: [], text: '' };
  }

  const rawLines = input.split('\n');
  const lines: TimestampBatchLine[] = [];
  const textParts: string[] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (line === '') {
      lines.push({ input: line, output: null, blank: true, ok: false });
      textParts.push('');
      continue;
    }

    if (direction === 'toDate') {
      const num = Number(line);
      if (!Number.isFinite(num)) {
        lines.push({ input: line, output: '[unparseable]', blank: false, ok: false });
        textParts.push(`${line}  ->  [unparseable]`);
        continue;
      }
      // Decide unit: auto treats >= 1e12 magnitude as milliseconds.
      let ms: number;
      if (unit === 's') ms = num * 1000;
      else if (unit === 'ms') ms = num;
      else ms = Math.abs(num) >= 1e12 ? num : num * 1000;

      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) {
        lines.push({ input: line, output: '[out of range]', blank: false, ok: false });
        textParts.push(`${line}  ->  [out of range]`);
        continue;
      }
      const rendered = zone === 'utc' ? isoUTC(d) : isoLocal(d);
      lines.push({ input: line, output: rendered, blank: false, ok: true });
      textParts.push(`${line}  ->  ${rendered}`);
    } else {
      // toTimestamp: parse a date string into epoch seconds + ms.
      const ms = Date.parse(line);
      if (Number.isNaN(ms)) {
        lines.push({ input: line, output: '[unparseable date]', blank: false, ok: false });
        textParts.push(`${line}  ->  [unparseable date]`);
        continue;
      }
      const secs = Math.floor(ms / 1000);
      const rendered = `${secs} s  |  ${ms} ms`;
      lines.push({ input: line, output: rendered, blank: false, ok: true });
      textParts.push(`${line}  ->  ${rendered}`);
    }
  }

  return { lines, text: textParts.join('\n') };
}
