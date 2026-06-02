// Pin the time zone before importing the module so the elapsed-millisecond
// totals (totalDays/totalHours/totalMinutes), which depend on the UTC offset of
// both the locally-parsed birth date and `now`, are deterministic. V8/Bun read
// process.env.TZ lazily on each Date call, so setting it here applies to every
// Date constructed below. (Same convention as epoch-precision-converter.test.ts.)
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { calculateAge } from '../../src/time/age-calculator';

describe('calculateAge', () => {
  it('computes a full age breakdown, totals, and next birthday', () => {
    const result = calculateAge('1990-01-15', { now: new Date('2026-06-02T12:34:56') });
    expect(result).toEqual({
      years: 36,
      months: 4,
      days: 18,
      totalDays: 13287,
      totalHours: 318900,
      totalMinutes: 19134034,
      nextBirthdayDays: 227,
      nextBirthdayDate: 'January 15, 2027',
    });
  });

  it('handles a leap-day birthday on the day before its non-leap anniversary', () => {
    const result = calculateAge('2000-02-29', { now: new Date('2026-03-01T00:00:00') });
    expect(result.years).toBe(26);
    expect(result.months).toBe(0);
    expect(result.days).toBe(0);
    expect(result.totalDays).toBe(9497);
    expect(result.nextBirthdayDays).toBe(365);
    expect(result.nextBirthdayDate).toBe('March 1, 2027');
  });

  it('borrows days across the year boundary', () => {
    const result = calculateAge('2025-12-31', { now: new Date('2026-06-02T00:00:00') });
    expect(result).toEqual({
      years: 0,
      months: 5,
      days: 2,
      totalDays: 153,
      totalHours: 3672,
      totalMinutes: 220320,
      nextBirthdayDays: 212,
      nextBirthdayDate: 'December 31, 2026',
    });
  });

  it('counts the next birthday as one day away', () => {
    const result = calculateAge('1995-06-03', { now: new Date('2026-06-02T00:00:00') });
    expect(result.years).toBe(30);
    expect(result.months).toBe(11);
    expect(result.days).toBe(30);
    expect(result.nextBirthdayDays).toBe(1);
    expect(result.nextBirthdayDate).toBe('June 3, 2026');
  });

  it('rejects an unparseable birth date', () => {
    expect(() => calculateAge('not-a-date', { now: new Date('2026-06-02T00:00:00') })).toThrow(
      RangeError,
    );
  });

  it('rejects a birth date in the future', () => {
    expect(() => calculateAge('2030-01-01', { now: new Date('2026-06-02T00:00:00') })).toThrow(
      /cannot be in the future/,
    );
  });
});
