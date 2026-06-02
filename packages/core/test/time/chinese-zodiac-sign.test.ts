import { describe, it, expect } from 'vitest';
import { chineseZodiacSign } from '../../src/time/chinese-zodiac-sign';

// Golden values verified by executing the lifted algorithm with `bun`.
describe('chineseZodiacSign', () => {
  it('computes the full sign for the Year of the Wood Dragon (2024)', () => {
    expect(chineseZodiacSign(2024)).toEqual({
      animal: 'Dragon',
      emoji: '🐉',
      element: 'Wood',
      polarity: 'Yang',
      cyclePos: 41,
      stem: 'Jiǎ',
      branch: 'Chén',
      combined: 'JiǎChén',
    });
  });

  it('handles a Metal Horse year (1990)', () => {
    const z = chineseZodiacSign(1990);
    expect(z.animal).toBe('Horse');
    expect(z.element).toBe('Metal');
    expect(z.polarity).toBe('Yang');
    expect(z.combined).toBe('GēngWǔ');
    expect(z.cyclePos).toBe(7);
  });

  it('marks odd years as Yin (2025, Wood Snake)', () => {
    const z = chineseZodiacSign(2025);
    expect(z.animal).toBe('Snake');
    expect(z.element).toBe('Wood');
    expect(z.polarity).toBe('Yin');
    expect(z.combined).toBe('YǐSì');
    expect(z.cyclePos).toBe(42);
  });

  it('handles the lower bound year (-2697) as cycle position 60', () => {
    const z = chineseZodiacSign(-2697);
    expect(z.animal).toBe('Pig');
    expect(z.element).toBe('Water');
    expect(z.polarity).toBe('Yin');
    expect(z.combined).toBe('GuǐHài');
    expect(z.cyclePos).toBe(60);
  });

  it('throws TypeError on a non-integer year', () => {
    expect(() => chineseZodiacSign(1990.5)).toThrow(TypeError);
    expect(() => chineseZodiacSign(Number.NaN)).toThrow(TypeError);
  });

  it('throws RangeError on a year outside the supported range', () => {
    expect(() => chineseZodiacSign(-2698)).toThrow(RangeError);
    expect(() => chineseZodiacSign(10000)).toThrow(RangeError);
  });
});
