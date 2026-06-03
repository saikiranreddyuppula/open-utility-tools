import { describe, it, expect } from 'vitest';

import { convertTimestamp, parseTimestamp, relativeTime } from '../../src/time/timestamp-converter';

describe('convertTimestamp', () => {
  it('treats a short numeric string as Unix seconds', () => {
    const r = convertTimestamp('1716239022');
    expect(r.unixSeconds).toBe(1716239022);
    expect(r.unixMilliseconds).toBe(1716239022000);
    expect(r.iso8601).toBe('2024-05-20T21:03:42.000Z');
    expect(r.utc).toBe('Mon, 20 May 2024 21:03:42 GMT');
  });

  it('treats a 13+ digit numeric string as Unix milliseconds', () => {
    const r = convertTimestamp('1716239022000');
    expect(r.unixSeconds).toBe(1716239022);
    expect(r.unixMilliseconds).toBe(1716239022000);
    expect(r.iso8601).toBe('2024-05-20T21:03:42.000Z');
  });

  it('parses an ISO 8601 date string', () => {
    const r = convertTimestamp('2024-05-20T18:23:42Z');
    expect(r.unixSeconds).toBe(1716229422);
    expect(r.unixMilliseconds).toBe(1716229422000);
    expect(r.iso8601).toBe('2024-05-20T18:23:42.000Z');
    expect(r.utc).toBe('Mon, 20 May 2024 18:23:42 GMT');
  });

  it('handles a negative timestamp (before the epoch)', () => {
    const r = convertTimestamp('-1000');
    expect(r.unixSeconds).toBe(-1000);
    expect(r.unixMilliseconds).toBe(-1000000);
    expect(r.iso8601).toBe('1969-12-31T23:43:20.000Z');
    expect(r.utc).toBe('Wed, 31 Dec 1969 23:43:20 GMT');
  });

  it('throws RangeError on empty input', () => {
    expect(() => convertTimestamp('   ')).toThrow(RangeError);
  });

  it('throws RangeError on unparseable input', () => {
    expect(() => convertTimestamp('not a date')).toThrow(
      'Could not parse "not a date" as a timestamp or date.',
    );
  });
});

describe('parseTimestamp', () => {
  it('throws TypeError when input is not a string', () => {
    // @ts-expect-error intentionally passing a non-string at runtime
    expect(() => parseTimestamp(42)).toThrow(TypeError);
  });
});

describe('relativeTime', () => {
  it('formats a near-future delta', () => {
    expect(relativeTime(90_000, 0)).toBe('in 1 minute');
  });

  it('formats a past delta in days', () => {
    expect(relativeTime(0, 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
  });

  it('formats a zero delta as "now"', () => {
    expect(relativeTime(0, 0)).toBe('now');
  });

  it('throws TypeError on non-finite inputs', () => {
    expect(() => relativeTime(Number.NaN, 0)).toThrow(TypeError);
  });
});