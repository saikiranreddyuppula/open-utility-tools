/**
 * Electrical calculator maths: SI prefix parsing/formatting, Ohm's law, resistor colour codes,
 * E-series, SMD codes, series/parallel, dividers, LED resistors, AC power and wire voltage drop.
 * Pure TypeScript, no dependencies.
 */

// ---------------------------------------------------------------- SI prefixes

const PREFIX_VALUE: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  K: 1e3,
  m: 1e-3,
  µ: 1e-6,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

const EXP_PREFIX: Record<number, string> = {
  [-15]: 'f',
  [-12]: 'p',
  [-9]: 'n',
  [-6]: 'µ',
  [-3]: 'm',
  0: '',
  3: 'k',
  6: 'M',
  9: 'G',
  12: 'T',
};

export type UnitKind = 'V' | 'A' | 'ohm' | 'W' | 'F' | 'H' | 'none';

const UNIT_NAMES: Record<UnitKind, string[]> = {
  V: ['V', 'v', 'volt', 'volts'],
  A: ['A', 'a', 'amp', 'amps', 'ampere', 'amperes'],
  ohm: ['Ω', 'ohm', 'ohms', 'R', 'r'],
  W: ['W', 'w', 'watt', 'watts'],
  F: ['F', 'farad', 'farads'],
  H: ['H', 'henry', 'henries'],
  none: [],
};

function normalizeSymbols(s: string): string {
  return s
    .replace(/[µμ]/g, 'µ')
    .replace(/[ΩΩ]/g, 'Ω')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
}

function unitMatches(rest: string, unit: UnitKind): boolean {
  if (rest === '') return true;
  for (const name of UNIT_NAMES[unit]) {
    if (name.length === 1 ? rest === name : rest.toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
}

/**
 * Parse "4.7k", "4k7", "470R", "10 mA", "2.2µF", "1e3", "5V" ... into base units.
 * Returns NaN when the text is not a valid number for that unit.
 */
export function parseSI(text: string, unit: UnitKind = 'none'): number {
  const s = normalizeSymbols(text);
  if (s === '') return NaN;
  // RKM code: 4k7, 4R7, 1M2, 2u2, 4n7
  const rkm = /^(\d+)([RrKkMmGgTtµunpf])(\d+)([A-Za-zΩ]*)$/.exec(s);
  if (rkm) {
    const [, a, p, b, tail] = rkm as unknown as [string, string, string, string, string];
    const mult = p === 'R' || p === 'r' ? 1 : (PREFIX_VALUE[p === 'g' ? 'G' : p === 't' ? 'T' : p] ?? NaN);
    if (!Number.isNaN(mult) && (tail === '' || unitMatches(tail, unit) || UNIT_NAMES[unit].length === 0)) {
      return Number(`${a}.${b}`) * mult;
    }
  }
  const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(.*)$/.exec(s);
  if (!m) return NaN;
  const num = Number(m[1]);
  const rest = m[2] ?? '';
  if (!Number.isFinite(num)) return NaN;
  if (unitMatches(rest, unit) && !(rest !== '' && UNIT_NAMES[unit].length === 0)) return num;
  const p = rest.charAt(0);
  const mult = PREFIX_VALUE[p];
  if (mult !== undefined && (unitMatches(rest.slice(1), unit) || (unit === 'none' && rest.length === 1))) return num * mult;
  return NaN;
}

/** Format with an SI prefix, e.g. formatSI(4700, 'Ω') = "4.7 kΩ". */
export function formatSI(value: number, unit = '', sig = 4): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return `0 ${unit}`.trim();
  const sign = value < 0 ? '-' : '';
  const a = Math.abs(value);
  let e3 = Math.floor(Math.log10(a) / 3) * 3;
  e3 = Math.max(-15, Math.min(12, e3));
  let scaled = a / Math.pow(10, e3);
  let rounded = Number(scaled.toPrecision(sig));
  if (rounded >= 1000 && e3 < 12) {
    e3 += 3;
    scaled = a / Math.pow(10, e3);
    rounded = Number(scaled.toPrecision(sig));
  }
  const prefix = EXP_PREFIX[e3] ?? '';
  return `${sign}${rounded} ${prefix}${unit}`.trim();
}

/** Plain number text without exponent for normal magnitudes. */
export function formatPlain(value: number, sig = 6): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const r = Number(value.toPrecision(sig));
  const a = Math.abs(r);
  if (a >= 1e-4 && a < 1e12) return String(r);
  return r.toExponential(Math.max(0, sig - 1)).replace(/\.?0+e/, 'e');
}

