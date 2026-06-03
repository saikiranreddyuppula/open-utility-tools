// Extracted from tools/time/age-on-other-planets. Pure, isomorphic orbital-age math.
//
// Converts an elapsed span of Earth time into the equivalent number of years on
// each planet (Earth years / orbital period), reproducing the exact rounding and
// "next birthday" projection used by the UI.

/** A planet and its sidereal orbital period, measured in Earth years. */
export interface Planet {
  /** Display name, e.g. `"Mars"`. */
  readonly name: string;
  /** Orbital period in Earth years (Earth = 1.0). */
  readonly period: number;
}

/**
 * The eight planets and their orbital periods in Earth years, in order from the
 * Sun. Earth's period is exactly `1.0`.
 */
export const PLANETS: readonly Planet[] = [
  { name: 'Mercury', period: 0.2408467 },
  { name: 'Venus', period: 0.61519726 },
  { name: 'Earth', period: 1.0 },
  { name: 'Mars', period: 1.8808158 },
  { name: 'Jupiter', period: 11.862615 },
  { name: 'Saturn', period: 29.447498 },
  { name: 'Uranus', period: 84.016846 },
  { name: 'Neptune', period: 164.79132 },
];

/** Seconds in one Earth year (365.25 days), the conversion constant. */
export const EARTH_YEAR_SECONDS = 365.25 * 24 * 60 * 60;

/** Equivalent age on a single planet. */
export interface PlanetAge {
  /** Planet name, e.g. `"Jupiter"`. */
  name: string;
  /** Equivalent age in that planet's years, rounded to 2 decimals as a string (e.g. `"2.11"`). */
  age: string;
  /**
   * The next whole-planet-year birthday projected onto Earth's calendar, as
   * `"YYYY-MM-DD (turns N)"`, or `"—"` when no birth instant was supplied.
   */
  nextBirthday: string;
}

/** Result of converting an Earth span into per-planet ages. */
export interface PlanetAgesResult {
  /** One row per planet, in Sun-outward order. */
  rows: PlanetAge[];
  /** Elapsed Earth time in seconds that drove the calculation. */
  earthSeconds: number;
}

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function formatDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(value: string): Date | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/**
 * Builds the per-planet rows from a raw elapsed-seconds value. When
 * `birthEpochMs` is provided, each row also includes the next whole-planet-year
 * birthday projected back onto Earth's calendar.
 */
function buildRows(earthSeconds: number, birthEpochMs: number | null): PlanetAge[] {
  return PLANETS.map((p) => {
    const planetSeconds = p.period * EARTH_YEAR_SECONDS;
    const age = earthSeconds / planetSeconds;

    let nextBirthday = '—';
    if (birthEpochMs !== null) {
      // Next whole planet-year after the current age, projected onto Earth's calendar.
      const nextWhole = Math.floor(age) + 1;
      const nextMs = birthEpochMs + nextWhole * planetSeconds * 1000;
      nextBirthday = `${formatDate(new Date(nextMs))} (turns ${nextWhole})`;
    }

    return {
      name: p.name,
      age: age.toFixed(2),
      nextBirthday,
    };
  });
}

/**
 * Converts a number of Earth years into the equivalent age on every planet.
 * Pure and isomorphic — no DOM; runs in the browser, Node, and Bun.
 *
 * Each planet's age is `earthYears / orbitalPeriod`, formatted to two decimals.
 * No `nextBirthday` is computed in this mode (it is reported as `"—"`), matching
 * the UI's "Earth years" tab.
 *
 * @param earthYears - Elapsed time on Earth, in years. Must be finite and non-negative.
 * @returns The per-planet rows and the elapsed time in Earth seconds.
 * @throws {RangeError} If `earthYears` is not a finite, non-negative number.
 *
 * @example
 * ```ts
 * import { agesFromEarthYears } from '@open-utility-tools/core/time/age-on-other-planets';
 * const { rows } = agesFromEarthYears(25);
 * rows.find((r) => r.name === 'Mars')?.age; // → '13.29'
 * rows.find((r) => r.name === 'Mercury')?.age; // → '103.80'
 * ```
 */
export function agesFromEarthYears(earthYears: number): PlanetAgesResult {
  if (typeof earthYears !== 'number' || !Number.isFinite(earthYears) || earthYears < 0) {
    throw new RangeError('earthYears must be a finite, non-negative number');
  }
  const earthSeconds = earthYears * EARTH_YEAR_SECONDS;
  return { rows: buildRows(earthSeconds, null), earthSeconds };
}

/**
 * Converts an age given by a birth date into the equivalent age on every planet,
 * including each planet's next birthday projected onto Earth's calendar.
 * Pure and isomorphic — no DOM; runs in the browser, Node, and Bun.
 *
 * Dates are interpreted at local midnight (matching the UI's `<input type="date">`
 * parsing). Pass an explicit `asOf` to keep the result deterministic; when it is
 * omitted the current local time is used.
 *
 * @param birthDate - Birth date as `YYYY-MM-DD`.
 * @param asOf - Reference "now" as `YYYY-MM-DD`. Defaults to the current date.
 * @returns The per-planet rows (with next-birthday projections) and elapsed Earth seconds.
 * @throws {RangeError} If `birthDate` or `asOf` is not a valid `YYYY-MM-DD` date,
 *   or if `birthDate` is after `asOf` (in the future).
 *
 * @example
 * ```ts
 * import { agesFromBirthDate } from '@open-utility-tools/core/time/age-on-other-planets';
 * const { rows } = agesFromBirthDate('2000-01-01', '2025-01-01');
 * rows.find((r) => r.name === 'Mars')?.nextBirthday; // → '2026-05-01 (turns 14)'
 * rows.find((r) => r.name === 'Earth')?.age; // → '25.00'
 * ```
 */
export function agesFromBirthDate(birthDate: string, asOf?: string): PlanetAgesResult {
  const birth = parseISODate(birthDate);
  if (!birth) {
    throw new RangeError(`Invalid birth date: ${JSON.stringify(birthDate)} (expected YYYY-MM-DD)`);
  }

  let nowMs: number;
  if (asOf === undefined) {
    nowMs = Date.now();
  } else {
    const asOfDate = parseISODate(asOf);
    if (!asOfDate) {
      throw new RangeError(`Invalid asOf date: ${JSON.stringify(asOf)} (expected YYYY-MM-DD)`);
    }
    nowMs = asOfDate.getTime();
  }

  const birthEpochMs = birth.getTime();
  if (birthEpochMs > nowMs) {
    throw new RangeError('Birth date is in the future.');
  }

  const earthSeconds = (nowMs - birthEpochMs) / 1000;
  return { rows: buildRows(earthSeconds, birthEpochMs), earthSeconds };
}