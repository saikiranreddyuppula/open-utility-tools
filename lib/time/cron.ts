/** Standard 5-field cron parsing: explain in English + compute next run times. */

const FIELD_NAMES = ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'];
const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface CronField {
  values: Set<number>;
  raw: string;
}

export function parseCron(expr: string): CronField[] {
  const normalized = ALIASES[expr.trim()] ?? expr.trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Expected 5 fields, got ${parts.length}. Example: "*/15 9-17 * * 1-5"`);
  }
  return parts.map((raw, i) => ({ raw, values: parseField(raw, RANGES[i]!) }));
}

function parseField(raw: string, [min, max]: [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    let step = 1;
    let range = part;
    if (part.includes('/')) {
      const [r, s] = part.split('/');
      range = r!;
      step = parseInt(s!, 10);
      if (!step || step < 1) throw new Error(`Invalid step in "${part}"`);
    }
    let lo = min;
    let hi = max;
    if (range === '*' || range === '') {
      // full range
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      lo = parseInt(a!, 10);
      hi = parseInt(b!, 10);
    } else {
      lo = hi = parseInt(range, 10);
    }
    if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`Field value "${part}" out of range ${min}-${max}`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function explainCron(expr: string): string {
  const fields = parseCron(expr);
  const [minute, hour, dom, month, dow] = fields;

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
  if (minute!.raw === '*' && hour!.raw === '*') {
    parts.push('every minute');
  } else if (minute!.values.size === 1 && hour!.values.size === 1) {
    const h = [...hour!.values][0]!;
    const m = [...minute!.values][0]!;
    parts.push(`at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  } else {
    parts.push(`at ${describeField(minute!, 'minute', 59)}, ${describeField(hour!, 'hour', 23)}`);
  }
  // day of month
  if (dom!.raw !== '*') parts.push(`on day-of-month ${[...dom!.values].join(', ')}`);
  // month
  if (month!.raw !== '*') parts.push(`in ${[...month!.values].map((m) => MONTHS[m - 1]).join(', ')}`);
  // day of week
  if (dow!.raw !== '*') parts.push(`on ${[...dow!.values].map((d) => DOW[d % 7]).join(', ')}`);

  return parts.join(', ');
}

export function nextRuns(expr: string, count = 5, from = new Date()): Date[] {
  const fields = parseCron(expr);
  const [minute, hour, dom, month, dow] = fields;
  const runs: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  let guard = 0;
  while (runs.length < count && guard < 500000) {
    guard++;
    if (
      minute!.values.has(d.getMinutes()) &&
      hour!.values.has(d.getHours()) &&
      month!.values.has(d.getMonth() + 1) &&
      matchDay(d, dom!, dow!)
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
