import { describe, it, expect } from 'vitest';
import { expandCron } from '../../src/time/cron-field-expander';

describe('expandCron', () => {
  it('expands a typical business-hours expression', () => {
    const { fields, perDay } = expandCron('*/15 9-17 * * MON-FRI');
    expect(fields.map((f) => f.name)).toEqual([
      'Minute', 'Hour', 'Day of month', 'Month', 'Day of week',
    ]);
    expect(fields[0]?.values).toEqual([0, 15, 30, 45]);
    expect(fields[1]?.values).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(fields[4]?.token).toBe('MON-FRI');
    expect(fields[4]?.values).toEqual([1, 2, 3, 4, 5]);
    expect(perDay).toBe(36);
  });

  it('handles a 5-field expression with lists, steps, names and ?', () => {
    const { fields, perDay } = expandCron('30 */6 1,15 JAN,JUL ?');
    expect(fields).toHaveLength(5);
    expect(fields[0]?.values).toEqual([30]);
    expect(fields[1]?.values).toEqual([0, 6, 12, 18]);
    expect(fields[2]?.values).toEqual([1, 15]);
    expect(fields[3]?.values).toEqual([1, 7]);
    expect(fields[4]?.values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(perDay).toBe(4);
  });

  it('supports a 6-field expression with leading seconds and L (last) day-of-month', () => {
    const { fields, perDay } = expandCron('0 0 0 L * ?');
    expect(fields.map((f) => f.name)).toEqual([
      'Second', 'Minute', 'Hour', 'Day of month', 'Month', 'Day of week',
    ]);
    expect(fields[3]?.values).toEqual([31]);
    expect(perDay).toBe(1);
  });

  it('expands a daily-midnight 5-field expression to a single fire time', () => {
    const { fields, perDay } = expandCron('0 0 * * *');
    expect(fields[0]?.values).toEqual([0]);
    expect(fields[1]?.values).toEqual([0]);
    expect(fields[4]?.values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(perDay).toBe(1);
  });

  it('throws RangeError when the field count is wrong', () => {
    expect(() => expandCron('* * *')).toThrow(RangeError);
    expect(() => expandCron('* * *')).toThrow(
      'Enter a 5-field (or 6-field with seconds) cron expression.',
    );
  });

  it('throws RangeError for an out-of-range value', () => {
    expect(() => expandCron('99 * * * *')).toThrow(RangeError);
    expect(() => expandCron('99 * * * *')).toThrow('Value out of range (0-59) in Minute');
  });
});
