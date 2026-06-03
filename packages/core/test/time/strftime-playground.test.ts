import { describe, it, expect } from 'vitest';
import { formatStrftime } from '../../src/time/strftime-playground';

describe('formatStrftime', () => {
  it('renders the default playground pattern with a full legend', () => {
    const r = formatStrftime('%A, %B %d, %Y at %I:%M %p', {
      year: 2024,
      month: 3,
      day: 15,
      hour: 14,
      minute: 30,
      second: 45,
    });
    expect(r.output).toBe('Friday, March 15, 2024 at 02:30 PM');
    expect(r.legend).toEqual([
      { token: '%A', produced: 'Friday', desc: 'Full weekday name' },
      { token: '%B', produced: 'March', desc: 'Full month name' },
      { token: '%d', produced: '15', desc: 'Day of month, zero-padded (01-31)' },
      { token: '%Y', produced: '2024', desc: 'Year with century' },
      { token: '%I', produced: '02', desc: 'Hour, 12-hour, zero-padded (01-12)' },
      { token: '%M', produced: '30', desc: 'Minute, zero-padded (00-59)' },
      { token: '%p', produced: 'PM', desc: 'AM or PM' },
    ]);
  });

  it('defaults hour/minute/second to zero and renders midnight as 12 AM', () => {
    const r = formatStrftime('%Y-%m-%d %H:%M:%S %I %p', {
      year: 2024,
      month: 1,
      day: 1,
    });
    expect(r.output).toBe('2024-01-01 00:00:00 12 AM');
  });

  it('handles day-of-year, weekday numbers, week-of-year, and space padding', () => {
    const r = formatStrftime('%a %e/%m/%y %p %j %w %u %U %W', {
      year: 2024,
      month: 6,
      day: 9,
      hour: 9,
      minute: 5,
      second: 3,
    });
    expect(r.output).toBe('Sun  9/06/24 AM 161 0 7 23 22');
  });

  it('renders %z / %Z from offsetMinutes, escapes %%, and keeps unknown directives literal', () => {
    const r = formatStrftime('%Y %z %Z %% %Q literal', {
      year: 2023,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
    }, { offsetMinutes: 330 });
    expect(r.output).toBe('2023 +0530 UTC+05:30 % %Q literal');
    expect(r.legend[r.legend.length - 1]).toEqual({
      token: '%Q',
      produced: '%Q',
      desc: 'Unknown directive %Q (kept literally)',
    });
  });

  it('emits a trailing bare % literally without adding a legend entry', () => {
    const r = formatStrftime('pct at end %', { year: 2024, month: 5, day: 20, hour: 13 });
    expect(r.output).toBe('pct at end %');
    expect(r.legend).toEqual([]);
  });

  it('throws on non-finite and non-integer datetime components', () => {
    expect(() => formatStrftime('%Y', { year: Number.NaN, month: 1, day: 1 })).toThrow(TypeError);
    expect(() => formatStrftime('%Y', { year: 2024, month: 1.5, day: 1 })).toThrow(RangeError);
  });
});
