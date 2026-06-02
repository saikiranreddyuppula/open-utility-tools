import { describe, it, expect } from 'vitest';
import { dayPercentageElapsed, type PeriodName } from '../../src/time/day-percentage-elapsed';

// Period boundaries are computed in LOCAL time (matching the browser
// `datetime-local` UI), so the golden numeric/duration values below are only
// valid when the runtime is UTC. Detect that and skip the TZ-sensitive cases
// otherwise; input-handling and error cases run in every timezone.
const IS_UTC = new Date('2026-06-02T12:00:00.000Z').getTimezoneOffset() === 0;

function row(r: ReturnType<typeof dayPercentageElapsed>, period: PeriodName) {
  const found = r.rows.find((x) => x.period === period);
  if (found === undefined) throw new Error(`missing period ${period}`);
  return found;
}

describe('dayPercentageElapsed', () => {
  it('always returns the seven periods in Minute→Year order', () => {
    const r = dayPercentageElapsed('2026-06-02T12:00:00.000Z');
    expect(r.rows.map((x) => x.period)).toEqual([
      'Minute',
      'Hour',
      'Day',
      'Week (Mon)',
      'Month',
      'Quarter',
      'Year',
    ]);
    expect(r.epochMs).toBe(1780401600000);
  });

  it.skipIf(!IS_UTC)('reports midday as 50% of the day elapsed', () => {
    const r = dayPercentageElapsed('2026-06-02T12:00:00.000Z');
    const day = row(r, 'Day');
    expect(day.pctElapsed).toBe(50);
    expect(day.pctRemaining).toBe(50);
    expect(day.elapsed).toBe('12h');
    expect(day.remaining).toBe('12h');
    expect(row(r, 'Week (Mon)').elapsed).toBe('1d 12h');
    expect(row(r, 'Month').pctElapsed).toBe(5);
    expect(row(r, 'Year').pctElapsed).toBeCloseTo(41.78082191780822, 10);
    expect(row(r, 'Year').elapsed).toBe('152d 12h');
  });

  it.skipIf(!IS_UTC)('reports the start of the year as 0% for most periods', () => {
    const r = dayPercentageElapsed('2026-01-01T00:00:00.000Z');
    expect(row(r, 'Minute').pctElapsed).toBe(0);
    expect(row(r, 'Day').elapsed).toBe('0s');
    expect(row(r, 'Year').pctElapsed).toBe(0);
    expect(row(r, 'Year').remaining).toBe('365d');
    // 2026-01-01 is a Thursday, so the Monday-anchored week is partway through.
    expect(row(r, 'Week (Mon)').pctElapsed).toBeCloseTo(42.857142857142854, 10);
    expect(row(r, 'Week (Mon)').elapsed).toBe('3d');
  });

  it.skipIf(!IS_UTC)('reports the last second of the year as nearly 100%', () => {
    const r = dayPercentageElapsed('2026-12-31T23:59:59.000Z');
    expect(row(r, 'Minute').elapsed).toBe('59s');
    expect(row(r, 'Day').remaining).toBe('1s');
    expect(row(r, 'Year').pctElapsed).toBeCloseTo(99.9999968290208, 8);
    expect(row(r, 'Year').elapsed).toBe('364d 23h 59m 59s');
  });

  it.skipIf(!IS_UTC)('handles the leap day 2024-02-29 correctly', () => {
    const r = dayPercentageElapsed('2024-02-29T06:30:00.000Z');
    expect(row(r, 'Hour').pctElapsed).toBe(50);
    expect(row(r, 'Hour').elapsed).toBe('30m');
    expect(row(r, 'Month').pctElapsed).toBeCloseTo(97.48563218390804, 10);
    expect(row(r, 'Day').elapsed).toBe('6h 30m');
  });

  it('accepts epoch-ms numbers and Date instances equivalently to strings', () => {
    const fromNum = dayPercentageElapsed(1780401600000);
    const fromDate = dayPercentageElapsed(new Date('2026-06-02T12:00:00.000Z'));
    expect(fromNum.epochMs).toBe(1780401600000);
    expect(fromDate.epochMs).toBe(1780401600000);
    expect(fromNum.rows.map((x) => x.pctElapsed)).toEqual(fromDate.rows.map((x) => x.pctElapsed));
  });

  it('throws RangeError on unparseable or non-finite input', () => {
    expect(() => dayPercentageElapsed('totally not a date')).toThrow(RangeError);
    expect(() => dayPercentageElapsed(NaN)).toThrow(RangeError);
    expect(() => dayPercentageElapsed('totally not a date')).toThrow(/Invalid moment/);
  });
});
