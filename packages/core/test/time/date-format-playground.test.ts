import { describe, it, expect } from 'vitest';
import { formatDatePlayground } from '../../src/time/date-format-playground';

// All inputs use no timezone offset, so parsing and formatting both use local
// time and the rendered wall-clock values are stable across timezones.
describe('formatDatePlayground', () => {
  it('renders an LDML pattern with padded fields and locale-aware names (en-US)', () => {
    const r = formatDatePlayground('2026-06-02T14:30:45', 'en-US', {
      mode: 'ldml',
      pattern: 'EEEE, dd MMM yyyy HH:mm:ss',
    });
    expect(r).toEqual({
      output: 'Tuesday, 02 Jun 2026 14:30:45',
      resolved: 'locale=en-US, pattern="EEEE, dd MMM yyyy HH:mm:ss"',
    });
  });

  it('localizes weekday/month names via Intl for a non-English locale', () => {
    const r = formatDatePlayground('2026-06-02T14:30:45', 'de-DE', {
      mode: 'ldml',
      pattern: 'EEEE, dd MMM yyyy HH:mm:ss',
    });
    expect(r.output).toBe('Dienstag, 02 Jun 2026 14:30:45');
  });

  it('handles quoted literals, escaped quotes, and 12-hour tokens', () => {
    const r = formatDatePlayground('2026-01-09T00:07:03', 'en-US', {
      mode: 'ldml',
      pattern: "yy/M/d h a 'o''clock'",
    });
    // '' inside a quoted run yields a single quote; h maps midnight (0) -> 12.
    expect(r.output).toBe('26/1/9 12 AM oclock');
  });

  it('formats with an Intl preset and reports resolved options', () => {
    const r = formatDatePlayground('2026-06-02T14:30:45', 'en-US', {
      mode: 'preset',
      dateStyle: 'full',
      timeStyle: 'medium',
    });
    expect(r.output).toBe('Tuesday, June 2, 2026 at 2:30:45 PM');
    expect(r.resolved).toBe(
      'locale=en-US, calendar=gregory, numberingSystem=latn, dateStyle=full, timeStyle=medium',
    );
  });

  it('throws RangeError on an unparseable datetime', () => {
    expect(() =>
      formatDatePlayground('not-a-date', 'en-US', { mode: 'ldml', pattern: 'yyyy' }),
    ).toThrow(RangeError);
  });

  it('throws RangeError on a blank LDML pattern', () => {
    expect(() =>
      formatDatePlayground('2026-06-02T14:30', 'en-US', { mode: 'ldml', pattern: '   ' }),
    ).toThrow(/Enter an LDML pattern/);
  });
});