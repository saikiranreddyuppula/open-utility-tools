import { describe, it, expect } from 'vitest';
import {
  calculateMeetingCost,
  parseRates,
  formatMeetingCost,
} from '../../src/time/time-meeting-cost-calculator';

describe('calculateMeetingCost', () => {
  it('computes the default average-mode meeting (6 × $75 for 60 min)', () => {
    expect(calculateMeetingCost({ mode: 'average', attendees: 6, averageRate: 75 }, { minutes: 60 })).toEqual({
      totalCost: 450,
      perMinute: 7.5,
      perAttendee: 75,
      attendees: 6,
      hours: 1,
      ratesSum: 450,
      baseSum: 450,
    });
  });

  it('matches the equivalent per-person rate list (same instant of cost)', () => {
    expect(calculateMeetingCost({ mode: 'list', rates: '120\n90\n75\n60\n55\n50' }, { minutes: 60 })).toEqual({
      totalCost: 450,
      perMinute: 7.5,
      perAttendee: 75,
      attendees: 6,
      hours: 1,
      ratesSum: 450,
      baseSum: 450,
    });
  });

  it('applies an overhead multiplier over a non-hour duration (90 min, 1.4×)', () => {
    expect(
      calculateMeetingCost(
        { mode: 'average', attendees: 4, averageRate: 100 },
        { minutes: 90, overhead: 1.4 },
      ),
    ).toEqual({
      totalCost: 840,
      perMinute: 9.333333333333334,
      perAttendee: 210,
      attendees: 4,
      hours: 1.5,
      ratesSum: 560,
      baseSum: 400,
    });
  });

  it('parses a comma-separated rate list and drops invalid/negative entries', () => {
    expect(calculateMeetingCost({ mode: 'list', rates: '120, 90, abc, -5, 60' }, { minutes: 30 })).toEqual({
      totalCost: 135,
      perMinute: 4.5,
      perAttendee: 45,
      attendees: 3,
      hours: 0.5,
      ratesSum: 270,
      baseSum: 270,
    });
  });

  it('falls back to overhead = 1 when overhead is non-positive', () => {
    expect(
      calculateMeetingCost({ mode: 'average', attendees: 3, averageRate: 50 }, { minutes: 60, overhead: -2 }),
    ).toEqual({
      totalCost: 150,
      perMinute: 2.5,
      perAttendee: 50,
      attendees: 3,
      hours: 1,
      ratesSum: 150,
      baseSum: 150,
    });
  });

  it('throws on a non-positive duration', () => {
    expect(() =>
      calculateMeetingCost({ mode: 'average', attendees: 6, averageRate: 75 }, { minutes: 0 }),
    ).toThrow(RangeError);
  });

  it('throws when a list contains no valid rates', () => {
    expect(() => calculateMeetingCost({ mode: 'list', rates: 'abc, -5' }, { minutes: 60 })).toThrow(RangeError);
  });
});

describe('parseRates', () => {
  it('splits on commas/newlines and keeps finite, non-negative values', () => {
    expect(parseRates('120, 90, abc, -5, 60')).toEqual([120, 90, 60]);
  });
});

describe('formatMeetingCost', () => {
  it('formats with en-US grouping and two fraction digits', () => {
    expect(formatMeetingCost('$', 12345.678)).toBe('$12,345.68');
  });

  it('renders the sign before the symbol for negative amounts', () => {
    expect(formatMeetingCost('€', -50)).toBe('-€50.00');
  });
});