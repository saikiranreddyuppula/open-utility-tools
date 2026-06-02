import { describe, it, expect } from 'vitest';
import {
  weekToDateRange,
  dateToWeek,
  isoWeeksInYear,
} from '../../src/time/week-to-date';

describe('weekToDateRange', () => {
  it('returns the Monday–Sunday range for a standard week', () => {
    expect(weekToDateRange(2024, 1)).toEqual({
      start: '2024-01-01',
      end: '2024-01-07',
      weeksInYear: 52,
    });
  });

  it('spans the year boundary for week 53 of a 53-week year', () => {
    expect(weekToDateRange(2020, 53)).toEqual({
      start: '2020-12-28',
      end: '2021-01-03',
      weeksInYear: 53,
    });
  });

  it('handles a mid-year week', () => {
    expect(weekToDateRange(2026, 23)).toEqual({
      start: '2026-06-01',
      end: '2026-06-07',
      weeksInYear: 53,
    });
  });

  it('throws RangeError when the week exceeds the weeks in the year', () => {
    // 2024 has only 52 ISO weeks.
    expect(() => weekToDateRange(2024, 53)).toThrow(RangeError);
    expect(() => weekToDateRange(2024, 53)).toThrow(
      'Week must be between 1 and 52 for 2024.',
    );
  });

  it('throws TypeError for a non-integer year', () => {
    expect(() => weekToDateRange(2024.5, 1)).toThrow(TypeError);
  });
});

describe('dateToWeek', () => {
  it('maps a date to its ISO week (Monday)', () => {
    expect(dateToWeek('2024-01-01')).toEqual({
      isoYear: 2024,
      isoWeek: 1,
      isoWeekday: 1,
      weekdayName: 'Monday',
      label: '2024-W01',
    });
  });

  it('rolls back into the previous ISO year near Jan 1', () => {
    expect(dateToWeek('2021-01-01')).toEqual({
      isoYear: 2020,
      isoWeek: 53,
      isoWeekday: 5,
      weekdayName: 'Friday',
      label: '2020-W53',
    });
  });

  it('accepts a Date object', () => {
    expect(dateToWeek(new Date(Date.UTC(2026, 5, 2)))).toEqual({
      isoYear: 2026,
      isoWeek: 23,
      isoWeekday: 2,
      weekdayName: 'Tuesday',
      label: '2026-W23',
    });
  });

  it('throws TypeError for an invalid calendar date', () => {
    expect(() => dateToWeek('2021-02-30')).toThrow(TypeError);
    expect(() => dateToWeek('not-a-date')).toThrow(TypeError);
  });
});

describe('isoWeeksInYear', () => {
  it('reports 53 weeks for a long ISO year and 52 otherwise', () => {
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2024)).toBe(52);
  });
});