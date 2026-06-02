// Extracted from tools/time/swatch-internet-time. Pure, isomorphic time-of-day
// math — no DOM, no Date construction, runs in the browser, Node, and Bun.
//
// Swatch Internet Time divides one day into 1000 ".beats" (1 beat = 86.4 s),
// measured from midnight Biel Mean Time (BMT = UTC+1, no DST).

/** BMT = Biel Mean Time = UTC+1, no DST. Offset from UTC, in minutes. */
const BMT_OFFSET_MIN = 60;

/** Seconds in one day. */
const SECONDS_PER_DAY = 86400;

/** Seconds per beat (86400 / 1000). */
const SECONDS_PER_BEAT = 86.4;

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

/**
 * Formats a count of seconds (wrapped into a single day) as a `HH:MM:SS`
 * 24-hour clock string. Negative and >1 day inputs wrap modulo 24h.
 */
function secondsToClock(sec: number): string {
  const s = ((sec % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${pad(hh, 2)}:${pad(mm, 2)}:${pad(ss, 2)}`;
}

/** Result of converting a local time of day into Swatch Internet Time. */
export interface TimeToBeatsResult {
  /** Whole beats, `0`–`999` (floored). */
  beats: number;
  /** Whole beats formatted as the canonical `@NNN` label, e.g. `"@541"`. */
  beatsLabel: string;
  /** Fractional beats with full precision, e.g. `541.6666666666666`. */
  beatsPrecise: number;
  /** Fractional beats label rounded to 2 decimals, e.g. `"@541.67"`. */
  beatsPreciseLabel: string;
  /** The equivalent BMT (UTC+1) wall clock as `HH:MM:SS`. */
  bmtClock: string;
  /** The input local time normalized to `HH:MM:SS`. */
  localTime: string;
}

/** Result of converting Swatch Internet Time beats back to a local time. */
export interface BeatsToTimeResult {
  /** Local wall clock for the requested UTC offset, as `HH:MM:SS`. */
  localTime: string;
  /** The equivalent BMT (UTC+1) wall clock as `HH:MM:SS`. */
  bmtClock: string;
  /** Whole beats normalized into `0`–`999`. */
  beats: number;
  /** Whole beats formatted as the canonical `@NNN` label, e.g. `"@500"`. */
  beatsLabel: string;
}

/**
 * Converts a local time of day to Swatch Internet Time beats.
 *
 * The local time is shifted by `utcOffsetMinutes` to UTC, then to Biel Mean
 * Time (UTC+1, no DST), and the resulting seconds-since-BMT-midnight are
 * divided by 86.4 to yield beats. The instant wraps within a single day, so
 * the date is irrelevant — only the time of day matters.
 *
 * @param time - Local time of day as `HH:MM` or `HH:MM:SS` (24-hour). Seconds
 *   default to `0` and minutes to `0` when omitted.
 * @param utcOffsetMinutes - The local time's offset from UTC in minutes (e.g.
 *   `330` for IST/UTC+05:30, `-480` for PST/UTC-08:00, `0` for UTC).
 * @returns The whole and precise beats (with `@`-prefixed labels), the
 *   equivalent BMT clock, and the normalized local time.
 * @throws {TypeError} If `time` is not a string.
 * @throws {RangeError} If `utcOffsetMinutes` is not finite, or `time` is not a
 *   valid `HH:MM[:SS]` with `hh` 0–23, `mm` 0–59, `ss` 0–59.
 *
 * @example
 * ```ts
 * import { timeToBeats } from '@open-utility-tools/core/time/swatch-internet-time';
 * timeToBeats('12:00:00', 0).beatsLabel;        // → '@541'
 * timeToBeats('12:00:00', 0).beatsPreciseLabel; // → '@541.67'
 * timeToBeats('09:30:00', 330).beatsLabel;      // → '@208' (IST)
 * ```
 */
export function timeToBeats(time: string, utcOffsetMinutes: number): TimeToBeatsResult {
  if (typeof time !== 'string') {
    throw new TypeError(`time must be a string, got ${typeof time}`);
  }
  if (!Number.isFinite(utcOffsetMinutes)) {
    throw new RangeError('utcOffsetMinutes must be a finite number');
  }

  const parts = time.split(':');
  const hh = Number(parts[0]);
  const rawMm = parts[1];
  const rawSs = parts[2];
  const mm = Number(rawMm ?? '0');
  const ss = Number(rawSs ?? '0');

  if (
    !Number.isFinite(hh) ||
    !Number.isFinite(mm) ||
    !Number.isFinite(ss) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59 ||
    ss < 0 ||
    ss > 59
  ) {
    throw new RangeError(
      `Invalid time: ${JSON.stringify(time)} (expected HH:MM or HH:MM:SS)`,
    );
  }

  const localSec = hh * 3600 + mm * 60 + ss;
  // Convert local time of day to BMT seconds since BMT midnight.
  const bmtSec = localSec - utcOffsetMinutes * 60 + BMT_OFFSET_MIN * 60;
  const beatsVal =
    (((bmtSec % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY) / SECONDS_PER_BEAT;
  const wholeBeats = Math.floor(beatsVal);

  return {
    beats: wholeBeats,
    beatsLabel: `@${pad(wholeBeats, 3)}`,
    beatsPrecise: beatsVal,
    beatsPreciseLabel: `@${beatsVal.toFixed(2)}`,
    bmtClock: secondsToClock(bmtSec),
    localTime: secondsToClock(localSec),
  };
}

/**
 * Converts Swatch Internet Time beats back to a local time of day.
 *
 * Beats are normalized into `0`–`999` (so values like `1500` wrap to `500` and
 * negatives wrap forward), multiplied by 86.4 to get seconds since BMT
 * midnight, then shifted from BMT (UTC+1) to the requested UTC offset.
 *
 * @param beats - Beats value; normalized modulo 1000 (non-integers and
 *   out-of-range values are wrapped, matching the original tool's behavior).
 * @param utcOffsetMinutes - The target local time's offset from UTC in minutes.
 * @returns The local clock, the BMT clock, and the normalized whole beats with
 *   its `@`-prefixed label.
 * @throws {RangeError} If `beats` or `utcOffsetMinutes` is not a finite number.
 *
 * @example
 * ```ts
 * import { beatsToTime } from '@open-utility-tools/core/time/swatch-internet-time';
 * beatsToTime(500, 0).localTime; // → '11:00:00' (BMT noon, shown in UTC)
 * beatsToTime(0, 60).localTime;  // → '00:00:00' (BMT midnight, shown in CET)
 * ```
 */
export function beatsToTime(beats: number, utcOffsetMinutes: number): BeatsToTimeResult {
  if (!Number.isFinite(beats)) {
    throw new RangeError('beats must be a finite number');
  }
  if (!Number.isFinite(utcOffsetMinutes)) {
    throw new RangeError('utcOffsetMinutes must be a finite number');
  }

  const normBeats = ((beats % 1000) + 1000) % 1000;
  const bmtSec = normBeats * SECONDS_PER_BEAT;
  // Convert BMT seconds since BMT midnight to chosen offset local time.
  const localSec = bmtSec - BMT_OFFSET_MIN * 60 + utcOffsetMinutes * 60;
  const wholeBeats = Math.floor(normBeats);

  return {
    localTime: secondsToClock(localSec),
    bmtClock: secondsToClock(bmtSec),
    beats: wholeBeats,
    beatsLabel: `@${pad(wholeBeats, 3)}`,
  };
}
