// Extracted from tools/time/time-unit-converter. Pure, isomorphic time-unit
// conversion. No React/DOM — runs in the browser, Node, and Bun. The algorithm
// is lifted verbatim from the UI's inline transform: each unit is defined by its
// size in nanoseconds, the input is canonicalized to nanoseconds, and every
// target unit is derived by dividing by its nanosecond size. `formatNumber`
// (trailing-zero trimming + exponential fallback) is preserved exactly so the
// formatted output is byte-for-byte identical to what the UI renders.

/** A supported time unit: nanoseconds through days. */
export type TimeUnit = 'ns' | 'us' | 'ms' | 's' | 'min' | 'h' | 'd';

interface UnitDef {
  key: TimeUnit;
  label: string;
  /** Nanoseconds per one unit. */
  ns: number;
}

// Ordered exactly as the UI lists them; the order drives the formatted table.
const UNITS: readonly UnitDef[] = [
  { key: 'ns', label: 'Nanoseconds', ns: 1 },
  { key: 'us', label: 'Microseconds', ns: 1e3 },
  { key: 'ms', label: 'Milliseconds', ns: 1e6 },
  { key: 's', label: 'Seconds', ns: 1e9 },
  { key: 'min', label: 'Minutes', ns: 6e10 },
  { key: 'h', label: 'Hours', ns: 3.6e12 },
  { key: 'd', label: 'Days', ns: 8.64e13 },
] as const;

/** A value expressed in every supported time unit. */
export type TimeUnitConversions = Record<TimeUnit, number>;

/**
 * Formats a converted number the same way the UI does: `0` stays `'0'`; values
 * whose magnitude is below `1e-4` or at/above `1e15` use 6-digit exponential
 * notation; everything else is rendered with up to 9 fractional digits and has
 * its trailing zeros (and a bare trailing dot) trimmed.
 *
 * @param n - The number to format.
 * @returns The formatted, trailing-zero-trimmed string.
 */
function formatNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) {
    return n.toExponential(6);
  }
  // Trim trailing zeros from a fixed representation.
  const fixed = n.toFixed(9);
  return fixed.replace(/\.?0+$/, '');
}

function unitDef(unit: TimeUnit): UnitDef {
  const def = UNITS.find((u) => u.key === unit);
  if (def === undefined) {
    throw new RangeError(`Unknown time unit: ${String(unit)}`);
  }
  return def;
}

/**
 * Converts a value from one time unit into every supported time unit.
 *
 * The value is first canonicalized to nanoseconds (`value * sizeOf(from)`), then
 * each target unit is derived by dividing that nanosecond total by the unit's
 * nanosecond size — the exact arithmetic the UI performs. Results are returned
 * as raw `number`s; use {@link formatTimeValue} or
 * {@link formatTimeUnitConversions} to render them the way the UI displays them.
 *
 * @param value - The amount to convert, in units of `from`. Must be finite.
 * @param from - The unit `value` is expressed in.
 * @returns An object mapping every {@link TimeUnit} to `value` in that unit.
 * @throws {RangeError} If `value` is not a finite number.
 * @throws {RangeError} If `from` is not a recognized time unit.
 *
 * @example
 * ```ts
 * import { convertTimeUnit } from '@open-utility-tools/core/time/time-unit-converter';
 *
 * convertTimeUnit(90, 's');
 * // → {
 * //   ns: 90000000000,
 * //   us: 90000000,
 * //   ms: 90000,
 * //   s: 90,
 * //   min: 1.5,
 * //   h: 0.025,
 * //   d: 0.0010416666666666667,
 * // }
 * ```
 */
export function convertTimeUnit(value: number, from: TimeUnit): TimeUnitConversions {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('Value must be a finite number.');
  }
  const source = unitDef(from);
  const baseNs = value * source.ns;

  const out = {} as TimeUnitConversions;
  for (const u of UNITS) {
    out[u.key] = baseNs / u.ns;
  }
  return out;
}

/**
 * Produces the exact multi-line, label-padded conversion table the UI renders:
 * one line per unit, the 13-character-padded unit label, a space, and the
 * {@link formatNumber}-formatted value, joined by newlines.
 *
 * @param value - The amount to convert, in units of `from`. Must be finite.
 * @param from - The unit `value` is expressed in.
 * @returns The formatted conversion table (no trailing newline).
 * @throws {RangeError} If `value` is not finite or `from` is not a known unit.
 *
 * @example
 * ```ts
 * import { formatTimeUnitConversions } from '@open-utility-tools/core/time/time-unit-converter';
 *
 * formatTimeUnitConversions(90, 's');
 * // → 'Nanoseconds   90000000000\n' +
 * //   'Microseconds  90000000\n' +
 * //   'Milliseconds  90000\n' +
 * //   'Seconds       90\n' +
 * //   'Minutes       1.5\n' +
 * //   'Hours         0.025\n' +
 * //   'Days          0.001041667'
 * ```
 */
export function formatTimeUnitConversions(value: number, from: TimeUnit): string {
  const conversions = convertTimeUnit(value, from);
  return UNITS.map(
    (u) => `${u.label.padEnd(13)} ${formatNumber(conversions[u.key])}`,
  ).join('\n');
}

/**
 * Formats a single converted time value using the UI's display rules (see
 * {@link formatNumber}): `0`, exponential notation for very small/large
 * magnitudes, and trailing-zero-trimmed fixed notation otherwise.
 *
 * @param value - The number to format.
 * @returns The formatted string.
 * @throws {RangeError} If `value` is not a finite number.
 *
 * @example
 * ```ts
 * import { formatTimeValue } from '@open-utility-tools/core/time/time-unit-converter';
 *
 * formatTimeValue(0.025);       // → '0.025'
 * formatTimeValue(0.000001234); // → '1.234000e-6'
 * ```
 */
export function formatTimeValue(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('Value must be a finite number.');
  }
  return formatNumber(value);
}