import { describe, it, expect } from 'vitest';

import { dateDifference } from '../../src/time/date-difference';

describe('dateDifference', () => {
  it('computes whole-year spans across two decades', () => {
    expect(dateDifference('2000-01-01', '2020-01-01')).toEqual({
      calendar: '20 years, 0 months, 0 days',
      totalDays: '7,305',
      totalWeeks: '1043.6',
      totalHours: '175,320',
      totalMinutes: '10,519,200',
      totalSeconds: '631,152,000',
    });
  });

  it('borrows from the prior month for a partial calendar breakdown', () => {
    expect(dateDifference('2000-01-15', '2020-03-10')).toEqual({
      calendar: '20 years, 1 months, 24 days',
      totalDays: '7,360',
      totalWeeks: '1051.4',
      totalHours: '176,640',
      totalMinutes: '10,598,400',
      totalSeconds: '635,904,000',
    });
  });

  it('is direction-independent (swapping from/to gives the same span)', () => {
    expect(dateDifference('2020-03-10', '2000-01-15')).toEqual(
      dateDifference('2000-01-15', '2020-03-10'),
    );
  });

  it('handles a single-day difference across a year boundary', () => {
    expect(dateDifference('2023-12-31', '2024-01-01')).toEqual({
      calendar: '0 years, 0 months, 1 days',
      totalDays: '1',
      totalWeeks: '0.1',
      totalHours: '24',
      totalMinutes: '1,440',
      totalSeconds: '86,400',
    });
  });

  it('returns all zeros when the two dates are identical', () => {
    expect(dateDifference('2000-01-01', '2000-01-01')).toEqual({
      calendar: '0 years, 0 months, 0 days',
      totalDays: '0',
      totalWeeks: '0.0',
      totalHours: '0',
      totalMinutes: '0',
      totalSeconds: '0',
    });
  });

  it('throws a RangeError for an unparseable "from" date', () => {
    expect(() => dateDifference('not-a-date', '2020-01-01')).toThrow(RangeError);
    expect(() => dateDifference('not-a-date', '2020-01-01')).toThrow(
      'Invalid "from" date: not-a-date',
    );
  });
});
