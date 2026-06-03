/**
 * Julian Day Number conversions (Meeus / Fliegel–Van Flandern).
 *
 * Converts between Gregorian calendar dates (in UTC) and the astronomical
 * Julian Date (JD), Julian Day Number (JDN) and Modified Julian Date (MJD).
 *
 * Pure & isomorphic: no DOM, no Web APIs beyond Math/String. The arithmetic is
 * lifted verbatim from the original tool UI so outputs match exactly.
 *
 * @module time/julian-day-number
 */

/** A Gregorian date/time broken into integer UTC fields. */
export interface DateParts {
  /** Proleptic Gregorian year (may be negative, e.g. -44 for 45 BC). */
  year: number;
  /** Month, 1–12. */
  month: number;
  /** Day of month, 1–31. */
  day: number;
  /** Hour, 0–23. */
  hour: number;
  /** Minute, 0–59. */
  minute: number;
  /** Second, 0–59. */
  second: number;
}

/** Result of converting a Gregorian date to Julian forms. */
export interface JulianResult {
  /** Julian Date (days since noon UTC, Jan 1 4713 BC, proleptic Julian). */
  jd: number;
  /** Julian Day Number — the integer day, `floor(jd + 0.5)`. */
  jdn: number;
  /** Modified Julian Date — `jd - 2400000.5`. */
  mjd: number;
  /** Canonical `YYYY-MM-DD HH:MM:SS UTC` rendering of the input. */
  iso: string;
}

/** Result of converting a Julian Date back to a Gregorian date. */
export interface GregorianResult {
  /** Reconstructed Gregorian date/time fields (UTC). */
  parts: DateParts;
  /** Canonical `YYYY-MM-DD HH:MM:SS UTC` rendering of {@link parts}. */
  iso: string;
  /** Julian Day Number — `floor(jd + 0.5)`. */
  jdn: number;
  /** Modified Julian Date — `jd - 2400000.5`. */
  mjd: number;
  /** Echo of the input Julian Date. */
  jd: number;
}

/** Options for {@link gregorianToJulian}'s time-of-day component (all default to 0). */
export interface TimeOfDay {
  /** Hour, 0–23. Defaults to 0. */
  hour?: number;
  /** Minute, 0–59. Defaults to 0. */
  minute?: number;
  /** Second, 0–59. Defaults to 0. */
  second?: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIso(parts: DateParts): string {
  const { year, month, day, hour, minute, second } = parts;
  return (
    `${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}-${pad2(month)}-${pad2(day)} ` +
    `${pad2(hour)}:${pad2(minute)}:${pad2(second)} UTC`
  );
}

/**
 * Core Meeus / Fliegel–Van Flandern formula: Gregorian date+time → Julian Date.
 * Kept verbatim from the source tool; no validation here.
 */
function gregorianToJdRaw(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFraction = day + hour / 24 + minute / 1440 + second / 86400;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    dayFraction +
    b -
    1524.5
  );
}

/**
 * Inverse Meeus algorithm: Julian Date → Gregorian calendar date + time.
 * Kept verbatim from the source tool; no validation here.
 */
function jdToGregorianRaw(jd: number): DateParts {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayWithFrac = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayWithFrac);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const frac = dayWithFrac - day;
  let totalSeconds = Math.round(frac * 86400);
  const hour = Math.floor(totalSeconds / 3600);
  totalSeconds -= hour * 3600;
  const minute = Math.floor(totalSeconds / 60);
  const second = totalSeconds - minute * 60;
  return { year, month, day, hour, minute, second };
}

function requireInt(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
}

/**
 * Convert a proleptic Gregorian UTC date (and optional time of day) to the
 * astronomical Julian Date, Julian Day Number, and Modified Julian Date.
 *
 * @param year - Proleptic Gregorian year (may be negative, e.g. -44 for 45 BC).
 * @param month - Month of year, 1–12.
 * @param day - Day of month, 1–31.
 * @param time - Optional UTC time of day; `hour`/`minute`/`second` each default to 0.
 * @returns The Julian forms (`jd`, `jdn`, `mjd`) plus a canonical `iso` string echo of the input.
 * @throws {TypeError} If any numeric field is non-finite.
 * @throws {RangeError} If month is not 1–12, day not 1–31, or any time field is out of range.
 * @example
 * // The J2000.0 epoch:
 * gregorianToJulian(2000, 1, 1, { hour: 12 });
 * // => { jd: 2451545, jdn: 2451545, mjd: 51544.5, iso: '2000-01-01 12:00:00 UTC' }
 */
