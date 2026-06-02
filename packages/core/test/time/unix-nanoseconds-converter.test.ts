import { describe, it, expect } from 'vitest';

import {
  nanosecondsToDateTime,
  dateTimeToNanoseconds,
} from '../../src/time/unix-nanoseconds-converter';

describe('nanosecondsToDateTime', () => {
  it('converts a positive nanosecond timestamp', () => {
    expect(nanosecondsToDateTime('1700000000123456789')).toEqual({
      fullNs: '1700000000123456789',
      secFrac: '1700000000.123456789',
      iso: '2023-11-14T22:13:20.123456789Z',
      wholeSeconds: '1700000000',
      subSecond: '123456789',
    });
  });

  it('strips underscores and normalizes a negative timestamp via floor division', () => {
    expect(nanosecondsToDateTime('-500000000')).toEqual({
      fullNs: '-500000000',
      secFrac: '-1.500000000',
      iso: '1969-12-31T23:59:59.500000000Z',
      wholeSeconds: '-1',
      subSecond: '500000000',
    });
    // Underscored grouped literal yields the same result as the plain integer.
    expect(nanosecondsToDateTime('1_700_000_000_123_456_789')).toEqual(
      nanosecondsToDateTime('1700000000123456789'),
    );
  });

  it('handles the epoch (zero)', () => {
    expect(nanosecondsToDateTime('0')).toEqual({
      fullNs: '0',
      secFrac: '0.000000000',
      iso: '1970-01-01T00:00:00.000000000Z',
      wholeSeconds: '0',
      subSecond: '000000000',
    });
  });

  it('throws a TypeError on non-integer input', () => {
    expect(() => nanosecondsToDateTime('12.5')).toThrow(TypeError);
    expect(() => nanosecondsToDateTime('not-a-number')).toThrow(
      'Enter an integer number of nanoseconds.',
    );
  });
});

describe('dateTimeToNanoseconds', () => {
  it('combines a parsed instant with a sub-second nanosecond component', () => {
    expect(dateTimeToNanoseconds('2023-11-14T22:13:20Z', '123456789')).toEqual({
      fullNs: '1700000000123456789',
      secFrac: '1700000000.123456789',
      iso: '2023-11-14T22:13:20.123456789Z',
      wholeSeconds: '1700000000',
      subSecond: '123456789',
    });
  });

  it('discards any millisecond fraction in the date and replaces it with subSecond', () => {
    // The `.500` ms portion is overwritten by the sub-second ns field.
    expect(dateTimeToNanoseconds('2023-11-14T22:13:20.500Z', '123456789')).toEqual(
      dateTimeToNanoseconds('2023-11-14T22:13:20Z', '123456789'),
    );
  });

  it('defaults the sub-second component to zero', () => {
    expect(dateTimeToNanoseconds('2023-11-14T22:13:20Z')).toEqual({
      fullNs: '1700000000000000000',
      secFrac: '1700000000.000000000',
      iso: '2023-11-14T22:13:20.000000000Z',
      wholeSeconds: '1700000000',
      subSecond: '000000000',
    });
  });

  it('throws a RangeError on an unparseable datetime', () => {
    expect(() => dateTimeToNanoseconds('not-a-date')).toThrow(RangeError);
  });
});
