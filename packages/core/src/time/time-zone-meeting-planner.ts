// Extracted from tools/time/time-zone-meeting-planner. Pure, isomorphic.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Parse "+5.5", "-8", "+05:30" or "0" into a UTC offset in minutes. */
function parseOffset(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const colon = t.match(/^([+-]?)(\d{1,2}):(\d{2})$/);
  if (colon) {
    const sign = colon[1] === '-' ? -1 : 1;
    const h = Number(colon[2] ?? '');
    const m = Number(colon[3] ?? '');
    if (!Number.isFinite(h) || !Number.isFinite(m) || h > 14 || m > 59) return null;
    return sign * (h * 60 + m);
  }
  const dec = Number(t);
  if (!Number.isFinite(dec) || Math.abs(dec) > 14) return null;
  return Math.round(dec * 60);
}

/** Format a UTC offset in minutes as `UTC±HH:MM`. */
function fmtOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse a wall-clock "HH:MM" into minutes since midnight (0–1439). */
function parseClockMinutes(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1] ?? '');
  const min = Number(m[2] ?? '');
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface MeetingParticipantInput {
  /** Display label, e.g. `"Tokyo"`. Falls back to `"Participant"` when blank. */
  label: string;
  /** UTC offset string: `"+9"`, `"-8"`, `"+05:30"`, `"+5.5"`, or `"0"`. */
  offset: string;
}

export interface MeetingPlannerOptions {
  /** Base date as `YYYY-MM-DD`. */
  baseDate: string;
  /** Base wall-clock time as `HH:MM`. */
  baseTime: string;
  /** Base UTC offset string: `"+1"`, `"-8"`, `"+05:30"`, etc. */
  baseOffset: string;
  /** Participants, each with a label and UTC offset string. */
  participants: MeetingParticipantInput[];
  /** Acceptable-window start as `HH:MM`. Default `"08:00"`. */
  windowStart?: string;
  /** Acceptable-window end as `HH:MM` (exclusive). Default `"20:00"`. */
  windowEnd?: string;
}

export interface MeetingParticipantRow {
  /** Display label. */
  label: string;
  /** This participant's UTC offset in minutes. */
  offsetMin: number;
  /** Formatted offset, e.g. `"UTC+09:00"`. */
  offsetLabel: string;
  /** Local wall-clock time as `HH:MM`. */
  clock: string;
  /** Local weekday abbreviation, e.g. `"Mon"`. */
  weekday: string;
  /** Calendar-day shift relative to the base local date (e.g. `-1`, `0`, `+1`). */
  dayShift: number;
  /** Whether the local time falls within the acceptable window. */
  inHours: boolean;
}

export interface MeetingPlannerResult {
  /** One row per parsed participant, in input order. */
  rows: MeetingParticipantRow[];
  /** Count of participants whose local time is within working hours. */
  inCount: number;
  /** The base UTC offset in minutes. */
  baseOffsetMin: number;
  /** Formatted base offset, e.g. `"UTC+01:00"`. */
  baseOffsetLabel: string;
}

/**
 * Projects a single meeting instant — defined by a base date, time and UTC
 * offset — onto a set of participants at fixed UTC offsets, reporting each
 * one's local wall-clock time, weekday, day shift, and whether it lands inside
 * an acceptable working-hours window. Pure and isomorphic: no DOM, runs in the
 * browser, Node, and Bun. Offsets are fixed (no DST/IANA zone handling).
 *
 * Participants whose `offset` cannot be parsed are silently skipped (matching
 * the source UI). A row's label falls back to `"Participant"` when blank.
 *
 * @param options - Base date/time/offset, participants, and the working window.
 * @returns Per-participant local times plus the in-hours count and base offset.
 * @throws {RangeError} If the base date/time is invalid, the base offset cannot
 *   be parsed, the window times are invalid or non-increasing, or no
 *   participant offset could be parsed.
 *
 * @example
 * ```ts
 * import { planMeeting } from '@open-utility-tools/core/time/time-zone-meeting-planner';
 * const r = planMeeting({
 *   baseDate: '2026-06-01',
 *   baseTime: '14:00',
 *   baseOffset: '+1',
 *   participants: [
 *     { label: 'New York', offset: '-4' },
 *     { label: 'Tokyo', offset: '+9' },
 *   ],
 * });
 * r.rows[0]; // { label: 'New York', clock: '09:00', weekday: 'Mon', dayShift: 0, inHours: true, ... }
 * r.rows[1]; // { label: 'Tokyo', clock: '22:00', weekday: 'Mon', dayShift: 0, inHours: false, ... }
 * ```
 */
export function planMeeting(options: MeetingPlannerOptions): MeetingPlannerResult {
  const { baseDate, baseTime, baseOffset, participants } = options;
  const windowStart = options.windowStart ?? '08:00';
  const windowEnd = options.windowEnd ?? '20:00';

  const dm = baseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = baseTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) throw new RangeError('Enter a valid base date and time.');

  const y = Number(dm[1] ?? '');
  const mo = Number(dm[2] ?? '');
  const d = Number(dm[3] ?? '');
  const hh = Number(tm[1] ?? '');
  const mi = Number(tm[2] ?? '');
  if (![y, mo, d, hh, mi].every((n) => Number.isFinite(n)) || hh > 23 || mi > 59) {
    throw new RangeError('Enter a valid base date and time.');
  }

  const baseOff = parseOffset(baseOffset);
  if (baseOff === null) {
    throw new RangeError('Enter a valid base UTC offset (e.g. +1, -8, +05:30).');
  }

  const ws = parseClockMinutes(windowStart);
  const we = parseClockMinutes(windowEnd);
  if (ws === null || we === null || ws >= we) {
    throw new RangeError('Acceptable window must be valid times with start before end.');
  }

  // Build a UTC instant for the base local datetime.
  const baseUtcMs = Date.UTC(y, mo - 1, d, hh, mi) - baseOff * 60000;

  const rows: MeetingParticipantRow[] = [];
  for (const p of participants) {
    const label = p.label.trim() || 'Participant';
    const off = parseOffset(p.offset);
    if (off === null) continue;

    const localMs = baseUtcMs + off * 60000;
    const ld = new Date(localMs);
    const lh = ld.getUTCHours();
    const lm = ld.getUTCMinutes();
    const minutesOfDay = lh * 60 + lm;

    // Day shift relative to the base local calendar date.
    const baseDayUtc = Date.UTC(y, mo - 1, d);
    const localDayUtc = Date.UTC(ld.getUTCFullYear(), ld.getUTCMonth(), ld.getUTCDate());
    const dayShift = Math.round((localDayUtc - baseDayUtc) / 86400000);

    rows.push({
      label,
      offsetMin: off,
      offsetLabel: fmtOffset(off),
      clock: `${pad(lh)}:${pad(lm)}`,
      weekday: WEEKDAYS[ld.getUTCDay()] ?? '',
      dayShift,
      inHours: minutesOfDay >= ws && minutesOfDay < we,
    });
  }

  if (rows.length === 0) {
    throw new RangeError('Add at least one participant as "Label, offset" (e.g. "Tokyo, +9").');
  }

  const inCount = rows.filter((r) => r.inHours).length;
  return { rows, inCount, baseOffsetMin: baseOff, baseOffsetLabel: fmtOffset(baseOff) };
}