export function gregorianToJulian(
  year: number,
  month: number,
  day: number,
  time: TimeOfDay = {},
): JulianResult {
  requireInt(year, 'year');
  requireInt(month, 'month');
  requireInt(day, 'day');

  const hour = time.hour ?? 0;
  const minute = time.minute ?? 0;
  const second = time.second ?? 0;
  requireInt(hour, 'hour');
  requireInt(minute, 'minute');
  requireInt(second, 'second');

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new RangeError('Month/day out of range.');
  }
  if (hour > 23 || hour < 0 || minute > 59 || minute < 0 || second > 59 || second < 0) {
    throw new RangeError('Time fields out of range.');
  }

  const jd = gregorianToJdRaw(year, month, day, hour, minute, second);
  const jdn = Math.floor(jd + 0.5);
  const mjd = jd - 2400000.5;
  const iso = formatIso({ year, month, day, hour, minute, second });
  return { jd, jdn, mjd, iso };
}

/**
 * Parse a `YYYY-MM-DD` date string (optionally with a `HH:MM` or `HH:MM:SS`
 * time string) and convert it to Julian forms.
 *
 * This mirrors the original tool's text-input path, including its regexes and
 * range checks.
 *
 * @param dateStr - Date in `YYYY-MM-DD` form. The year may carry a leading `-` and 1–6 digits.
 * @param timeStr - Optional time in `HH:MM` or `HH:MM:SS` form; empty/whitespace means midnight UTC.
 * @returns The Julian forms plus a canonical `iso` echo of the parsed input.
 * @throws {RangeError} If the date string is empty, malformed, or any field is out of range.
 * @example
 * parseGregorianToJulian('1970-01-01', '00:00:00').jd; // => 2440587.5
 */
export function parseGregorianToJulian(dateStr: string, timeStr = ''): JulianResult {
  if (typeof dateStr !== 'string') {
    throw new TypeError('dateStr must be a string.');
  }
  const text = dateStr.trim();
  if (!text) {
    throw new RangeError('Pick a date.');
  }
  const dm = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(text);
  if (!dm) {
    throw new RangeError('Date must be YYYY-MM-DD.');
  }
  const year = Number(dm[1] ?? '');
  const month = Number(dm[2] ?? '');
  const day = Number(dm[3] ?? '');

  let hour = 0;
  let minute = 0;
  let second = 0;
  const t = (timeStr ?? '').trim();
  if (t) {
    const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (!tm) {
      throw new RangeError('Time must be HH:MM or HH:MM:SS.');
    }
    hour = Number(tm[1] ?? '0');
    minute = Number(tm[2] ?? '0');
    second = Number(tm[3] ?? '0');
  }

  return gregorianToJulian(year, month, day, { hour, minute, second });
}

/**
 * Convert an astronomical Julian Date back to a proleptic Gregorian UTC date.
 *
 * @param jd - Julian Date (must be a non-negative finite number).
 * @returns The reconstructed date `parts`, a canonical `iso` string, plus `jdn`, `mjd`, and the echoed `jd`.
 * @throws {TypeError} If `jd` is not a finite number.
 * @throws {RangeError} If `jd` is negative.
 * @example
 * julianToGregorian(2451545.0).iso; // => '2000-01-01 12:00:00 UTC'
 */
export function julianToGregorian(jd: number): GregorianResult {
  requireInt(jd, 'jd');
  if (jd < 0) {
    throw new RangeError('Julian Date must be non-negative.');
  }
  const parts = jdToGregorianRaw(jd);
  return {
    parts,
    iso: formatIso(parts),
    jdn: Math.floor(jd + 0.5),
    mjd: jd - 2400000.5,
    jd,
  };
}
