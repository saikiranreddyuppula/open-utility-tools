import { describe, it, expect } from 'vitest';

import { weekNumber, weekNumberFromISO } from '../../src/time/week-number';

describe('weekNumber', () => {
  it('computes a mid-year weekday and day-of-year', () => {
    expect(weekNumber(2026, 6, 2)).toEqual({
      week: 23,
      year: 2026,
      iso: '2026-W23',
      dayOfYear: 153,
      weekday: 'Tuesday',
    });
  });

  it('handles a leap-year December (day-of-year 366)', () => {
    expect(weekNumber(2020, 12, 31)).toEqual({
      week: 53,
      year: 2020,
      iso: '2020-W53',
      dayOfYear: 366,
      weekday: 'Thursday',
    });
  });

  it('reports an ISO week-year that differs from the calendar year', () => {
    // Dec 29, 2025 belongs to ISO week 01 of week-year 2026.
    expect(weekNumber(2025, 12, 29)).toEqual({
      week: 1,
      year: 2026,
      iso: '2026-W01',
      dayOfYear: 363,
      weekday: 'Monday',
    });
  });

  it('throws RangeError for an out-of-range month', () => {
    expect(() => weekNumber(2026, 0, 5)).toThrow(RangeError);
    expect(() => weekNumber(2026, 13, 1)).toThrow(RangeError);
  });

  it('throws RangeError for a non-existent calendar date', () => {
    expect(() => weekNumber(2026, 2, 30)).toThrow(RangeError);
  });

  it('throws TypeError for a non-finite component', () => {
    expect(() => weekNumber(2026, Number.NaN, 1)).toThrow(TypeError);
  });
});

describe('weekNumberFromISO', () => {
  it('parses a YYYY-MM-DD string', () => {
    expect(weekNumberFromISO('2024-01-01')).toEqual({
      week: 1,
      year: 2024,
      iso: '2024-W01',
      dayOfYear: 1,
      weekday: 'Monday',
    });
  });

  it('matches the component-based API', () => {
    expect(weekNumberFromISO('2016-01-04')).toEqual(weekNumber(2016, 1, 4));
  });

  it('throws RangeError for malformed input', () => {
    expect(() => weekNumberFromISO('not-a-date')).toThrow(RangeError);
    expect(() => weekNumberFromISO('2026-6-2')).toThrow(RangeError);
  });
});