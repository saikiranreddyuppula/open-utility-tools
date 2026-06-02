import { describe, it, expect } from 'vitest';

import { dateToIsoWeekDate, isoWeekDateToDate } from '../../src/time/iso-week-date-converter';

describe('dateToIsoWeekDate', () => {
  it('converts a mid-year date to its ISO week-date', () => {
    expect(dateToIsoWeekDate('2026-06-02')).toEqual({
      isoWeekDate: '2026-W23-2',
      isoYear: 2026,
      week: 23,
      weekday: 2,
      weekdayName: 'Tuesday',
      weeksInYear: 53,
      calendar: '2026-06-02',
    });
  });

  it('assigns a Jan 1 to the previous (53-week) ISO year', () => {
    expect(dateToIsoWeekDate('2021-01-01')).toEqual({
      isoWeekDate: '2020-W53-5',
      isoYear: 2020,
      week: 53,
      weekday: 5,
      weekdayName: 'Friday',
      weeksInYear: 53,
      calendar: '2021-01-01',
    });
  });

  it('assigns a Sunday Jan 1 to the previous year, week 52', () => {
    expect(dateToIsoWeekDate('2023-01-01')).toEqual({
      isoWeekDate: '2022-W52-7',
      isoYear: 2022,
      week: 52,
      weekday: 7,
      weekdayName: 'Sunday',
      weeksInYear: 52,
      calendar: '2023-01-01',
    });
  });

  it('throws RangeError for a calendar date that does not exist', () => {
    expect(() => dateToIsoWeekDate('2021-02-29')).toThrow(RangeError);
    expect(() => dateToIsoWeekDate('2021-02-29')).toThrow('That calendar date does not exist.');
  });

  it('throws RangeError for a non YYYY-MM-DD string', () => {
    expect(() => dateToIsoWeekDate('06/02/2026')).toThrow('Date must be YYYY-MM-DD.');
  });
});

describe('isoWeekDateToDate', () => {
  it('resolves a week-date that crosses into the next calendar year', () => {
    expect(isoWeekDateToDate(2020, 53, 5)).toEqual({
      calendar: '2021-01-01',
      isoWeekDate: '2020-W53-5',
      weekdayName: 'Friday',
      weeksInYear: 53,
      isoYear: 2020,
    });
  });

  it('resolves a week 1 Monday that falls in the previous calendar year', () => {
    expect(isoWeekDateToDate(2009, 1, 1)).toEqual({
      calendar: '2008-12-29',
      isoWeekDate: '2009-W01-1',
      weekdayName: 'Monday',
      weeksInYear: 53,
      isoYear: 2009,
    });
  });

  it('throws RangeError when the week exceeds the ISO year length', () => {
    expect(() => isoWeekDateToDate(2021, 53, 1)).toThrow('2021 has only 52 ISO weeks.');
  });

  it('throws RangeError for a weekday outside 1–7', () => {
    expect(() => isoWeekDateToDate(2026, 2, 8)).toThrow(RangeError);
  });
});