// ---------------------------------------------------------------- Ohm's law

export type OhmKey = 'V' | 'I' | 'R' | 'P';

export interface OhmResult {
  V: number;
  I: number;
  R: number;
  P: number;
  /** Formulas used to derive the two unknowns. */
  formulas: { target: OhmKey; text: string }[];
}

export function solveOhm(known: Partial<Record<OhmKey, number>>): OhmResult {
  const keys = (Object.keys(known) as OhmKey[]).filter((k) => known[k] !== undefined);
  if (keys.length !== 2) throw new Error('Enter exactly two of V, I, R, P.');
  const has = (a: OhmKey, b: OhmKey) => keys.includes(a) && keys.includes(b);
  const g = (k: OhmKey) => known[k] as number;
  for (const k of keys) {
    if (!Number.isFinite(g(k))) throw new Error(`${k} is not a valid number.`);
  }
  let V: number;
  let I: number;
  let R: number;
  let P: number;
  const formulas: { target: OhmKey; text: string }[] = [];
  if (has('V', 'I')) {
    V = g('V');
    I = g('I');
    if (I === 0) throw new Error('Current cannot be zero when voltage is given (R would be infinite).');
    R = V / I;
    P = V * I;
    formulas.push({ target: 'R', text: 'R = V / I' }, { target: 'P', text: 'P = V × I' });
  } else if (has('V', 'R')) {
    V = g('V');
    R = g('R');
    if (R === 0) throw new Error('Resistance cannot be zero here (current would be infinite).');
    I = V / R;
    P = (V * V) / R;
    formulas.push({ target: 'I', text: 'I = V / R' }, { target: 'P', text: 'P = V² / R' });
  } else if (has('V', 'P')) {
    V = g('V');
    P = g('P');
    if (V === 0) throw new Error('Voltage cannot be zero when power is given.');
    if (P === 0) throw new Error('Power cannot be zero when voltage is given (R would be infinite).');
    I = P / V;
    R = (V * V) / P;
    formulas.push({ target: 'I', text: 'I = P / V' }, { target: 'R', text: 'R = V² / P' });
  } else if (has('I', 'R')) {
    I = g('I');
    R = g('R');
    V = I * R;
    P = I * I * R;
    formulas.push({ target: 'V', text: 'V = I × R' }, { target: 'P', text: 'P = I² × R' });
  } else if (has('I', 'P')) {
    I = g('I');
    P = g('P');
    if (I === 0) throw new Error('Current cannot be zero when power is given.');
    V = P / I;
    R = P / (I * I);
    formulas.push({ target: 'V', text: 'V = P / I' }, { target: 'R', text: 'R = P / I²' });
  } else {
    R = g('R');
    P = g('P');
    if (R <= 0) throw new Error('Resistance must be greater than 0 when power is given.');
    if (P < 0) throw new Error('Power must not be negative when used with R.');
    V = Math.sqrt(P * R);
    I = Math.sqrt(P / R);
    formulas.push({ target: 'V', text: 'V = √(P × R)' }, { target: 'I', text: 'I = √(P / R)' });
  }
  return { V, I, R, P, formulas };
}

// ---------------------------------------------------------------- resistor colour code

export type BandColor =
  | 'black'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'grey'
  | 'white'
  | 'gold'
  | 'silver'
  | 'none';

export const DIGIT_COLORS: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
export const MULTIPLIER_COLORS: BandColor[] = [...DIGIT_COLORS, 'gold', 'silver'];
export const TOLERANCE_COLORS: BandColor[] = ['brown', 'red', 'green', 'blue', 'violet', 'grey', 'gold', 'silver', 'none'];
export const TEMPCO_COLORS: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey'];

export const COLOR_HEX: Record<BandColor, string> = {
  black: '#1a1a1a',
  brown: '#8b4513',
  red: '#d32f2f',
  orange: '#f57c00',
  yellow: '#fbc02d',
  green: '#388e3c',
  blue: '#1976d2',
  violet: '#7b1fa2',
  grey: '#9e9e9e',
  white: '#fafafa',
  gold: '#c9a227',
  silver: '#b8bcc2',
  none: 'transparent',
};

