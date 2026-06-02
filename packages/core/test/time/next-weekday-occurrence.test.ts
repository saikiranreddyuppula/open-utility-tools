import { describe, it, expect } from 'vitest';

import { nextWeekdayOccurrence } from '../../src/time/next-weekday-occurrence';

// 2026-06-02 is a Tuesday. All expected values were produced by executing the
// extracted function with `bun`.
describe('nextWeekdayOccurrence', () => {
  it('finds the next Monday after a Tuesday start', () => {
    const result = nextWeekdayOccurrence('2026-06-02', 1);
    expect(result.startWeekday).toBe('Tuesday');
    expect(result.target).toEqual({
      iso: '2026-06-08',
      weekday: 'Monday',
      daysFromStart: 6,
    });
    expect(result.list).toHaveLength(8);
    expect(result.list[0]?.iso).toBe('2026-06-08');
    expect(result.list[7]).toEqual({
      iso: '2026-07-27',
      weekday: 'Monday',
      daysFromStart: 55,
    });
  });

  it('skips the start date by default when it already matches the target weekday', () => {
    const result = nextWeekdayOccurrence('2026-06-02', 2);
    expect(result.target).toEqual({
      iso: '2026-06-09',
      weekday: 'Tuesday',
      daysFromStart: 7,
    });
  });

  it('includes the start date when includeStart is set', () => {
    const result = nextWeekdayOccurrence('2026-06-02', 2, { includeStart: true });
    expect(result.target).toEqual({
      iso: '2026-06-02',
      weekday: 'Tuesday',
      daysFromStart: 0,
    });
    expect(result.list[0]?.iso).toBe('2026-06-02');
  });

  it('searches backward with direction "previous"', () => {
    const result = nextWeekdayOccurrence('2026-06-02', 5, { direction: 'previous' });
    expect(result.target).toEqual({
      iso: '2026-05-29',
      weekday: 'Friday',
      daysFromStart: -4,
    });
    expect(result.list[1]).toEqual({
      iso: '2026-05-22',
      weekday: 'Friday',
      daysFromStart: -11,
    });
  });

  it('returns the Nth occurrence', () => {
    const result = nextWeekdayOccurrence('2026-06-02', 0, { n: 3 });
    expect(result.target).toEqual({
      iso: '2026-06-21',
      weekday: 'Sunday',
      daysFromStart: 19,
    });
    // The list still starts at the nearest occurrence regardless of n.
    expect(result.list[0]?.iso).toBe('2026-06-07');
  });

  it('throws RangeError on malformed and out-of-range input', () => {
    expect(() => nextWeekdayOccurrence('   ', 1)).toThrow(RangeError);
    expect(() => nextWeekdayOccurrence('06/02/2026', 1)).toThrow('Start date must be YYYY-MM-DD.');
    expect(() => nextWeekdayOccurrence('2026-02-30', 1)).toThrow('That start date does not exist.');
    expect(() => nextWeekdayOccurrence('2026-06-02', 7)).toThrow(RangeError);
    expect(() => nextWeekdayOccurrence('2026-06-02', 1, { n: 0 })).toThrow('Occurrence N must be a positive integer.');
    expect(() => nextWeekdayOccurrence('2026-06-02', 1, { n: 999 })).toThrow('Occurrence N is too large (max 520).');
  });
});
