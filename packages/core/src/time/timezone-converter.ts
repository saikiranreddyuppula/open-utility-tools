/**
 * Timezone Converter — interpret a wall-clock date/time as belonging to a
 * source IANA timezone, then render that same instant in one or more target
 * timezones. Backed entirely by the runtime's built-in Intl/IANA database, so
 * it works identically in modern browsers, Node 20+, and Bun with no data
 * bundled.
 *
 * @module
 */

/** A parsed wall-clock date/time with no associated timezone. */
export interface WallClock {
  /** Full year, e.g. 2026. */
  year: number;
  /** Month, 1-12. */
  month: number;
  /** Day of month, 1-31. */
  day: number;
  /** Hour, 0-23. */
  hour: number;
  /** Minute, 0-59. */
  minute: number;
  /** Second, 0-59. */
  second: number;
}

/** One target zone's rendered result. */
export interface ZoneRendering {
  /** The IANA timezone identifier, e.g. `"Asia/Tokyo"`. */
  zone: string;
  /** Localized `en-US` rendering (medium date, short time), e.g. `"Jun 2, 2026, 9:00 PM"`. */
  formatted: string;
}

/** Result of converting a wall-clock time from a source zone into target zones. */
export interface ConversionResult {
  /** The absolute instant the wall-clock time denotes, as a UTC `Date`. */
  instant: Date;
  /** The instant as an ISO-8601 UTC string (`Date.prototype.toISOString`). */
  iso: string;
  /** The rendered string for each requested target zone, in request order. */
  renderings: ZoneRendering[];
}

const DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse a `datetime-local`-style string (`"YYYY-MM-DDTHH:mm"` with optional
 * `":ss"`) into its wall-clock components. The string carries no timezone; the
 * components are taken literally.
 *
 * @param dt - A wall-clock string such as `"2026-06-02T12:00"` or `"2026-06-02T12:00:45"`.
 * @returns The parsed {@link WallClock} components.
 * @throws {RangeError} If `dt` does not match the expected shape or encodes an
 *   impossible calendar value (e.g. month 13, day 32, hour 24).
 */
export function parseWallClock(dt: string): WallClock {
  const m = DT_RE.exec(dt);
  if (m === null) {
    throw new RangeError(
      `Invalid date/time string: "${dt}". Expected "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss".`,
    );
  }
  const yearStr = m[1];
  const monthStr = m[2];
  const dayStr = m[3];
  const hourStr = m[4];
  const minuteStr = m[5];
  const secStr = m[6];
  // The regex guarantees the first five groups are present; assert for strict TS.
  if (
    yearStr === undefined ||
    monthStr === undefined ||
    dayStr === undefined ||
    hourStr === undefined ||
    minuteStr === undefined
  ) {
    throw new RangeError(`Invalid date/time string: "${dt}".`);
  }
  const wall: WallClock = {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
    hour: Number(hourStr),
    minute: Number(minuteStr),
    second: secStr === undefined ? 0 : Number(secStr),
  };
  if (
    wall.month < 1 ||
    wall.month > 12 ||
    wall.day < 1 ||
    wall.day > 31 ||
    wall.hour > 23 ||
    wall.minute > 59 ||
    wall.second > 59
  ) {
    throw new RangeError(`Invalid date/time string: "${dt}".`);
  }
  return wall;
}

/**
 * Compute the offset (in milliseconds) of `timeZone` at a given UTC instant:
 * `wallClockTime - utcTime`. Positive east of UTC.
 *
 * @throws {RangeError} If `timeZone` is not a valid IANA identifier.
 */
function getZoneOffsetMs(utcMs: number, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    parts = dtf.formatToParts(new Date(utcMs));
  } catch {
    throw new RangeError(`Invalid time zone: "${timeZone}".`);
  }
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const y = map['year'];
  const mo = map['month'];
  const d = map['day'];
  let h = map['hour'];
  const mi = map['minute'];
  const s = map['second'];
  if (
    y === undefined ||
    mo === undefined ||
    d === undefined ||
    h === undefined ||
    mi === undefined ||
    s === undefined
  ) {
    throw new RangeError(`Invalid time zone: "${timeZone}".`);
  }
  // `formatToParts` can emit hour 24 for midnight in some engines; normalize.
  if (h === 24) h = 0;
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, s);
  return asUTC - utcMs;
}

