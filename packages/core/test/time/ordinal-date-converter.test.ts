import { describe, it, expect } from 'vitest';
import { dateToOrdinal, ordinalToDate } from '../../src/time/ordinal-date-converter';

describe('dateToOrdinal', () => {
  it('converts a leap-year date to its ordinal form', () => {
    expect(dateToOrdinal('2024-03-01')).toEqual({
      ordinal: '2024-061',
      year: 2024,
      dayOfYear: 61,
      daysRemaining: 305,
      daysInYear: 366,
      leapYear: true,
    });
  });

  it('handles the last day of a common year (zero days remaining)', () => {
    expect(dateToOrdinal('2023-12-31')).toEqual({
      ordinal: '2023-365',
      year: 2023,
      dayOfYear: 365,
      daysRemaining: 0,
      daysInYear: 365,
      leapYear: false,
    });
  });

  it('handles the first day of the year', () => {
    expect(dateToOrdinal('2024-01-01')).toEqual({
      ordinal: '2024-001',
      year: 2024,
      dayOfYear: 1,
      daysRemaining: 365,
      daysInYear: 366,
      leapYear: true,
    });
  });

  it('throws RangeError for a non-existent / malformed date', () => {
    expect(() => dateToOrdinal('not-a-date')).toThrow(RangeError);
    expect(() => dateToOrdinal('2023-02-29')).toThrow(RangeError);
  });
});

describe('ordinalToDate', () => {
  it('round-trips a leap-year ordinal date back to the calendar date', () => {
    expect(ordinalToDate(2024, 61)).toEqual({
      date: '2024-03-01',
      ordinal: '2024-061',
      daysRemaining: 305,
      daysInYear: 366,
      leapYear: true,
    });
  });

  it('resolves day 366 in a leap year to Dec 31', () => {
    expect(ordinalToDate(2024, 366)).toEqual({
      date: '2024-12-31',
      ordinal: '2024-366',
      daysRemaining: 0,
      daysInYear: 366,
      leapYear: true,
    });
  });

  it('throws RangeError when day-of-year exceeds days in a common year', () => {
    expect(() => ordinalToDate(2023, 366)).toThrow(RangeError);
  });

  it('throws TypeError for a non-integer day-of-year', () => {
    expect(() => ordinalToDate(2024, 1.5)).toThrow(TypeError);
  });
});
