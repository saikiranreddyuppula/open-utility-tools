import { describe, it, expect } from 'vitest';
import { parseIso8601, formatIso8601Components } from '../../src/time/iso-8601-parser';

describe('parseIso8601', () => {
  it('parses a full date-time with fractional seconds and an offset', () => {
    const r = parseIso8601('2024-01-31T10:30:00.500+05:30');
    expect(r.year).toBe(2024);
    expect(r.month).toBe(1);
    expect(r.day).toBe(31);
    expect(r.hour).toBe(10);
    expect(r.minute).toBe(30);
    expect(r.second).toBe(0);
    expect(r.fraction).toBe('500');
    expect(r.fractionMs).toBe(500);
    expect(r.offsetText).toBe('+05:30');
    expect(r.offsetLabel).toBe('+05:30 (5h 30m)');
    expect(r.offsetMinutes).toBe(330);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.weekday).toBe('Wednesday');
    expect(r.dayOfYear).toBe(31);
    expect(r.isoWeek).toBe(5);
    expect(r.isoWeekYear).toBe(2024);
    expect(r.unixSeconds).toBe(1706677200);
    expect(r.unixMilliseconds).toBe(1706677200500);
    expect(r.normalizedUtc).toBe('2024-01-31T05:00:00.500Z');
  });

  it('parses a date-only value with no time fields', () => {
    const r = parseIso8601('2024-01-31');
    expect(r.hour).toBeNull();
    expect(r.minute).toBeNull();
    expect(r.offsetText).toBeNull();
    expect(r.offsetLabel).toBe('none (local / unspecified)');
    expect(r.offsetMinutes).toBeNull();
    expect(r.valid).toBe(true);
    expect(r.weekday).toBe('Wednesday');
    expect(r.unixMilliseconds).toBe(1706659200000);
    expect(r.normalizedUtc).toBe('2024-01-31T00:00:00.000Z');
  });

  it('treats Z as UTC offset zero', () => {
    const r = parseIso8601('2024-01-31T10:30:00Z');
    expect(r.offsetText).toBe('Z');
    expect(r.offsetLabel).toBe('Z (UTC, +00:00)');
    expect(r.offsetMinutes).toBe(0);
    expect(r.normalizedUtc).toBe('2024-01-31T10:30:00.000Z');
  });

  it('flags a non-existent calendar date (Feb 30) as invalid', () => {
    const r = parseIso8601('2023-02-30');
    expect(r.valid).toBe(false);
    expect(r.issues).toEqual(['2023-02-30 does not exist on the calendar']);
    // Derived fields still reflect the rolled-over instant, matching the original UI.
    expect(r.normalizedUtc).toBe('2023-03-02T00:00:00.000Z');
  });

  it('flags an out-of-range time (second 60 with no leap support) as invalid', () => {
    const r = parseIso8601('2024-12-31T23:59:60Z');
    expect(r.second).toBe(60);
    expect(r.valid).toBe(false);
    expect(r.issues).toEqual(['value is not a valid calendar date/time']);
    expect(r.normalizedUtc).toBeNull();
    expect(r.weekday).toBeNull();
  });

  it('throws RangeError on an unrecognized shape', () => {
    expect(() => parseIso8601('2024-W01')).toThrow(RangeError);
    expect(() => parseIso8601('not a date')).toThrow(
      /Not a recognized ISO 8601 date-time/,
    );
  });
});

describe('formatIso8601Components', () => {
  it('renders the aligned two-column table for a date-only value', () => {
    expect(formatIso8601Components('2024-01-31')).toBe(
      [
        'Year               2024',
        'Month              01 (1)',
        'Day                31 (31)',
        'Offset             none (local / unspecified)',
        'Weekday            Wednesday',
        'Day of year        31',
        'ISO week           2024-W05',
        'Unix seconds       1706659200',
        'Unix milliseconds  1706659200000',
        'Normalized (UTC)   2024-01-31T00:00:00.000Z',
        'Valid              yes',
      ].join('\n'),
    );
  });
});