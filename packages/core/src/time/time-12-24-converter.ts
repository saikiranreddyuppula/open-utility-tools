/**
 * 12 / 24 Hour Time Converter — isomorphic core.
 *
 * Parses a single clock time written in either 12-hour AM/PM form
 * (e.g. `2:30 PM`, `12:00 am`) or 24-hour form (e.g. `14:30`, `09:05:45`)
 * and reformats it into both 24-hour and 12-hour strings.
 *
 * The parsing/formatting algorithm is lifted verbatim from the UI tool so
 * outputs are identical: AM/PM is detected case-insensitively (e.g. `am`,
 * `PM`); hours/minutes/seconds must be integers; minutes and seconds must be
 * 0–59; 12-hour hours must be 1–12; 24-hour hours must be 0–23. Note the
 * meridiem matcher does not accept the fully-dotted `a.m.` / `p.m.` form;
 * only `am`/`pm` (and the partial `a.m`/`p.m`) are recognized.
 */

/** A time normalized to a 24-hour clock. */
export interface ParsedTime {
  /** Hour on a 24-hour clock, 0–23. */
  h: number;
  /** Minutes, 0–59. */
  m: number;
  /** Seconds, 0–59. */
  s: number;
}

/** Options controlling how a converted time is rendered. */
export interface ConvertTimeOptions {
  /**
   * Zero-pad the 24-hour clock's hour to two digits (e.g. `09:00` vs `9:00`).
   * Only affects the 24-hour output. Defaults to `true`.
   */
  padHour?: boolean;
  /**
   * Include seconds in both outputs (e.g. `14:30:00`). When `false`, seconds
   * are dropped from the rendered strings even if present in the input.
   * Defaults to `false`.
   */
  showSeconds?: boolean;
}

/** Result of converting a single time string. */
export interface ConvertTimeResult {
  /** The trimmed input that was parsed. */
  input: string;
  /** The time formatted on a 24-hour clock (e.g. `14:30`). */
  hour24: string;
  /** The time formatted on a 12-hour clock with meridiem (e.g. `2:30 PM`). */
  hour12: string;
  /** Hour on a 24-hour clock, 0–23. */
  h: number;
  /** Minutes, 0–59. */
  m: number;
  /** Seconds, 0–59. */
  s: number;
}

/** One row of a bulk conversion: either a successful result or an error marker. */
export interface ConvertTimeRow {
  /** The trimmed input for this line. */
  input: string;
  /** Whether the line parsed successfully. */
  ok: boolean;
  /** 24-hour output, or `'—'` when the line is invalid. */
  hour24: string;
  /** 12-hour output, or `'invalid'` when the line is invalid. */
  hour12: string;
}

/**
 * Parse a single time line in either 12-hour or 24-hour format into a
 * 24-hour {@link ParsedTime}. Returns `null` when the line is empty or
 * does not represent a valid time.
 */
function parseTimeInternal(line: string): ParsedTime | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const ampmMatch = trimmed.match(/\b([AaPp])\.?[Mm]\.?\b/);
  const matched = ampmMatch?.[1];
  const meridiem = matched ? matched.toUpperCase() : null;
  const timePart = trimmed.replace(/\b[AaPp]\.?[Mm]\.?\b/, '').trim();
  const segs = timePart.split(':');
  if (segs.length < 1 || segs.length > 3) return null;
  const seg0 = segs[0];
  if (seg0 === undefined) return null;
  const hRaw = Number(seg0);
  const mRaw = segs[1] === undefined ? 0 : Number(segs[1]);
  const sRaw = segs[2] === undefined ? 0 : Number(segs[2]);
  if (!Number.isInteger(hRaw) || !Number.isInteger(mRaw) || !Number.isInteger(sRaw)) {
    return null;
  }
  if (mRaw < 0 || mRaw > 59 || sRaw < 0 || sRaw > 59) return null;

  let h = hRaw;
  if (meridiem) {
    if (hRaw < 1 || hRaw > 12) return null;
    if (meridiem === 'A') {
      h = hRaw === 12 ? 0 : hRaw;
    } else {
      h = hRaw === 12 ? 12 : hRaw + 12;
    }
  } else {
    if (hRaw < 0 || hRaw > 23) return null;
  }
  return { h, m: mRaw, s: sRaw };
}

