/**
 * Standard 5-field cron parsing: explain in plain English and compute next run times.
 *
 * Isomorphic (browser + Node 20 + Bun). No DOM, no React. Uses only `Date`, `Set`,
 * `Math`, and standard string/number APIs.
 */

const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day-of-month
  [1, 12], // month
  [0, 6], // day-of-week
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

/** A single parsed cron field: the original token plus the concrete set of matching values. */
export interface CronField {
  /** The set of integer values this field matches (e.g. minutes 0,15,30,45). */
  readonly values: Set<number>;
  /** The raw, unexpanded field token (e.g. the every-15 token, `"1-5"`, `"*"`). */
  readonly raw: string;
}

/**
 * Parse a 5-field cron expression (or a named alias like `@daily`) into its fields.
 *
 * @param expr - A standard 5-field cron string `minute hour day-of-month month day-of-week`,
 *   or a supported alias (`@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily`,
 *   `@midnight`, `@hourly`).
 * @returns An array of exactly 5 {@link CronField}s in field order.
 * @throws {RangeError} If the expression does not have exactly 5 fields, contains an invalid
 *   step, or has a value outside the allowed range for its field.
 * @throws {TypeError} If `expr` is not a string.
 *
 * @example
 * const fields = parseCron('0,15,30,45 9-17 * * 1-5');
 * fields[0].values; // Set { 0, 15, 30, 45 }
 * fields[1].values; // Set { 9, 10, ..., 17 }
 */
export function parseCron(expr: string): CronField[] {
  if (typeof expr !== 'string') {
    throw new TypeError('Cron expression must be a string');
  }
  const trimmed = expr.trim();
  const normalized = ALIASES[trimmed] ?? trimmed;
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) {
    throw new RangeError(`Expected 5 fields, got ${parts.length}. Example: "*/15 9-17 * * 1-5"`);
  }
  return parts.map((raw, i) => {
    const range = RANGES[i];
    if (range === undefined) {
      throw new RangeError(`Unexpected field index ${i}`);
    }
    return { raw, values: parseField(raw, range) };
  });
}

