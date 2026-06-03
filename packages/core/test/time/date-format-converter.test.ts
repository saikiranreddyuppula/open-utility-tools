// Force UTC + a stable locale base so the locale-/offset-/Intl-dependent
// outputs are deterministic on any CI machine. Must run before any Date use.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import {
  convertDateFormats,
  formatDateTable,
  parseDateInput,
  type DateFormatEntry,
} from '../../src/time/date-format-converter';

function valueOf(formats: DateFormatEntry[], label: string): string | undefined {
  return formats.find((f) => f.label === label)?.value;
}

describe('convertDateFormats', () => {
  it('produces all UTC-anchored formats for an ISO 8601 input', () => {
    const { date, formats } = convertDateFormats('2024-01-31T10:30:00Z');
    expect(date.toISOString()).toBe('2024-01-31T10:30:00.000Z');

    expect(valueOf(formats, 'ISO 8601 (UTC)')).toBe('2024-01-31T10:30:00.000Z');
    expect(valueOf(formats, 'ISO 8601 (local)')).toBe('2024-01-31T10:30:00+00:00');
    expect(valueOf(formats, 'ISO date only')).toBe('2024-01-31');
    expect(valueOf(formats, 'ISO time only')).toBe('10:30:00.000');
    expect(valueOf(formats, 'RFC 2822')).toBe('Wed, 31 Jan 2024 10:30:00 +0000');
    expect(valueOf(formats, 'Unix seconds')).toBe('1706697000');
    expect(valueOf(formats, 'Unix milliseconds')).toBe('1706697000000');
    expect(valueOf(formats, 'US (MM/DD/YYYY)')).toBe('01/31/2024');
    expect(valueOf(formats, 'EU (DD/MM/YYYY)')).toBe('31/01/2024');
    expect(valueOf(formats, 'UTC string')).toBe('Wed, 31 Jan 2024 10:30:00 GMT');
    expect(valueOf(formats, 'Day of week')).toBe('Wednesday');
  });

  it('parses a bare Unix-seconds timestamp (10-digit => seconds)', () => {
    const { formats } = convertDateFormats('1706697000');
    expect(valueOf(formats, 'ISO 8601 (UTC)')).toBe('2024-01-31T10:30:00.000Z');
    expect(valueOf(formats, 'Unix seconds')).toBe('1706697000');
    expect(valueOf(formats, 'Unix milliseconds')).toBe('1706697000000');
  });

  it('parses a bare Unix-milliseconds timestamp (>= 1e12 => milliseconds)', () => {
    const { formats } = convertDateFormats('1706697000000');
    expect(valueOf(formats, 'ISO 8601 (UTC)')).toBe('2024-01-31T10:30:00.000Z');
  });

  it('trims surrounding whitespace before parsing', () => {
    const { date } = convertDateFormats('  2024-01-31T10:30:00Z  ');
    expect(date.toISOString()).toBe('2024-01-31T10:30:00.000Z');
  });

  it('throws RangeError on an unparseable string and TypeError on empty input', () => {
    expect(() => convertDateFormats('not a date')).toThrow(RangeError);
    expect(() => convertDateFormats('   ')).toThrow(TypeError);
    expect(() => parseDateInput('')).toThrow(TypeError);
  });
});

describe('formatDateTable', () => {
  it('renders an aligned, column-padded table', () => {
    const { formats } = convertDateFormats('2024-01-31T10:30:00Z');
    const table = formatDateTable(formats);
    const lines = table.split('\n');
    // 'Unix milliseconds' is the longest label (17 chars); two-space gutter.
    expect(lines[0]).toBe('ISO 8601 (UTC)     2024-01-31T10:30:00.000Z');
    expect(lines).toHaveLength(formats.length);
  });

  it('returns an empty string for no entries', () => {
    expect(formatDateTable([])).toBe('');
  });
});