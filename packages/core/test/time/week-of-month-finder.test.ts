import { describe, it, expect } from 'vitest';

import { findWeekOfMonth } from '../../src/time/week-of-month-finder';

describe('findWeekOfMonth', () => {
  it('defaults to a Sunday week start and reaches into the previous month for the row span', () => {
    expect(findWeekOfMonth('2026-06-02')).toEqual({
      simple: 1,
      calendar: 1,
      isoStyle: 0,
      weekday: 'Tuesday',
      rowStart: '2026-05-31',
      rowEnd: '2026-06-06',
      isWeekend: false,
      daysInMonth: 30,
    });
  });

  it('shifts the row span and ISO-style number when the week starts on Monday', () => {
    expect(findWeekOfMonth('2026-06-02', 'mon')).toEqual({
      simple: 1,
      calendar: 1,
      isoStyle: 1,
      weekday: 'Tuesday',
      rowStart: '2026-06-01',
      rowEnd: '2026-06-07',
      isWeekend: false,
      daysInMonth: 30,
    });
  });

  it('handles a fifth-week date whose row spills into the next month', () => {
    expect(findWeekOfMonth('2024-02-29', 'mon')).toEqual({
      simple: 5,
      calendar: 5,
      isoStyle: 4,
      weekday: 'Thursday',
      rowStart: '2024-02-26',
      rowEnd: '2024-03-03',
      isWeekend: false,
      daysInMonth: 29,
    });
  });

  it('flags weekends and clamps the row span to month boundaries', () => {
    expect(findWeekOfMonth('2025-08-03', 'mon')).toEqual({
      simple: 1,
      calendar: 1,
      isoStyle: 0,
      weekday: 'Sunday',
      rowStart: '2025-07-28',
      rowEnd: '2025-08-03',
      isWeekend: true,
      daysInMonth: 31,
    });
  });

  it('throws RangeError on a malformed date string', () => {
    expect(() => findWeekOfMonth('not-a-date')).toThrow(RangeError);
    expect(() => findWeekOfMonth('not-a-date')).toThrow(
      'Enter a valid date (YYYY-MM-DD).',
    );
  });

  it('throws RangeError when the day is out of range for the month', () => {
    expect(() => findWeekOfMonth('2025-02-30')).toThrow(RangeError);
    expect(() => findWeekOfMonth('2025-02-30')).toThrow(
      'Day 30 is out of range for that month.',
    );
  });
});