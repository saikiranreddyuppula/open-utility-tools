import { describe, it, expect } from 'vitest';
import { humanizeDuration } from '../../src/time/duration-humanizer';

// Golden values verified by executing the lifted algorithm with bun.
describe('humanizeDuration', () => {
  it('humanizes seconds in long style with an Oxford comma', () => {
    const r = humanizeDuration(190500);
    expect(r.human).toBe('2 days, 4 hours, and 55 minutes');
    expect(r.colon).toBe('2d 04:55:00');
    expect(r.totalSeconds).toBe(190500);
    expect(r.breakdown.find((e) => e.key === 'day')?.count).toBe(2);
    expect(r.breakdown.find((e) => e.key === 'hour')?.count).toBe(4);
    expect(r.breakdown.find((e) => e.key === 'minute')?.count).toBe(55);
  });

  it('renders the short style', () => {
    expect(humanizeDuration(190500, { style: 'short' }).human).toBe('2d 4h 55m');
  });

  it('converts milliseconds and respects maxUnits', () => {
    const r = humanizeDuration(5000, { inputUnit: 'ms', maxUnits: 2 });
    expect(r.human).toBe('5 seconds');
    expect(r.colon).toBe('00:00:05');
    expect(r.totalSeconds).toBe(5);
  });

  it('drops the Oxford comma when disabled', () => {
    expect(humanizeDuration(3661, { oxford: false }).human).toBe('1 hour, 1 minute and 1 second');
  });

  it('rolls into weeks when years are disabled', () => {
    const r = humanizeDuration(60 * 60 * 24 * 400, { includeYears: false });
    expect(r.human).toBe('57 weeks, and 1 day');
    expect(r.colon).toBe('400d 00:00:00');
    expect(r.breakdown[0]?.key).toBe('week');
  });

  it('returns "0 seconds" for a zero duration', () => {
    const r = humanizeDuration(0);
    expect(r.human).toBe('0 seconds');
    expect(r.colon).toBe('00:00:00');
  });

  it('throws on invalid input', () => {
    expect(() => humanizeDuration(-5)).toThrow(RangeError);
    expect(() => humanizeDuration(Number.NaN)).toThrow(TypeError);
    // @ts-expect-error - invalid unit at runtime
    expect(() => humanizeDuration(10, { inputUnit: 'days' })).toThrow(RangeError);
  });
});