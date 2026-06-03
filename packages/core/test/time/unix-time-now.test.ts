// Pin the time zone before importing the module so the `local` field (which is
// time-zone / locale dependent) is at least produced deterministically. We only
// assert deterministic fields (seconds, milliseconds, microseconds, utc,
// millisField); `local` is checked for shape, not exact text.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { formatUnixInstant } from '../../src/time/unix-time-now';

describe('formatUnixInstant', () => {
  it('derives seconds, ms, micros, UTC, and the padded ms field', () => {
    const r = formatUnixInstant(1_700_000_000_123);
    expect(r.seconds).toBe('1700000000');
    expect(r.milliseconds).toBe('1700000000123');
    expect(r.microseconds).toBe('1700000000123000');
    expect(r.utc).toBe('2023-11-14T22:13:20.123Z');
    expect(r.millisField).toBe('123');
    expect(typeof r.local).toBe('string');
    expect(r.local.length).toBeGreaterThan(0);
  });

  it('adds a sub-millisecond microsecond tail from fractionalMs', () => {
    expect(formatUnixInstant(1_700_000_000_123, { fractionalMs: 0.5 }).microseconds).toBe(
      '1700000000123500',
    );
    expect(formatUnixInstant(1_700_000_000_123, { fractionalMs: 0.999 }).microseconds).toBe(
      '1700000000123999',
    );
  });

  it('normalizes fractionalMs into [0, 1) so negatives wrap rather than throw', () => {
    // ((-0.25 % 1) + 1) % 1 === 0.75 -> +750 µs
    expect(formatUnixInstant(1_700_000_000_123, { fractionalMs: -0.25 }).microseconds).toBe(
      '1700000000123750',
    );
  });

  it('handles the epoch and zero-pads a small ms-of-second component', () => {
    const epoch = formatUnixInstant(0);
    expect(epoch.seconds).toBe('0');
    expect(epoch.microseconds).toBe('0');
    expect(epoch.utc).toBe('1970-01-01T00:00:00.000Z');
    expect(epoch.millisField).toBe('000');

    const small = formatUnixInstant(1_700_000_000_007);
    expect(small.millisField).toBe('007');
    expect(small.microseconds).toBe('1700000000007000');
  });

  it('throws TypeError on non-finite ms and RangeError when out of Date range', () => {
    expect(() => formatUnixInstant(Number.NaN)).toThrow(TypeError);
    expect(() => formatUnixInstant(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => formatUnixInstant(8.64e15 + 1)).toThrow(RangeError);
    expect(() => formatUnixInstant(1_700_000_000_123, { fractionalMs: Number.POSITIVE_INFINITY })).toThrow(
      TypeError,
    );
  });
});
