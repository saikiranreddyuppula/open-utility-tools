import { describe, it, expect } from 'vitest';
import {
  computeDurationArithmetic,
  formatDurationHMS,
  formatDurationValue,
} from '../../src/time/time-time-duration-arithmetic';

describe('computeDurationArithmetic', () => {
  it('adds and subtracts mixed HH:MM:SS / MM:SS / unit lines with a running tape', () => {
    const r = computeDurationArithmetic('+01:30:00\n+0:45:30\n-00:15:00\n+90m');
    expect(r.tape).toEqual([
      { line: '+01:30:00', seconds: 5400, running: 5400, bad: false },
      { line: '+0:45:30', seconds: 2730, running: 8130, bad: false },
      { line: '-00:15:00', seconds: -900, running: 7230, bad: false },
      { line: '+90m', seconds: 5400, running: 12630, bad: false },
    ]);
    expect(r.total).toBe(12630);
    expect(r.totalSeconds).toBe(12630);
    expect(r.decimalHours).toBeCloseTo(3.508333333333333, 10);
    expect(formatDurationHMS(r.totalSeconds)).toBe('03:30:30');
    expect(formatDurationValue(r.totalSeconds, 'seconds')).toBe('12630 s');
    expect(formatDurationValue(r.totalSeconds, 'decimal')).toBe('3.5083 h');
  });

  it('treats bare numbers as seconds and supports MM:SS and unit forms', () => {
    const r = computeDurationArithmetic('1h2m3s\n90\n2:30');
    expect(r.tape.map((t) => t.seconds)).toEqual([3723, 90, 150]);
    expect(r.total).toBe(3963);
  });

  it('rounds the total to the nearest minute when requested', () => {
    const r = computeDurationArithmetic('-01:00:00\n+00:00:20', { roundToMinute: true });
    expect(r.total).toBe(-3600);
    expect(r.tape[1]?.running).toBe(-3580);
  });

  it('clamps a negative total to zero when allowNegative is false', () => {
    const r = computeDurationArithmetic('-01:00:00\n+00:00:20', { allowNegative: false });
    expect(r.total).toBe(0);
    expect(r.totalSeconds).toBe(0);
    expect(r.decimalHours).toBe(0);
  });

  it('keeps unparseable lines in the tape but ignores them in the running total', () => {
    const r = computeDurationArithmetic('garbage\n+01:00:00\n12:xx:00');
    expect(r.tape.map((t) => t.bad)).toEqual([true, false, true]);
    expect(r.total).toBe(3600);
  });

  it('throws when no line parses and TypeErrors on non-string input', () => {
    expect(() => computeDurationArithmetic('   \nnope\n12:xx')).toThrow(RangeError);
    expect(() => computeDurationArithmetic(123 as unknown as string)).toThrow(TypeError);
  });
});
