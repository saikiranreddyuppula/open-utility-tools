// Extracted from tools/time/cron-field-expander. Pure, isomorphic cron field expansion.

interface FieldDef {
  name: string;
  min: number;
  max: number;
  names?: Record<string, number>;
  allowL?: boolean;
  allowQ?: boolean;
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

// 5-field layout (no seconds)
const DEFS5: FieldDef[] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31, allowL: true, allowQ: true },
  { name: 'Month', min: 1, max: 12, names: MONTHS },
  { name: 'Day of week', min: 0, max: 6, names: DOW, allowL: true, allowQ: true },
];

// 6-field layout (with seconds at the front)
const DEFS6: FieldDef[] = [
  { name: 'Second', min: 0, max: 59 },
  ...DEFS5,
];

export interface ExpandedField {
  /** Human label of the field, e.g. `"Minute"` or `"Day of week"`. */
  name: string;
  /** The raw cron token for this field, e.g. a step like `*` `/15`. */
  token: string;
  /** Sorted, de-duplicated explicit values the token matches. */
  values: number[];
}

export interface CronExpansion {
  /** Each cron field expanded into its explicit set of matching values. */
  fields: ExpandedField[];
  /**
   * Distinct fire times per day: the product of the second, minute, and hour
   * value counts (time-of-day fields only).
   */
  perDay: number;
}

function expandToken(token: string, def: FieldDef): number[] {
  const out = new Set<number>();
  const resolve = (raw: string): number => {
    const upper = raw.toUpperCase();
    if (def.names && upper in def.names) {
      const v = def.names[upper];
      if (v === undefined) throw new RangeError(`Unknown name "${raw}" in ${def.name}`);
      return v;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new RangeError(`Invalid value "${raw}" in ${def.name}`);
    return n;
  };

  const parts = token.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part === '') throw new RangeError(`Empty list item in ${def.name}`);

    // ? and * mean "all" (or "no restriction" for ?)
    if (part === '*' || (part === '?' && def.allowQ)) {
      for (let i = def.min; i <= def.max; i++) out.add(i);
      continue;
    }
    if (part === '?') throw new RangeError(`"?" is not allowed in ${def.name}`);

    // L (last) — represent as the max for day-of-month, or treat as 7->0 last for DOW
    if ((part === 'L' || part === 'l') && def.allowL) {
      out.add(def.name === 'Day of month' ? 31 : def.max);
      continue;
    }

    // step: base/step
    let base = part;
    let step = 1;
    const slash = part.indexOf('/');
    if (slash >= 0) {
      base = part.slice(0, slash);
      const stepStr = part.slice(slash + 1);
      const s = Number(stepStr);
      if (!Number.isInteger(s) || s <= 0) throw new RangeError(`Invalid step "/${stepStr}" in ${def.name}`);
      step = s;
    }

    // range or single
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
      throw new RangeError(`Value out of range (${def.min}-${def.max}) in ${def.name}`);
    }
    if (lo > hi) throw new RangeError(`Range start greater than end in ${def.name}`);

    for (let i = lo; i <= hi; i += step) out.add(i);
  }

  // Normalise DOW 7 -> 0
  if (def.name === 'Day of week' && out.has(7)) {
    out.delete(7);
    out.add(0);
  }

  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Expands each field of a cron expression into the explicit set of matching
 * values and reports how many distinct fire times occur per day. Pure and
 * isomorphic — no DOM, runs in the browser, Node, and Bun.
 *
 * Accepts standard 5-field cron (`minute hour day-of-month month day-of-week`)
 * or 6-field cron with a leading seconds field. Supports `*`, ranges (`9-17`),
 * lists (`1,15,30`), steps (`*\/15`, `0-30/10`), month/day names
 * (`JAN`, `MON-FRI`), `?` (day-of-month / day-of-week), and `L` (last). Day-of-week
 * `7` is normalised to `0` (Sunday).
 *
 * @param expr - A cron expression, e.g. `"*\/15 9-17 * * MON-FRI"`.
 * @returns The expanded fields (in field order) and the per-day fire count.
 * @throws {RangeError} If the expression is not 5 or 6 fields, or any field
 *   token is malformed (empty list item, unknown name, bad step, out-of-range
 *   value, inverted range, or a disallowed `?`).
 *
 * @example
 * ```ts
 * import { expandCron } from '@open-utility-tools/core/time/cron-field-expander';
 * const { fields, perDay } = expandCron('*\/15 9-17 * * MON-FRI');
 * fields[0].values; // → [0, 15, 30, 45]   (Minute)
 * fields[1].values; // → [9, 10, 11, 12, 13, 14, 15, 16, 17]   (Hour)
 * perDay;           // → 36   (4 minutes × 9 hours)
 * ```
 */
export function expandCron(expr: string): CronExpansion {
  if (typeof expr !== 'string') {
    throw new TypeError('Cron expression must be a string.');
  }
  const tokens = expr.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 5 && tokens.length !== 6) {
    throw new RangeError('Enter a 5-field (or 6-field with seconds) cron expression.');
  }
  const defs = tokens.length === 6 ? DEFS6 : DEFS5;
  const fields: ExpandedField[] = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const tok = tokens[i];
    if (!def || tok === undefined) continue;
    fields.push({ name: def.name, token: tok, values: expandToken(tok, def) });
  }

  // distinct fire times per day = seconds(if any) * minutes * hours (time-of-day fields only)
  const byName = new Map(fields.map((f) => [f.name, f.values.length]));
  const sec = byName.get('Second') ?? 1;
  const min = byName.get('Minute') ?? 1;
  const hr = byName.get('Hour') ?? 1;
  const perDay = sec * min * hr;

  return { fields, perDay };
}
