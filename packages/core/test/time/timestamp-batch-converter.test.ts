// Pin the time zone before importing the module so any `local`-zone rendering
// (which is time-zone dependent) is deterministic. V8/Bun read process.env.TZ
// lazily on each Date call, so setting it here applies to every Date below.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { convertTimestampBatch } from '../../src/time/timestamp-batch-converter';

describe('convertTimestampBatch', () => {
  it('converts timestamps to UTC dates with auto unit detection', () => {
    const sample = ['1700000000', '1700000000000', '1609459200', 'not-a-number', '946684800'].join(
      '\n',
    );
    const result = convertTimestampBatch(sample, {
      direction: 'toDate',
      unit: 'auto',
      zone: 'utc',
    });
    expect(result.text).toBe(
      [
        '1700000000  ->  2023-11-14T22:13:20Z',
        '1700000000000  ->  2023-11-14T22:13:20Z',
        '1609459200  ->  2021-01-01T00:00:00Z',
        'not-a-number  ->  [unparseable]',
        '946684800  ->  2000-01-01T00:00:00Z',
      ].join('\n'),
    );
    expect(result.lines.map((l) => l.ok)).toEqual([true, true, true, false, true]);
  });

  it('converts date strings back to epoch seconds and milliseconds', () => {
    const result = convertTimestampBatch('2021-01-01T00:00:00Z\nnot-a-date', {
      direction: 'toTimestamp',
    });
    expect(result.text).toBe(
      [
        '2021-01-01T00:00:00Z  ->  1609459200 s  |  1609459200000 ms',
        'not-a-date  ->  [unparseable date]',
      ].join('\n'),
    );
    expect(result.lines[1]).toEqual({
      input: 'not-a-date',
      output: '[unparseable date]',
      blank: false,
      ok: false,
    });
  });

  it('preserves blank lines verbatim', () => {
    const result = convertTimestampBatch('1700000000\n\n946684800', { direction: 'toDate' });
    expect(result.text).toBe(
      '1700000000  ->  2023-11-14T22:13:20Z\n\n946684800  ->  2000-01-01T00:00:00Z',
    );
    expect(result.lines[1]).toEqual({ input: '', output: null, blank: true, ok: false });
  });

  it('returns an empty result for blank input', () => {
    expect(convertTimestampBatch('   ')).toEqual({ lines: [], text: '' });
  });

  it('flags timestamps that fall outside the representable Date range', () => {
    const result = convertTimestampBatch('9000000000000000', {
      direction: 'toDate',
      unit: 'auto',
    });
    expect(result.text).toBe('9000000000000000  ->  [out of range]');
    expect(result.lines[0]?.ok).toBe(false);
  });

  it('throws RangeError on an unknown direction', () => {
    expect(() =>
      // @ts-expect-error invalid direction is rejected at runtime
      convertTimestampBatch('1700000000', { direction: 'sideways' }),
    ).toThrow(RangeError);
  });
});
