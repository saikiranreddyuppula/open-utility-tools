// Pin the time zone before importing the module. Date construction and weekday
// formatting in the recurrence generator use LOCAL calendar fields, so a fixed
// TZ keeps the golden outputs deterministic. V8/Bun read process.env.TZ lazily
// on each Date call, so setting it here applies to every Date constructed below.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { generateRecurringDates } from '../../src/time/recurring-event-dates';

describe('generateRecurringDates', () => {
  it('generates weekly occurrences using the start weekday by default', () => {
    expect(
      generateRecurringDates({ start: '2026-01-01', frequency: 'weekly', interval: 1, count: 4 }),
    ).toEqual([
      { date: '2026-01-01', weekday: 'Thursday', gapDays: 0 },
      { date: '2026-01-08', weekday: 'Thursday', gapDays: 7 },
      { date: '2026-01-15', weekday: 'Thursday', gapDays: 7 },
      { date: '2026-01-22', weekday: 'Thursday', gapDays: 7 },
    ]);
  });

  it('steps daily by interval and reports the gap from the previous date', () => {
    expect(
      generateRecurringDates({ start: '2026-02-26', frequency: 'daily', interval: 3, count: 3 }),
    ).toEqual([
      { date: '2026-02-26', weekday: 'Thursday', gapDays: 0 },
      { date: '2026-03-01', weekday: 'Sunday', gapDays: 3 },
      { date: '2026-03-04', weekday: 'Wednesday', gapDays: 3 },
    ]);
  });

  it('clamps monthly occurrences to each month last day from a month-end start', () => {
    expect(
      generateRecurringDates({ start: '2026-01-31', frequency: 'monthly', interval: 1, count: 4 }),
    ).toEqual([
      { date: '2026-01-31', weekday: 'Saturday', gapDays: 0 },
      { date: '2026-02-28', weekday: 'Saturday', gapDays: 28 },
      { date: '2026-03-31', weekday: 'Tuesday', gapDays: 31 },
      { date: '2026-04-30', weekday: 'Thursday', gapDays: 30 },
    ]);
  });

  it('clamps yearly occurrences from a leap-day start', () => {
    expect(
      generateRecurringDates({ start: '2024-02-29', frequency: 'yearly', interval: 1, count: 3 }),
    ).toEqual([
      { date: '2024-02-29', weekday: 'Thursday', gapDays: 0 },
      { date: '2025-02-28', weekday: 'Friday', gapDays: 365 },
      { date: '2026-02-28', weekday: 'Saturday', gapDays: 365 },
    ]);
  });

  it('emits selected weekdays within each active week and stops at the end date', () => {
    // Weekly with a weekday filter (Tue=2, Thu=4); end date trims the tail.
    expect(
      generateRecurringDates({
        start: '2026-01-01',
        frequency: 'weekly',
        interval: 1,
        count: 10,
        weekdays: [2, 4],
        end: '2026-01-13',
      }),
    ).toEqual([
      { date: '2026-01-01', weekday: 'Thursday', gapDays: 0 },
      { date: '2026-01-06', weekday: 'Tuesday', gapDays: 5 },
      { date: '2026-01-08', weekday: 'Thursday', gapDays: 2 },
      { date: '2026-01-13', weekday: 'Tuesday', gapDays: 5 },
    ]);
  });

  it('throws a RangeError on an invalid start date', () => {
    expect(() =>
      generateRecurringDates({ start: 'not-a-date', frequency: 'daily', count: 3 }),
    ).toThrow(RangeError);
  });

  it('throws a RangeError when count is out of range', () => {
    expect(() =>
      generateRecurringDates({ start: '2026-01-01', frequency: 'daily', count: 501 }),
    ).toThrow(/count must be a whole number between 1 and 500/);
  });

  it('throws a RangeError when end is before start', () => {
    expect(() =>
      generateRecurringDates({
        start: '2026-01-10',
        frequency: 'daily',
        count: 3,
        end: '2026-01-01',
      }),
    ).toThrow(/end must be on or after start/);
  });
});
