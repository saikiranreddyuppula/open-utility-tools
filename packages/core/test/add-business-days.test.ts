import { describe, it, expect } from 'vitest';
import { addBusinessDays } from '../src/time/add-business-days';

// 2026-06-01 is a Monday (verified independently).
describe('addBusinessDays', () => {
  it('adds business days across weekends', () => {
    const r = addBusinessDays('2026-06-01', 10);
    expect(r.date).toBe('2026-06-15');
    expect(r.weekday).toBe('Monday');
    expect(r.calendarSpan).toBe(14);
    expect(r.skipped).toEqual([
      '2026-06-06 (Saturday)',
      '2026-06-07 (Sunday)',
      '2026-06-13 (Saturday)',
      '2026-06-14 (Sunday)',
    ]);
  });

  it('subtracts business days for negative counts (inverse of adding)', () => {
    expect(addBusinessDays('2026-06-15', -10).date).toBe('2026-06-01');
  });

  it('skips holidays', () => {
    const r = addBusinessDays('2026-06-01', 3, { holidays: ['2026-06-03'] });
    expect(r.date).toBe('2026-06-05');
    expect(r.skipped).toEqual(['2026-06-03 (holiday)']);
  });

  it('returns the same date for count 0', () => {
    expect(addBusinessDays('2026-06-01', 0)).toEqual({
      date: '2026-06-01',
      weekday: 'Monday',
      calendarSpan: 0,
      skipped: [],
    });
  });

  it('honors a custom weekend', () => {
    // Friday/Saturday weekend (e.g. parts of the Middle East).
    const r = addBusinessDays('2026-06-01', 5, { weekend: [5, 6] });
    expect(r.skipped.some((s) => s.includes('Friday'))).toBe(true);
  });

  it('throws on invalid input', () => {
    expect(() => addBusinessDays('nope', 1)).toThrow(RangeError);
    expect(() => addBusinessDays('2026-06-01', 1.5)).toThrow(RangeError);
    expect(() => addBusinessDays('2026-06-01', 1, { weekend: [0, 1, 2, 3, 4, 5, 6] })).toThrow(
      RangeError,
    );
  });
});
