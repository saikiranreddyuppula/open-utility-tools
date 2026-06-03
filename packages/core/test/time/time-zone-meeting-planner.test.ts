import { describe, it, expect } from 'vitest';

import { planMeeting } from '../../src/time/time-zone-meeting-planner';

describe('planMeeting', () => {
  it('projects the default UI scenario across fixed offsets', () => {
    const r = planMeeting({
      baseDate: '2026-06-01',
      baseTime: '14:00',
      baseOffset: '+1',
      participants: [
        { label: 'New York', offset: '-4' },
        { label: 'London', offset: '+1' },
        { label: 'Mumbai', offset: '+5.5' },
        { label: 'Tokyo', offset: '+9' },
        { label: 'San Francisco', offset: '-7' },
      ],
    });

    expect(r.rows).toEqual([
      { label: 'New York', offsetMin: -240, offsetLabel: 'UTC-04:00', clock: '09:00', weekday: 'Mon', dayShift: 0, inHours: true },
      { label: 'London', offsetMin: 60, offsetLabel: 'UTC+01:00', clock: '14:00', weekday: 'Mon', dayShift: 0, inHours: true },
      { label: 'Mumbai', offsetMin: 330, offsetLabel: 'UTC+05:30', clock: '18:30', weekday: 'Mon', dayShift: 0, inHours: true },
      { label: 'Tokyo', offsetMin: 540, offsetLabel: 'UTC+09:00', clock: '22:00', weekday: 'Mon', dayShift: 0, inHours: false },
      { label: 'San Francisco', offsetMin: -420, offsetLabel: 'UTC-07:00', clock: '06:00', weekday: 'Mon', dayShift: 0, inHours: false },
    ]);
    expect(r.inCount).toBe(3);
    expect(r.baseOffsetMin).toBe(60);
    expect(r.baseOffsetLabel).toBe('UTC+01:00');
  });

  it('computes positive day shifts and respects a custom window', () => {
    const r = planMeeting({
      baseDate: '2026-06-01',
      baseTime: '23:30',
      baseOffset: '+0',
      participants: [
        { label: 'Tokyo', offset: '+9' },
        { label: 'San Francisco', offset: '-7' },
      ],
      windowStart: '09:00',
      windowEnd: '17:00',
    });

    expect(r.rows[0]).toEqual({
      label: 'Tokyo', offsetMin: 540, offsetLabel: 'UTC+09:00', clock: '08:30', weekday: 'Tue', dayShift: 1, inHours: false,
    });
    expect(r.rows[1]).toEqual({
      label: 'San Francisco', offsetMin: -420, offsetLabel: 'UTC-07:00', clock: '16:30', weekday: 'Mon', dayShift: 0, inHours: true,
    });
    expect(r.inCount).toBe(1);
    expect(r.baseOffsetLabel).toBe('UTC+00:00');
  });

  it('falls back blank labels, parses colon offsets, and skips unparseable rows (negative day shift)', () => {
    const r = planMeeting({
      baseDate: '2026-12-25',
      baseTime: '00:00',
      baseOffset: '+05:30',
      participants: [
        { label: '   ', offset: '+05:30' },
        { label: 'Bad', offset: 'nonsense' },
        { label: 'Honolulu', offset: '-10' },
      ],
    });

    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      label: 'Participant', offsetMin: 330, offsetLabel: 'UTC+05:30', clock: '00:00', weekday: 'Fri', dayShift: 0, inHours: false,
    });
    expect(r.rows[1]).toEqual({
      label: 'Honolulu', offsetMin: -600, offsetLabel: 'UTC-10:00', clock: '08:30', weekday: 'Thu', dayShift: -1, inHours: true,
    });
    expect(r.inCount).toBe(1);
  });

  it('throws RangeError on an invalid base date', () => {
    expect(() =>
      planMeeting({ baseDate: 'oops', baseTime: '14:00', baseOffset: '+1', participants: [{ label: 'x', offset: '+1' }] }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when the window start is not before its end', () => {
    expect(() =>
      planMeeting({
        baseDate: '2026-06-01', baseTime: '14:00', baseOffset: '+1',
        participants: [{ label: 'x', offset: '+1' }],
        windowStart: '20:00', windowEnd: '08:00',
      }),
    ).toThrow('Acceptable window must be valid times with start before end.');
  });

  it('throws RangeError when no participant offset can be parsed', () => {
    expect(() =>
      planMeeting({ baseDate: '2026-06-01', baseTime: '14:00', baseOffset: '+1', participants: [{ label: 'x', offset: 'junk' }] }),
    ).toThrow(RangeError);
  });
});