export const TOLERANCE_PCT: Partial<Record<BandColor, number>> = {
  brown: 1,
  red: 2,
  green: 0.5,
  blue: 0.25,
  violet: 0.1,
  grey: 0.05,
  gold: 5,
  silver: 10,
  none: 20,
};

export const TEMPCO_PPM: Partial<Record<BandColor, number>> = {
  black: 250,
  brown: 100,
  red: 50,
  orange: 15,
  yellow: 25,
  green: 20,
  blue: 10,
  violet: 5,
  grey: 1,
};

export function digitOf(c: BandColor): number {
  return DIGIT_COLORS.indexOf(c);
}

/** Multiplier exponent: black = 0 ... white = 9, gold = -1, silver = -2. */
export function multiplierExponent(c: BandColor): number {
  if (c === 'gold') return -1;
  if (c === 'silver') return -2;
  return DIGIT_COLORS.indexOf(c);
}

export function colorForExponent(e: number): BandColor | null {
  if (e === -1) return 'gold';
  if (e === -2) return 'silver';
  return e >= 0 && e <= 9 ? (DIGIT_COLORS[e] as BandColor) : null;
}

export type BandCount = 4 | 5 | 6;

export interface DecodedResistor {
  ohms: number;
  tolerancePct: number;
  tempcoPpm: number | null;
  min: number;
  max: number;
}

/** bands: [d1, d2, (d3), multiplier, tolerance, (tempco)] */
export function decodeBands(bands: BandColor[], count: BandCount): DecodedResistor {
  if (bands.length < count) throw new Error('Not enough bands.');
  const nd = count === 4 ? 2 : 3;
  let mantissa = 0;
  for (let k = 0; k < nd; k++) {
    const d = digitOf(bands[k] as BandColor);
    if (d < 0) throw new Error(`Band ${k + 1} must be a digit colour (black to white).`);
    mantissa = mantissa * 10 + d;
  }
  const mult = bands[nd] as BandColor;
  if (mult === 'none') throw new Error('The multiplier band cannot be empty.');
  const tolBand = bands[nd + 1] as BandColor;
  const tol = TOLERANCE_PCT[tolBand];
  if (tol === undefined) throw new Error('Invalid tolerance colour.');
  let tempco: number | null = null;
  if (count === 6) {
    const t = TEMPCO_PPM[bands[nd + 2] as BandColor];
    if (t === undefined) throw new Error('Invalid temperature coefficient colour.');
    tempco = t;
  }
  const ohms = mantissa * Math.pow(10, multiplierExponent(mult));
  const clean = Number(ohms.toPrecision(12));
  return { ohms: clean, tolerancePct: tol, tempcoPpm: tempco, min: clean * (1 - tol / 100), max: clean * (1 + tol / 100) };
}

export interface EncodedResistor {
  bands: BandColor[];
  /** The value the bands actually represent. */
  ohms: number;
  exact: boolean;
  errorPct: number;
}

/** Colour bands for a resistance. Picks the closest value representable with the band count. */
export function encodeBands(ohms: number, count: BandCount, tolerancePct: number, tempcoPpm?: number): EncodedResistor {
  if (!Number.isFinite(ohms) || ohms < 0) throw new Error('Enter a resistance of 0 or more.');
  const nd = count === 4 ? 2 : 3;
  const tolColor = (Object.keys(TOLERANCE_PCT) as BandColor[]).find((c) => TOLERANCE_PCT[c] === tolerancePct);
  if (!tolColor) throw new Error('Unsupported tolerance for colour bands.');
  let digits: number;
  let e: number;
  if (ohms === 0) {
    digits = 0;
    e = 0;
  } else {
    e = Math.floor(Math.log10(ohms)) - (nd - 1);
    digits = Math.round(ohms / Math.pow(10, e));
    if (digits >= Math.pow(10, nd)) {
      digits = Math.round(digits / 10);
      e += 1;
    }
    if (e < -2) {
      e = -2;
      digits = Math.round(ohms / 0.01);
    }
    if (e > 9) throw new Error('That value is too large for colour bands (maximum is 999 GΩ).');
  }
  const multColor = colorForExponent(e);
  if (!multColor) throw new Error('Value cannot be represented.');
  const digitColors: BandColor[] = [];
  let rem = digits;
  for (let k = 0; k < nd; k++) {
    const place = Math.pow(10, nd - 1 - k);
    const d = Math.floor(rem / place);
    rem -= d * place;
    digitColors.push(DIGIT_COLORS[d] as BandColor);
  }
  const bands: BandColor[] = [...digitColors, multColor, tolColor];
  if (count === 6) {
    const t = (Object.keys(TEMPCO_PPM) as BandColor[]).find((c) => TEMPCO_PPM[c] === (tempcoPpm ?? 100));
    bands.push(t ?? 'brown');
  }
  const actual = Number((digits * Math.pow(10, e)).toPrecision(12));
  const exact = ohms === 0 ? true : Math.abs(actual - ohms) / ohms < 1e-9;
  return { bands, ohms: actual, exact, errorPct: ohms === 0 ? 0 : ((actual - ohms) / ohms) * 100 };
}

