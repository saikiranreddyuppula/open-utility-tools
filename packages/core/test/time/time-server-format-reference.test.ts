// Pin the time zone before importing the module so the time-zone-dependent rows
// (local offset, RFC 2822, Date.toString(), Local UTC offset) are deterministic.
// V8/Bun read process.env.TZ lazily on each Date call, so setting it here
// applies to every Date constructed below. Golden values were captured by
// executing the extracted logic under TZ=UTC with `bun`.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { formatReferenceRows } from '../../src/time/time-server-format-reference';

/** Convenience: map rows to a label→value record for targeted assertions. */
function asRecord(rows: ReturnType<typeof formatReferenceRows>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) out[r.label] = r.value;
  return out;
}

describe('formatReferenceRows', () => {
  it('renders every format for an ISO string instant (TZ=UTC)', () => {
    expect(formatReferenceRows('2026-03-09T17:05:09.042Z')).toEqual([
      { label: 'ISO 8601 / RFC 3339 (UTC, Z)', value: '2026-03-09T17:05:09.042Z' },
      { label: 'ISO 8601 with local offset', value: '2026-03-09T17:05:09+00:00' },
      { label: 'ISO 8601 basic (no separators)', value: '20260309T170509Z' },
      { label: 'RFC 2822 / email Date', value: 'Mon, 09 Mar 2026 17:05:09 +0000' },
      { label: 'HTTP-date (RFC 7231, GMT)', value: 'Mon, 09 Mar 2026 17:05:09 GMT' },
      { label: 'SQL DATETIME (UTC)', value: '2026-03-09 17:05:09' },
      {
        label: 'JavaScript Date.toString()',
        value: 'Mon Mar 09 2026 17:05:09 GMT+0000 (Coordinated Universal Time)',
      },
      { label: 'JavaScript Date.toUTCString()', value: 'Mon, 09 Mar 2026 17:05:09 GMT' },
      { label: 'Unix seconds', value: '1773075909' },
      { label: 'Unix milliseconds', value: '1773075909042' },
      { label: '.NET DateTime ticks', value: '639086727090420000' },
      { label: 'Cookie expires (RFC 6265)', value: 'Mon, 09-Mar-2026 17:05:09 GMT' },
      { label: 'W3C datetime', value: '2026-03-09T17:05:09Z' },
      { label: 'Local UTC offset', value: '+00:00 (+0000)' },
      { label: 'Milliseconds component', value: '042 ms' },
    ]);
  });

  it('accepts an epoch-millisecond number (the Unix epoch)', () => {
    const r = asRecord(formatReferenceRows(0));
    expect(r['Unix seconds']).toBe('0');
    expect(r['Unix milliseconds']).toBe('0');
    expect(r['.NET DateTime ticks']).toBe('621355968000000000');
    expect(r['ISO 8601 / RFC 3339 (UTC, Z)']).toBe('1970-01-01T00:00:00.000Z');
    expect(r['HTTP-date (RFC 7231, GMT)']).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
    expect(r['Cookie expires (RFC 6265)']).toBe('Thu, 01-Jan-1970 00:00:00 GMT');
    expect(r['Milliseconds component']).toBe('000 ms');
  });

  it('accepts a Date object and keeps UTC-based rows stable', () => {
    const r = asRecord(formatReferenceRows(new Date('2021-07-04T00:00:00.000Z')));
    expect(r['ISO 8601 basic (no separators)']).toBe('20210704T000000Z');
    expect(r['SQL DATETIME (UTC)']).toBe('2021-07-04 00:00:00');
    expect(r['W3C datetime']).toBe('2021-07-04T00:00:00Z');
    expect(r['Unix seconds']).toBe('1625356800');
    expect(r['.NET DateTime ticks']).toBe('637609536000000000');
  });

  it('always returns the 15 fixed rows in order', () => {
    const rows = formatReferenceRows('2026-03-09T17:05:09.042Z');
    expect(rows).toHaveLength(15);
    expect(rows[0]?.label).toBe('ISO 8601 / RFC 3339 (UTC, Z)');
    expect(rows[14]?.label).toBe('Milliseconds component');
  });

  it('throws RangeError on an unparseable string or an invalid Date', () => {
    expect(() => formatReferenceRows('not-a-date')).toThrow(RangeError);
    expect(() => formatReferenceRows(new Date('nope'))).toThrow(RangeError);
    expect(() => formatReferenceRows(NaN)).toThrow(RangeError);
  });

  it('throws TypeError on a non-date, non-string, non-number input', () => {
    // @ts-expect-error — exercising the runtime guard with a bad type.
    expect(() => formatReferenceRows(null)).toThrow(TypeError);
  });
});
