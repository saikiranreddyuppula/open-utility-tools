import { describe, it, expect } from 'vitest';
import { weekdayOfDate } from '../../src/time/weekday-of-date';

// Golden values captured by executing the lifted algorithm with `bun`.
describe('weekdayOfDate', () => {
  it('finds the weekday of a weekend date and cross-checks against Doomsday', () => {
    const r = weekdayOfDate('2026-05-30');
    expect(r.weekday).toBe('Saturday');
    expect(r.short).toBe('Sat');
    expect(r.index).toBe(6);
    expect(r.isoNum).toBe(6);
    expect(r.isWeekend).toBe(true);
    expect(r.leap).toBe(false);
    expect(r.crosscheck).toBe(true);
    expect(r.steps).toHaveLength(4);
    expect(r.steps[0]).toBe('Century anchor for the 2000s: Tuesday (index 2).');
  });

  it('handles a leap-year January date', () => {
    const r = weekdayOfDate('2000-01-01');
    expect(r.weekday).toBe('Saturday');
    expect(r.isoNum).toBe(6);
    expect(r.isWeekend).toBe(true);
    expect(r.leap).toBe(true);
    expect(r.crosscheck).toBe(true);
    // 1900 is divisible by 100 but not 400 → century non-leap.
    expect(r.steps[2]).toContain('(leap-year value)');
  });

  it('treats 1900 as a non-leap year (Gregorian century rule)', () => {
    const r = weekdayOfDate('1900-02-28');
    expect(r.weekday).toBe('Wednesday');
    expect(r.short).toBe('Wed');
    expect(r.index).toBe(3);
    expect(r.isoNum).toBe(3);
    expect(r.isWeekend).toBe(false);
    expect(r.leap).toBe(false);
    expect(r.crosscheck).toBe(true);
  });

  it('reports ISO weekday 1 for a Monday', () => {
    const r = weekdayOfDate('2026-06-01');
    expect(r.weekday).toBe('Monday');
    expect(r.isoNum).toBe(1);
    expect(r.isWeekend).toBe(false);
    expect(r.crosscheck).toBe(true);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(weekdayOfDate('  2026-06-01  ').weekday).toBe('Monday');
  });

  it('throws RangeError on malformed input and out-of-range fields', () => {
    expect(() => weekdayOfDate('not-a-date')).toThrow(RangeError);
    expect(() => weekdayOfDate('2026-13-01')).toThrow('Month must be 1–12.');
    expect(() => weekdayOfDate('2026-04-31')).toThrow('Day must be 1–30 for that month.');
    expect(() => weekdayOfDate('2025-02-29')).toThrow('Day must be 1–28 for that month.');
  });
});
