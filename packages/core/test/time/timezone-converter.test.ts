import { describe, it, expect } from 'vitest';
import {
  convertTimezone,
  wallClockToInstant,
  parseWallClock,
  formatInZone,
} from '../../src/time/timezone-converter';

describe('convertTimezone', () => {
  it('converts noon UTC into multiple target zones (rendering order preserved)', () => {
    const r = convertTimezone('2026-06-02T12:00', 'UTC', [
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
    ]);
    expect(r.iso).toBe('2026-06-02T12:00:00.000Z');
    expect(r.renderings).toEqual([
      { zone: 'America/New_York', formatted: 'Jun 2, 2026, 8:00 AM' },
      { zone: 'Europe/London', formatted: 'Jun 2, 2026, 1:00 PM' },
      { zone: 'Asia/Tokyo', formatted: 'Jun 2, 2026, 9:00 PM' },
    ]);
  });

  it('interprets the wall-clock time as local to the source zone (New York in winter / EST)', () => {
    const r = convertTimezone('2026-01-15T09:00', 'America/New_York', ['Asia/Tokyo', 'UTC']);
    expect(r.iso).toBe('2026-01-15T14:00:00.000Z');
    expect(r.renderings).toEqual([
      { zone: 'Asia/Tokyo', formatted: 'Jan 15, 2026, 11:00 PM' },
      { zone: 'UTC', formatted: 'Jan 15, 2026, 2:00 PM' },
    ]);
  });

  it('handles a half-hour-offset target zone and a day rollover (Tokyo -> Kolkata)', () => {
    const r = convertTimezone('2026-03-10T00:00', 'Asia/Tokyo', ['Asia/Kolkata']);
    expect(r.iso).toBe('2026-03-09T15:00:00.000Z');
    expect(r.renderings).toEqual([{ zone: 'Asia/Kolkata', formatted: 'Mar 9, 2026, 8:30 PM' }]);
  });

  it('throws RangeError when targetZones is empty', () => {
    expect(() => convertTimezone('2026-06-02T12:00', 'UTC', [])).toThrow(RangeError);
  });

  it('throws RangeError on an unknown target timezone', () => {
    expect(() => convertTimezone('2026-06-02T12:00', 'UTC', ['Mars/Olympus'])).toThrow(RangeError);
  });
});

describe('wallClockToInstant', () => {
  it('resolves a seconds-precision wall-clock in a source zone to a UTC instant', () => {
    const i = wallClockToInstant('2026-06-02T12:30:45', 'Europe/Paris');
    expect(i.toISOString()).toBe('2026-06-02T10:30:45.000Z');
  });

  it('throws RangeError on a malformed date/time string', () => {
    expect(() => wallClockToInstant('not-a-date', 'UTC')).toThrow(RangeError);
  });

  it('throws RangeError on an invalid source zone', () => {
    expect(() => wallClockToInstant('2026-06-02T12:00', 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('parseWallClock', () => {
  it('parses a minute-precision string with second defaulting to 0', () => {
    expect(parseWallClock('2026-06-02T12:00')).toEqual({
      year: 2026,
      month: 6,
      day: 2,
      hour: 12,
      minute: 0,
      second: 0,
    });
  });

  it('throws RangeError on an impossible month', () => {
    expect(() => parseWallClock('2026-13-02T12:00')).toThrow(RangeError);
  });
});

describe('formatInZone', () => {
  it('renders an instant in en-US medium/short style', () => {
    const out = formatInZone(new Date('2026-06-02T12:00:00.000Z'), 'UTC');
    expect(out).toBe('Jun 2, 2026, 12:00 PM');
  });

  it('throws RangeError on an invalid Date', () => {
    expect(() => formatInZone(new Date('nope'), 'UTC')).toThrow(RangeError);
  });
});