function parseField(raw: string, [min, max]: readonly [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    let step = 1;
    let range = part;
    if (part.includes('/')) {
      const segments = part.split('/');
      const r = segments[0];
      const s = segments[1];
      if (r === undefined || s === undefined) {
        throw new RangeError(`Invalid step in "${part}"`);
      }
      range = r;
      step = parseInt(s, 10);
      if (!step || step < 1) throw new RangeError(`Invalid step in "${part}"`);
    }
    let lo = min;
    let hi = max;
    if (range === '*' || range === '') {
      // full range
    } else if (range.includes('-')) {
      const bounds = range.split('-');
      const a = bounds[0];
      const b = bounds[1];
      lo = parseInt(a ?? '', 10);
      hi = parseInt(b ?? '', 10);
    } else {
      lo = hi = parseInt(range, 10);
    }
    if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) {
      throw new RangeError(`Field value "${part}" out of range ${min}-${max}`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/**
 * Describe a cron expression in plain English.
 *
 * @param expr - A standard 5-field cron string or supported alias (see {@link parseCron}).
 * @returns A human-readable description, e.g. `"at 09:00, on Mon, Tue, Wed, Thu, Fri"`.
 * @throws {RangeError} If the expression is malformed (see {@link parseCron}).
 * @throws {TypeError} If `expr` is not a string.
 *
 * @example
 * explainCron('0 9 * * 1-5'); // "at 09:00, on Mon, Tue, Wed, Thu, Fri"
 * explainCron('@daily');      // "at 00:00"
 */
export function explainCron(expr: string): string {
  const fields = parseCron(expr);
  const minute = fields[0];
  const hour = fields[1];
  const dom = fields[2];
  const month = fields[3];
  const dow = fields[4];
  if (minute === undefined || hour === undefined || dom === undefined || month === undefined || dow === undefined) {
    throw new RangeError('Expected 5 cron fields');
  }

  const describeField = (f: CronField, name: string, max: number): string => {
    if (f.raw === '*') return `every ${name}`;
    if (f.values.size === max + 1) return `every ${name}`;
    const vals = [...f.values].sort((a, b) => a - b);
    if (f.raw.includes('/')) {
      const step = f.raw.split('/')[1];
      return `every ${step} ${name}s`;
    }
    return `${name} ${vals.join(', ')}`;
  };

  const parts: string[] = [];
  // time
  if (minute.raw === '*' && hour.raw === '*') {
    parts.push('every minute');
  } else if (minute.values.size === 1 && hour.values.size === 1) {
    const h = [...hour.values][0];
    const m = [...minute.values][0];
    if (h === undefined || m === undefined) {
      throw new RangeError('Expected single hour and minute values');
    }
    parts.push(`at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  } else {
    parts.push(`at ${describeField(minute, 'minute', 59)}, ${describeField(hour, 'hour', 23)}`);
  }
  // day of month
  if (dom.raw !== '*') parts.push(`on day-of-month ${[...dom.values].join(', ')}`);
  // month
  if (month.raw !== '*') parts.push(`in ${[...month.values].map((m) => MONTHS[m - 1]).join(', ')}`);
  // day of week
  if (dow.raw !== '*') parts.push(`on ${[...dow.values].map((d) => DOW[d % 7]).join(', ')}`);

  return parts.join(', ');
}

/**
 * Compute the next run times for a cron expression, starting strictly after `from`.
 *
 * Matching uses the local timezone of the supplied/`new Date()` value. When both
 * day-of-month and day-of-week are restricted, a day matches if EITHER matches (standard
 * cron semantics).
 *
 * @param expr - A standard 5-field cron string or supported alias (see {@link parseCron}).
 * @param count - How many upcoming run times to return. Defaults to 5.
 * @param from - The reference time; results are strictly after this instant.
 *   Defaults to the current time. The reference is rounded down to the start of the minute
 *   and advanced by one minute before matching begins.
 * @returns An array of up to `count` `Date`s, in ascending order.
 * @throws {RangeError} If the expression is malformed (see {@link parseCron}).
 * @throws {TypeError} If `expr` is not a string.
 *
 * @example
 * // 2026-06-01 00:00 local is a Monday:
 * nextRuns('0 9 * * 1-5', 2, new Date(2026, 5, 1, 0, 0));
 * // → [ Mon 2026-06-01 09:00, Tue 2026-06-02 09:00 ] (local)
 */
export function nextRuns(expr: string, count = 5, from: Date = new Date()): Date[] {
  const fields = parseCron(expr);
  const minute = fields[0];
  const hour = fields[1];
  const dom = fields[2];
  const month = fields[3];
  const dow = fields[4];
  if (minute === undefined || hour === undefined || dom === undefined || month === undefined || dow === undefined) {
    throw new RangeError('Expected 5 cron fields');
  }
  const runs: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  let guard = 0;
  while (runs.length < count && guard < 500000) {
    guard++;
    if (
      minute.values.has(d.getMinutes()) &&
      hour.values.has(d.getHours()) &&
      month.values.has(d.getMonth() + 1) &&
      matchDay(d, dom, dow)
    ) {
      runs.push(new Date(d.getTime()));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return runs;
}

function matchDay(d: Date, dom: CronField, dow: CronField): boolean {
  const domStar = dom.raw === '*';
  const dowStar = dow.raw === '*';
  const domMatch = dom.values.has(d.getDate());
  const dowMatch = dow.values.has(d.getDay());
  // Cron semantics: if both restricted, match if EITHER matches.
  if (!domStar && !dowStar) return domMatch || dowMatch;
  if (!domStar) return domMatch;
  if (!dowStar) return dowMatch;
  return true;
}
