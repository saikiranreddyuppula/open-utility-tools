import { describe, it, expect } from 'vitest';
import { timeBetweenClocks } from '../../src/time/time-between-clocks';

describe('timeBetweenClocks', () => {
  it('wraps past midnight for an overnight shift', () => {
    expect(timeBetweenClocks('22:30', '06:15', { wrap: true })).toEqual({
      durationHMS: '07:45:00',
      totalSeconds: 27900,
      totalMinutes: '465.00',
      totalHoursDecimal: '7.7500',
      crossesMidnight: true,
    });
  });

  it('computes a same-day span without wrapping', () => {
    expect(timeBetweenClocks('09:00', '17:30', { wrap: false })).toEqual({
      durationHMS: '08:30:00',
      totalSeconds: 30600,
      totalMinutes: '510.00',
      totalHoursDecimal: '8.5000',
      crossesMidnight: false,
    });
  });

  it('handles HH:MM:SS precision across nearly a full day', () => {
    expect(timeBetweenClocks('00:00:00', '23:59:59')).toEqual({
      durationHMS: '23:59:59',
      totalSeconds: 86399,
      totalMinutes: '1439.98',
      totalHoursDecimal: '23.9997',
      crossesMidnight: false,
    });
  });

  it('treats equal start and end as a zero-length duration', () => {
    expect(timeBetweenClocks('12:00', '12:00')).toEqual({
      durationHMS: '00:00:00',
      totalSeconds: 0,
      totalMinutes: '0.00',
      totalHoursDecimal: '0.0000',
      crossesMidnight: false,
    });
  });

  it('wraps a sub-hour overnight span with seconds', () => {
    expect(timeBetweenClocks('23:15:30', '01:45:00', { wrap: true })).toEqual({
      durationHMS: '02:29:30',
      totalSeconds: 8970,
      totalMinutes: '149.50',
      totalHoursDecimal: '2.4917',
      crossesMidnight: true,
    });
  });

  it('throws RangeError when end precedes start without wrap', () => {
    expect(() => timeBetweenClocks('10:00', '08:00', { wrap: false })).toThrow(RangeError);
  });

  it('throws TypeError on an unparseable clock string', () => {
    expect(() => timeBetweenClocks('25:00', '01:00')).toThrow(TypeError);
    expect(() => timeBetweenClocks('09:00', 'noon')).toThrow(TypeError);
  });
});
