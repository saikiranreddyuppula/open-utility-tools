import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../src/time/relative-time-formatter';

// Fixed reference instant: 2024-01-15T13:30:00Z.
// Outputs below were captured by executing the lifted algorithm under bun.
// We assert only timezone-stable fields (phrase/iso/value/unit/direction/
// unixSeconds); `localTime` is host-timezone dependent and intentionally
// excluded.
const NOW = Date.UTC(2024, 0, 15, 13, 30, 0); // 1705325400000

describe('formatRelativeTime', () => {
  it('formats an ISO date 3 hours in the past (en, long)', () => {
    const r = formatRelativeTime('2024-01-15T10:30:00Z', {
      now: NOW,
      locale: 'en',
      style: 'long',
    });
    expect(r.phrase).toBe('3 hours ago');
    expect(r.iso).toBe('2024-01-15T10:30:00.000Z');
    expect(r.unixSeconds).toBe(1705314600);
    expect(r.value).toBe(-3);
    expect(r.unit).toBe('hour');
    expect(r.direction).toBe('past');
  });

  it('treats a 10-digit integer as unix seconds and honors short style', () => {
    const r = formatRelativeTime('1705312200', {
      now: NOW,
      locale: 'en',
      style: 'short',
    });
    expect(r.phrase).toBe('4 hr. ago');
    expect(r.iso).toBe('2024-01-15T09:50:00.000Z');
    expect(r.unixSeconds).toBe(1705312200);
    expect(r.value).toBe(-4);
    expect(r.unit).toBe('hour');
    expect(r.direction).toBe('past');
  });

  it('formats a future date with numeric:"auto" in a non-English locale (fr)', () => {
    const futureMs = NOW + 2 * 86400 * 1000;
    const r = formatRelativeTime(String(futureMs), {
      now: NOW,
      locale: 'fr',
      style: 'long',
    });
    expect(r.phrase).toBe('après-demain');
    expect(r.iso).toBe('2024-01-17T13:30:00.000Z');
    expect(r.value).toBe(2);
    expect(r.unit).toBe('day');
    expect(r.direction).toBe('future');
  });

  it('chooses the seconds unit and includes a full text summary', () => {
    const r = formatRelativeTime(String(NOW - 30000), {
      now: NOW,
      locale: 'en',
      style: 'long',
    });
    expect(r.phrase).toBe('30 seconds ago');
    expect(r.value).toBe(-30);
    expect(r.unit).toBe('second');
    expect(r.text).toContain('30 seconds ago');
    expect(r.text).toContain('Parsed date: 2024-01-15T13:29:30.000Z');
    expect(r.text).toContain('Difference:  -30 seconds (past)');
  });

  it('throws RangeError on an unparseable date', () => {
    expect(() => formatRelativeTime('not a date', { now: NOW })).toThrow(RangeError);
    expect(() => formatRelativeTime('not a date', { now: NOW })).toThrow(/Could not parse/);
  });

  it('throws RangeError on an invalid locale', () => {
    expect(() =>
      formatRelativeTime('2024-01-15T10:30:00Z', { now: NOW, locale: 'not-a-locale!!' })
    ).toThrow(RangeError);
    expect(() =>
      formatRelativeTime('2024-01-15T10:30:00Z', { now: NOW, locale: 'not-a-locale!!' })
    ).toThrow(/Invalid locale/);
  });
});