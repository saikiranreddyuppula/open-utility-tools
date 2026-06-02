import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../src/time/duration-parser';

// Expected values verified by executing the extracted function with bun.
describe('parseDuration', () => {
  it('parses a compound duration with multiple units', () => {
    const r = parseDuration('1h 30m 15s');
    expect(r.totalSeconds).toBe(5415);
    expect(r.totalMs).toBe(5415000);
    expect(r.totalMinutes).toBe(90.25);
    expect(r.totalHours).toBe(1.5041666666666667);
    expect(r.canonical).toBe('1h 30m 15s');
    expect(r.matched).toEqual([
      { raw: '1h', seconds: 3600 },
      { raw: '30m', seconds: 1800 },
      { raw: '15s', seconds: 15 },
    ]);
    expect(r.unknown).toEqual([]);
  });

  it('normalizes an overflowing single unit into the canonical form', () => {
    const r = parseDuration('90s');
    expect(r.totalSeconds).toBe(90);
    expect(r.canonical).toBe('1m 30s');
  });

  it('accepts spelled-out units with spaces', () => {
    const r = parseDuration('2 days 4 hours');
    expect(r.totalSeconds).toBe(187200);
    expect(r.totalHours).toBe(52);
    expect(r.canonical).toBe('2d 4h');
  });

  it('handles fractional values', () => {
    const r = parseDuration('1.5h');
    expect(r.totalSeconds).toBe(5400);
    expect(r.canonical).toBe('1h 30m');
  });

  it('collects unrecognized tokens in unknown and still parses the rest', () => {
    const r = parseDuration('2 weeks foo 3d xyz');
    expect(r.totalSeconds).toBe(1468800);
    expect(r.canonical).toBe('2w 3d');
    expect(r.unknown).toEqual(['foo', 'xyz']);
    expect(r.matched).toEqual([
      { raw: '2 weeks', seconds: 1209600 },
      { raw: '3d', seconds: 259200 },
    ]);
  });

  it('throws on empty, unrecognized, or non-string input', () => {
    expect(() => parseDuration('')).toThrow(RangeError);
    expect(() => parseDuration('   ')).toThrow(RangeError);
    expect(() => parseDuration('hello world')).toThrow(RangeError);
    expect(() => parseDuration(123 as unknown as string)).toThrow(TypeError);
  });
});