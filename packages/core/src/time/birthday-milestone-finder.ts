const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;
const SEC_MS = 1_000;

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** A single computed life milestone. */
export interface BirthdayMilestone {
  /** Human-readable label, e.g. `"10,000 days old"` or `"30th birthday"`. */
  label: string;
  /** The exact moment the milestone occurs. */
  date: Date;
  /** Local-calendar ISO date (`YYYY-MM-DD`) of {@link date}. */
  iso: string;
  /** Three-letter local weekday abbreviation of {@link date} (e.g. `"Mon"`). */
  weekday: string;
  /**
   * Whole days between {@link date} and `now`, rounded.
   * Negative = already passed, `0` = today, positive = upcoming.
   */
  daysFromToday: number;
}

/** Result of {@link findBirthdayMilestones}. */
export interface BirthdayMilestonesResult {
  /** Epoch-ms timestamp of the resolved birth moment (date + optional time). */
  bornMs: number;
  /** Local-calendar ISO date (`YYYY-MM-DD`) of the birth moment. */
  bornIso: string;
  /** Milestones sorted ascending by date. */
  milestones: BirthdayMilestone[];
  /** Count of milestones with `daysFromToday >= 0` (today or future). */
  upcomingCount: number;
}

/** Options for {@link findBirthdayMilestones}. */
export interface BirthdayMilestonesOptions {
  /**
   * Birth time of day as `"HH:MM"` (24-hour). Defaults to `"00:00"`.
   * Hours are clamped to 0-23 and minutes to 0-59; non-numeric parts fall back to 0.
   */
  birthTime?: string;
  /**
   * Reference "now" as epoch milliseconds. Defaults to `Date.now()`.
   * Provide a fixed value for deterministic output.
   */
  now?: number;
}

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

/** Format a Date as local-calendar `YYYY-MM-DD`. */
function fmt(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parse a strict `YYYY-MM-DD` string into local calendar parts, rejecting
 * out-of-range values (e.g. month 13, Feb 30) by round-tripping through Date.
 */
function parseISODate(value: string): { y: number; m: number; d: number } | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/**
 * Find life milestones for a person born on the given date (and optional time).
 *
 * Produces a date-sorted list of notable moments relative to the birth instant:
 *  - every 1,000 days of age (up to ~age + 5,000 days, capped at 40,000 days);
 *  - 1 and 2 billion seconds old;
 *  - 500,000 and 1,000,000 minutes old;
 *  - 100,000 and 500,000 hours old;
 *  - round-number calendar birthdays (18, 21, 25, 30, 40, 50, 60, 70, 80, 90, 100).
 *
 * All calendar fields (`iso`, `weekday`, `daysFromToday`) are computed in the
 * host's local time zone, matching the original UI behavior.
 *
 * @param birthDate - Birth date as a strict `YYYY-MM-DD` string.
 * @param options - Optional birth time-of-day and a fixed `now` for determinism.
 * @returns The resolved birth moment plus the sorted milestone list and upcoming count.
 * @throws {TypeError} If `birthDate` is not a string.
 * @throws {RangeError} If `birthDate` is not a valid `YYYY-MM-DD` date, or the
 *   resolved birth moment is in the future relative to `now`.
 *
 * @example
 * ```ts
 * const { milestones, upcomingCount } = findBirthdayMilestones('1995-06-15', {
 *   birthTime: '00:00',
 *   now: Date.UTC(2026, 5, 2, 12), // fixed reference for a reproducible result
 * });
 * milestones[0];        // -> { label: '500,000 minutes old', iso: '1996-05-27', weekday: 'Mon', daysFromToday: -10963, date: Date }
 * upcomingCount;        // -> number of milestones today or in the future
 * ```
 */
export function findBirthdayMilestones(
  birthDate: string,
  options: BirthdayMilestonesOptions = {},
): BirthdayMilestonesResult {
  if (typeof birthDate !== 'string') {
    throw new TypeError('birthDate must be a string in YYYY-MM-DD format.');
  }

  const parsed = parseISODate(birthDate);
  if (!parsed) {
    throw new RangeError(
      `Invalid birth date: "${birthDate}". Expected a valid YYYY-MM-DD date.`,
    );
  }

  const birthTime = options.birthTime ?? '00:00';
  const timeParts = birthTime.split(':');
  const hh = Number(timeParts[0] ?? '0');
  const mm = Number(timeParts[1] ?? '0');
  const hour = Number.isFinite(hh) ? Math.max(0, Math.min(23, hh)) : 0;
  const minute = Number.isFinite(mm) ? Math.max(0, Math.min(59, mm)) : 0;

  const born = new Date(parsed.y, parsed.m - 1, parsed.d, hour, minute, 0, 0);
  const bornMs = born.getTime();
  const nowMs = options.now ?? Date.now();

  if (bornMs > nowMs) {
    throw new RangeError('Birth date/time is in the future.');
  }

  const ageMs = nowMs - bornMs;
  const ageDays = ageMs / DAY_MS;

  interface RawRow {
    label: string;
    date: Date;
    daysFromToday: number;
  }
  const rows: RawRow[] = [];

  const addMs = (label: string, deltaMs: number): void => {
    const date = new Date(bornMs + deltaMs);
    const daysFromToday = Math.round((date.getTime() - nowMs) / DAY_MS);
    rows.push({ label, date, daysFromToday });
  };

  // Every 1,000 days up to a horizon (~age + 5,000 days), capped at 40,000 days.
  const horizonDays = Math.ceil(ageDays / 1000) * 1000 + 5000;
  for (let k = 1000; k <= horizonDays && k <= 40000; k += 1000) {
    addMs(`${k.toLocaleString()} days old`, k * DAY_MS);
  }

  // Billion-second markers.
  addMs('1 billion seconds old', 1_000_000_000 * SEC_MS);
  addMs('2 billion seconds old', 2_000_000_000 * SEC_MS);

  // Minute markers.
  addMs('500,000 minutes old', 500_000 * MIN_MS);
  addMs('1,000,000 minutes old', 1_000_000 * MIN_MS);

  // Hour markers.
  addMs('100,000 hours old', 100_000 * HOUR_MS);
  addMs('500,000 hours old', 500_000 * HOUR_MS);

  // Round-number birthdays (calendar-anniversary based).
  const roundAges = [18, 21, 25, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const a of roundAges) {
    const bd = new Date(
      born.getFullYear() + a,
      born.getMonth(),
      born.getDate(),
      born.getHours(),
      born.getMinutes(),
      0,
      0,
    );
    const daysFromToday = Math.round((bd.getTime() - nowMs) / DAY_MS);
    rows.push({ label: `${a}th birthday`, date: bd, daysFromToday });
  }

  rows.sort((x, y) => x.date.getTime() - y.date.getTime());

  const milestones: BirthdayMilestone[] = rows.map((r) => {
    const wd = WEEKDAY[r.date.getDay()];
    return {
      label: r.label,
      date: r.date,
      iso: fmt(r.date),
      weekday: wd ?? '',
      daysFromToday: r.daysFromToday,
    };
  });

  return {
    bornMs,
    bornIso: fmt(new Date(bornMs)),
    milestones,
    upcomingCount: milestones.filter((m) => m.daysFromToday >= 0).length,
  };
}
