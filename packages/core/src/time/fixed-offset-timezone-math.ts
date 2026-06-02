/**
 * Fixed UTC Offset Converter — convert a wall-clock datetime tagged with a
 * fixed UTC offset into the equivalent wall-clock datetime at one or more other
 * fixed UTC offsets. No DST / IANA zone rules are applied: offsets are treated
 * as constant numeric shifts, which makes results fully deterministic.
 *
 * @module
 */

/** A single converted target offset row. */
export interface FixedOffsetTargetRow {
  /** Normalized offset label, e.g. `"-08:00"`. For an unparseable target line, the original text. */
  offsetLabel: string;
  /** Converted wall-clock datetime `"YYYY-MM-DD HH:MM:SS"`, or `"invalid offset"` if the line could not be parsed. */
  datetime: string;
  /** Hour difference from the source offset, e.g. `"+3.5 h"`, or `"—"` for an invalid line. */
  hourDiff: string;
  /** Calendar-day shift relative to the source wall-clock day, e.g. `"next day (+1)"`, or `"—"` for an invalid line. */
  dayShift: string;
}

/** Result of {@link convertFixedOffset}. */
export interface FixedOffsetResult {
  /** The true UTC instant of the source datetime, as an ISO 8601 string. */
  utcIso: string;
  /** Human-readable description of the source, e.g. `"2026-05-30 14:30:00 (+05:30)"`. */
  sourceLabel: string;
  /** One row per target offset, in input order. */
  rows: FixedOffsetTargetRow[];
}

/**
 * Parse a signed UTC offset such as `"+05:30"`, `"-8"`, `"+0545"`, `"0"`, or a
 * leading `"utc"`/`"gmt"` prefix into a count of minutes east of UTC.
 *
 * @returns Offset in minutes (positive east of UTC), or `null` when the text is
 *   empty / not a recognizable offset / out of the accepted range.
 */
function parseOffset(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return null;
  const m = /^([+-]?)(\d{1,2})(?::?(\d{2}))?$/.exec(text.replace(/^utc|^gmt/i, '').trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2] ?? '');
  const mins = Number(m[3] ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours > 14 || mins > 59) return null;
  return sign * (hours * 60 + mins);
}

/** Format a minute offset as a normalized `"+HH:MM"` / `"-HH:MM"` label. */
function fmtOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convert a fixed-offset wall-clock datetime to one or more other fixed UTC
 * offsets, without applying any DST or IANA time-zone rules.
 *
 * The source datetime is read as plain wall-clock components and combined with
 * `sourceOffset` to derive the true UTC instant; each target offset is then a
 * constant shift away from that instant. Target lines that cannot be parsed are
 * not fatal — they appear in {@link FixedOffsetResult.rows} as a row whose
 * `datetime` is `"invalid offset"`, mirroring the original tool.
 *
 * @param datetime - Source wall-clock datetime, `"YYYY-MM-DDTHH:MM"` or
 *   `"YYYY-MM-DD HH:MM"`, with optional `":SS"` seconds.
 * @param sourceOffset - The source's fixed UTC offset, e.g. `"+05:30"`, `"-8"`,
 *   `"+0545"`, `"0"`, or with a `"utc"`/`"gmt"` prefix.
 * @param targets - Target offsets separated by newlines and/or commas; each is
 *   parsed independently.
 * @returns The UTC instant plus one converted row per target offset.
 * @throws {TypeError} If `datetime` is empty or not in an accepted format.
 * @throws {RangeError} If `datetime` is numerically out of range, the
 *   `sourceOffset` is not a valid offset, or no target offsets are supplied.
 *
 * @example
 * convertFixedOffset('2026-05-30T14:30', '+05:30', '-08:00\n+00:00\n+09:00');
 * // => {
 * //   utcIso: '2026-05-30T09:00:00.000Z',
 * //   sourceLabel: '2026-05-30 14:30:00 (+05:30)',
 * //   rows: [
 * //     { offsetLabel: '-08:00', datetime: '2026-05-30 01:00:00', hourDiff: '-13.5 h', dayShift: 'same day' },
 * //     { offsetLabel: '+00:00', datetime: '2026-05-30 09:00:00', hourDiff: '-5.5 h',  dayShift: 'same day' },
 * //     { offsetLabel: '+09:00', datetime: '2026-05-30 18:00:00', hourDiff: '+3.5 h',  dayShift: 'same day' },
 * //   ],
 * // }
 */
export function convertFixedOffset(
  datetime: string,
  sourceOffset: string,
  targets: string,
): FixedOffsetResult {
  const text = datetime.trim();
  if (!text) {
    throw new TypeError('Enter a source datetime.');
  }

  // Parse the local datetime as plain wall-clock components (no zone applied yet).
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!m) {
    throw new TypeError('Datetime must look like 2026-05-30T14:30 (YYYY-MM-DDTHH:MM).');
  }
  const year = Number(m[1] ?? '');
  const month = Number(m[2] ?? '');
  const day = Number(m[3] ?? '');
  const hour = Number(m[4] ?? '');
  const minute = Number(m[5] ?? '');
  const second = Number(m[6] ?? '0');
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new TypeError('Could not parse the datetime fields.');
  }

  const srcMin = parseOffset(sourceOffset);
  if (srcMin === null) {
    throw new RangeError('Source offset is invalid. Use a form like +05:30 or -8.');
  }

  // Wall-clock as if UTC, then subtract the source offset to get the true UTC instant.
  const wallUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(wallUtcMs)) {
    throw new RangeError('Datetime is out of range.');
  }
  const trueUtcMs = wallUtcMs - srcMin * 60000;
  const utcDate = new Date(trueUtcMs);

  const targetLines = targets
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (targetLines.length === 0) {
    throw new RangeError('Add at least one target offset (one per line).');
  }

  const rows: FixedOffsetTargetRow[] = [];
  for (const line of targetLines) {
    const tMin = parseOffset(line);
    if (tMin === null) {
      rows.push({ offsetLabel: line, datetime: 'invalid offset', hourDiff: '—', dayShift: '—' });
      continue;
    }
    const localMs = trueUtcMs + tMin * 60000;
    const ld = new Date(localMs);
    const localStr =
      `${ld.getUTCFullYear()}-${pad2(ld.getUTCMonth() + 1)}-${pad2(ld.getUTCDate())} ` +
      `${pad2(ld.getUTCHours())}:${pad2(ld.getUTCMinutes())}:${pad2(ld.getUTCSeconds())}`;

    const diffMin = tMin - srcMin;
    const diffH = diffMin / 60;
    const diffLabel = `${diffMin >= 0 ? '+' : ''}${Number(diffH.toFixed(2))} h`;

    // Compare calendar day vs source wall-clock day.
    const srcDayMs = Date.UTC(year, month - 1, day);
    const tgtDayMs = Date.UTC(ld.getUTCFullYear(), ld.getUTCMonth(), ld.getUTCDate());
    const dayDelta = Math.round((tgtDayMs - srcDayMs) / 86400000);
    let dayShift = 'same day';
    if (dayDelta === 1) dayShift = 'next day (+1)';
    else if (dayDelta === -1) dayShift = 'previous day (-1)';
    else if (dayDelta > 1) dayShift = `+${dayDelta} days`;
    else if (dayDelta < -1) dayShift = `${dayDelta} days`;

    rows.push({ offsetLabel: fmtOffset(tMin), datetime: localStr, hourDiff: diffLabel, dayShift });
  }

  return {
    utcIso: utcDate.toISOString(),
    sourceLabel: `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)} (${fmtOffset(srcMin)})`,
    rows,
  };
}
