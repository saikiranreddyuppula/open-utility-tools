import { describe, it, expect } from 'vitest';
import { countBusinessDays, addBusinessDays } from '../../src/time/business-days-calculator';

describe('countBusinessDays', () => {
  it('counts business, weekend, and total days across a full month (start included)', () => {
    expect(countBusinessDays('2024-01-01', '2024-01-31')).toEqual({
      business: 23,
      weekend: 8,
      total: 31,
      reversed: false,
    });
  });

  it('excludes the start day when includeStart is false', () => {
    expect(countBusinessDays('2024-01-01', '2024-01-05', true)).toEqual({
      business: 5,
      weekend: 0,
      total: 5,
      reversed: false,
    });
    expect(countBusinessDays('2024-01-01', '2024-01-05', false)).toEqual({
      business: 4,
      weekend: 0,
      total: 4,
      reversed: false,
    });
  });

  it('swaps the range and flags reversed when end precedes start', () => {
    expect(countBusinessDays('2024-01-31', '2024-01-01')).toEqual({
      business: 23,
      weekend: 8,
      total: 31,
      reversed: true,
    });
  });

  it('handles a single weekend day (start === end)', () => {
    expect(countBusinessDays('2024-01-06', '2024-01-06')).toEqual({
      business: 0,
      weekend: 1,
      total: 1,
      reversed: false,
    });
  });

  it('throws RangeError on an impossible calendar date', () => {
    expect(() => countBusinessDays('2024-02-31', '2024-03-01')).toThrow(RangeError);
  });
});

describe('addBusinessDays', () => {
  it('adds business days forward, skipping weekends', () => {
    expect(addBusinessDays('2024-01-01', 5)).toEqual({
      resultDate: '2024-01-08',
      weekday: 'Monday',
    });
  });

  it('subtracts business days backward', () => {
    expect(addBusinessDays('2024-01-15', -3)).toEqual({
      resultDate: '2024-01-10',
      weekday: 'Wednesday',
    });
  });

  it('returns the start date unchanged for a zero offset', () => {
    expect(addBusinessDays('2024-01-06', 0)).toEqual({
      resultDate: '2024-01-06',
      weekday: 'Saturday',
    });
  });

  it('throws TypeError when days is not an integer', () => {
    expect(() => addBusinessDays('2024-01-01', 2.5)).toThrow(TypeError);
  });
});
