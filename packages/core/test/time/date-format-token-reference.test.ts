import { describe, it, expect } from 'vitest';
import {
  searchDateFormatTokens,
  DATE_FORMAT_TOKENS,
  DATE_FORMAT_TOKEN_SAMPLE,
} from '../../src/time/date-format-token-reference';

describe('searchDateFormatTokens', () => {
  it('returns the full table (as a fresh array) for an empty query', () => {
    const rows = searchDateFormatTokens('');
    expect(rows).toHaveLength(30);
    expect(rows).toHaveLength(DATE_FORMAT_TOKENS.length);
    expect(rows[0]).toEqual({
      concept: '4-digit year',
      example: '2026',
      moment: 'YYYY',
      datefns: 'yyyy',
      strftime: '%Y',
      java: 'yyyy',
      ldml: 'yyyy',
    });
    // copy, not the underlying readonly array
    expect(rows).not.toBe(DATE_FORMAT_TOKENS as unknown as typeof rows);
  });

  it('matches a concept substring across all rows', () => {
    const rows = searchDateFormatTokens('year');
    expect(rows.map((r) => r.concept)).toEqual([
      '4-digit year',
      '2-digit year',
      'Day of year',
      'ISO week of year',
      'ISO week-numbering year',
    ]);
  });

  it('matches token columns and is case-insensitive (substring semantics)', () => {
    // "EEE" also matches "EEEE" (full weekday name) by substring.
    const rows = searchDateFormatTokens('EEE');
    expect(rows.map((r) => r.concept)).toEqual([
      'Weekday full name',
      'Weekday abbreviated',
    ]);
  });

  it('matches a strftime directive exactly (no-pad variant is excluded)', () => {
    const rows = searchDateFormatTokens('%H');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.concept).toBe('Hour 24h, padded');
  });

  it('trims surrounding whitespace before matching', () => {
    const rows = searchDateFormatTokens('  MONTH  ');
    expect(rows.map((r) => r.concept)).toEqual([
      'Month, zero-padded',
      'Month, no pad',
      'Month full name',
      'Month abbreviated',
      'Day of month, padded',
      'Day of month, no pad',
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchDateFormatTokens('zzzzznotatoken')).toEqual([]);
  });

  it('throws TypeError on non-string input', () => {
    // @ts-expect-error runtime guard test
    expect(() => searchDateFormatTokens(123)).toThrow(TypeError);
  });

  it('exposes the sample instant constant', () => {
    expect(DATE_FORMAT_TOKEN_SAMPLE).toBe('2026-03-09, 17:05:09 (Mon), tz +05:30');
  });
});