// ---------------------------------------------------------------- E-series

const E3 = [1.0, 2.2, 4.7];
const E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];
export const E96 = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62,
  1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67,
  2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42,
  4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32,
  7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
];
const E48 = E96.filter((_, k) => k % 2 === 0);

export type ESeriesName = 'E3' | 'E6' | 'E12' | 'E24' | 'E48' | 'E96';

export const E_SERIES: Record<ESeriesName, number[]> = { E3, E6, E12, E24, E48, E96 };

export const E_SERIES_TOLERANCE: Record<ESeriesName, string> = {
  E3: '±40 %',
  E6: '±20 %',
  E12: '±10 %',
  E24: '±5 % (±2 %, ±1 %)',
  E48: '±2 %',
  E96: '±1 %',
};

function scaleStd(m: number, decade: number): number {
  return Number((m * Math.pow(10, decade)).toPrecision(12));
}

export interface NearestStandard {
  value: number;
  errorPct: number;
  lower: number;
  upper: number;
}

/** Nearest preferred value (relative error), plus the neighbours below and above. */
export function nearestStandard(value: number, series: ESeriesName): NearestStandard {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a value greater than 0.');
  const list = E_SERIES[series];
  const decade = Math.floor(Math.log10(value));
  const m = value / Math.pow(10, decade);
  let lo = list[0] as number;
  let hi = -1;
  for (const c of list) {
    if (c <= m * (1 + 1e-12)) lo = c;
    if (c >= m * (1 - 1e-12)) {
      hi = c;
      break;
    }
  }
  let hiDecade = decade;
  if (hi < 0) {
    hi = list[0] as number;
    hiDecade = decade + 1;
  }
  const lower = scaleStd(lo, decade);
  const upper = scaleStd(hi, hiDecade);
  const nearest = Math.abs(value - lower) <= Math.abs(upper - value) ? lower : upper;
  return { value: nearest, errorPct: ((nearest - value) / value) * 100, lower, upper };
}

/** Smallest preferred value that is >= `value` (within 0.01 % tolerance). */
export function standardAtLeast(value: number, series: ESeriesName): number {
  const n = nearestStandard(value, series);
  return n.lower >= value * (1 - 1e-9) ? n.lower : n.upper;
}

// ---------------------------------------------------------------- SMD codes

const EIA96_MULT: Record<string, number> = {
  Z: 0.001,
  Y: 0.01,
  R: 0.01,
  X: 0.1,
  S: 0.1,
  A: 1,
  B: 10,
  H: 10,
  C: 100,
  D: 1000,
  E: 10000,
  F: 100000,
};

export interface SmdResult {
  ohms: number;
  scheme: '3-digit' | '4-digit' | 'EIA-96' | 'R-notation' | 'jumper';
  tolerance: string;
  explanation: string;
  alternative?: string;
}

