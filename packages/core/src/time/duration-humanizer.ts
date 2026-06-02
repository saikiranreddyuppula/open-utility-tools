// Extracted from tools/time/duration-humanizer. Pure, isomorphic duration formatting.

/** Unit the input number is expressed in. */
export type DurationInputUnit = 'ms' | 's' | 'min' | 'h';

/** Phrasing style for the human-readable output. */
export type DurationStyle = 'long' | 'short';

interface DurationUnitDef {
  key: string;
  seconds: number;
  long: string;
  longPlural: string;
  short: string;
}

const DURATION_UNITS: readonly DurationUnitDef[] = [
  { key: 'year', seconds: 365 * 86400, long: 'year', longPlural: 'years', short: 'y' },
  { key: 'week', seconds: 7 * 86400, long: 'week', longPlural: 'weeks', short: 'w' },
  { key: 'day', seconds: 86400, long: 'day', longPlural: 'days', short: 'd' },
  { key: 'hour', seconds: 3600, long: 'hour', longPlural: 'hours', short: 'h' },
  { key: 'minute', seconds: 60, long: 'minute', longPlural: 'minutes', short: 'm' },
  { key: 'second', seconds: 1, long: 'second', longPlural: 'seconds', short: 's' },
];

const DURATION_IN_FACTORS: Record<DurationInputUnit, number> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3600,
};

/** One unit's contribution to a humanized duration. */
export interface DurationBreakdownEntry {
  /** Stable unit key, e.g. `"day"`, `"hour"`. */
  key: string;
  /** Whole-number count of this unit. */
  count: number;
  /** Long form, e.g. `"2 days"`, `"1 minute"`. */
  longLabel: string;
  /** Short form, e.g. `"2d"`, `"1m"`. */
  shortLabel: string;
}

/** Result of {@link humanizeDuration}. */
export interface HumanizeDurationResult {
  /** Human-readable phrase, e.g. `"2 days, 4 hours, and 55 minutes"` or `"2d 4h 55m"`. */
  human: string;
  /** Colon/clock format, e.g. `"2d 04:55:00"` (day prefix only when non-zero). */
  colon: string;
  /** Full per-unit breakdown for every active unit (includes zero-count units). */
  breakdown: DurationBreakdownEntry[];
  /** Total duration in seconds (un-floored). */
  totalSeconds: number;
}

/** Options controlling how a duration is humanized. */
export interface HumanizeDurationOptions {
  /** Unit the input `value` is expressed in. Default `'s'`. */
  inputUnit?: DurationInputUnit;
  /** Max number of non-zero units to show in the human phrase. Clamped to at least 1. Default `3`. */
  maxUnits?: number;
  /** Include weeks as a unit. Default `true`. */
  includeWeeks?: boolean;
  /** Include years as a unit. Default `true`. */
  includeYears?: boolean;
  /** `'long'` => words; `'short'` => compact suffixes. Default `'long'`. */
  style?: DurationStyle;
  /** Use the Oxford comma before "and" in long style. Default `true`. */
  oxford?: boolean;
}

/**
 * Turns a raw duration into a human-readable phrase plus a colon (clock) format
 * and a per-unit breakdown. Pure and isomorphic — no DOM, runs in the browser,
 * Node, and Bun.
 *
 * The phrase drops leading zero units and caps to `maxUnits` non-zero units
 * (counting from the largest). The `colon` format is always `HH:MM:SS`, prefixed
 * with `"<days>d "` when the duration spans whole days.
 *
 * @param value - The numeric duration, expressed in `options.inputUnit`.
 * @param options - Input unit, unit toggles, cap, style, and Oxford-comma flag.
 * @returns The human phrase, colon format, full breakdown, and total seconds.
 * @throws {TypeError} If `value` is not a finite number.
 * @throws {RangeError} If `value` is negative or `inputUnit` is unknown.
 *
 * @example
 * ```ts
 * import { humanizeDuration } from '@open-utility-tools/core/time/duration-humanizer';
 * humanizeDuration(190500).human;                    // → '2 days, 4 hours, and 55 minutes'
 * humanizeDuration(190500).colon;                    // → '2d 04:55:00'
 * humanizeDuration(190500, { style: 'short' }).human; // → '2d 4h 55m'
 * humanizeDuration(5000, { inputUnit: 'ms' }).human;  // → '5 seconds'
 * ```
 */
export function humanizeDuration(
  value: number,
  options: HumanizeDurationOptions = {},
): HumanizeDurationResult {
  const {
    inputUnit = 's',
    maxUnits = 3,
    includeWeeks = true,
    includeYears = true,
    style = 'long',
    oxford = true,
  } = options;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('value must be a finite number.');
  }
  if (value < 0) {
    throw new RangeError('Duration must be zero or positive.');
  }
  const factor = DURATION_IN_FACTORS[inputUnit];
  if (factor === undefined) {
    throw new RangeError(`Unknown input unit: ${String(inputUnit)}`);
  }

  const totalSeconds = value * factor;
  let remaining = Math.floor(totalSeconds);

  const active = DURATION_UNITS.filter((u) => {
    if (u.key === 'year' && !includeYears) return false;
    if (u.key === 'week' && !includeWeeks) return false;
    return true;
  });

  const all: DurationBreakdownEntry[] = [];
  for (const u of active) {
    const count = Math.floor(remaining / u.seconds);
    remaining -= count * u.seconds;
    all.push({
      key: u.key,
      count,
      longLabel: `${count} ${count === 1 ? u.long : u.longPlural}`,
      shortLabel: `${count}${u.short}`,
    });
  }

  // For the human phrase, drop leading zero units and cap to maxUnits non-zero (from the largest).
  const nonZero = all.filter((e) => e.count > 0);
  const fallback: DurationBreakdownEntry =
    all[all.length - 1] ?? { key: 'second', count: 0, longLabel: '0 seconds', shortLabel: '0s' };
  const shown = nonZero.length > 0 ? nonZero.slice(0, Math.max(1, maxUnits)) : [fallback];

  let human: string;
  if (style === 'short') {
    human = shown.map((e) => e.shortLabel).join(' ');
  } else {
    const labels = shown.map((e) => e.longLabel);
    if (labels.length <= 1) {
      human = labels[0] ?? '0 seconds';
    } else {
      const last = labels[labels.length - 1] ?? '';
      const head = labels.slice(0, -1);
      human = oxford ? `${head.join(', ')}, and ${last}` : `${head.join(', ')} and ${last}`;
    }
  }

  // colon HH:MM:SS (with days prefix if present)
  const totalInt = Math.floor(totalSeconds);
  const days = Math.floor(totalInt / 86400);
  const hh = Math.floor((totalInt % 86400) / 3600);
  const mm = Math.floor((totalInt % 3600) / 60);
  const ss = totalInt % 60;
  const pad = (x: number): string => x.toString().padStart(2, '0');
  const colon = (days > 0 ? `${days}d ` : '') + `${pad(hh)}:${pad(mm)}:${pad(ss)}`;

  return { human, colon, breakdown: all, totalSeconds };
}