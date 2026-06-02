// Extracted from tools/time/chinese-zodiac-sign. Pure, isomorphic year→zodiac
// lookup. No DOM, no React — runs in the browser, Node, and Bun.

const ANIMALS = [
  'Rat',
  'Ox',
  'Tiger',
  'Rabbit',
  'Dragon',
  'Snake',
  'Horse',
  'Goat',
  'Monkey',
  'Rooster',
  'Dog',
  'Pig',
] as const;

const ANIMAL_EMOJI = [
  '🐀',
  '🐂',
  '🐅',
  '🐇',
  '🐉',
  '🐍',
  '🐎',
  '🐐',
  '🐒',
  '🐓',
  '🐕',
  '🐖',
] as const;

// Five elements indexed by floor((year-4) mod 10 / 2).
const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const;

const HEAVENLY_STEMS = [
  'Jiǎ',
  'Yǐ',
  'Bǐng',
  'Dīng',
  'Wù',
  'Jǐ',
  'Gēng',
  'Xīn',
  'Rén',
  'Guǐ',
] as const;

const EARTHLY_BRANCHES = [
  'Zǐ',
  'Chǒu',
  'Yín',
  'Mǎo',
  'Chén',
  'Sì',
  'Wǔ',
  'Wèi',
  'Shēn',
  'Yǒu',
  'Xū',
  'Hài',
] as const;

/** One of the twelve Chinese zodiac animals. */
export type ZodiacAnimal = (typeof ANIMALS)[number];

/** One of the five Chinese elements. */
export type ZodiacElement = (typeof ELEMENTS)[number];

/** Yin/Yang polarity of a year. */
export type ZodiacPolarity = 'Yin' | 'Yang';

export interface ChineseZodiacInfo {
  /** Zodiac animal for the year, e.g. `"Dragon"`. */
  animal: ZodiacAnimal;
  /** Emoji for the animal, e.g. `"🐉"`. */
  emoji: string;
  /** Governing element, e.g. `"Wood"`. */
  element: ZodiacElement;
  /** Yin/Yang polarity — `"Yang"` for even years, `"Yin"` for odd. */
  polarity: ZodiacPolarity;
  /** Position within the 60-year sexagenary cycle, `1`–`60`. */
  cyclePos: number;
  /** Heavenly stem (pinyin), e.g. `"Jiǎ"`. */
  stem: string;
  /** Earthly branch (pinyin), e.g. `"Chén"`. */
  branch: string;
  /** Stem + branch concatenated, e.g. `"JiǎChén"`. */
  combined: string;
}

/** Mathematical modulo that always returns a non-negative result. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Computes the Chinese zodiac sign for a Gregorian calendar year. Returns the
 * animal, five-element, yin/yang polarity, and the sexagenary-cycle heavenly
 * stem / earthly branch (with their combined name and 1–60 cycle position).
 *
 * This is an approximate, by-Gregorian-year lookup: the Chinese New Year falls
 * in late January or February, so people born in January or early February may
 * belong to the previous year's animal.
 *
 * @param year - A whole Gregorian year between `-2697` and `9999` inclusive.
 * @returns The zodiac animal, element, polarity, and sexagenary stem/branch.
 * @throws {TypeError} If `year` is not a finite integer.
 * @throws {RangeError} If `year` is outside `-2697`–`9999`.
 *
 * @example
 * ```ts
 * import { chineseZodiacSign } from '@open-utility-tools/core/time/chinese-zodiac-sign';
 * const z = chineseZodiacSign(2024);
 * // z.animal === 'Dragon', z.element === 'Wood', z.polarity === 'Yang'
 * // z.combined === 'JiǎChén', z.cyclePos === 41
 * ```
 */
export function chineseZodiacSign(year: number): ChineseZodiacInfo {
  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new TypeError('year must be a whole calendar year, e.g. 1990.');
  }
  if (year < -2697 || year > 9999) {
    throw new RangeError('year must be between -2697 and 9999.');
  }

  const animalIdx = mod(year - 4, 12);
  const animal = ANIMALS[animalIdx] ?? 'Rat';
  const emoji = ANIMAL_EMOJI[animalIdx] ?? '';

  const stemIdx = mod(year - 4, 10);
  const element = ELEMENTS[Math.floor(stemIdx / 2)] ?? 'Wood';
  const polarity: ZodiacPolarity = mod(year, 2) === 0 ? 'Yang' : 'Yin';

  const branchIdx = mod(year - 4, 12);
  const stem = HEAVENLY_STEMS[stemIdx] ?? '';
  const branch = EARTHLY_BRANCHES[branchIdx] ?? '';

  // Sexagenary cycle position 1..60.
  const cyclePos = mod(year - 4, 60) + 1;

  return {
    animal,
    emoji,
    element,
    polarity,
    cyclePos,
    stem,
    branch,
    combined: `${stem}${branch}`,
  };
}
