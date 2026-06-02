import { describe, it, expect } from 'vitest';
import {
  dateToDayOfYear,
  dayOfYearToDate,
  isLeapYear,
  daysInYear,
} from '../../src/time/day-of-year';

describe('dateToDayOfYear', () => {
  it('computes the ordinal day in a leap year', () => {
    expect(dateToDayOfYear('2024-03-01')).toEqual({
      day: 61,
      remaining: 305,
      total: 366,
      percent: '16.7',
      weekday: 'Friday',
      leap: true,
    });
  });

  it('handles the last day of a non-leap year', () => {
    expect(dateToDayOfYear('2023-12-31')).toEqual({
      day: 365,
      remaining: 0,
      total: 365,
      percent: '100.0',
      weekday: 'Sunday',
      leap: false,
    });
  });

  it('handles January 1', () => {
    expect(dateToDayOfYear('2024-01-01')).toEqual({
      day: 1,
      remaining: 365,
      total: 366,
      percent: '0.3',
      weekday: 'Monday',
      leap: true,
    });
  });

  it('rejects a non-existent calendar date', () => {
    expect(() => dateToDayOfYear('2023-02-29')).toThrow(RangeError);
    expect(() => dateToDayOfYear('2023-02-29')).toThrow('Enter a valid date.');
  });
});

describe('dayOfYearToDate', () => {
  it('round-trips a leap-year ordinal back to a date', () => {
    expect(dayOfYearToDate(2024, 61)).toEqual({
      date: '2024-03-01',
      weekday: 'Friday',
      remaining: 305,
      total: 366,
    });
  });

  it('resolves a mid-year ordinal', () => {
    expect(dayOfYearToDate(2025, 200)).toEqual({
      date: '2025-07-19',
      weekday: 'Saturday',
      remaining: 165,
      total: 365,
    });
  });

  it('accepts day 366 in a leap year', () => {
    expect(dayOfYearToDate(2024, 366)).toEqual({
      date: '2024-12-31',
      weekday: 'Tuesday',
      remaining: 0,
      total: 366,
    });
  });

  it('rejects day 366 in a non-leap year', () => {
    expect(() => dayOfYearToDate(2023, 366)).toThrow(RangeError);
    expect(() => dayOfYearToDate(2023, 366)).toThrow(
      'Day must be between 1 and 365 for 2023.',
    );
  });

  it('rejects a non-integer ordinal', () => {
    expect(() => dayOfYearToDate(2024, 1.5)).toThrow(TypeError);
  });
});

describe('calendar helpers', () => {
  it('detects leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('reports days in year', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2023)).toBe(365);
  });
});
