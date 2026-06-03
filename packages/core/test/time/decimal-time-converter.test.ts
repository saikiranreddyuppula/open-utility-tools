import { describe, it, expect } from 'vitest';
import { standardToDecimal, decimalToStandard } from '../../src/time/decimal-time-converter';

describe('standardToDecimal', () => {
  it('converts a typical afternoon time', () => {
    expect(standardToDecimal('14:30:00')).toEqual({
      decimalTime: '6:04:16',
      decimalHours: '6.04167',
      fractionOfDay: '60.41667%',
      standardTime: '14:30:00',
    });
  });

  it('treats midnight as zero and defaults seconds to 0 for HH:MM', () => {
    expect(standardToDecimal('00:00')).toEqual({
      decimalTime: '0:00:00',
      decimalHours: '0.00000',
      fractionOfDay: '0.00000%',
      standardTime: '00:00:00',
    });
  });

  it('maps noon to exactly half the decimal day', () => {
    expect(standardToDecimal('12:00:00')).toEqual({
      decimalTime: '5:00:00',
      decimalHours: '5.00000',
      fractionOfDay: '50.00000%',
      standardTime: '12:00:00',
    });
  });

  it('floors the last second of the day to 9:99:98', () => {
    expect(standardToDecimal('23:59:59').decimalTime).toBe('9:99:98');
  });

  it('throws RangeError when hours exceed 23', () => {
    expect(() => standardToDecimal('25:00')).toThrow(RangeError);
  });

  it('throws TypeError when parts are not numbers', () => {
    expect(() => standardToDecimal('a:b')).toThrow(TypeError);
  });
});

describe('decimalToStandard', () => {
  it('round-trips an afternoon time (lossy by rounding, matching the original)', () => {
    expect(decimalToStandard('6:04:16')).toEqual({
      standardTime: '14:29:59',
      fractionOfDay: '60.41600%',
      secondsSinceMidnight: 52199,
      decimalTime: '6:04:16',
    });
  });

  it('maps decimal 5:00 back to noon', () => {
    expect(decimalToStandard('5:00')).toEqual({
      standardTime: '12:00:00',
      fractionOfDay: '50.00000%',
      secondsSinceMidnight: 43200,
      decimalTime: '5:00:00',
    });
  });

  it('maps the max decimal time to the last second of the day', () => {
    expect(decimalToStandard('9:99:99')).toEqual({
      standardTime: '23:59:59',
      fractionOfDay: '99.99900%',
      secondsSinceMidnight: 86399,
      decimalTime: '9:99:99',
    });
  });

  it('throws RangeError when decimal hours exceed 9', () => {
    expect(() => decimalToStandard('10:00')).toThrow(RangeError);
  });
});
