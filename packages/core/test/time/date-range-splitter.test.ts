// Pin the time zone before importing: the formatter uses local-time getters on
// UTC-parsed dates, so golden values are only stable when TZ is fixed.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { splitDateRange } from '../../src/time/date-range-splitter';

describe('splitDateRange', () => {
  it('lays down weekly fixed buckets, truncating the last one at the end', () => {
    const result = splitDateRange({
      start: '2026-01-01',
      end: '2026-04-01',
      mode: 'fixed',
      length: 1,
      unit: 'weeks',
    });
    expect(result.total).toBe(90);
    expect(result.chunks).toHaveLength(13);
    expect(result.chunks[0]).toEqual({ start: '2026-01-01', end: '2026-01-08', days: 7 });
    expect(result.chunks[11]).toEqual({ start: '2026-03-19', end: '2026-03-26', days: 7 });
    expect(result.chunks[12]).toEqual({ start: '2026-03-26', end: '2026-04-01', days: 6 });
  });

  it('splits into N equal chunks via proportional rounding', () => {
    const result = splitDateRange({
      start: '2026-01-01',
      end: '2026-03-15',
      mode: 'equal',
      count: 4,
    });
    expect(result.total).toBe(73);
    expect(result.chunks).toEqual([
      { start: '2026-01-01', end: '2026-01-19', days: 18 },
      { start: '2026-01-19', end: '2026-02-06', days: 18 },
      { start: '2026-02-06', end: '2026-02-24', days: 18 },
      { start: '2026-02-24', end: '2026-03-15', days: 18 },
    ]);
  });

  it('clamps day-of-month for monthly buckets (Jan 31 -> Feb 28)', () => {
    const result = splitDateRange({
      start: '2026-01-31',
      end: '2026-05-31',
      mode: 'fixed',
      length: 1,
      unit: 'months',
    });
    expect(result.total).toBe(120);
    expect(result.chunks).toEqual([
      { start: '2026-01-31', end: '2026-02-28', days: 28 },
      { start: '2026-02-28', end: '2026-03-28', days: 28 },
      { start: '2026-03-28', end: '2026-04-28', days: 31 },
      { start: '2026-04-28', end: '2026-05-28', days: 30 },
      { start: '2026-05-28', end: '2026-05-31', days: 3 },
    ]);
  });

  it('produces fixed day-length buckets stopping at the end boundary', () => {
    const result = splitDateRange({
      start: '2026-01-01',
      end: '2026-01-10',
      mode: 'fixed',
      length: 3,
      unit: 'days',
    });
    expect(result.total).toBe(9);
    expect(result.chunks).toEqual([
      { start: '2026-01-01', end: '2026-01-04', days: 3 },
      { start: '2026-01-04', end: '2026-01-07', days: 3 },
      { start: '2026-01-07', end: '2026-01-10', days: 3 },
    ]);
  });

  it('throws RangeError on an end date that is not after the start', () => {
    expect(() =>
      splitDateRange({ start: '2026-02-01', end: '2026-01-01', mode: 'equal', count: 2 }),
    ).toThrow(RangeError);
    expect(() =>
      splitDateRange({ start: '2026-02-01', end: '2026-01-01', mode: 'equal', count: 2 }),
    ).toThrow('End date must be after start date.');
  });

  it('validates the chunk count and date parseability', () => {
    expect(() =>
      splitDateRange({ start: 'not-a-date', end: '2026-01-10', mode: 'equal', count: 2 }),
    ).toThrow('Enter a valid start date.');
    expect(() =>
      splitDateRange({ start: '2026-01-01', end: '2026-02-01', mode: 'equal', count: 0 }),
    ).toThrow('Enter a chunk count of at least 1.');
    expect(() =>
      splitDateRange({ start: '2026-01-01', end: '2026-02-01', mode: 'equal', count: 1001 }),
    ).toThrow('Chunk count too large (max 1000).');
  });
});