function pad(n: number, width: number, on: boolean): string {
  return on ? n.toString().padStart(width, '0') : n.toString();
}

function format24(p: ParsedTime, padHour: boolean, showSec: boolean): string {
  const base = `${pad(p.h, 2, padHour)}:${p.m.toString().padStart(2, '0')}`;
  return showSec ? `${base}:${p.s.toString().padStart(2, '0')}` : base;
}

function format12(p: ParsedTime, showSec: boolean): string {
  const meridiem = p.h < 12 ? 'AM' : 'PM';
  let h12 = p.h % 12;
  if (h12 === 0) h12 = 12;
  const base = `${h12}:${p.m.toString().padStart(2, '0')}`;
  const full = showSec ? `${base}:${p.s.toString().padStart(2, '0')}` : base;
  return `${full} ${meridiem}`;
}

/**
 * Convert a single clock time string into both 24-hour and 12-hour formats.
 *
 * Accepts 12-hour input with an AM/PM meridiem (case-insensitive, e.g.
 * `2:30 PM`, `12:00 am`) or 24-hour input (e.g. `14:30`, `09:05:45`). The
 * hour segment is required; minutes and seconds are optional and default to
 * `0`. The fully-dotted `a.m.` / `p.m.` form is not recognized.
 *
 * @param input - A single time string. Surrounding whitespace is trimmed.
 * @param options - Formatting options; see {@link ConvertTimeOptions}.
 * @returns A {@link ConvertTimeResult} with the normalized fields and both
 *   rendered strings.
 * @throws {RangeError} If `input` is empty or is not a recognizable time
 *   (out-of-range hours/minutes/seconds, non-integer parts, an invalid
 *   12-hour hour, or more than three colon-separated segments).
 * @example
 * convertTime('2:30 PM');
 * // => { input: '2:30 PM', hour24: '14:30', hour12: '2:30 PM', h: 14, m: 30, s: 0 }
 *
 * convertTime('09:05:45', { showSeconds: true });
 * // => { input: '09:05:45', hour24: '09:05:45', hour12: '9:05:45 AM', h: 9, m: 5, s: 45 }
 */
export function convertTime(
  input: string,
  options: ConvertTimeOptions = {},
): ConvertTimeResult {
  const padHour = options.padHour ?? true;
  const showSeconds = options.showSeconds ?? false;
  const parsed = parseTimeInternal(input);
  if (!parsed) {
    throw new RangeError(`Unrecognized time format: "${input.trim()}"`);
  }
  return {
    input: input.trim(),
    hour24: format24(parsed, padHour, showSeconds),
    hour12: format12(parsed, showSeconds),
    h: parsed.h,
    m: parsed.m,
    s: parsed.s,
  };
}

/**
 * Convert many newline-separated time strings at once. Blank lines are
 * skipped. Unlike {@link convertTime}, lines that fail to parse do not throw:
 * they are returned as rows with `ok: false`, `hour24: '—'` and
 * `hour12: 'invalid'`, mirroring the bulk UI behaviour.
 *
 * @param text - Newline-separated time strings.
 * @param options - Formatting options applied to every line.
 * @returns One {@link ConvertTimeRow} per non-blank input line, in order.
 * @example
 * convertTimes('2:30 PM\nnope\n14:30');
 * // => [
 * //   { input: '2:30 PM', ok: true,  hour24: '14:30', hour12: '2:30 PM' },
 * //   { input: 'nope',    ok: false, hour24: '—',     hour12: 'invalid' },
 * //   { input: '14:30',   ok: true,  hour24: '14:30', hour12: '2:30 PM' },
 * // ]
 */
export function convertTimes(
  text: string,
  options: ConvertTimeOptions = {},
): ConvertTimeRow[] {
  return text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((line): ConvertTimeRow => {
      try {
        const r = convertTime(line, options);
        return { input: r.input, ok: true, hour24: r.hour24, hour12: r.hour12 };
      } catch {
        return { input: line.trim(), ok: false, hour24: '—', hour12: 'invalid' };
      }
    });
}
