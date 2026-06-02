// Pin the time zone before importing the module so the date-derived golden
// values (earthSeconds and each `nextBirthday`, which come from local-midnight
// Date construction) are deterministic on every runner. V8/Bun read
// process.env.TZ lazily on each Date call, so setting it here applies to every
// Date constructed below. Without this pin the values below fail in offsets at
// or beyond ~UTC+14 (e.g. Pacific/Kiritimati). Mirrors the convention used by
// epoch-precision-converter.test.ts.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import {
  agesFromEarthYears,
  agesFromBirthDate,
  PLANETS,
} from '../../src/time/age-on-other-planets';

describe('agesFromEarthYears', () => {
  it('converts 25 Earth years to per-planet ages', () => {
    const { rows, earthSeconds } = agesFromEarthYears(25);
    expect(earthSeconds).toBe(788_940_000);
    expect(rows).toHaveLength(PLANETS.length);
    expect(rows.find((r) => r.name === 'Mercury')?.age).toBe('103.80');
    expect(rows.find((r) => r.name === 'Earth')?.age).toBe('25.00');
    expect(rows.find((r) => r.name === 'Mars')?.age).toBe('13.29');
    expect(rows.find((r) => r.name === 'Neptune')?.age).toBe('0.15');
    // No birth instant supplied → no projected birthday.
    expect(rows.every((r) => r.nextBirthday === '—')).toBe(true);
  });

  it('handles zero years', () => {
    const { rows, earthSeconds } = agesFromEarthYears(0);
    expect(earthSeconds).toBe(0);
    expect(rows.every((r) => r.age === '0.00')).toBe(true);
  });

  it('throws RangeError on negative or non-finite input', () => {
    expect(() => agesFromEarthYears(-1)).toThrow(RangeError);
    expect(() => agesFromEarthYears(Number.NaN)).toThrow(RangeError);
    expect(() => agesFromEarthYears(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('agesFromBirthDate', () => {
  it('computes ages and projected birthdays for a birth date', () => {
    const { rows, earthSeconds } = agesFromBirthDate('2000-01-01', '2025-01-01');
    expect(earthSeconds).toBe(789_004_800);
    expect(rows).toEqual([
      { name: 'Mercury', age: '103.81', nextBirthday: '2025-01-17 (turns 104)' },
      { name: 'Venus', age: '40.64', nextBirthday: '2025-03-22 (turns 41)' },
      { name: 'Earth', age: '25.00', nextBirthday: '2025-12-31 (turns 26)' },
      { name: 'Mars', age: '13.29', nextBirthday: '2026-05-01 (turns 14)' },
      { name: 'Jupiter', age: '2.11', nextBirthday: '2035-08-03 (turns 3)' },
      { name: 'Saturn', age: '0.85', nextBirthday: '2029-06-12 (turns 1)' },
      { name: 'Uranus', age: '0.30', nextBirthday: '2084-01-07 (turns 1)' },
      { name: 'Neptune', age: '0.15', nextBirthday: '2164-10-17 (turns 1)' },
    ]);
  });

  it('projects the next Mars birthday relative to a reference date', () => {
    const { rows, earthSeconds } = agesFromBirthDate('1990-07-20', '2026-06-02');
    expect(earthSeconds).toBe(1_131_926_400);
    expect(rows.find((r) => r.name === 'Earth')?.nextBirthday).toBe('2026-07-20 (turns 36)');
    expect(rows.find((r) => r.name === 'Mars')).toEqual({
      name: 'Mars',
      age: '19.07',
      nextBirthday: '2028-03-01 (turns 20)',
    });
  });

  it('throws RangeError for invalid dates and future birth dates', () => {
    expect(() => agesFromBirthDate('nope', '2025-01-01')).toThrow(RangeError);
    expect(() => agesFromBirthDate('2000-01-01', 'nope')).toThrow(RangeError);
    expect(() => agesFromBirthDate('2030-01-01', '2025-01-01')).toThrow(/future/);
  });
});