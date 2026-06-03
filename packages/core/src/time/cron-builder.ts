// Extracted from tools/time/cron-builder. Pure, isomorphic cron-expression
// assembly — no DOM, runs in the browser, Node, and Bun.

/** The five standard cron fields, in canonical order. */
export type CronFieldKey = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

/** How a single cron field is rendered. */
export type CronFieldMode = 'every' | 'value' | 'step';

/** Configuration for one cron field. */
export interface CronFieldState {
  /** `'every'` → `*`, `'value'` → a fixed number, `'step'` → `*​/n`. */
  mode: CronFieldMode;
  /** The fixed value used when `mode === 'value'`. */
  value: number;
  /** The step used when `mode === 'step'` (must be ≥ 1). */
  step: number;
}

/** A full schedule: one {@link CronFieldState} per field. */
export type CronSchedule = Record<CronFieldKey, CronFieldState>;

/** The assembled cron expression plus a human-readable description. */
export interface CronBuildResult {
  /** Standard 5-field cron expression, e.g. `"0 9 * * 1"`. */
  expression: string;
  /** Plain-English summary, e.g. `"Runs at minute 0, at hour 9, …."`. */
  description: string;
}

interface FieldDef {
  key: CronFieldKey;
  label: string;
  min: number;
  max: number;
  options?: { value: number; label: string }[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DOW_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const FIELDS: readonly FieldDef[] = [
  { key: 'minute', label: 'Minute', min: 0, max: 59 },
  { key: 'hour', label: 'Hour', min: 0, max: 23 },
  { key: 'dom', label: 'Day of month', min: 1, max: 31 },
  {
    key: 'month',
    label: 'Month',
    min: 1,
    max: 12,
    options: MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name })),
  },
  {
    key: 'dow',
    label: 'Day of week',
    min: 0,
    max: 6,
    options: DOW_NAMES.map((name, i) => ({ value: i, label: name })),
  },
];

/** Sensible defaults — every field set to `every`. Mirrors the UI's initial state. */
export const DEFAULT_CRON_SCHEDULE: CronSchedule = {
  minute: { mode: 'every', value: 0, step: 5 },
  hour: { mode: 'every', value: 0, step: 1 },
  dom: { mode: 'every', value: 1, step: 1 },
  month: { mode: 'every', value: 1, step: 1 },
  dow: { mode: 'every', value: 0, step: 1 },
};

function fieldToken(state: CronFieldState): string {
  switch (state.mode) {
    case 'every':
      return '*';
    case 'value':
      return String(state.value);
    case 'step':
      return `*/${state.step}`;
  }
}

function describeField(def: FieldDef, state: CronFieldState): string {
  const labelFor = (v: number): string => {
    const opt = def.options?.find((o) => o.value === v);
    return opt ? opt.label : String(v);
  };
  switch (state.mode) {
    case 'every':
      return `every ${def.label.toLowerCase()}`;
    case 'value':
      return `at ${def.label.toLowerCase()} ${labelFor(state.value)}`;
    case 'step':
      return `every ${state.step} ${def.label.toLowerCase()}${state.step === 1 ? '' : 's'}`;
  }
}

function validateField(def: FieldDef, state: CronFieldState): void {
  if (state.mode !== 'every' && state.mode !== 'value' && state.mode !== 'step') {
    throw new TypeError(
      `${def.label}: invalid mode ${JSON.stringify(state.mode)} (expected "every", "value", or "step")`,
    );
  }
  if (state.mode === 'value') {
    if (!Number.isInteger(state.value) || state.value < def.min || state.value > def.max) {
      throw new RangeError(
        `${def.label}: value must be an integer in [${def.min}, ${def.max}], got ${state.value}`,
      );
    }
  }
  if (state.mode === 'step') {
    const stepMin = Math.max(1, def.min);
    if (!Number.isInteger(state.step) || state.step < stepMin || state.step > def.max) {
      throw new RangeError(
        `${def.label}: step must be an integer in [${stepMin}, ${def.max}], got ${state.step}`,
      );
    }
  }
}

/**
 * Builds a standard 5-field cron expression (and a human-readable description)
 * from a per-field schedule. Each field is rendered as `*` (every), a fixed
 * value, or a `*​/n` step. Pure and isomorphic — no DOM, runs in the browser,
 * Node, and Bun.
 *
 * Field order is the cron standard: minute, hour, day-of-month, month, day-of-week.
 *
 * @param schedule - One {@link CronFieldState} per field. Defaults to
 *   {@link DEFAULT_CRON_SCHEDULE} (every field set to `every`).
 * @returns The assembled cron `expression` and a plain-English `description`.
 * @throws {TypeError} If any field's `mode` is not one of `every`/`value`/`step`.
 * @throws {RangeError} If a `value`-mode field is out of range for that field, or
 *   a `step`-mode field's step is out of `[max(1, min), max]`.
 *
 * @example
 * ```ts
 * import { buildCronExpression } from '@open-utility-tools/core/time/cron-builder';
 *
 * buildCronExpression({
 *   minute: { mode: 'value', value: 0, step: 5 },
 *   hour: { mode: 'value', value: 9, step: 1 },
 *   dom: { mode: 'every', value: 1, step: 1 },
 *   month: { mode: 'every', value: 1, step: 1 },
 *   dow: { mode: 'value', value: 1, step: 1 },
 * });
 * // → {
 * //     expression: '0 9 * * 1',
 * //     description: 'Runs at minute 0, at hour 9, every day of month, every month, at day of week Monday.',
 * //   }
 * ```
 */
export function buildCronExpression(
  schedule: CronSchedule = DEFAULT_CRON_SCHEDULE,
): CronBuildResult {
  const tokens: string[] = [];
  const parts: string[] = [];

  for (const def of FIELDS) {
    const state = schedule[def.key];
    validateField(def, state);
    tokens.push(fieldToken(state));
    parts.push(describeField(def, state));
  }

  return {
    expression: tokens.join(' '),
    description: `Runs ${parts.join(', ')}.`,
  };
}
