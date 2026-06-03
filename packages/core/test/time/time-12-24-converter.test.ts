import { describe, it, expect } from 'vitest';
import { convertTime, convertTimes } from '../../src/time/time-12-24-converter';

describe('convertTime', () => {
  it('converts 12-hour PM input to 24-hour', () => {
    expect(convertTime('2:30 PM')).toEqual({
      input: '2:30 PM',
      hour24: '14:30',
      hour12: '2:30 PM',
      h: 14,
      m: 30,
      s: 0,
    });
  });

  it('converts 24-hour input back to a 12-hour string', () => {
    expect(convertTime('14:30')).toEqual({
      input: '14:30',
      hour24: '14:30',
      hour12: '2:30 PM',
      h: 14,
      m: 30,
      s: 0,
    });
  });

  it('handles midnight (12:00 AM -> 00:00) and noon (12:00 PM -> 12:00)', () => {
    expect(convertTime('12:00 AM').hour24).toBe('00:00');
    expect(convertTime('12:00 AM').hour12).toBe('12:00 AM');
    expect(convertTime('12:00 PM').hour24).toBe('12:00');
    expect(convertTime('12:00 PM').hour12).toBe('12:00 PM');
  });

  it('respects showSeconds and padHour options', () => {
    expect(convertTime('09:05:45', { showSeconds: true })).toEqual({
      input: '09:05:45',
      hour24: '09:05:45',
      hour12: '9:05:45 AM',
      h: 9,
      m: 5,
      s: 45,
    });
    // padHour: false drops the leading zero on the 24-hour hour
    expect(convertTime('9', { padHour: false }).hour24).toBe('9:00');
    expect(convertTime('9').hour24).toBe('09:00');
  });

  it('throws a RangeError on unrecognizable input', () => {
    expect(() => convertTime('nope')).toThrow(RangeError);
    expect(() => convertTime('nope')).toThrow('Unrecognized time format: "nope"');
    expect(() => convertTime('25:00')).toThrow(RangeError); // hour out of 24h range
    expect(() => convertTime('13:00 PM')).toThrow(RangeError); // hour out of 12h range
    expect(() => convertTime('5:99')).toThrow(RangeError); // minutes out of range
    expect(() => convertTime('')).toThrow(RangeError); // empty
  });
});

describe('convertTimes', () => {
  it('processes bulk input, marking invalid lines without throwing', () => {
    expect(convertTimes('2:30 PM\nnope\n14:30')).toEqual([
      { input: '2:30 PM', ok: true, hour24: '14:30', hour12: '2:30 PM' },
      { input: 'nope', ok: false, hour24: '—', hour12: 'invalid' },
      { input: '14:30', ok: true, hour24: '14:30', hour12: '2:30 PM' },
    ]);
  });
});
