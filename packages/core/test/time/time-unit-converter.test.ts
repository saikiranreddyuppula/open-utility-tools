import { describe, it, expect } from 'vitest';
import {
  convertTimeUnit,
  formatTimeUnitConversions,
  formatTimeValue,
} from '../../src/time/time-unit-converter';

describe('convertTimeUnit', () => {
  it('converts seconds to every unit', () => {
    expect(convertTimeUnit(90, 's')).toEqual({
      ns: 90000000000,
      us: 90000000,
      ms: 90000,
      s: 90,
      min: 1.5,
      h: 0.025,
      d: 0.0010416666666666667,
    });
  });

  it('converts one day to every unit (whole numbers)', () => {
    expect(convertTimeUnit(1, 'd')).toEqual({
      ns: 86400000000000,
      us: 86400000000,
      ms: 86400000,
      s: 86400,
      min: 1440,
      h: 24,
      d: 1,
    });
  });

  it('handles zero', () => {
    expect(convertTimeUnit(0, 's')).toEqual({
      ns: 0,
      us: 0,
      ms: 0,
      s: 0,
      min: 0,
      h: 0,
      d: 0,
    });
  });

  it('rejects non-finite values with RangeError', () => {
    expect(() => convertTimeUnit(NaN, 's')).toThrow(RangeError);
    expect(() => convertTimeUnit(Infinity, 's')).toThrow('finite');
  });

  it('rejects an unknown unit with RangeError', () => {
    // @ts-expect-error exercising the runtime guard with a bad unit
    expect(() => convertTimeUnit(1, 'years')).toThrow(RangeError);
  });
});

describe('formatTimeUnitConversions', () => {
  it('reproduces the padded multi-line table the UI renders', () => {
    expect(formatTimeUnitConversions(90, 's')).toBe(
      'Nanoseconds   90000000000\n' +
        'Microseconds  90000000\n' +
        'Milliseconds  90000\n' +
        'Seconds       90\n' +
        'Minutes       1.5\n' +
        'Hours         0.025\n' +
        'Days          0.001041667',
    );
  });

  it('uses exponential notation for very small magnitudes', () => {
    expect(formatTimeUnitConversions(1234567890, 'ns')).toBe(
      'Nanoseconds   1234567890\n' +
        'Microseconds  1234567.89\n' +
        'Milliseconds  1234.56789\n' +
        'Seconds       1.23456789\n' +
        'Minutes       0.020576132\n' +
        'Hours         0.000342936\n' +
        'Days          1.428898e-5',
    );
  });
});

describe('formatTimeValue', () => {
  it('trims trailing zeros and switches to exponential below 1e-4', () => {
    expect(formatTimeValue(0)).toBe('0');
    expect(formatTimeValue(1.5)).toBe('1.5');
    expect(formatTimeValue(0.000001234)).toBe('1.234000e-6');
  });
});