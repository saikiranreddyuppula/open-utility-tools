import { describe, it, expect } from 'vitest';
import { timeToBeats, beatsToTime } from '../../src/time/swatch-internet-time';

describe('timeToBeats', () => {
  it('converts UTC noon to beats via BMT (UTC+1)', () => {
    expect(timeToBeats('12:00:00', 0)).toEqual({
      beats: 541,
      beatsLabel: '@541',
      beatsPrecise: 541.6666666666666,
      beatsPreciseLabel: '@541.67',
      bmtClock: '13:00:00',
      localTime: '12:00:00',
    });
  });

  it('treats BMT midnight (UTC+1 local) as @000', () => {
    expect(timeToBeats('00:00:00', 60)).toEqual({
      beats: 0,
      beatsLabel: '@000',
      beatsPrecise: 0,
      beatsPreciseLabel: '@0.00',
      bmtClock: '00:00:00',
      localTime: '00:00:00',
    });
  });

  it('applies a fractional UTC offset (IST, +330)', () => {
    const r = timeToBeats('09:30:00', 330);
    expect(r.beatsLabel).toBe('@208');
    expect(r.beatsPreciseLabel).toBe('@208.33');
    expect(r.bmtClock).toBe('05:00:00');
    expect(r.localTime).toBe('09:30:00');
  });

  it('defaults missing minutes/seconds to zero and handles negative offsets', () => {
    const r = timeToBeats('18:45:30', -480);
    expect(r).toEqual({
      beats: 156,
      beatsLabel: '@156',
      beatsPrecise: 156.5972222222222,
      beatsPreciseLabel: '@156.60',
      bmtClock: '03:45:30',
      localTime: '18:45:30',
    });
  });

  it('rejects out-of-range and malformed times', () => {
    expect(() => timeToBeats('24:00', 0)).toThrow(RangeError);
    expect(() => timeToBeats('12:60', 0)).toThrow(RangeError);
    expect(() => timeToBeats('not-a-time', 0)).toThrow(RangeError);
    expect(() => timeToBeats('12:00', Number.NaN)).toThrow(RangeError);
  });
});

describe('beatsToTime', () => {
  it('converts @500 (BMT noon) to local time', () => {
    expect(beatsToTime(500, 0)).toEqual({
      localTime: '11:00:00',
      bmtClock: '12:00:00',
      beats: 500,
      beatsLabel: '@500',
    });
  });

  it('converts the last beat @999 just before BMT midnight', () => {
    expect(beatsToTime(999, 0)).toEqual({
      localTime: '22:58:33',
      bmtClock: '23:58:33',
      beats: 999,
      beatsLabel: '@999',
    });
  });

  it('wraps out-of-range beats modulo 1000', () => {
    expect(beatsToTime(1500, 0)).toEqual({
      localTime: '11:00:00',
      bmtClock: '12:00:00',
      beats: 500,
      beatsLabel: '@500',
    });
    expect(beatsToTime(-100, 0)).toEqual({
      localTime: '20:36:00',
      bmtClock: '21:36:00',
      beats: 900,
      beatsLabel: '@900',
    });
  });

  it('throws on non-finite inputs', () => {
    expect(() => beatsToTime(Number.NaN, 0)).toThrow(RangeError);
    expect(() => beatsToTime(500, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
