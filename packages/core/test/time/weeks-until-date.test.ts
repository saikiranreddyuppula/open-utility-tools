import { describe, it, expect } from 'vitest';
import { weeksUntilDate } from '../../src/time/weeks-until-date';

describe('weeksUntilDate', () => {
  it('breaks a future span into weeks, months, weekends and business days', () => {
    expect(weeksUntilDate('2026-06-02', '2026-12-25')).toEqual({
      reversed: false,
      totalDays: 206,
      fullWeeks: 29,
      leftoverDays: 3,
      fullMonths: 6,
      leftoverMonthDays: 23,
      weekendDays: 58,
      businessDays: 148,
    });
  });

  it('handles a full non-leap year span', () => {
    expect(weeksUntilDate('2026-06-02', '2027-06-02')).toEqual({
      reversed: false,
      totalDays: 365,
      fullWeeks: 52,
      leftoverDays: 1,
      fullMonths: 12,
      leftoverMonthDays: 0,
      weekendDays: 104,
      businessDays: 261,
    });
  });

  it('clamps month-end overflow (Jan 31 -> Mar 31 is exactly 2 months)', () => {
    expect(weeksUntilDate('2026-01-31', '2026-03-31')).toEqual({
      reversed: false,
      totalDays: 59,
      fullWeeks: 8,
      leftoverDays: 3,
      fullMonths: 2,
      leftoverMonthDays: 0,
      weekendDays: 17,
      businessDays: 42,
    });
  });

  it('marks a backwards span as reversed but keeps magnitudes non-negative', () => {
    const res = weeksUntilDate('2026-12-25', '2026-06-02');
    expect(res.reversed).toBe(true);
    expect(res.totalDays).toBe(206);
    expect(res.fullWeeks).toBe(29);
    expect(res.fullMonths).toBe(6);
    expect(res.weekendDays).toBe(58);
    expect(res.businessDays).toBe(148);
  });

  it('returns all zeros when the dates are equal', () => {
    expect(weeksUntilDate('2026-06-02', '2026-06-02')).toEqual({
      reversed: false,
      totalDays: 0,
      fullWeeks: 0,
      leftoverDays: 0,
      fullMonths: 0,
      leftoverMonthDays: 0,
      weekendDays: 0,
      businessDays: 0,
    });
  });

  it('throws on invalid or empty input', () => {
    expect(() => weeksUntilDate('not-a-date', '2026-12-25')).toThrow(RangeError);
    expect(() => weeksUntilDate('', '2026-12-25')).toThrow(TypeError);
  });
});