export function decodeSmd(raw: string): SmdResult {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!code) throw new Error('Enter an SMD code such as 472, 1002, 4R7 or 01C.');
  if (/^0{1,4}$/.test(code)) {
    return { ohms: 0, scheme: 'jumper', tolerance: 'n/a', explanation: 'All zeros marks a zero-ohm jumper.' };
  }
  const eia = /^(\d{2})([A-Z])$/.exec(code);
  if (eia) {
    const idx = Number(eia[1]);
    const letter = eia[2] as string;
    const mult = EIA96_MULT[letter];
    if (mult !== undefined) {
      if (idx < 1 || idx > 96) throw new Error('EIA-96 codes use digits 01 to 96.');
      const base = Math.round((E96[idx - 1] as number) * 100);
      const ohms = Number((base * mult).toPrecision(12));
      const res: SmdResult = {
        ohms,
        scheme: 'EIA-96',
        tolerance: '±1 %',
        explanation: `Code ${String(idx).padStart(2, '0')} = ${base} Ω (E96 table), letter ${letter} = ×${mult}.`,
      };
      if (letter === 'R') {
        const alt = Number(`${idx}`);
        res.alternative = `If this is a schematic value rather than a part marking, ${code} would mean ${alt} Ω.`;
      }
      return res;
    }
  }
  const rkm = /^(\d*)([RKM])(\d*)$/.exec(code);
  if (rkm && (rkm[1] !== '' || rkm[3] !== '')) {
    const a = rkm[1] ?? '';
    const b = rkm[3] ?? '';
    const letter = rkm[2] as string;
    const mult = letter === 'R' ? 1 : letter === 'K' ? 1e3 : 1e6;
    const ohms = Number((Number(`${a === '' ? '0' : a}.${b === '' ? '0' : b}`) * mult).toPrecision(12));
    return {
      ohms,
      scheme: 'R-notation',
      tolerance: 'unspecified',
      explanation: `The letter ${letter} marks the decimal point${letter === 'R' ? '' : ` and the multiplier ×${mult}`}: ${a || '0'}.${b || '0'}${letter === 'R' ? ' Ω' : ''}.`,
    };
  }
  if (/^\d{3}$/.test(code)) {
    const mant = Number(code.slice(0, 2));
    const e = Number(code.slice(2));
    const mult = e === 8 ? 0.01 : e === 9 ? 0.1 : Math.pow(10, e);
    return {
      ohms: Number((mant * mult).toPrecision(12)),
      scheme: '3-digit',
      tolerance: '±2 % to ±5 % (E24)',
      explanation: `${mant} × 10^${e === 8 ? '-2' : e === 9 ? '-1' : e} (two significant digits and a power of ten).`,
    };
  }
  if (/^\d{4}$/.test(code)) {
    const mant = Number(code.slice(0, 3));
    const e = Number(code.slice(3));
    const mult = e === 8 ? 0.01 : e === 9 ? 0.1 : Math.pow(10, e);
    return {
      ohms: Number((mant * mult).toPrecision(12)),
      scheme: '4-digit',
      tolerance: '±1 % (E96)',
      explanation: `${mant} × 10^${e === 8 ? '-2' : e === 9 ? '-1' : e} (three significant digits and a power of ten).`,
    };
  }
  throw new Error('Unrecognised SMD code. Use 3 digits (472), 4 digits (1002), R-notation (4R7) or EIA-96 (01C).');
}

export interface SmdCode {
  scheme: string;
  code: string;
  note?: string;
}

function sigDigitsExact(ohms: number, digits: number): { mant: number; exp: number } | null {
  if (ohms <= 0) return null;
  const e = Math.floor(Math.log10(ohms)) - (digits - 1);
  const mant = Math.round(ohms / Math.pow(10, e));
  if (mant < Math.pow(10, digits - 1) || mant >= Math.pow(10, digits)) return null;
  if (Math.abs(mant * Math.pow(10, e) - ohms) / ohms > 1e-9) return null;
  return { mant, exp: e };
}

/** Marking codes that represent the resistance exactly. */
export function encodeSmd(ohms: number): SmdCode[] {
  if (!Number.isFinite(ohms) || ohms < 0) throw new Error('Enter a resistance of 0 or more.');
  if (ohms === 0) return [{ scheme: 'Jumper', code: '000', note: 'zero-ohm link' }];
  const out: SmdCode[] = [];
  const two = sigDigitsExact(ohms, 2);
  if (two && two.exp >= 0 && two.exp <= 9) out.push({ scheme: '3-digit', code: `${two.mant}${two.exp}` });
  const three = sigDigitsExact(ohms, 3);
  if (three && three.exp >= 0 && three.exp <= 9) out.push({ scheme: '4-digit', code: `${three.mant}${three.exp}` });
  // EIA-96: three significant digits that appear in the E96 table, multiplier letter
  if (three) {
    const idx = E96.findIndex((v) => Math.round(v * 100) === three.mant);
    if (idx >= 0) {
      const mult = Math.pow(10, three.exp);
      const letter = Object.keys(EIA96_MULT).find((l) => Math.abs((EIA96_MULT[l] as number) - mult) < mult * 1e-9 && l !== 'R' && l !== 'S' && l !== 'H');
      if (letter) out.push({ scheme: 'EIA-96', code: `${String(idx + 1).padStart(2, '0')}${letter}`, note: '1 % parts' });
    }
  }
  // R / K / M notation
  const sig = Number(ohms.toPrecision(6));
  const unit = sig >= 1e6 ? { l: 'M', d: 1e6 } : sig >= 1e3 ? { l: 'K', d: 1e3 } : { l: 'R', d: 1 };
  const txt = String(Number((sig / unit.d).toPrecision(6)));
  if (!txt.includes('e')) {
    const code = txt.includes('.') ? txt.replace('.', unit.l) : `${txt}${unit.l}`;
    const finalCode = code.startsWith('0' + unit.l) ? code.slice(1) : code;
    out.push({
      scheme: 'R-notation',
      code: finalCode,
      note: /^\d\dR$/.test(finalCode) ? 'schematic style; on a part this would read as an EIA-96 code' : undefined,
    });
  }
  return out;
}

