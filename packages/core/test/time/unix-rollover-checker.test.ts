import { describe, it, expect } from 'vitest';
import {
  buildRolloverMilestones,
  probeRolloverTimestamp,
  OUT_OF_RANGE,
} from '../../src/time/unix-rollover-checker';

describe('buildRolloverMilestones', () => {
  it('returns the full milestone table with computed 32-bit overflow instants', () => {
    const table = buildRolloverMilestones();
    expect(table).toHaveLength(8);

    const i32 = table[0];
    if (i32 === undefined) throw new Error('missing signed 32-bit row');
    expect(i32.name).toBe('Signed 32-bit Unix overflow (Y2038)');
    expect(i32.value).toBe('2147483647 s');
    expect(i32.datetime).toBe('2038-01-19T03:14:07Z');

    const u32 = table[1];
    if (u32 === undefined) throw new Error('missing unsigned 32-bit row');
    expect(u32.datetime).toBe('2106-02-07T06:28:15Z');
  });

  it('carries the fixed JS Date max datetime label verbatim', () => {
    const table = buildRolloverMilestones();
    const jsMax = table.find((m) => m.value === '8640000000000000 ms');
    expect(jsMax?.datetime).toBe('+275760-09-13T00:00:00Z');
  });
});

describe('probeRolloverTimestamp', () => {
  it('interprets the Y2038 limit as seconds and milliseconds', () => {
    expect(probeRolloverTimestamp('2147483647')).toEqual({
      value: '2147483647',
      asSeconds: '2038-01-19T03:14:07Z',
      asMilliseconds: '1970-01-25T20:31:23.647Z',
    });
  });

  it('trims whitespace and handles negative values', () => {
    expect(probeRolloverTimestamp('  42  ')).toEqual({
      value: '42',
      asSeconds: '1970-01-01T00:00:42Z',
      asMilliseconds: '1970-01-01T00:00:00.042Z',
    });
    expect(probeRolloverTimestamp('-1')).toEqual({
      value: '-1',
      asSeconds: '1969-12-31T23:59:59Z',
      asMilliseconds: '1969-12-31T23:59:59.999Z',
    });
  });

  it('reports out-of-range per interpretation instead of throwing', () => {
    expect(probeRolloverTimestamp('8640000000001')).toEqual({
      value: '8640000000001',
      asSeconds: OUT_OF_RANGE,
      asMilliseconds: '2243-10-17T00:00:00.001Z',
    });
    expect(probeRolloverTimestamp('8640000000000000001')).toEqual({
      value: '8640000000000000001',
      asSeconds: OUT_OF_RANGE,
      asMilliseconds: OUT_OF_RANGE,
    });
  });

  it('accepts numeric and bigint inputs', () => {
    expect(probeRolloverTimestamp(0)).toEqual({
      value: '0',
      asSeconds: '1970-01-01T00:00:00Z',
      asMilliseconds: '1970-01-01T00:00:00Z',
    });
    expect(probeRolloverTimestamp(2147483647n).asSeconds).toBe('2038-01-19T03:14:07Z');
  });

  it('throws RangeError on non-integer strings and TypeError on blank/non-integer numbers', () => {
    expect(() => probeRolloverTimestamp('abc')).toThrow(RangeError);
    expect(() => probeRolloverTimestamp('1.5')).toThrow(RangeError);
    expect(() => probeRolloverTimestamp('   ')).toThrow(TypeError);
    expect(() => probeRolloverTimestamp(1.5)).toThrow(TypeError);
  });
});
