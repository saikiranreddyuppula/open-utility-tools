import { describe, it, expect } from 'vitest';
import { nthWeekdayOfMonth } from '../../src/time/nth-weekday-of-month';

describe('nthWeekdayOfMonth', () => {
  it('finds the 3rd Thursday of November 2026', () => {
    expect(nthWeekdayOfMonth({ year: 2026, month: 10, weekday: 4, ordinal: 2 })).toEqual({
      iso: '2026-11-19',
      weekday: 'Thursday',
      longLabel: '3rd Thursday of November 2026',
      day: 19,
      ordinalLabel: '3rd',
    });
  });

  it('finds the last Monday of May 2026 (Memorial Day)', () => {
    expect(nthWeekdayOfMonth({ year: 2026, month: 4, weekday: 1, ordinal: 5 })).toEqual({
      iso: '2026-05-25',
      weekday: 'Monday',
      longLabel: 'Last Monday of May 2026',
      day: 25,
      ordinalLabel: 'Last',
    });
  });

  it('finds the last Thursday of November 2026 (Thanksgiving)', () => {
    const r = nthWeekdayOfMonth({ year: 2026, month: 10, weekday: 4, ordinal: 5 });
    expect(r.iso).toBe('2026-11-26');
    expect(r.day).toBe(26);
    expect(r.longLabel).toBe('Last Thursday of November 2026');
  });

  it('finds the 1st Sunday of January 2026', () => {
    expect(nthWeekdayOfMonth({ year: 2026, month: 0, weekday: 0, ordinal: 0 })).toEqual({
      iso: '2026-01-04',
      weekday: 'Sunday',
      longLabel: '1st Sunday of January 2026',
      day: 4,
      ordinalLabel: '1st',
    });
  });

  it('zero-pads the year to four digits in the ISO output', () => {
    expect(nthWeekdayOfMonth({ year: 99, month: 0, weekday: 0, ordinal: 0 }).iso).toBe('0099-01-03');
  });

  it('throws RangeError when the requested occurrence does not exist', () => {
    // February 2026 has only four Mondays, so a "5th Monday" is impossible.
    expect(() => nthWeekdayOfMonth({ year: 2026, month: 1, weekday: 1, ordinal: 4 })).toThrow(
      'There is no 5th Monday in February 2026. That month only has 4 of them.',
    );
    expect(() => nthWeekdayOfMonth({ year: 2026, month: 1, weekday: 1, ordinal: 4 })).toThrow(
      RangeError,
    );
  });

  it('throws on out-of-range month and non-integer year', () => {
    expect(() => nthWeekdayOfMonth({ year: 2026, month: 12, weekday: 0, ordinal: 0 })).toThrow(
      RangeError,
    );
    expect(() => nthWeekdayOfMonth({ year: 2026.5, month: 0, weekday: 0, ordinal: 0 })).toThrow(
      TypeError,
    );
  });
});