/**
 * Resolve a wall-clock time, interpreted as being in `sourceZone`, to the
 * absolute UTC instant it denotes.
 *
 * @param dt - A wall-clock string (`"YYYY-MM-DDTHH:mm"` with optional `":ss"`)
 *   or pre-parsed {@link WallClock} components.
 * @param sourceZone - IANA timezone the wall-clock time is expressed in, e.g. `"America/New_York"`.
 * @returns A `Date` representing the absolute UTC instant.
 * @throws {RangeError} If `dt` is malformed or `sourceZone` is not a valid IANA zone.
 *
 * @example
 * ```ts
 * const i = wallClockToInstant('2026-01-15T09:00', 'America/New_York');
 * i.toISOString(); // '2026-01-15T14:00:00.000Z'
 * ```
 */
export function wallClockToInstant(dt: string | WallClock, sourceZone: string): Date {
  const w = typeof dt === 'string' ? parseWallClock(dt) : dt;
  // First guess: treat the wall-clock components as if they were UTC.
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Shift by the zone's offset to land on the instant whose sourceZone
  // wall-clock equals the input. Refine once to settle DST transitions.
  const off1 = getZoneOffsetMs(guess, sourceZone);
  let ms = guess - off1;
  const off2 = getZoneOffsetMs(ms, sourceZone);
  if (off2 !== off1) ms = guess - off2;
  return new Date(ms);
}

/**
 * Render an absolute instant in a target timezone using the `en-US` locale
 * with a medium date and short time (e.g. `"Jun 2, 2026, 9:00 PM"`).
 *
 * @param instant - The absolute instant to render.
 * @param zone - Target IANA timezone, e.g. `"Asia/Tokyo"`.
 * @returns The localized string.
 * @throws {RangeError} If `zone` is not a valid IANA zone or `instant` is invalid.
 */
export function formatInZone(instant: Date, zone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Cannot format an invalid Date.');
  }
  try {
    return instant.toLocaleString('en-US', {
      timeZone: zone,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    throw new RangeError(`Invalid time zone: "${zone}".`);
  }
}

/**
 * Convert a wall-clock date/time expressed in `sourceZone` into the equivalent
 * local renderings across one or more `targetZones`. This is the primary entry
 * point that the Timezone Converter tool is built around: it resolves the input
 * to a single absolute instant and then formats that instant in every requested
 * zone.
 *
 * @param dt - Wall-clock string (`"YYYY-MM-DDTHH:mm"`, optional `":ss"`) or
 *   {@link WallClock} components, interpreted as local time in `sourceZone`.
 * @param sourceZone - IANA timezone the input is expressed in, e.g. `"UTC"`.
 * @param targetZones - IANA timezones to render the resulting instant in. Must
 *   be non-empty.
 * @returns A {@link ConversionResult} containing the resolved `instant`, its
 *   `iso` string, and per-zone `renderings` in request order.
 * @throws {RangeError} If `dt` is malformed, `sourceZone`/any target zone is not
 *   a valid IANA zone, or `targetZones` is empty.
 * @throws {TypeError} If `targetZones` is not an array.
 *
 * @example
 * ```ts
 * const r = convertTimezone('2026-06-02T12:00', 'UTC', [
 *   'America/New_York',
 *   'Europe/London',
 *   'Asia/Tokyo',
 * ]);
 * r.iso; // '2026-06-02T12:00:00.000Z'
 * r.renderings;
 * // [
 * //   { zone: 'America/New_York', formatted: 'Jun 2, 2026, 8:00 AM' },
 * //   { zone: 'Europe/London',    formatted: 'Jun 2, 2026, 1:00 PM' },
 * //   { zone: 'Asia/Tokyo',       formatted: 'Jun 2, 2026, 9:00 PM' },
 * // ]
 * ```
 */
export function convertTimezone(
  dt: string | WallClock,
  sourceZone: string,
  targetZones: readonly string[],
): ConversionResult {
  if (!Array.isArray(targetZones)) {
    throw new TypeError('targetZones must be an array of IANA timezone strings.');
  }
  if (targetZones.length === 0) {
    throw new RangeError('targetZones must contain at least one timezone.');
  }
  const instant = wallClockToInstant(dt, sourceZone);
  const renderings: ZoneRendering[] = targetZones.map((zone) => ({
    zone,
    formatted: formatInZone(instant, zone),
  }));
  return { instant, iso: instant.toISOString(), renderings };
}
