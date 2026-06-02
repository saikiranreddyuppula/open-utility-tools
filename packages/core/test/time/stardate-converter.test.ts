import { describe, it, expect } from 'vitest';
import { dateToStardate, stardateToDate } from '../../src/time/stardate-converter';

describe('dateToStardate', () => {
  it('maps the 2364 epoch reference to stardate 41000.0', () => {
    expect(dateToStardate('2364-01-01')).toEqual({
      stardate: '41000.0',
      yearOffset: 41,
      fraction: '0.0',
      gregorianDate: '2364-01-01',
    });
  });

  it('maps the 2323 origin to stardate 0.0', () => {
    expect(dateToStardate('2323-01-01')).toEqual({
      stardate: '0.0',
      yearOffset: 0,
      fraction: '0.0',
      gregorianDate: '2323-01-01',
    });
  });

  it('handles a mid-year date with the day-of-year fraction', () => {
    expect(dateToStardate('2323-07-02')).toEqual({
      stardate: '498.6',
      yearOffset: 0,
      fraction: '498.6',
      gregorianDate: '2323-07-02',
    });
  });

  it('accounts for leap years (2324 has 366 days)', () => {
    expect(dateToStardate('2324-12-31')).toEqual({
      stardate: '1997.3',
      yearOffset: 1,
      fraction: '997.3',
      gregorianDate: '2324-12-31',
    });
  });

  it('throws RangeError on an invalid calendar date', () => {
    expect(() => dateToStardate('2364-02-31')).toThrow(RangeError);
    expect(() => dateToStardate('not-a-date')).toThrow(RangeError);
  });
});

describe('stardateToDate', () => {
  it('inverts the 41000 reference back to 2364-01-01', () => {
    expect(stardateToDate(41000)).toEqual({
      gregorianDate: '2364-01-01',
      year: 2364,
      dayOfYear: 1,
      stardate: '41000.0',
    });
  });

  it('accepts a numeric string and maps to mid-year', () => {
    expect(stardateToDate('41500.0')).toEqual({
      gregorianDate: '2364-07-02',
      year: 2364,
      dayOfYear: 184,
      stardate: '41500.0',
    });
  });

  it('clamps the last-day rounding into a leap year', () => {
    expect(stardateToDate('1999.9')).toEqual({
      gregorianDate: '2324-12-31',
      year: 2324,
      dayOfYear: 366,
      stardate: '1999.9',
    });
  });

  it('throws TypeError on non-numeric input', () => {
    expect(() => stardateToDate('warp 9')).toThrow(TypeError);
  });

  it('throws RangeError on negative stardates (pre-2323)', () => {
    expect(() => stardateToDate(-1)).toThrow(RangeError);
  });
});
