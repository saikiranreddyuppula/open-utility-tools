import { describe, it, expect } from 'vitest';

import { calculateMoonPhase, SYNODIC_MONTH } from '../../src/time/moon-phase-calculator';

describe('calculateMoonPhase', () => {
  it('returns a brand-new moon at the reference epoch', () => {
    const r = calculateMoonPhase({ date: '2000-01-06', time: '18:14' });
    expect(r.name).toBe('New Moon');
    expect(r.glyph).toBe('🌑');
    expect(r.age).toBe(0);
    expect(r.illumination).toBe(0);
    expect(r.waxing).toBe(true);
    expect(r.nextNew).toBe('2000-02-05 06:58 UTC');
    expect(r.nextFull).toBe('2000-01-21 12:36 UTC');
    expect(r.inputUtc).toBe('2000-01-06 18:14 UTC');
  });

  it('computes a near-full moon with high illumination', () => {
    const r = calculateMoonPhase({ date: '2024-08-19', time: '18:26' });
    expect(r.name).toBe('Full Moon');
    expect(r.glyph).toBe('🌕');
    expect(r.age).toBeCloseTo(14.709322021332866, 10);
    expect(r.illumination).toBeCloseTo(99.99645432980509, 8);
    expect(r.waxing).toBe(true);
    expect(r.nextNew).toBe('2024-09-03 14:08 UTC');
    expect(r.nextFull).toBe('2024-08-19 19:46 UTC');
    expect(r.inputUtc).toBe('2024-08-19 18:26 UTC');
  });

  it('reports a waning phase past the half-cycle', () => {
    const r = calculateMoonPhase({ date: '2026-06-02', time: '00:00' });
    expect(r.name).toBe('Full Moon');
    expect(r.age).toBeCloseTo(16.26831169977664, 10);
    expect(r.illumination).toBeCloseTo(97.46499347650217, 8);
    expect(r.waxing).toBe(false);
    expect(r.nextNew).toBe('2026-06-15 06:17 UTC');
    expect(r.nextFull).toBe('2026-06-30 00:39 UTC');
  });

  it('defaults to 00:00 UTC when no time is supplied', () => {
    const r = calculateMoonPhase({ date: '2024-01-25' });
    expect(r.inputUtc).toBe('2024-01-25 00:00 UTC');
    expect(r.age).toBeCloseTo(13.655388436776672, 10);
    expect(r.illumination).toBeCloseTo(98.6122582370704, 8);
    expect(r.nextFull).toBe('2024-01-26 02:38 UTC');
  });

  it('keeps the synodic-month constant in sync', () => {
    expect(SYNODIC_MONTH).toBe(29.530588853);
  });

  it('throws RangeError for a malformed date', () => {
    expect(() => calculateMoonPhase({ date: '01-02-2024' })).toThrow(RangeError);
    expect(() => calculateMoonPhase({ date: '01-02-2024' })).toThrow('Date must be YYYY-MM-DD.');
  });

  it('throws RangeError for an out-of-range month', () => {
    expect(() => calculateMoonPhase({ date: '2024-13-01' })).toThrow(RangeError);
    expect(() => calculateMoonPhase({ date: '2024-13-01' })).toThrow('Invalid date.');
  });

  it('throws RangeError for an out-of-range time', () => {
    expect(() => calculateMoonPhase({ date: '2024-01-25', time: '99:99' })).toThrow('Time out of range.');
  });

  it('throws TypeError when date is not a string', () => {
    // @ts-expect-error — exercising the runtime guard with an invalid type
    expect(() => calculateMoonPhase({ date: 123 })).toThrow(TypeError);
  });
});
