import { describe, it, expect } from 'vitest';
import { daysUntil } from '../../src/time/days-until';

// All expected values were produced by executing the extracted function with
// bun (TZ=UTC) and asserting the real outputs verbatim.
describe('daysUntil', () => {
  it('counts days remaining for a future date', () => {
    const r = daysUntil('2026-06-12', new Date('2026-06-02T00:00:00'));
    expect(r).toEqual({
      past: false,
      days: 10,
      weeks: 1,
      remDays: 3,
      hours: 0,
      minutes: 0,
      totalHours: 240,
      totalMinutes: 14400,
      headline: '10 days remaining',
    });
  });

  it('reports a date matching now as today', () => {
    const r = daysUntil('2026-06-02', new Date('2026-06-02T00:00:00'));
    expect(r.days).toBe(0);
    expect(r.past).toBe(false);
    expect(r.headline).toBe('That date is today');
  });

  it('handles past dates with a sub-day remainder', () => {
    const r = daysUntil('2026-05-23', new Date('2026-06-02T12:30:00'));
    expect(r).toEqual({
      past: true,
      days: 10,
      weeks: 1,
      remDays: 3,
      hours: 12,
      minutes: 30,
      totalHours: 252,
      totalMinutes: 15150,
      headline: '10 days ago',
    });
  });

  it('uses the singular noun for a one-day span', () => {
    expect(daysUntil('2026-06-03', new Date('2026-06-02T00:00:00')).headline).toBe(
      '1 day remaining',
    );
    expect(daysUntil('2026-06-01', new Date('2026-06-02T06:00:00')).headline).toBe('1 day ago');
  });

  it('rolls weeks correctly for larger spans', () => {
    const r = daysUntil('2026-08-11', new Date('2026-06-02T00:00:00'));
    expect(r.days).toBe(70);
    expect(r.weeks).toBe(10);
    expect(r.remDays).toBe(0);
    expect(r.totalHours).toBe(1680);
  });

  it('throws on malformed or invalid dates', () => {
    expect(() => daysUntil('not-a-date')).toThrow(RangeError);
    expect(() => daysUntil('06/12/2026')).toThrow(RangeError);
    expect(() => daysUntil('2026-13-45')).toThrow(RangeError);
    // @ts-expect-error — exercising the runtime TypeError guard
    expect(() => daysUntil(123)).toThrow(TypeError);
    expect(() => daysUntil('2026-06-12', new Date('nope'))).toThrow(RangeError);
  });
});
