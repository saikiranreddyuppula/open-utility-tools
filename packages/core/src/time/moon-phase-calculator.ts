/**
 * Moon phase calculator — mean-synodic-month approximation.
 *
 * Estimates the lunar phase for a given UTC date/time by measuring elapsed
 * time since a known new-moon epoch (2000-01-06 18:14 UTC) and reducing it
 * modulo the mean synodic month. This is a mean-phase approximation: it does
 * not model orbital perturbations, so individual events can be off by up to
 * roughly a day from precise ephemerides.
 *
 * @module time/moon-phase-calculator
 */

/** Mean synodic month, in days. */
const SYNODIC = 29.530588853;

/** Reference new moon: 2000-01-06 18:14 UTC, as epoch milliseconds. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

/** The eight canonical lunar phases with their Unicode glyphs. */
const PHASES: ReadonlyArray<{ readonly name: string; readonly glyph: string }> = [
  { name: 'New Moon', glyph: '🌑' },
  { name: 'Waxing Crescent', glyph: '🌒' },
  { name: 'First Quarter', glyph: '🌓' },
  { name: 'Waxing Gibbous', glyph: '🌔' },
  { name: 'Full Moon', glyph: '🌕' },
  { name: 'Waning Gibbous', glyph: '🌖' },
  { name: 'Last Quarter', glyph: '🌗' },
  { name: 'Waning Crescent', glyph: '🌘' },
];

/** The mean synodic month length (days) used by this calculator. */
export const SYNODIC_MONTH = SYNODIC;

/** Input for {@link calculateMoonPhase}. */
export interface MoonPhaseOptions {
  /** Calendar date in `YYYY-MM-DD` format (interpreted as UTC). */
  date: string;
  /**
   * Optional time of day in `HH:MM` 24-hour format (UTC).
   * Defaults to `00:00` when omitted or empty.
   */
  time?: string;
}

/** Computed moon-phase result. */
export interface MoonPhaseResult {
  /** Unicode glyph for the matched phase (e.g. `🌕`). */
  glyph: string;
  /** Human-readable phase name (e.g. `Full Moon`). */
  name: string;
  /** Lunar age in days since the most recent new moon, in `[0, SYNODIC_MONTH)`. */
  age: number;
  /** Illuminated fraction of the disc, as a percentage in `[0, 100]`. */
  illumination: number;
  /** `true` while the moon is growing (age before half-cycle), `false` while shrinking. */
  waxing: boolean;
  /** Approximate next new moon, formatted as `YYYY-MM-DD HH:MM UTC`. */
  nextNew: string;
  /** Approximate next full moon, formatted as `YYYY-MM-DD HH:MM UTC`. */
  nextFull: string;
  /** The normalized input instant, formatted as `YYYY-MM-DD HH:MM UTC`. */
  inputUtc: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/**
 * Map lunar age (`0..SYNODIC`) to one of 8 phases, centered on the canonical
 * angles so each phase occupies a 1/8 window.
 */
function phaseIndex(age: number): number {
  const frac = age / SYNODIC; // 0..1
  return Math.floor((frac + 1 / 16) * 8) % 8;
}

/**
 * Estimate the moon phase, lunar age, illumination, and the approximate next
 * new/full moon for a UTC date and time.
 *
 * The algorithm anchors to a known new moon (2000-01-06 18:14 UTC) and reduces
 * the elapsed time modulo the mean synodic month. Illumination is derived from
 * the lunar age via `(1 - cos(2π·age/synodic)) / 2`. Results are a mean-phase
 * approximation and may differ from precise ephemerides by up to ~1 day.
 *
 * @param options - The target instant. `date` is `YYYY-MM-DD` (UTC); `time` is
 *   an optional `HH:MM` 24-hour UTC clock (defaults to `00:00`).
 * @returns A {@link MoonPhaseResult} with the phase name/glyph, lunar age (days),
 *   illumination percentage, waxing/waning trend, and the formatted next new and
 *   full moons.
 * @throws {TypeError} If `date` is not a string.
 * @throws {RangeError} If `date` is empty, not `YYYY-MM-DD`, encodes an invalid
 *   calendar date, or if `time` is not `HH:MM` or is out of the 0–23 / 0–59 range.
 *
 * @example
 * ```ts
 * const phase = calculateMoonPhase({ date: '2024-08-19', time: '18:26' });
 * // phase.name        === 'Full Moon'
 * // phase.glyph       === '🌕'
 * // phase.illumination ~= 99.996
 * // phase.nextFull    === '2024-08-19 19:46 UTC'
 * ```
 */
export function calculateMoonPhase(options: MoonPhaseOptions): MoonPhaseResult {
  const dateInput: unknown = options.date;
  if (typeof dateInput !== 'string') {
    throw new TypeError('`date` must be a string in YYYY-MM-DD format.');
  }
  const timeInput: unknown = options.time ?? '';
  const timeStr = typeof timeInput === 'string' ? timeInput : '';

  const text = dateInput.trim();
  if (!text) throw new RangeError('Pick a date.');
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!dm) throw new RangeError('Date must be YYYY-MM-DD.');
  const yStr = dm[1];
  const moStr = dm[2];
  const daStr = dm[3];
  if (yStr === undefined || moStr === undefined || daStr === undefined) {
    throw new RangeError('Date must be YYYY-MM-DD.');
  }
  const y = Number(yStr);
  const mo = Number(moStr);
  const da = Number(daStr);

  let hh = 0;
  let mm = 0;
  const t = timeStr.trim();
  if (t) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!tm) throw new RangeError('Time must be HH:MM (UTC).');
    const hhStr = tm[1];
    const mmStr = tm[2];
    hh = Number(hhStr ?? '0');
    mm = Number(mmStr ?? '0');
    if (hh > 23 || mm > 59) throw new RangeError('Time out of range.');
  }
  if (![y, mo, da].every(Number.isFinite) || mo < 1 || mo > 12 || da < 1 || da > 31) {
    throw new RangeError('Invalid date.');
  }

  const targetMs = Date.UTC(y, mo - 1, da, hh, mm, 0);
  if (Number.isNaN(targetMs)) throw new RangeError('Date is out of range.');

  const daysSince = (targetMs - NEW_MOON_EPOCH) / 86400000;
  let age = daysSince % SYNODIC;
  if (age < 0) age += SYNODIC;

  const idx = phaseIndex(age);
  const fallback = PHASES[0];
  if (fallback === undefined) throw new Error('Phase table is empty.');
  const phase = PHASES[idx] ?? fallback;

  const illumination = ((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2) * 100;
  const waxing = age < SYNODIC / 2;

  // Next new moon: when age completes the cycle.
  const daysToNewMoon = SYNODIC - age;
  const nextNewMs = targetMs + daysToNewMoon * 86400000;
  // Next full moon: age reaches half-cycle.
  const halfAge = SYNODIC / 2;
  let daysToFull = halfAge - age;
  if (daysToFull < 0) daysToFull += SYNODIC;
  const nextFullMs = targetMs + daysToFull * 86400000;

  return {
    glyph: phase.glyph,
    name: phase.name,
    age,
    illumination,
    waxing,
    nextNew: fmtUtc(nextNewMs),
    nextFull: fmtUtc(nextFullMs),
    inputUtc: `${y}-${pad2(mo)}-${pad2(da)} ${pad2(hh)}:${pad2(mm)} UTC`,
  };
}
