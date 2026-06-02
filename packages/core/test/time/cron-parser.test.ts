import { describe, it, expect } from 'vitest';

import { parseCron, explainCron, nextRuns } from '../../src/time/cron-parser';

describe('parseCron', () => {
  it('expands steps, ranges, and stars into concrete value sets', () => {
    const fields = parseCron('*/15 9-17 * * 1-5');
    expect([...fields[0]!.values]).toEqual([0, 15, 30, 45]);
    expect([...fields[1]!.values]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect([...fields[4]!.values]).toEqual([1, 2, 3, 4, 5]);
  });

  it('throws RangeError when the field count is wrong', () => {
    expect(() => parseCron('* * *')).toThrow(RangeError);
    expect(() => parseCron('* * *')).toThrow('Expected 5 fields, got 3');
  });

  it('throws RangeError for out-of-range values and bad steps', () => {
    expect(() => parseCron('99 * * * *')).toThrow('Field value "99" out of range 0-59');
    expect(() => parseCron('*/0 * * * *')).toThrow('Invalid step in "*/0"');
  });
});

describe('explainCron', () => {
  it('describes stepped minute fields', () => {
    expect(explainCron('*/15 * * * *')).toBe('at every 15 minutes, every hour');
  });

  it('describes a fixed time with weekday restriction', () => {
    expect(explainCron('0 9 * * 1-5')).toBe('at 09:00, on Mon, Tue, Wed, Thu, Fri');
  });

  it('expands aliases', () => {
    expect(explainCron('@daily')).toBe('at 00:00');
    expect(explainCron('@hourly')).toBe('at minute 0, every hour');
  });

  it('describes day-of-month and month restrictions', () => {
    expect(explainCron('0 0 1 * *')).toBe('at 00:00, on day-of-month 1');
    expect(explainCron('30 8 1 6 1')).toBe('at 08:30, on day-of-month 1, in Jun, on Mon');
  });
});

describe('nextRuns', () => {
  // `from` is built from LOCAL components so results are timezone-independent.
  const from = new Date(2026, 5, 1, 0, 0, 0, 0); // 2026-06-01 00:00 local (Monday)

  const decompose = (d: Date) => [
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getDay(),
  ];

  it('returns the next weekday 09:00 instants', () => {
    const runs = nextRuns('0 9 * * 1-5', 3, from);
    expect(runs.map(decompose)).toEqual([
      [2026, 5, 1, 9, 0, 1],
      [2026, 5, 2, 9, 0, 2],
      [2026, 5, 3, 9, 0, 3],
    ]);
  });

  it('returns quarter-hour ticks strictly after the start minute', () => {
    const runs = nextRuns('*/15 * * * *', 4, from);
    expect(runs.map((d) => [d.getHours(), d.getMinutes()])).toEqual([
      [0, 15],
      [0, 30],
      [0, 45],
      [1, 0],
    ]);
  });

  it('handles aliases and month rollover', () => {
    const daily = nextRuns('@daily', 2, from);
    expect(daily.map((d) => [d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [5, 2, 0, 0],
      [5, 3, 0, 0],
    ]);

    const monthly = nextRuns('0 0 1 * *', 2, from);
    expect(monthly.map((d) => [d.getFullYear(), d.getMonth(), d.getDate()])).toEqual([
      [2026, 6, 1],
      [2026, 7, 1],
    ]);
  });

  it('propagates parse errors', () => {
    expect(() => nextRuns('not a cron', 3, from)).toThrow(RangeError);
  });
});