// ---------------------------------------------------------------- series / parallel

export type PassiveKind = 'R' | 'C' | 'L';

export const PASSIVE_UNIT: Record<PassiveKind, { unit: string; kind: UnitKind; name: string }> = {
  R: { unit: 'Ω', kind: 'ohm', name: 'Resistors' },
  C: { unit: 'F', kind: 'F', name: 'Capacitors' },
  L: { unit: 'H', kind: 'H', name: 'Inductors' },
};

export interface CombineResult {
  series: number;
  parallel: number;
}

function sumOf(v: number[]): number {
  return v.reduce((a, b) => a + b, 0);
}

function reciprocalSum(v: number[]): number {
  if (v.some((x) => x === 0)) return 0;
  return 1 / sumOf(v.map((x) => 1 / x));
}

/** Resistors and inductors add in series; capacitors add in parallel. */
export function combine(values: number[], kind: PassiveKind): CombineResult {
  if (values.length === 0) throw new Error('Enter at least one value.');
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Values must be 0 or greater.');
  if (kind === 'C') return { series: reciprocalSum(values), parallel: sumOf(values) };
  return { series: sumOf(values), parallel: reciprocalSum(values) };
}

export function parseValueList(text: string, unit: UnitKind): number[] {
  const toks = text.split(/[\s,;]+/).filter((t) => t.length > 0);
  return toks.map((t) => {
    const v = parseSI(t, unit);
    if (Number.isNaN(v)) throw new Error(`Could not read "${t}" as a value.`);
    return v;
  });
}

// ---------------------------------------------------------------- voltage divider

export interface DividerResult {
  vout: number;
  r2Effective: number;
  current: number;
  ratio: number;
  powerR1: number;
  powerR2: number;
  powerLoad: number;
}

export function divider(vin: number, r1: number, r2: number, rload?: number): DividerResult {
  if (r1 < 0 || r2 < 0 || (rload !== undefined && rload <= 0)) throw new Error('Resistances must be positive.');
  if (r1 + r2 === 0) throw new Error('R1 and R2 cannot both be zero.');
  const r2e = rload === undefined ? r2 : r2 === 0 ? 0 : (r2 * rload) / (r2 + rload);
  const total = r1 + r2e;
  if (total === 0) throw new Error('The divider resistance is zero.');
  const vout = (vin * r2e) / total;
  const current = vin / total;
  return {
    vout,
    r2Effective: r2e,
    current,
    ratio: vout / vin,
    powerR1: current * current * r1,
    powerR2: r2 === 0 ? 0 : (vout * vout) / r2,
    powerLoad: rload === undefined ? 0 : (vout * vout) / rload,
  };
}

function checkTarget(vin: number, vout: number): void {
  if (vin === 0) throw new Error('Vin cannot be zero.');
  const ratio = vout / vin;
  if (!(ratio > 0 && ratio < 1)) throw new Error('Vout must be between 0 and Vin (same polarity) for a resistive divider.');
}

/** R2 needed for a target Vout; with a load the load is in parallel with R2. */
export function solveR2(vin: number, r1: number, vout: number, rload?: number): number {
  checkTarget(vin, vout);
  if (r1 <= 0) throw new Error('R1 must be greater than 0.');
  const r2e = (r1 * vout) / (vin - vout);
  if (rload === undefined) return r2e;
  if (rload <= r2e) throw new Error('The load is too heavy: Vout cannot be reached with this R1 and load.');
  return (r2e * rload) / (rload - r2e);
}

