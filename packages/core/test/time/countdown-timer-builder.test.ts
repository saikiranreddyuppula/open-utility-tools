import { describe, it, expect } from 'vitest';
import { buildCountdownSnapshot } from '../../src/time/countdown-timer-builder';

describe('buildCountdownSnapshot', () => {
  it('computes a future snapshot with weeks and a label', () => {
    const snap = buildCountdownSnapshot('2026-07-15T09:30:00', {
      from: '2026-06-02T08:00:00',
      label: 'Launch',
    });
    expect(snap).toEqual({
      future: true,
      breakdown: { weeks: 6, days: 1, hours: 1, minutes: 30, seconds: 0 },
      totals: {
        totalWeeks: 6,
        totalDays: 43,
        totalHours: 1033,
        totalMinutes: 62010,
        totalSeconds: 3720600,
      },
      summary: 'Launch in 43d 01h 30m',
      absMs: 3720600000,
    });
  });

  it('computes a past snapshot with the "was ... ago" summary', () => {
    // Interval kept entirely within winter so it never crosses a DST
    // transition, keeping the wall-clock difference identical in every time
    // zone (this transform parses datetime-local values in local time).
    const snap = buildCountdownSnapshot('2026-01-01T00:00:00', {
      from: '2026-02-20T12:00:00',
      label: 'New Year',
    });
    expect(snap.future).toBe(false);
    expect(snap.breakdown).toEqual({ weeks: 7, days: 1, hours: 12, minutes: 0, seconds: 0 });
    expect(snap.totals).toEqual({
      totalWeeks: 7,
      totalDays: 50,
      totalHours: 1212,
      totalMinutes: 72720,
      totalSeconds: 4363200,
    });
    expect(snap.summary).toBe('New Year was 50d 12h 00m ago');
    expect(snap.absMs).toBe(4363200000);
  });

  it('falls back to the "Target" label when none is provided', () => {
    const snap = buildCountdownSnapshot('2026-03-01T00:00:00', { from: '2026-01-01T00:00:00' });
    expect(snap.summary).toBe('Target in 59d 00h 00m');
    expect(snap.breakdown).toEqual({ weeks: 8, days: 3, hours: 0, minutes: 0, seconds: 0 });
  });

  it('treats an exact match as a zero future snapshot', () => {
    const snap = buildCountdownSnapshot('2026-06-02T12:00:00', {
      from: '2026-06-02T12:00:00',
      label: 'Now',
    });
    expect(snap.future).toBe(true);
    expect(snap.absMs).toBe(0);
    expect(snap.breakdown).toEqual({ weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(snap.summary).toBe('Now in 0d 00h 00m');
  });

  it('keeps sub-minute remainders in the seconds field', () => {
    const snap = buildCountdownSnapshot('2026-06-02T12:00:45', {
      from: '2026-06-02T12:00:00',
      label: 'Tick',
    });
    expect(snap.breakdown).toEqual({ weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 45 });
    expect(snap.absMs).toBe(45000);
  });

  it('throws TypeError on a malformed datetime-local string', () => {
    expect(() => buildCountdownSnapshot('not-a-date', { from: '2026-06-02T12:00:00' })).toThrow(
      TypeError,
    );
    expect(() => buildCountdownSnapshot('2026-06-02T12:00:00', { from: 'bad' })).toThrow(TypeError);
  });
});
