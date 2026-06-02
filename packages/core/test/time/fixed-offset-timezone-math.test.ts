import { describe, it, expect } from 'vitest';

import { convertFixedOffset } from '../../src/time/fixed-offset-timezone-math';

describe('convertFixedOffset', () => {
  it('converts a half-hour source offset to multiple targets (same day)', () => {
    expect(convertFixedOffset('2026-05-30T14:30', '+05:30', '-08:00\n+00:00\n+09:00')).toEqual({
      utcIso: '2026-05-30T09:00:00.000Z',
      sourceLabel: '2026-05-30 14:30:00 (+05:30)',
      rows: [
        { offsetLabel: '-08:00', datetime: '2026-05-30 01:00:00', hourDiff: '-13.5 h', dayShift: 'same day' },
        { offsetLabel: '+00:00', datetime: '2026-05-30 09:00:00', hourDiff: '-5.5 h', dayShift: 'same day' },
        { offsetLabel: '+09:00', datetime: '2026-05-30 18:00:00', hourDiff: '+3.5 h', dayShift: 'same day' },
      ],
    });
  });

  it('handles the date line: +14 stays same day while -12 rolls to the previous day', () => {
    const r = convertFixedOffset('2026-01-01T00:00', '+00:00', '+14:00\n-12:00');
    expect(r.utcIso).toBe('2026-01-01T00:00:00.000Z');
    expect(r.rows).toEqual([
      { offsetLabel: '+14:00', datetime: '2026-01-01 14:00:00', hourDiff: '+14 h', dayShift: 'same day' },
      { offsetLabel: '-12:00', datetime: '2025-12-31 12:00:00', hourDiff: '-12 h', dayShift: 'previous day (-1)' },
    ]);
  });

  it('accepts shorthand/seconds and crosses a year boundary forward', () => {
    const r = convertFixedOffset('2026-12-31 23:45:30', '-8', '0\n+0545');
    expect(r.utcIso).toBe('2027-01-01T07:45:30.000Z');
    expect(r.sourceLabel).toBe('2026-12-31 23:45:30 (-08:00)');
    expect(r.rows).toEqual([
      { offsetLabel: '+00:00', datetime: '2027-01-01 07:45:30', hourDiff: '+8 h', dayShift: 'next day (+1)' },
      { offsetLabel: '+05:45', datetime: '2027-01-01 13:30:30', hourDiff: '+13.75 h', dayShift: 'next day (+1)' },
    ]);
  });

  it('marks unparseable target lines as "invalid offset" without failing the others', () => {
    const r = convertFixedOffset('2026-06-02T09:00', '+02:00', 'foo, +03:00');
    expect(r.rows[0]).toEqual({ offsetLabel: 'foo', datetime: 'invalid offset', hourDiff: '—', dayShift: '—' });
    expect(r.rows[1]).toEqual({ offsetLabel: '+03:00', datetime: '2026-06-02 10:00:00', hourDiff: '+1 h', dayShift: 'same day' });
  });

  it('throws TypeError for an empty or malformed datetime', () => {
    expect(() => convertFixedOffset('', '+05:30', '+00:00')).toThrow(TypeError);
    expect(() => convertFixedOffset('2026/05/30 14:30', '+05:30', '+00:00')).toThrow(TypeError);
  });

  it('throws RangeError for an invalid source offset or no target offsets', () => {
    expect(() => convertFixedOffset('2026-05-30T14:30', 'utc', '+00:00')).toThrow(RangeError);
    expect(() => convertFixedOffset('2026-05-30T14:30', '+05:30', '   ')).toThrow(RangeError);
  });
});
