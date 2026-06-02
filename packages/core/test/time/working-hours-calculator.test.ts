import { describe, it, expect } from 'vitest';
import { calculateWorkingHours } from '../../src/time/working-hours-calculator';

describe('calculateWorkingHours', () => {
  it('counts a full Mon-Fri week with a 60-minute lunch', () => {
    const r = calculateWorkingHours({
      start: '2026-05-25T09:00',
      end: '2026-05-29T17:00',
      workDayStart: '09:00',
      workDayEnd: '17:00',
      lunchMinutes: 60,
      workingDays: [1, 2, 3, 4, 5],
    });
    expect(r).toEqual({
      totalMinutes: 2100,
      totalHours: 35,
      workingDays: 5,
      days: [
        { date: '2026-05-25', dayOfWeek: 'Mon', minutes: 420 },
        { date: '2026-05-26', dayOfWeek: 'Tue', minutes: 420 },
        { date: '2026-05-27', dayOfWeek: 'Wed', minutes: 420 },
        { date: '2026-05-28', dayOfWeek: 'Thu', minutes: 420 },
        { date: '2026-05-29', dayOfWeek: 'Fri', minutes: 420 },
      ],
    });
  });

  it('clamps a partial single-day interval to the work window (no lunch)', () => {
    const r = calculateWorkingHours({
      start: '2026-05-25T10:30',
      end: '2026-05-25T15:00',
    });
    expect(r.totalMinutes).toBe(270);
    expect(r.totalHours).toBeCloseTo(4.5, 10);
    expect(r.workingDays).toBe(1);
    expect(r.days).toEqual([{ date: '2026-05-25', dayOfWeek: 'Mon', minutes: 270 }]);
  });

  it('excludes weekend days that fall in the span', () => {
    const r = calculateWorkingHours({
      start: '2026-05-29T09:00',
      end: '2026-06-01T17:00',
      lunchMinutes: 60,
    });
    expect(r.totalMinutes).toBe(840);
    expect(r.workingDays).toBe(2);
    expect(r.days).toEqual([
      { date: '2026-05-29', dayOfWeek: 'Fri', minutes: 420 },
      { date: '2026-06-01', dayOfWeek: 'Mon', minutes: 420 },
    ]);
  });

  it('caps the day at the work window even when the span extends past it', () => {
    const r = calculateWorkingHours({
      start: '2026-05-25T06:00',
      end: '2026-05-25T20:00',
      lunchMinutes: 30,
    });
    expect(r.totalMinutes).toBe(450);
    expect(r.days).toEqual([{ date: '2026-05-25', dayOfWeek: 'Mon', minutes: 450 }]);
  });

  it('supports a custom set of working days (weekends only)', () => {
    const r = calculateWorkingHours({
      start: '2026-05-30T08:00',
      end: '2026-05-31T18:00',
      workDayStart: '10:00',
      workDayEnd: '14:00',
      workingDays: [0, 6],
    });
    expect(r.totalMinutes).toBe(480);
    expect(r.days).toEqual([
      { date: '2026-05-30', dayOfWeek: 'Sat', minutes: 240 },
      { date: '2026-05-31', dayOfWeek: 'Sun', minutes: 240 },
    ]);
  });

  it('throws TypeError on an invalid start datetime', () => {
    expect(() =>
      calculateWorkingHours({ start: 'not-a-date', end: '2026-05-25T15:00' }),
    ).toThrow(TypeError);
  });

  it('throws RangeError when end is not after start', () => {
    expect(() =>
      calculateWorkingHours({ start: '2026-05-25T15:00', end: '2026-05-25T09:00' }),
    ).toThrow(RangeError);
  });

  it('throws RangeError when lunch is longer than the work window', () => {
    expect(() =>
      calculateWorkingHours({
        start: '2026-05-25T09:00',
        end: '2026-05-25T17:00',
        lunchMinutes: 600,
      }),
    ).toThrow(/Lunch is longer than the daily work window/);
  });

  it('throws RangeError when no working days are selected', () => {
    expect(() =>
      calculateWorkingHours({
        start: '2026-05-25T09:00',
        end: '2026-05-29T17:00',
        workingDays: [],
      }),
    ).toThrow(/at least one working weekday/);
  });
});