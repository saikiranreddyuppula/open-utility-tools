import { describe, it, expect } from 'vitest';

import {
  gregorianToJulian,
  parseGregorianToJulian,
  julianToGregorian,
} from '../../src/time/julian-day-number';

describe('gregorianToJulian', () => {
  it('computes the J2000.0 epoch (2000-01-01 12:00 UTC)', () => {
    expect(gregorianToJulian(2000, 1, 1, { hour: 12 })).toEqual({
      jd: 2451545,
      jdn: 2451545,
      mjd: 51544.5,
      iso: '2000-01-01 12:00:00 UTC',
    });
  });

  it('defaults time of day to midnight UTC', () => {
    expect(gregorianToJulian(2000, 1, 1)).toEqual({
      jd: 2451544.5,
      jdn: 2451545,
      mjd: 51544,
      iso: '2000-01-01 00:00:00 UTC',
    });
  });

  it('handles negative (BC) years with zero-padded ISO output', () => {
    expect(gregorianToJulian(-44, 3, 15, { hour: 12 })).toEqual({
      jd: 1705063,
      jdn: 1705063,
      mjd: -694937.5,
      iso: '-0044-03-15 12:00:00 UTC',
    });
  });

  it('throws RangeError when month/day are out of range', () => {
    expect(() => gregorianToJulian(2000, 13, 1)).toThrow(RangeError);
    expect(() => gregorianToJulian(2000, 1, 32)).toThrow(RangeError);
  });

  it('throws RangeError when a time field is out of range', () => {
    expect(() => gregorianToJulian(2000, 1, 1, { hour: 24 })).toThrow(RangeError);
  });
});

describe('parseGregorianToJulian', () => {
  it('parses date + time strings (Unix epoch)', () => {
    expect(parseGregorianToJulian('1970-01-01', '00:00:00')).toEqual({
      jd: 2440587.5,
      jdn: 2440588,
      mjd: 40587,
      iso: '1970-01-01 00:00:00 UTC',
    });
  });

  it('throws RangeError on a malformed date string', () => {
    expect(() => parseGregorianToJulian('01/01/2000')).toThrow(RangeError);
    expect(() => parseGregorianToJulian('')).toThrow(RangeError);
  });
});

describe('julianToGregorian', () => {
  it('reconstructs the Gregorian date for the J2000.0 epoch', () => {
    expect(julianToGregorian(2451545.0)).toEqual({
      parts: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
      iso: '2000-01-01 12:00:00 UTC',
      jdn: 2451545,
      mjd: 51544.5,
      jd: 2451545,
    });
  });

  it('maps the MJD reference epoch (JD 2400000.5) to 1858-11-17', () => {
    const r = julianToGregorian(2400000.5);
    expect(r.iso).toBe('1858-11-17 00:00:00 UTC');
    expect(r.mjd).toBe(0);
  });

  it('round-trips with gregorianToJulian', () => {
    const fwd = gregorianToJulian(1970, 1, 1);
    expect(julianToGregorian(fwd.jd).iso).toBe('1970-01-01 00:00:00 UTC');
  });

  it('throws RangeError for a negative Julian Date', () => {
    expect(() => julianToGregorian(-1)).toThrow(RangeError);
  });
});
