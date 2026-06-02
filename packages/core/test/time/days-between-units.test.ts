// Pin TZ before any Date use: calendar fields read wall-clock components, so a
// fixed timezone keeps the golden values reproducible across machines/CI.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { daysBetweenUnits } from '../../src/time/days-between-units';

describe('daysBetweenUnits', () => {
  it('expresses a 100-day span in every unit with a calendar breakdown', () => {
    const r = daysBetweenUnits('2026-01-01T00:00:00Z', '2026-04-11T00:00:00Z');
    expect(r.totals).toEqual({
      years365: 0.273972602739726,
      months: 3.3333333333333335,
      weeks: 14.285714285714286,
      days: 100,
      hours: 2400,
      minutes: 144000,
      seconds: 8640000,
    });
    expect(r.breakdown).toEqual({ years: 0, months: 3, days: 10, hours: 0, minutes: 0, seconds: 0 });
    expect(r.human).toBe('3mo 10d');
    expect(r.businessDays).toBe(72);
    expect(r.weekendDays).toBe(28);
    expect(r.ms).toBe(8640000000);
  });

  it('is order-independent (smaller datetime is treated as the start)', () => {
    const forward = daysBetweenUnits('2026-01-01T00:00:00Z', '2026-04-11T00:00:00Z');
    const reversed = daysBetweenUnits('2026-04-11T00:00:00Z', '2026-01-01T00:00:00Z');
    expect(reversed).toEqual(forward);
  });

  it('borrows across month lengths and counts a leap year as 365 days', () => {
    const r = daysBetweenUnits('2024-02-29T12:00:00Z', '2025-02-28T12:00:00Z');
    expect(r.totals.days).toBe(365);
    expect(r.totals.years365).toBe(1);
    expect(r.breakdown).toEqual({ years: 0, months: 11, days: 30, hours: 0, minutes: 0, seconds: 0 });
    expect(r.human).toBe('11mo 30d');
    expect(r.businessDays).toBe(261);
    expect(r.weekendDays).toBe(104);
  });

  it('handles sub-day spans with h/m/s in the human label', () => {
    const r = daysBetweenUnits('2026-03-01T00:00:00Z', '2026-03-04T03:30:15Z');
    expect(r.human).toBe('3d 3h 30m 15s');
    expect(r.totals.hours).toBe(75.50416666666666);
    expect(r.totals.seconds).toBe(271815);
  });

  it('returns a zero span (human "0s") for identical datetimes and accepts Date/epoch inputs', () => {
    const r = daysBetweenUnits('2026-06-02T08:00:00Z', '2026-06-02T08:00:00Z');
    expect(r.ms).toBe(0);
    expect(r.human).toBe('0s');

    const mixed = daysBetweenUnits(
      new Date('2026-01-01T00:00:00Z'),
      Date.parse('2026-04-11T00:00:00Z'),
    );
    expect(mixed.totals.days).toBe(100);
    expect(mixed.human).toBe('3mo 10d');
  });

  it('throws on unparseable input', () => {
    expect(() => daysBetweenUnits('not-a-date', '2026-01-01T00:00:00Z')).toThrow(RangeError);
    expect(() => daysBetweenUnits('2026-01-01T00:00:00Z', NaN)).toThrow(RangeError);
  });
});
