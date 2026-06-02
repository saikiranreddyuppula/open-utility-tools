// Extracted from tools/time/age-calculator. Pure, isomorphic age math.
// The calendar diff, total-elapsed math, and next-birthday logic are lifted
// verbatim from the tool's UI (computeAge) so outputs match the app exactly.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Days in a 0-based month of a given year (day 0 of next month = last day of this one). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Parses a `YYYY-MM-DD` birth date into a local-midnight `Date`, mirroring the
 * UI's `new Date(`${value}T00:00:00`)` construction.
 */
function parseBirthDate(birthDate: string): Date {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    throw new RangeError(`Invalid birth date: ${JSON.stringify(birthDate)} (expected YYYY-MM-DD)`);
  }
  return birth;
}

export interface AgeOptions {
  /**
   * The "current" moment to measure age against. Defaults to `new Date()`.
   * Pass a fixed `Date` for deterministic results (e.g. in tests).
   */
  now?: Date;
  /**
   * BCP-47 locale used to format `nextBirthdayDate`. Defaults to `'en-US'`
   * for stable output across Node, Bun, and browsers.
   */
  locale?: string;
}

export interface AgeResult {
  /** Full calendar years between birth date and `now`. */
  years: number;
  /** Leftover whole months after `years` (0–11). */
  months: number;
  /** Leftover whole days after `years` and `months`. */
  days: number;
  /** Total whole days elapsed since birth (floored). */
  totalDays: number;
  /** Total whole hours elapsed since birth (floored). */
  totalHours: number;
  /** Total whole minutes elapsed since birth (floored). */
  totalMinutes: number;
  /** Whole days until the next birthday (0 only when the birthday is today). */
  nextBirthdayDays: number;
  /** The next birthday, formatted with `Intl` (e.g. `"January 15, 2027"`). */
  nextBirthdayDate: string;
}

/**
 * Calculates a person's exact age and birthday countdown from a birth date.
 *
 * The age breakdown uses calendar arithmetic (borrowing days from the previous
 * month and months from the previous year), matching how people naturally state
 * their age. Totals (days/hours/minutes) are derived from elapsed milliseconds.
 * The next-birthday count is measured from local midnight of `now`; note that
 * when the birthday falls on `now`'s date, `nextBirthdayDate` rolls forward to
 * next year (the breakdown will read 0 years / 0 months / 0 days for that day).
 *
 * Pure and isomorphic — no DOM; runs in the browser, Node, and Bun.
 *
 * @param birthDate - Birth date as `YYYY-MM-DD`.
 * @param options - Optional `now` reference moment and formatting `locale`.
 * @returns The age breakdown, elapsed totals, and next-birthday countdown.
 * @throws {RangeError} If `birthDate` is not a valid date, or is in the future
 *   relative to `now`.
 *
 * @example
 * ```ts
 * import { calculateAge } from '@open-utility-tools/core/time/age-calculator';
 *
 * const age = calculateAge('1990-01-15', { now: new Date('2026-06-02T12:34:56') });
 * age.years;            // → 36
 * age.months;           // → 4
 * age.days;             // → 18
 * age.totalDays;        // → 13287
 * age.nextBirthdayDays; // → 227
 * age.nextBirthdayDate; // → 'January 15, 2027'
 * ```
 */
export function calculateAge(birthDate: string, options: AgeOptions = {}): AgeResult {
  const now = options.now ?? new Date();
  const locale = options.locale ?? 'en-US';

  const birth = parseBirthDate(birthDate);
  if (birth.getTime() > now.getTime()) {
    throw new RangeError('Birth date cannot be in the future.');
  }

  // Calendar diff (years/months/days).
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // Borrow days from the previous month relative to `now`.
    const prevMonthIndex = now.getMonth() - 1;
    const borrowYear = prevMonthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const borrowMonth = (prevMonthIndex + 12) % 12;
    days += daysInMonth(borrowYear, borrowMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const diffMs = now.getTime() - birth.getTime();
  const totalDays = Math.floor(diffMs / MS_PER_DAY);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  // Next birthday.
  let nextYear = now.getFullYear();
  let next = new Date(nextYear, birth.getMonth(), birth.getDate());
  // Normalize "today" to midnight for a clean day count.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() <= today.getTime()) {
    nextYear += 1;
    next = new Date(nextYear, birth.getMonth(), birth.getDate());
  }
  const nextBirthdayDays = Math.round((next.getTime() - today.getTime()) / MS_PER_DAY);

  return {
    years,
    months,
    days,
    totalDays,
    totalHours,
    totalMinutes,
    nextBirthdayDays,
    nextBirthdayDate: next.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}