export function solveR1(vin: number, r2: number, vout: number, rload?: number): number {
  checkTarget(vin, vout);
  if (r2 <= 0) throw new Error('R2 must be greater than 0.');
  const r2e = rload === undefined ? r2 : (r2 * rload) / (r2 + rload);
  return (r2e * (vin - vout)) / vout;
}

// ---------------------------------------------------------------- LED resistor

export const STANDARD_WATTAGES = [0.0625, 0.125, 0.25, 0.5, 1, 2, 3, 5, 10, 25];

export interface LedResult {
  rExact: number;
  rE12: number;
  rE24: number;
  rUsed: number;
  currentActual: number;
  resistorPower: number;
  recommendedWatts: number | null;
  totalLedVf: number;
  totalPower: number;
  efficiencyPct: number;
}

export function ledResistor(vs: number, vf: number, nLeds: number, currentA: number, series: 'E12' | 'E24' | 'exact'): LedResult {
  if (![vs, vf, nLeds, currentA].every(Number.isFinite)) throw new Error('Enter numbers for all fields.');
  if (!Number.isInteger(nLeds) || nLeds < 1 || nLeds > 100) throw new Error('Number of LEDs in series must be a whole number from 1 to 100.');
  if (vf <= 0) throw new Error('LED forward voltage must be greater than 0.');
  if (currentA <= 0) throw new Error('LED current must be greater than 0.');
  const totalVf = nLeds * vf;
  if (vs <= totalVf) {
    throw new Error(
      `The supply (${vs} V) must be higher than the total LED forward voltage (${Number(totalVf.toPrecision(6))} V). Use fewer LEDs in series or a higher supply.`
    );
  }
  const rExact = (vs - totalVf) / currentA;
  const rE12 = standardAtLeast(rExact, 'E12');
  const rE24 = standardAtLeast(rExact, 'E24');
  const rUsed = series === 'E12' ? rE12 : series === 'E24' ? rE24 : rExact;
  const currentActual = (vs - totalVf) / rUsed;
  const resistorPower = currentActual * currentActual * rUsed;
  const recommended = STANDARD_WATTAGES.find((w) => w >= resistorPower * 2) ?? null;
  return {
    rExact,
    rE12,
    rE24,
    rUsed,
    currentActual,
    resistorPower,
    recommendedWatts: recommended,
    totalLedVf: totalVf,
    totalPower: vs * currentActual,
    efficiencyPct: (totalVf / vs) * 100,
  };
}

// ---------------------------------------------------------------- AC power

export type AcGiven = 'amps' | 'kw' | 'kva';

export interface AcResult {
  amps: number;
  kw: number;
  kva: number;
  kvar: number;
  pf: number;
  angleDeg: number;
  factor: number;
}

export function acPower(phases: 1 | 3, volts: number, pf: number, given: AcGiven, value: number): AcResult {
  if (!Number.isFinite(volts) || volts <= 0) throw new Error('Voltage must be greater than 0.');
  if (!Number.isFinite(pf) || pf <= 0 || pf > 1) throw new Error('Power factor must be greater than 0 and at most 1.');
  if (!Number.isFinite(value) || value < 0) throw new Error('Enter a value of 0 or more.');
  const factor = phases === 3 ? Math.sqrt(3) : 1;
  let kva: number;
  if (given === 'amps') kva = (factor * volts * value) / 1000;
  else if (given === 'kva') kva = value;
  else kva = value / pf;
  const kw = kva * pf;
  const amps = (kva * 1000) / (factor * volts);
  const kvar = Math.sqrt(Math.max(0, kva * kva - kw * kw));
  return { amps, kw, kva, kvar, pf, angleDeg: (Math.acos(pf) * 180) / Math.PI, factor };
}

export function powerFactorFrom(kw: number, kva: number): number {
  if (!(kva > 0)) throw new Error('kVA must be greater than 0.');
  if (kw < 0 || kw > kva * (1 + 1e-9)) throw new Error('kW cannot be larger than kVA.');
  return Math.min(1, kw / kva);
}

/** Capacitor kVAR needed to raise the power factor of a load from pf1 to pf2. */
export function pfCorrectionKvar(kw: number, pf1: number, pf2: number): number {
  if (!(pf1 > 0 && pf1 <= 1 && pf2 > 0 && pf2 <= 1)) throw new Error('Power factors must be between 0 and 1.');
  if (pf2 < pf1) throw new Error('Target power factor must be higher than the present one.');
  return kw * (Math.tan(Math.acos(pf1)) - Math.tan(Math.acos(pf2)));
}

