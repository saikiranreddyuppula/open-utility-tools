// Pin the time zone before importing the module so the `local` field (which is
// time-zone dependent) is deterministic. V8/Bun read process.env.TZ lazily on
// each Date call, so setting it here applies to every Date constructed below.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { convertEpochPrecision } from '../../src/time/epoch-precision-converter';

describe('convertEpochPrecision', () => {
  it('auto-detects seconds and derives every precision', () => {
    expect(convertEpochPrecision('1700000000')).toEqual({
      detected: 's',
      seconds: '1700000000',
      ms: '1700000000000',
      us: '1700000000000000',
      ns: '1700000000000000000',
      utc: '2023-11-14T22:13:20.000Z',
      local: '2023-11-14 22:13:20',
    });
  });

  it('auto-detects milliseconds (same instant, more digits)', () => {
    const r = convertEpochPrecision('1700000000000');
    expect(r.detected).toBe('ms');
    expect(r.seconds).toBe('1700000000');
    expect(r.ns).toBe('1700000000000000000');
    expect(r.utc).toBe('2023-11-14T22:13:20.000Z');
  });

  it('honors an explicit source unit and truncates sub-unit remainders', () => {
    const r = convertEpochPrecision('1700000000123456789', 'ns');
    expect(r).toEqual({
      detected: 'ns',
      seconds: '1700000000',
      ms: '1700000000123',
      us: '1700000000123456',
      ns: '1700000000123456789',
      utc: '2023-11-14T22:13:20.123Z',
      local: '2023-11-14 22:13:20',
    });
  });

  it('strips grouping separators and handles negative (pre-1970) timestamps', () => {
    const grouped = convertEpochPrecision('1,700,000,000');
    expect(grouped.seconds).toBe('1700000000');
    expect(grouped.utc).toBe('2023-11-14T22:13:20.000Z');

    const negative = convertEpochPrecision('-1000000000', 's');
    expect(negative.ns).toBe('-1000000000000000000');
    expect(negative.utc).toBe('1938-04-24T22:13:20.000Z');
  });

  it('reports out-of-range dates while keeping exact integer conversions', () => {
    const r = convertEpochPrecision('100000000000000', 's');
    expect(r.ms).toBe('100000000000000000');
    expect(r.ns).toBe('100000000000000000000000');
    expect(r.utc).toBe('Out of representable range');
    expect(r.local).toBe('Out of representable range');
  });

  it('throws on empty and non-integer input', () => {
    expect(() => convertEpochPrecision('   ')).toThrow(TypeError);
    expect(() => convertEpochPrecision('12.5')).toThrow(RangeError);
    expect(() => convertEpochPrecision('not-a-number')).toThrow(RangeError);
  });
});
