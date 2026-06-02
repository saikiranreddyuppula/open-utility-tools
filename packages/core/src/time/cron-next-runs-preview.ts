// Extracted from tools/time/cron-next-runs-preview. Pure, isomorphic cron-schedule
// preview. No React/JSX, no DOM — runs in the browser, Node 20+, and Bun.
//
// The algorithm matches the original UI exactly: it parses a 5-field cron
// expression, then steps a cursor minute-by-minute in "wall clock" space (the UTC
// accessors of a Date shifted by the supplied offset) until it has collected the
// requested number of matching runs, or exhausts a ~1-year safety bound.

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface FieldDef {
  min: number;
  max: number;
  names?: Record<string, number>;
}

function expandField(token: string, def: FieldDef): Set<number> {
  const out = new Set<number>();
  const resolve = (raw: string): number => {
    const upper = raw.toUpperCase();
    if (def.names && upper in def.names) {
      const v = def.names[upper];
      if (v === undefined) throw new RangeError(`Unknown name "${raw}"`);
      return v;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new RangeError(`Invalid value "${raw}"`);
    return n;
  };

  for (const rawPart of token.split(',')) {
    const part = rawPart.trim();
    if (part === '') throw new RangeError('Empty list item');
    if (part === '*' || part === '?') {
      for (let i = def.min; i <= def.max; i++) out.add(i);
      continue;
    }
    let base = part;
    let step = 1;
    const slash = part.indexOf('/');
    if (slash >= 0) {
      base = part.slice(0, slash);
      const s = Number(part.slice(slash + 1));
      if (!Number.isInteger(s) || s <= 0) throw new RangeError('Invalid step');
      step = s;
    }
    let lo: number;
    let hi: number;
    if (base === '*' || base === '') {
      lo = def.min;
      hi = def.max;
    } else if (base.includes('-')) {
      const dash = base.indexOf('-');
      lo = resolve(base.slice(0, dash));
      hi = resolve(base.slice(dash + 1));
    } else {
      lo = resolve(base);
      hi = slash >= 0 ? def.max : lo;
    }
    if (lo < def.min || lo > def.max || hi < def.min || hi > def.max) {
      throw new RangeError(`Value out of range (${def.min}-${def.max})`);
    }
    if (lo > hi) throw new RangeError('Range start greater than end');
    for (let i = lo; i <= hi; i += step) out.add(i);
  }
  return out;
}

interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

function parseCronExpression(expr: string): ParsedCron {
  const t = expr.trim().split(/\s+/).filter(Boolean);
  if (t.length !== 5) {
    throw new RangeError('Enter exactly 5 fields: minute hour day-of-month month day-of-week.');
  }
  const [m, h, dom, mon, dow] = t;
  if (m === undefined || h === undefined || dom === undefined || mon === undefined || dow === undefined) {
    throw new RangeError('Missing field.');
  }
  const parsed: ParsedCron = {
    minute: expandField(m, { min: 0, max: 59 }),
    hour: expandField(h, { min: 0, max: 23 }),
    dom: expandField(dom, { min: 1, max: 31 }),
    month: expandField(mon, { min: 1, max: 12, names: MONTHS }),
    dow: expandField(dow, { min: 0, max: 6, names: DOW_NAMES }),
    domRestricted: dom !== '*' && dom !== '?',
    dowRestricted: dow !== '*' && dow !== '?',
  };
  // Cron allows 7 as Sunday; fold it into 0.
  if (parsed.dow.has(7)) {
    parsed.dow.delete(7);
    parsed.dow.add(0);
  }
  return parsed;
}

function matches(d: Date, p: ParsedCron): boolean {
  if (!p.minute.has(d.getUTCMinutes())) return false;
  if (!p.hour.has(d.getUTCHours())) return false;
  if (!p.month.has(d.getUTCMonth() + 1)) return false;
  const domOk = p.dom.has(d.getUTCDate());
  const dowOk = p.dow.has(d.getUTCDay());
  // Standard cron: when both day-of-month and day-of-week are restricted, OR them;
  // otherwise AND with the unrestricted side passing.
  if (p.domRestricted && p.dowRestricted) return domOk || dowOk;
  if (p.domRestricted) return domOk;
  if (p.dowRestricted) return dowOk;
  return true;
}

function fmtGap(ms: number): string {
  if (ms <= 0) return '—';
  const totalMin = Math.round(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export interface CronNextRunsOptions {
  /**
   * Start instant to search from. A `Date`, or an ISO-8601 / `Date.parse`-able
   * string. Defaults to "now" (`Date.now()`). The first run returned is at or
   * after the next whole minute following this instant.
   */
  start?: string | Date;
  /** How many runs to return. Clamped to the range 1–100. Default `10`. */
  count?: number;
  /**
   * Timezone offset in minutes applied to the wall clock. The displayed
   * datetimes are interpreted at this offset (e.g. `330` for IST, UTC+5:30).
   * Default `0` (UTC).
   */
  offsetMinutes?: number;
}

export interface CronRun {
  /** Wall-clock datetime as `YYYY-MM-DD HH:MM` (at the requested offset). */
  datetime: string;
  /** Short weekday name of the run, e.g. `"Mon"`. */
  weekday: string;
  /** Gap from the previous run, e.g. `"1d"`, `"15m"`, `"2h 30m"`; `"—"` for the first run. */
  gap: string;
  /** Epoch milliseconds of the run in the shifted (wall-clock) space. */
  epochMs: number;
}

/**
 * Computes the next `count` execution datetimes for a 5-field cron expression
 * (`minute hour day-of-month month day-of-week`) starting from a chosen instant.
 * Supports `*`, `?`, ranges (`1-5`), lists (`1,15,30`), steps (`*​/15`, `0-30/10`),
 * and month/weekday names (`JAN`, `MON-FRI`). Day-of-week `7` is treated as Sunday.
 * When both day-of-month and day-of-week are restricted, a run matches if *either*
 * matches (standard cron OR semantics).
 *
 * Pure and isomorphic — no DOM, runs in the browser, Node, and Bun. The search is
 * bounded to roughly one year of minute-by-minute stepping.
 *
 * @param expression - A 5-field cron expression.
 * @param options - Start instant, run count (1–100), and timezone offset in minutes.
 * @returns An array of upcoming runs (datetime, weekday, gap, and epoch ms).
 * @throws {TypeError} If `expression` is not a string.
 * @throws {RangeError} If the expression is malformed or out of range, the start
 *   datetime is invalid, the offset/count is not finite, or no run is found within
 *   one year of the start time.
 *
 * @example
 * ```ts
 * import { cronNextRuns } from '@open-utility-tools/core/time/cron-next-runs-preview';
 * cronNextRuns('0 9 * * MON-FRI', { start: '2026-06-01T00:00:00Z', count: 2 });
 * // → [
 * //   { datetime: '2026-06-01 09:00', weekday: 'Mon', gap: '—',  epochMs: 1780304400000 },
 * //   { datetime: '2026-06-02 09:00', weekday: 'Tue', gap: '1d', epochMs: 1780390800000 },
 * // ]
 * ```
 */
export function cronNextRuns(
  expression: string,
  options: CronNextRunsOptions = {},
): CronRun[] {
  if (typeof expression !== 'string') {
    throw new TypeError('expression must be a string');
  }
  const parsed = parseCronExpression(expression);

  const { start, count = 10, offsetMinutes = 0 } = options;

  let startMs: number;
  if (start === undefined) {
    startMs = Date.now();
  } else if (start instanceof Date) {
    startMs = start.getTime();
  } else {
    startMs = Date.parse(start);
  }
  if (!Number.isFinite(startMs)) throw new RangeError('Enter a valid start datetime.');
  if (!Number.isFinite(offsetMinutes)) throw new RangeError('Enter a valid timezone offset (minutes).');
  if (!Number.isFinite(count)) throw new RangeError('count must be a finite number');

  const n = Math.max(1, Math.min(100, Math.floor(count)));

  // Work in "wall clock" space by shifting the UTC accessor to the target offset.
  // We treat the wall time = startMs + offset, step minute by minute on that wall clock.
  let cursorMs = startMs + offsetMinutes * 60000;
  // Round up to the next whole minute.
  cursorMs = Math.ceil(cursorMs / 60000) * 60000;

  const runs: CronRun[] = [];
  let prevMs: number | null = null;
  const limit = 366 * 24 * 60 + 10; // ~1 year of minutes safety bound
  let steps = 0;
  while (runs.length < n && steps < limit) {
    const wall = new Date(cursorMs);
    if (matches(wall, parsed)) {
      const gap = prevMs === null ? '—' : fmtGap(cursorMs - prevMs);
      runs.push({
        datetime: fmtDate(wall),
        weekday: WEEKDAY_NAMES[wall.getUTCDay()] ?? '',
        gap,
        epochMs: cursorMs,
      });
      prevMs = cursorMs;
    }
    cursorMs += 60000;
    steps++;
  }
  if (runs.length === 0) {
    throw new RangeError('No matching runs found within one year of the start time.');
  }
  return runs;
}