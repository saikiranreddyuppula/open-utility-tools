// Extracted from tools/time/iso-duration-parser. Pure, isomorphic ISO 8601
// duration parsing — no DOM, runs in the browser, Node, and Bun.

// ISO 8601 duration: PnYnMnWnDTnHnMnS (weeks are mutually exclusive in spec,
// but we accept and combine them for convenience).
const DURATION_RE =
  /^(?<sign>[+-])?P(?=\d|T\d)(?:(?<years>\d+(?:\.\d+)?)Y)?(?:(?<months>\d+(?:\.\d+)?)M)?(?:(?<weeks>\d+(?:\.\d+)?)W)?(?:(?<days>\d+(?:\.\d+)?)D)?(?:T(?=\d)(?:(?<hours>\d+(?:\.\d+)?)H)?(?:(?<minutes>\d+(?:\.\d+)?)M)?(?:(?<seconds>\d+(?:\.\d+)?)S)?)?$/;

// Approximate seconds-per-unit for the calendar-based components.
const SECONDS = {
  year: 365.2425 * 86400,
  month: (365.2425 / 12) * 86400,
  week: 7 * 86400,
  day: 86400,
  hour: 3600,
  minute: 60,
  second: 1,
} as const;

function n(v: string | undefined): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function plural(value: number, unit: string): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

/** Parsed components and derived totals of an ISO 8601 duration. */
export interface IsoDuration {
  /** `1` for a positive duration, `-1` if the string was prefixed with `-`. */
  sign: 1 | -1;
  /** Year component (unsigned, may be fractional). */
  years: number;
  /** Month component (unsigned, may be fractional). */
  months: number;
  /** Week component (unsigned, may be fractional). */
  weeks: number;
  /** Day component (unsigned, may be fractional). */
  days: number;
  /** Hour component (unsigned, may be fractional). */
  hours: number;
  /** Minute component (unsigned, may be fractional). */
  minutes: number;
  /** Second component (unsigned, may be fractional). */
  seconds: number;
  /**
   * Signed total seconds using average month/year lengths
   * (365.2425 days/yr). Approximate when years or months are present.
   */
  totalSeconds: number;
  /** {@link totalSeconds} rounded to the nearest whole second. */
  totalSecondsRounded: number;
  /** {@link totalSeconds} divided by 60. */
  totalMinutes: number;
  /** {@link totalSeconds} divided by 3600. */
  totalHours: number;
  /** {@link totalSeconds} divided by 86400. */
  totalDays: number;
  /** Human-readable breakdown, e.g. `"1 year, 2 months, 30 minutes"`. */
  human: string;
  /**
   * `true` when no years or months are present, so {@link totalSeconds} is an
   * exact second count (weeks/days/hours/minutes/seconds have fixed lengths).
   */
  isExact: boolean;
  /**
   * Signed exact second total when {@link isExact} is `true`, otherwise `null`.
   * Excludes the calendar-approximated year/month components by construction.
   */
  exactSeconds: number | null;
}

/**
 * Parses an ISO 8601 duration string (e.g. `P1Y2M10DT2H30M`) into its
 * components and a set of derived totals. Year and month components use
 * average calendar lengths (365.2425 days/yr), so totals involving them are
 * approximate; a duration without years or months is reported as exact.
 *
 * Pure and isomorphic — no DOM, runs in the browser, Node, and Bun. Input is
 * trimmed and upper-cased before matching, and a leading `+`/`-` sign is
 * honoured. Weeks are accepted alongside other components for convenience even
 * though the spec treats them as mutually exclusive.
 *
 * @param input - An ISO 8601 duration such as `P1Y2M10DT2H30M`, `PT45M`,
 *   `P3W`, `P0D`, or a signed variant like `-PT1H`.
 * @returns The parsed components, a human-readable breakdown, and derived
 *   totals (seconds/minutes/hours/days).
 * @throws {RangeError} If `input` is empty or not a valid ISO 8601 duration.
 *
 * @example
 * ```ts
 * import { parseIsoDuration } from '@open-utility-tools/core/time/iso-duration-parser';
 * const d = parseIsoDuration('P1Y2M10DT2H30M');
 * d.human;               // → '1 year, 2 months, 10 days, 2 hours, 30 minutes'
 * d.totalSecondsRounded; // → 37689444
 * d.isExact;             // → false (years/months use average lengths)
 *
 * parseIsoDuration('PT45M').exactSeconds; // → 2700
 * parseIsoDuration('-PT1H').human;        // → 'minus 1 hour'
 * ```
 */
export function parseIsoDuration(input: string): IsoDuration {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    throw new RangeError('Empty input — expected an ISO 8601 duration like P1Y2M10DT2H30M.');
  }

  const match = DURATION_RE.exec(trimmed);
  if (!match || !match.groups) {
    throw new RangeError(
      'Not a valid ISO 8601 duration. Expected e.g. P1Y2M10DT2H30M, PT45M, P3W, or P0D.',
    );
  }

  const g = match.groups;
  const sign: 1 | -1 = g['sign'] === '-' ? -1 : 1;
  const years = n(g['years']);
  const months = n(g['months']);
  const weeks = n(g['weeks']);
  const days = n(g['days']);
  const hours = n(g['hours']);
  const minutes = n(g['minutes']);
  const seconds = n(g['seconds']);

  const totalSeconds =
    sign *
    (years * SECONDS.year +
      months * SECONDS.month +
      weeks * SECONDS.week +
      days * SECONDS.day +
      hours * SECONDS.hour +
      minutes * SECONDS.minute +
      seconds * SECONDS.second);

  // Build a human-readable breakdown of only the present components.
  const present: string[] = [];
  if (years) present.push(plural(years, 'year'));
  if (months) present.push(plural(months, 'month'));
  if (weeks) present.push(plural(weeks, 'week'));
  if (days) present.push(plural(days, 'day'));
  if (hours) present.push(plural(hours, 'hour'));
  if (minutes) present.push(plural(minutes, 'minute'));
  if (seconds) present.push(plural(seconds, 'second'));
  const human =
    present.length === 0
      ? 'zero duration'
      : `${sign < 0 ? 'minus ' : ''}${present.join(', ')}`;

  // A precise time-only total (hours/minutes/seconds + exact days/weeks) is
  // exact; year/month vary by calendar, so we only report it when absent.
  const exactPart =
    sign *
    (weeks * SECONDS.week +
      days * SECONDS.day +
      hours * SECONDS.hour +
      minutes * SECONDS.minute +
      seconds * SECONDS.second);
  const isExact = years === 0 && months === 0;

  return {
    sign,
    years,
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    totalSecondsRounded: Math.round(totalSeconds),
    totalMinutes: totalSeconds / 60,
    totalHours: totalSeconds / 3600,
    totalDays: totalSeconds / 86400,
    human,
    isExact,
    exactSeconds: isExact ? exactPart : null,
  };
}
