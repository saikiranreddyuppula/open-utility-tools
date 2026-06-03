/**
 * Tropical (Western) zodiac sign lookup.
 *
 * Maps a birth (month, day) to its sun sign, ignoring the year. The boundary
 * table and Capricorn new-year-wrap handling are lifted verbatim from the
 * open-utility-tools "Western Zodiac Sign Finder" tool.
 */

export type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';

export interface ZodiacSign {
  /** Sign name, e.g. "Aries". */
  name: string;
  /** Unicode astrological symbol, e.g. "♈". */
  symbol: string;
  /** Classical element. */
  element: ZodiacElement;
  /** Classical modality / quality. */
  modality: ZodiacModality;
  /** Ruling planet (modern, with traditional ruler in parentheses where they differ). */
  planet: string;
  /** Start month of the sign window (1-12, inclusive). */
  startMonth: number;
  /** Start day of the sign window (inclusive). */
  startDay: number;
  /** End month of the sign window (1-12, inclusive). */
  endMonth: number;
  /** End day of the sign window (inclusive). */
  endDay: number;
}

/** A label/value pair suitable for tabular display or copy-to-clipboard. */
export interface ZodiacRow {
  label: string;
  value: string;
}

export interface WesternZodiacResult {
  /** The matched zodiac sign and its metadata. */
  sign: ZodiacSign;
  /** True when the date falls on a sign boundary ("cusp"). */
  isBoundary: boolean;
  /** Human-readable inclusive date range, e.g. "March 21 – April 19". */
  dateRange: string;
  /** Pre-formatted display rows (Sign, Date range, Element, Modality, Ruling planet). */
  rows: ZodiacRow[];
}

// Boundary table. Capricorn wraps across the new year and is handled specially.
const SIGNS: readonly ZodiacSign[] = [
  { name: 'Aries', symbol: '♈', element: 'Fire', modality: 'Cardinal', planet: 'Mars', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { name: 'Taurus', symbol: '♉', element: 'Earth', modality: 'Fixed', planet: 'Venus', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { name: 'Gemini', symbol: '♊', element: 'Air', modality: 'Mutable', planet: 'Mercury', startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { name: 'Cancer', symbol: '♋', element: 'Water', modality: 'Cardinal', planet: 'Moon', startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { name: 'Leo', symbol: '♌', element: 'Fire', modality: 'Fixed', planet: 'Sun', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { name: 'Virgo', symbol: '♍', element: 'Earth', modality: 'Mutable', planet: 'Mercury', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { name: 'Libra', symbol: '♎', element: 'Air', modality: 'Cardinal', planet: 'Venus', startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { name: 'Scorpio', symbol: '♏', element: 'Water', modality: 'Fixed', planet: 'Pluto (Mars)', startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { name: 'Sagittarius', symbol: '♐', element: 'Fire', modality: 'Mutable', planet: 'Jupiter', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  { name: 'Capricorn', symbol: '♑', element: 'Earth', modality: 'Cardinal', planet: 'Saturn', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { name: 'Aquarius', symbol: '♒', element: 'Air', modality: 'Fixed', planet: 'Uranus (Saturn)', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { name: 'Pisces', symbol: '♓', element: 'Water', modality: 'Mutable', planet: 'Neptune (Jupiter)', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
];

const MONTH_NAMES: readonly string[] = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function findSign(month: number, day: number): ZodiacSign | undefined {
  for (const s of SIGNS) {
    if (s.name === 'Capricorn') {
      // Dec 22..Dec 31 or Jan 1..Jan 19
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return s;
      continue;
    }
    if (month === s.startMonth && day >= s.startDay) return s;
    if (month === s.endMonth && day <= s.endDay) return s;
  }
  return undefined;
}

function daysInMonth(month: number): number {
  // Use a leap year (29 Feb allowed) so Feb 29 is accepted.
  return new Date(2024, month, 0).getDate();
}

/**
 * Find the tropical (Western) zodiac sun sign for a birth month and day.
 *
 * The year is intentionally ignored: sun-sign lookup depends only on the
 * month/day window. February 29 is accepted (a leap year is used internally
 * to validate the day count). The result includes the matched sign's metadata,
 * a `isBoundary` flag indicating the date lands on a cusp, a formatted
 * `dateRange`, and pre-built display `rows`.
 *
 * @param month - Calendar month as an integer 1-12 (1 = January).
 * @param day - Day of month as an integer 1-N, where N is the number of days
 *   in `month` (Feb allows up to 29).
 * @returns A {@link WesternZodiacResult} with the matched sign and display data.
 * @throws {RangeError} If `month` is not an integer in 1-12.
 * @throws {RangeError} If `day` is not an integer within the valid day range
 *   for the given month.
 * @example
 * ```ts
 * const r = getWesternZodiacSign(3, 25);
 * r.sign.name;   // "Aries"
 * r.dateRange;   // "March 21 – April 19"
 * r.isBoundary;  // false
 * ```
 */
export function getWesternZodiacSign(month: number, day: number): WesternZodiacResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Month must be an integer 1-12.');
  }
  const maxD = daysInMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > maxD) {
    const monthName = MONTH_NAMES[month] ?? 'that month';
    throw new RangeError(`Day must be an integer 1-${maxD} for ${monthName}.`);
  }

  const sign = findSign(month, day);
  if (sign === undefined) {
    // Unreachable for valid inputs: the boundary table covers every day.
    throw new RangeError('Could not determine a zodiac sign for the given date.');
  }

  const isBoundary =
    (month === sign.startMonth && day === sign.startDay) ||
    (month === sign.endMonth && day === sign.endDay) ||
    (sign.name === 'Capricorn' && ((month === 12 && day === 22) || (month === 1 && day === 19)));

  const startName = MONTH_NAMES[sign.startMonth] ?? '';
  const endName = MONTH_NAMES[sign.endMonth] ?? '';
  const dateRange = `${startName} ${sign.startDay} – ${endName} ${sign.endDay}`;

  const rows: ZodiacRow[] = [
    { label: 'Sign', value: `${sign.symbol} ${sign.name}` },
    { label: 'Date range', value: dateRange },
    { label: 'Element', value: sign.element },
    { label: 'Modality', value: sign.modality },
    { label: 'Ruling planet', value: sign.planet },
  ];

  return { sign, isBoundary, dateRange, rows };
}
