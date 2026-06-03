import { describe, it, expect } from 'vitest';

import { checkLeapYear, isGregorianLeapYear } from '../../src/time/leap-year-checker';

describe('isGregorianLeapYear', () => {
  it('applies the divisible-by-4 / century-by-400 rule', () => {
    expect(isGregorianLeapYear(2024)).toBe(true);
    expect(isGregorianLeapYear(2023)).toBe(false);
    expect(isGregorianLeapYear(1900)).toBe(false);
    expect(isGregorianLeapYear(2000)).toBe(true);
  });
});

describe('checkLeapYear', () => {
  it('reports a divisible-by-4 leap year (2024)', () => {
    expect(checkLeapYear(2024)).toEqual({
      year: 2024,
      leap: true,
      reason: '2024 is divisible by 4 and not by 100 → leap year.',
      days: 366,
      februaryDays: 29,
      next: 2028,
      previous: 2020,
      julianLeap: true,
      rangeLeaps: null,
      rangeEnd: null,
    });
  });

  it('flags a century that is not divisible by 400 as common (1900)', () => {
    expect(checkLeapYear(1900)).toEqual({
      year: 1900,
      leap: false,
      reason: '1900 is divisible by 100 but not by 400 → common year (century exception).',
      days: 365,
      februaryDays: 28,
      next: 1904,
      previous: 1896,
      julianLeap: true,
      rangeLeaps: null,
      rangeEnd: null,
    });
  });

  it('flags a century divisible by 400 as leap (2000)', () => {
    expect(checkLeapYear(2000)).toEqual({
      year: 2000,
      leap: true,
      reason: '2000 is divisible by 400 → leap year (century exception override).',
      days: 366,
      februaryDays: 29,
      next: 2004,
      previous: 1996,
      julianLeap: true,
      rangeLeaps: null,
      rangeEnd: null,
    });
  });

  it('reports a common year and the legacy Julian rule (2023)', () => {
    const r = checkLeapYear(2023);
    expect(r.leap).toBe(false);
    expect(r.reason).toBe('2023 is not divisible by 4 → common year.');
    expect(r.days).toBe(365);
    expect(r.februaryDays).toBe(28);
    expect(r.next).toBe(2024);
    expect(r.previous).toBe(2020);
    expect(r.julianLeap).toBe(false);
  });

  it('collects leap years across a range (order-independent)', () => {
    const r = checkLeapYear(2000, { rangeEnd: 2024 });
    expect(r.rangeEnd).toBe(2024);
    expect(r.rangeLeaps).toEqual([2000, 2004, 2008, 2012, 2016, 2020, 2024]);
  });

  it('throws TypeError on a non-integer year', () => {
    expect(() => checkLeapYear(2024.5)).toThrow(TypeError);
  });

  it('throws RangeError when the range span exceeds the cap', () => {
    expect(() => checkLeapYear(2024, { rangeEnd: 99999 })).toThrow(RangeError);
  });
});
