import { describe, it, expect } from 'vitest';
import { quarterOfDate } from '../../src/time/quarter-of-date';

describe('quarterOfDate', () => {
  it('computes calendar quarters for a January fiscal-year start (default)', () => {
    expect(quarterOfDate('2026-06-02')).toEqual({
      quarter: 2,
      quarterLabel: 'Q2',
      half: 1,
      halfLabel: 'H1',
      fiscalYearStartYear: 2026,
      fiscalYearLabel: '2026',
      quarterFullLabel: 'Q2 2026',
      halfFullLabel: 'H1 2026',
      quarterStart: '2026-04-01',
      quarterEnd: '2026-06-30',
      fiscalYearStart: '2026-01-01',
      fiscalYearEnd: '2026-12-31',
      daysInQuarter: 91,
      daysElapsed: 63,
      daysRemaining: 28,
      percentComplete: 69.2,
      summary: 'Q2 2026 — 2026-04-01 to 2026-06-30',
    });
  });

  it('uses span labels for an April fiscal-year start (June is fiscal Q1)', () => {
    expect(quarterOfDate('2026-06-02', 3)).toEqual({
      quarter: 1,
      quarterLabel: 'Q1',
      half: 1,
      halfLabel: 'H1',
      fiscalYearStartYear: 2026,
      fiscalYearLabel: 'FY 2026-27',
      quarterFullLabel: 'Q1 FY 2026-27',
      halfFullLabel: 'H1 FY 2026-27',
      quarterStart: '2026-04-01',
      quarterEnd: '2026-06-30',
      fiscalYearStart: '2026-04-01',
      fiscalYearEnd: '2027-03-31',
      daysInQuarter: 91,
      daysElapsed: 63,
      daysRemaining: 28,
      percentComplete: 69.2,
      summary: 'Q1 FY 2026-27 — 2026-04-01 to 2026-06-30',
    });
  });

  it('rolls back to the prior fiscal year when the month precedes the start month', () => {
    const r = quarterOfDate('2026-01-15', 3);
    expect(r.quarterFullLabel).toBe('Q4 FY 2025-26');
    expect(r.half).toBe(2);
    expect(r.fiscalYearStartYear).toBe(2025);
    expect(r.fiscalYearStart).toBe('2025-04-01');
    expect(r.fiscalYearEnd).toBe('2026-03-31');
    expect(r.quarterStart).toBe('2026-01-01');
    expect(r.quarterEnd).toBe('2026-03-31');
    expect(r.daysElapsed).toBe(15);
    expect(r.percentComplete).toBe(16.7);
  });

  it('handles a leap day and reports 100% on the last day of the quarter', () => {
    expect(quarterOfDate('2024-02-29').daysInQuarter).toBe(91);

    const last = quarterOfDate('2026-12-31', 9);
    expect(last.quarterFullLabel).toBe('Q1 FY 2026-27');
    expect(last.quarterStart).toBe('2026-10-01');
    expect(last.quarterEnd).toBe('2026-12-31');
    expect(last.daysElapsed).toBe(92);
    expect(last.daysRemaining).toBe(0);
    expect(last.percentComplete).toBe(100);
  });

  it('throws RangeError on an impossible calendar date', () => {
    expect(() => quarterOfDate('2026-02-30')).toThrow(RangeError);
    expect(() => quarterOfDate('not-a-date')).toThrow(RangeError);
  });

  it('throws RangeError on an out-of-range fiscal-year start month', () => {
    expect(() => quarterOfDate('2026-06-02', 12)).toThrow(RangeError);
    expect(() => quarterOfDate('2026-06-02', -1)).toThrow(RangeError);
  });
});
