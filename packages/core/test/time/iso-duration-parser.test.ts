import { describe, it, expect } from 'vitest';

import { parseIsoDuration } from '../../src/time/iso-duration-parser';

describe('parseIsoDuration', () => {
  it('parses a full calendar duration with approximate totals', () => {
    const d = parseIsoDuration('P1Y2M10DT2H30M');
    expect(d).toMatchObject({
      sign: 1,
      years: 1,
      months: 2,
      weeks: 0,
      days: 10,
      hours: 2,
      minutes: 30,
      seconds: 0,
      totalSeconds: 37689444,
      totalSecondsRounded: 37689444,
      totalMinutes: 628157.4,
      totalHours: 10469.29,
      totalDays: 436.22041666666667,
      human: '1 year, 2 months, 10 days, 2 hours, 30 minutes',
      isExact: false,
      exactSeconds: null,
    });
  });

  it('reports an exact second total when years and months are absent', () => {
    const d = parseIsoDuration('PT45M');
    expect(d.totalSeconds).toBe(2700);
    expect(d.totalMinutes).toBe(45);
    expect(d.totalHours).toBe(0.75);
    expect(d.human).toBe('45 minutes');
    expect(d.isExact).toBe(true);
    expect(d.exactSeconds).toBe(2700);
  });

  it('combines weeks even though the spec treats them as exclusive', () => {
    const d = parseIsoDuration('P3W');
    expect(d.weeks).toBe(3);
    expect(d.totalSeconds).toBe(1814400);
    expect(d.totalDays).toBe(21);
    expect(d.human).toBe('3 weeks');
    expect(d.exactSeconds).toBe(1814400);
  });

  it('honours a leading minus sign and trims/upper-cases input', () => {
    const d = parseIsoDuration('  -pt1h  ');
    expect(d.sign).toBe(-1);
    expect(d.hours).toBe(1);
    expect(d.totalSeconds).toBe(-3600);
    expect(d.human).toBe('minus 1 hour');
    expect(d.exactSeconds).toBe(-3600);
  });

  it('treats a zero duration as exact with a "zero duration" label', () => {
    const d = parseIsoDuration('P0D');
    expect(d.totalSeconds).toBe(0);
    expect(d.human).toBe('zero duration');
    expect(d.isExact).toBe(true);
    expect(d.exactSeconds).toBe(0);
  });

  it('throws RangeError on empty or malformed input', () => {
    expect(() => parseIsoDuration('   ')).toThrow(RangeError);
    expect(() => parseIsoDuration('P1H')).toThrow(RangeError);
    expect(() => parseIsoDuration('hello')).toThrow(RangeError);
  });
});
