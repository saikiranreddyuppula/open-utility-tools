// Extracted from tools/time/date-add-subtract. Pure, isomorphic calendar math —
// no DOM, runs in the browser, Node, and Bun.

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Time unit by which a date can be offset. */
export type DateOffsetUnit = 'days' | 'weeks' | 'months' | 'years';

/** Direction of the offset. */
export type DateOffsetOp = 'add' | 'subtract';

/** Options controlling how the resulting date is offset and formatted. */
export interface DateAddSubtractOptions {
  /** Whether to add or subtract the amount. Default `'add'`. */
  op?: DateOffsetOp;
  /** Unit the amount is measured in. Default `'days'`. */
  unit?: DateOffsetUnit;
  /**
   * BCP-47 locale tag used for the human-readable `locale` field, e.g. `'en-US'`
   * or `'de-DE'`. Defaults to `'en-US'` so the result is deterministic across
   * runtimes. Pass `undefined` explicitly to use the host's default locale.
   */
  locale?: string;
}

/** The shifted date, rendered in the formats the UI surfaces. */
export interface DateAddSubtractResult {
  /** Resulting date as an ISO `YYYY-MM-DD` string. */
  iso: string;
  /**
   * Long, human-readable form, e.g. `"Monday, January 22, 2024"`, produced with
   * `Intl.DateTimeFormat` for the requested `locale`.
   */
  locale: string;
  /** English weekday name of the resulting date, e.g. `"Monday"`. */
  weekday: string;
}

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0');
}

function formatISO(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses a strict `YYYY-MM-DD` string into a local-midnight `Date`, rejecting
 * out-of-range components (e.g. month 13, Feb 30) via a round-trip check.
 */
function parseISODate(value: string): Date | null {
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Applies a signed offset of `amount` `unit`s to `base`, returning a new `Date`. */
function applyOffset(base: Date, unit: DateOffsetUnit, amount: number): Date {
  const d = new Date(base.getTime());
  switch (unit) {
    case 'days':
      d.setDate(d.getDate() + amount);
      break;
    case 'weeks':
      d.setDate(d.getDate() + amount * 7);
      break;
    case 'months':
      d.setMonth(d.getMonth() + amount);
      break;
    case 'years':
      d.setFullYear(d.getFullYear() + amount);
      break;
  }
  return d;
}

/**
 * Adds or subtracts a number of days, weeks, months, or years from a base date,
 * returning the result as an ISO string, a localized long form, and an English
 * weekday name. Pure and isomorphic — no DOM, runs in the browser, Node, and Bun.
 *
 * Calendar arithmetic uses JavaScript's native `Date` rollover (e.g. Jan 31 +
 * 1 month → Mar 2 in a non-leap year, since Feb has no 31st), matching the
 * source tool exactly. All math is done at local midnight so the result is
 * timezone-independent. Fractional amounts are truncated by `Date` itself
 * (e.g. `+1.9 days` advances by one day).
 *
 * @param baseDate - The starting date as a strict `YYYY-MM-DD` string.
 * @param amount - How many units to shift by; combined with `op`. Must be finite.
 * @param options - Operation (`add`/`subtract`), `unit`, and display `locale`.
 * @returns The shifted date as `{ iso, locale, weekday }`.
 * @throws {RangeError} If `baseDate` is not a valid `YYYY-MM-DD` date.
 * @throws {TypeError} If `amount` is not a finite number.
 *
 * @example
 * ```ts
 * import { dateAddSubtract } from '@open-utility-tools/core/time/date-add-subtract';
 *
 * dateAddSubtract('2024-01-15', 7);
 * // → { iso: '2024-01-22', locale: 'Monday, January 22, 2024', weekday: 'Monday' }
 *
 * dateAddSubtract('2024-01-31', 1, { op: 'subtract', unit: 'months' });
 * // → { iso: '2023-12-31', locale: 'Sunday, December 31, 2023', weekday: 'Sunday' }
 * ```
 */
export function dateAddSubtract(
  baseDate: string,
  amount: number,
  options: DateAddSubtractOptions = {},
): DateAddSubtractResult {
  const base = parseISODate(baseDate);
  if (!base) {
    throw new RangeError(
      `Invalid base date: ${JSON.stringify(baseDate)} (expected YYYY-MM-DD)`,
    );
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError('amount must be a finite number.');
  }

  const op: DateOffsetOp = options.op ?? 'add';
  const unit: DateOffsetUnit = options.unit ?? 'days';
  const locale = 'locale' in options ? options.locale : 'en-US';

  const signed = op === 'subtract' ? -amount : amount;
  const result = applyOffset(base, unit, signed);

  return {
    iso: formatISO(result),
    locale: result.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    weekday: WEEKDAY_NAMES[result.getDay()] ?? '',
  };
}
