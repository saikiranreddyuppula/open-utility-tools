import { describe, it, expect } from 'vitest';
import { cronNextRuns } from '../../src/time/cron-next-runs-preview';

describe('cronNextRuns', () => {
  it('lists weekday runs at 9am with daily gaps', () => {
    const runs = cronNextRuns('0 9 * * MON-FRI', {
      start: '2026-06-01T00:00:00Z',
      count: 5,
      offsetMinutes: 0,
    });
    expect(runs).toEqual([
      { datetime: '2026-06-01 09:00', weekday: 'Mon', gap: '—', epochMs: 1780304400000 },
      { datetime: '2026-06-02 09:00', weekday: 'Tue', gap: '1d', epochMs: 1780390800000 },
      { datetime: '2026-06-03 09:00', weekday: 'Wed', gap: '1d', epochMs: 1780477200000 },
      { datetime: '2026-06-04 09:00', weekday: 'Thu', gap: '1d', epochMs: 1780563600000 },
      { datetime: '2026-06-05 09:00', weekday: 'Fri', gap: '1d', epochMs: 1780650000000 },
    ]);
  });

  it('handles step fields and rounds up to the next whole minute', () => {
    const runs = cronNextRuns('*/15 * * * *', {
      start: '2026-06-01T00:07:00Z',
      count: 4,
    });
    expect(runs).toEqual([
      { datetime: '2026-06-01 00:15', weekday: 'Mon', gap: '—', epochMs: 1780272900000 },
      { datetime: '2026-06-01 00:30', weekday: 'Mon', gap: '15m', epochMs: 1780273800000 },
      { datetime: '2026-06-01 00:45', weekday: 'Mon', gap: '15m', epochMs: 1780274700000 },
      { datetime: '2026-06-01 01:00', weekday: 'Mon', gap: '15m', epochMs: 1780275600000 },
    ]);
  });

  it('applies a timezone offset to the wall clock and accepts a Date start', () => {
    const runs = cronNextRuns('30 14 * * *', {
      start: new Date('2026-06-01T00:00:00Z'),
      count: 2,
      offsetMinutes: 330,
    });
    expect(runs).toEqual([
      { datetime: '2026-06-01 14:30', weekday: 'Mon', gap: '—', epochMs: 1780324200000 },
      { datetime: '2026-06-02 14:30', weekday: 'Tue', gap: '1d', epochMs: 1780410600000 },
    ]);
  });

  it('ORs day-of-month and day-of-week when both are restricted', () => {
    const runs = cronNextRuns('0 0 13 * FRI', {
      start: '2026-01-01T00:00:00Z',
      count: 3,
    });
    expect(runs).toEqual([
      { datetime: '2026-01-02 00:00', weekday: 'Fri', gap: '—', epochMs: 1767312000000 },
      { datetime: '2026-01-09 00:00', weekday: 'Fri', gap: '7d', epochMs: 1767916800000 },
      { datetime: '2026-01-13 00:00', weekday: 'Tue', gap: '4d', epochMs: 1768262400000 },
    ]);
  });

  it('clamps a count of 0 up to a single run', () => {
    const runs = cronNextRuns('0 9 * * *', {
      start: '2026-06-01T00:00:00Z',
      count: 0,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.datetime).toBe('2026-06-01 09:00');
  });

  it('throws TypeError when the expression is not a string', () => {
    // @ts-expect-error testing runtime guard against non-string input
    expect(() => cronNextRuns(123, {})).toThrow(TypeError);
  });

  it('throws RangeError for the wrong number of fields', () => {
    expect(() => cronNextRuns('0 9 * *', { start: '2026-06-01T00:00:00Z' })).toThrow(
      'Enter exactly 5 fields: minute hour day-of-month month day-of-week.',
    );
  });

  it('throws RangeError for out-of-range field values', () => {
    expect(() => cronNextRuns('99 9 * * *', { start: '2026-06-01T00:00:00Z' })).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for an unparseable start datetime', () => {
    expect(() => cronNextRuns('0 9 * * *', { start: 'not-a-date' })).toThrow(
      'Enter a valid start datetime.',
    );
  });
});