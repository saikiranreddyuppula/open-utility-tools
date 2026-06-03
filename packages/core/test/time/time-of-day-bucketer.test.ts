import { describe, it, expect } from 'vitest';
import { classifyTimeOfDay } from '../../src/time/time-of-day-bucketer';

describe('classifyTimeOfDay', () => {
  it('classifies an afternoon time with full details', () => {
    expect(classifyTimeOfDay('14:35')).toEqual({
      label: 'Afternoon',
      greeting: 'Good afternoon',
      time12: '2:35:00 PM',
      time24: '14:35:00',
      minutesSinceMidnight: 875,
      segmentStart: 720,
      segmentEnd: 1020,
      segmentRange: '12:00 – 17:00',
    });
  });

  it('treats a boundary start minute as belonging to the new segment', () => {
    const r = classifyTimeOfDay('06:00');
    expect(r.label).toBe('Morning');
    expect(r.greeting).toBe('Good morning');
    expect(r.time12).toBe('6:00:00 AM');
    expect(r.segmentStart).toBe(360);
    expect(r.segmentEnd).toBe(720);
  });

  it('handles midnight (with seconds) as the leading Night segment', () => {
    const r = classifyTimeOfDay('00:00:30');
    expect(r.label).toBe('Night');
    expect(r.time12).toBe('12:00:30 AM');
    expect(r.time24).toBe('00:00:30');
    expect(r.minutesSinceMidnight).toBe(0);
    expect(r.segmentRange).toBe('00:00 – 06:00');
  });

  it('classifies the last minute of the day as the trailing Night segment', () => {
    const r = classifyTimeOfDay('23:59:59');
    expect(r.label).toBe('Night');
    expect(r.time12).toBe('11:59:59 PM');
    expect(r.minutesSinceMidnight).toBe(1439);
    expect(r.segmentStart).toBe(1260);
    expect(r.segmentEnd).toBe(1440);
    expect(r.segmentRange).toBe('21:00 – 00:00');
  });

  it('accepts custom strictly-increasing boundaries', () => {
    const r = classifyTimeOfDay('08:00', {
      boundaries: [
        { label: 'Off', greeting: 'Closed', start: 0 },
        { label: 'Open', greeting: 'We are open', start: '09:00' },
        { label: 'Closing', greeting: 'Closing soon', start: '17:00' },
      ],
    });
    expect(r.label).toBe('Off');
    expect(r.segmentStart).toBe(0);
    expect(r.segmentEnd).toBe(540);
  });

  it('throws RangeError on invalid or out-of-range input', () => {
    expect(() => classifyTimeOfDay('25:00')).toThrow(RangeError);
    expect(() => classifyTimeOfDay('nope')).toThrow(RangeError);
    expect(() =>
      classifyTimeOfDay('10:00', {
        boundaries: [
          { label: 'A', greeting: 'a', start: 0 },
          { label: 'B', greeting: 'b', start: '00:00' },
        ],
      }),
    ).toThrow(RangeError);
  });
});