// ---------------------------------------------------------------- wire

/** AWG diameter in mm. Gauge numbers: 0000 = -3, 000 = -2, 00 = -1, 0 = 0, 1 ... 40. */
export function awgDiameterMm(n: number): number {
  return 0.127 * Math.pow(92, (36 - n) / 39);
}

export function awgAreaMm2(n: number): number {
  const d = awgDiameterMm(n);
  return (Math.PI / 4) * d * d;
}

export function awgLabel(n: number): string {
  return n <= 0 ? '0'.repeat(1 - n) : String(n);
}

/** All gauges 0000 ... 40, largest wire first. */
export const AWG_GAUGES: number[] = Array.from({ length: 44 }, (_, k) => k - 3);

export type Conductor = 'copper' | 'aluminium';

export const CONDUCTORS: Record<Conductor, { name: string; rho20: number; alpha: number }> = {
  copper: { name: 'Copper (annealed, 100 % IACS)', rho20: 1.724e-8, alpha: 0.00393 },
  aluminium: { name: 'Aluminium (conductor grade)', rho20: 2.82e-8, alpha: 0.00403 },
};

export const METRIC_SIZES_MM2 = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];

/** Resistivity (ohm metre) at a conductor temperature in degrees C. */
export function resistivityAt(material: Conductor, tempC: number): number {
  const c = CONDUCTORS[material];
  return c.rho20 * (1 + c.alpha * (tempC - 20));
}

/** Resistance per metre in ohms for a cross-section in mm². */
export function resistancePerMetre(areaMm2: number, rho: number): number {
  return rho / (areaMm2 * 1e-6);
}

export interface DropInput {
  areaMm2: number;
  material: Conductor;
  tempC: number;
  /** One-way length in metres. */
  lengthM: number;
  amps: number;
  volts: number;
  phases: 1 | 3;
}

export interface DropResult {
  resistancePerKm: number;
  /** Resistance of one conductor over the one-way length. */
  conductorOhms: number;
  dropV: number;
  dropPct: number;
  loadVolts: number;
  powerLossW: number;
  diameterMm: number;
}

export function voltageDrop(i: DropInput): DropResult {
  if (!(i.areaMm2 > 0)) throw new Error('Conductor size must be greater than 0.');
  if (!(i.lengthM >= 0) || !Number.isFinite(i.lengthM)) throw new Error('Length must be 0 or more.');
  if (!(i.amps >= 0) || !Number.isFinite(i.amps)) throw new Error('Current must be 0 or more.');
  if (!(i.volts > 0) || !Number.isFinite(i.volts)) throw new Error('Voltage must be greater than 0.');
  if (!Number.isFinite(i.tempC) || i.tempC <= -200) throw new Error('Enter a valid conductor temperature.');
  const rho = resistivityAt(i.material, i.tempC);
  const rPerM = resistancePerMetre(i.areaMm2, rho);
  const conductorOhms = rPerM * i.lengthM;
  const factor = i.phases === 3 ? Math.sqrt(3) : 2;
  const dropV = factor * i.amps * conductorOhms;
  const powerLossW = (i.phases === 3 ? 3 : 2) * i.amps * i.amps * conductorOhms;
  return {
    resistancePerKm: rPerM * 1000,
    conductorOhms,
    dropV,
    dropPct: (dropV / i.volts) * 100,
    loadVolts: i.volts - dropV,
    powerLossW,
    diameterMm: Math.sqrt((4 * i.areaMm2) / Math.PI),
  };
}

/** Smallest AWG gauge (thinnest wire) that keeps the drop within `limitPct`; null if even 0000 is too small. */
export function minAwgForDrop(base: Omit<DropInput, 'areaMm2'>, limitPct: number): number | null {
  for (let n = 40; n >= -3; n--) {
    const r = voltageDrop({ ...base, areaMm2: awgAreaMm2(n) });
    if (r.dropPct <= limitPct) return n;
  }
  return null;
}

/** Smallest standard metric size that keeps the drop within `limitPct`. */
export function minMetricForDrop(base: Omit<DropInput, 'areaMm2'>, limitPct: number): number | null {
  for (const a of METRIC_SIZES_MM2) {
    if (voltageDrop({ ...base, areaMm2: a }).dropPct <= limitPct) return a;
  }
  return null;
}

export const FEET_TO_M = 0.3048;
