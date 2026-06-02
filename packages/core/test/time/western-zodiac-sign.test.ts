import { describe, it, expect } from 'vitest';
import { getWesternZodiacSign } from '../../src/time/western-zodiac-sign';

describe('getWesternZodiacSign', () => {
  it('returns Aries for a mid-window date', () => {
    const r = getWesternZodiacSign(3, 25);
    expect(r.sign.name).toBe('Aries');
    expect(r.sign.symbol).toBe('♈');
    expect(r.sign.element).toBe('Fire');
    expect(r.sign.modality).toBe('Cardinal');
    expect(r.sign.planet).toBe('Mars');
    expect(r.dateRange).toBe('March 21 – April 19');
    expect(r.isBoundary).toBe(false);
    expect(r.rows).toEqual([
      { label: 'Sign', value: '♈ Aries' },
      { label: 'Date range', value: 'March 21 – April 19' },
      { label: 'Element', value: 'Fire' },
      { label: 'Modality', value: 'Cardinal' },
      { label: 'Ruling planet', value: 'Mars' },
    ]);
  });

  it('handles Capricorn wrapping across the new year (Jan 1)', () => {
    const r = getWesternZodiacSign(1, 1);
    expect(r.sign.name).toBe('Capricorn');
    expect(r.dateRange).toBe('December 22 – January 19');
    expect(r.isBoundary).toBe(false);
  });

  it('flags Capricorn cusps (Jan 19 and Dec 22) as boundaries', () => {
    expect(getWesternZodiacSign(1, 19).isBoundary).toBe(true);
    expect(getWesternZodiacSign(12, 22).isBoundary).toBe(true);
    // Dec 31 sits well inside Capricorn, not on a cusp.
    expect(getWesternZodiacSign(12, 31).isBoundary).toBe(false);
  });

  it('flags a standard window start as a boundary (Leo, Jul 23)', () => {
    const r = getWesternZodiacSign(7, 23);
    expect(r.sign.name).toBe('Leo');
    expect(r.sign.planet).toBe('Sun');
    expect(r.isBoundary).toBe(true);
  });

  it('accepts February 29 (leap day) and returns Pisces', () => {
    const r = getWesternZodiacSign(2, 29);
    expect(r.sign.name).toBe('Pisces');
    expect(r.sign.planet).toBe('Neptune (Jupiter)');
  });

  it('throws RangeError on an out-of-range month', () => {
    expect(() => getWesternZodiacSign(13, 1)).toThrow(RangeError);
    expect(() => getWesternZodiacSign(13, 1)).toThrow('Month must be an integer 1-12.');
  });

  it('throws RangeError on a day beyond the month length', () => {
    expect(() => getWesternZodiacSign(2, 30)).toThrow(RangeError);
    expect(() => getWesternZodiacSign(2, 30)).toThrow('Day must be an integer 1-29 for February.');
  });

  it('throws RangeError on a non-integer day', () => {
    expect(() => getWesternZodiacSign(4, 4.5)).toThrow(RangeError);
    expect(() => getWesternZodiacSign(4, 4.5)).toThrow('Day must be an integer 1-30 for April.');
  });
});
