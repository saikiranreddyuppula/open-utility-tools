import { describe, it, expect } from 'vitest';
import { dateAddSubtract } from '../../src/time/date-add-subtract';

describe('dateAddSubtract', () => {
  it('adds days (default op/unit)', () => {
    expect(dateAddSubtract('2024-01-15', 7)).toEqual({
      iso: '2024-01-22',
      locale: 'Monday, January 22, 2024',
      weekday: 'Monday',
    });
  });

  it('adds months with native end-of-month rollover (Jan 31 + 1mo → Mar 2)', () => {
    expect(dateAddSubtract('2024-01-31', 1, { unit: 'months' })).toEqual({
      iso: '2024-03-02',
      locale: 'Saturday, March 2, 2024',
      weekday: 'Saturday',
    });
  });

  it('subtracts weeks', () => {
    expect(dateAddSubtract('2024-03-15', 2, { op: 'subtract', unit: 'weeks' })).toEqual({
      iso: '2024-03-01',
      locale: 'Friday, March 1, 2024',
      weekday: 'Friday',
    });
  });

  it('adds a year onto a leap day, rolling Feb 29 → Mar 1', () => {
    expect(dateAddSubtract('2024-02-29', 1, { unit: 'years' })).toEqual({
      iso: '2025-03-01',
      locale: 'Saturday, March 1, 2025',
      weekday: 'Saturday',
    });
  });

  it('subtracts across a year boundary', () => {
    expect(dateAddSubtract('2020-12-31', 1, { op: 'subtract', unit: 'days' })).toEqual({
      iso: '2020-12-30',
      locale: 'Wednesday, December 30, 2020',
      weekday: 'Wednesday',
    });
  });

  it('honors a custom locale for the long form', () => {
    expect(dateAddSubtract('2024-01-15', 7, { locale: 'de-DE' }).locale).toBe(
      'Montag, 22. Januar 2024',
    );
  });

  it('throws RangeError on an invalid base date', () => {
    expect(() => dateAddSubtract('2024-02-30', 1)).toThrow(RangeError);
    expect(() => dateAddSubtract('not-a-date', 1)).toThrow(RangeError);
  });

  it('throws TypeError on a non-finite amount', () => {
    expect(() => dateAddSubtract('2024-01-15', Number.NaN)).toThrow(TypeError);
    expect(() => dateAddSubtract('2024-01-15', Infinity)).toThrow(TypeError);
  });
});
