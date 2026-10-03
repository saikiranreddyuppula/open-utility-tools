/**
 * Regression & correlation numerics: OLS (closed form and Householder QR),
 * polynomial / exponential / logarithmic / power models, inference with
 * Student-t and F distributions, Pearson / Spearman / Kendall correlation,
 * data parsing and an SVG chart builder. Pure TypeScript, no dependencies.
 *
 * The special-function block (lgamma, incomplete gamma / beta, erfc, normal
 * quantile) is the same code as the probability-distribution calculator,
 * duplicated on purpose so tools stay self-contained.
 */

const DBL_MIN = 2.2250738585072014e-308;
const FPMIN = 1e-300;
const EPS = 1.2e-16;
const LN_SQRT_2PI = 0.918938533204672741780329736406;
const LN_2PI = 1.837877066409345483560659472811;
const SQRT2 = Math.SQRT2;
const SQRT_2PI = 2.5066282746310002;

/* ------------------------------------------------------------------ */
/* Gamma-family special functions                                      */
/* ------------------------------------------------------------------ */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Natural log of |Gamma(x)| (Lanczos g=7, n=9; Stirling series for large x). */
export function lgamma(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === Infinity) return Infinity;
  if (x <= 0 && Math.floor(x) === x) return Infinity;
  if (x < 0.5) {
    // reflection
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  }
  if (x > 15) {
    const x2 = x * x;
    const corr =
      (1 / 12 - (1 / 360 - (1 / 1260 - (1 / 1680 - 1 / (1188 * x2)) / x2) / x2) / x2) / x;
    return (x - 0.5) * Math.log(x) - x + LN_SQRT_2PI + corr;
  }
  const xm = x - 1;
  let a = LANCZOS[0] as number;
  const t = xm + 7.5;
  for (let i = 1; i < 9; i++) a += (LANCZOS[i] as number) / (xm + i);
  return LN_SQRT_2PI + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Error of Stirling's formula: log(n!) - log(sqrt(2*pi*n) * (n/e)^n). */
export function stirlerr(n: number): number {
  const S0 = 1 / 12;
  const S1 = 1 / 360;
  const S2 = 1 / 1260;
  const S3 = 1 / 1680;
  const S4 = 1 / 1188;
  if (n <= 15) {
    return lgamma(n + 1) - (n + 0.5) * Math.log(n) + n - LN_SQRT_2PI;
  }
  const nn = n * n;
  if (n > 500) return (S0 - S1 / nn) / n;
  if (n > 80) return (S0 - (S1 - S2 / nn) / nn) / n;
  if (n > 35) return (S0 - (S1 - (S2 - S3 / nn) / nn) / nn) / n;
  return (S0 - (S1 - (S2 - (S3 - S4 / nn) / nn) / nn) / nn) / n;
}

/** Deviance term x*log(x/np) + np - x, computed without cancellation. */
export function bd0(x: number, np: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(np) || np === 0) return NaN;
  if (Math.abs(x - np) < 0.1 * (x + np)) {
    let v = (x - np) / (x + np);
    let s = (x - np) * v;
    if (Math.abs(s) < DBL_MIN) return s;
    let ej = 2 * x * v;
    v = v * v;
    for (let j = 1; j < 1000; j++) {
      ej *= v;
      const s1 = s + ej / (2 * j + 1);
      if (s1 === s) return s1;
      s = s1;
    }
  }
  return x * Math.log(x / np) + np - x;
}

/** Poisson density x^... = lambda^x e^-lambda / Gamma(x+1), real-valued x. */
export function dpoisRaw(x: number, lambda: number): number {
  if (lambda === 0) return x === 0 ? 1 : 0;
  if (!Number.isFinite(lambda)) return 0;
  if (x < 0) return 0;
  if (x <= lambda * DBL_MIN) return Math.exp(-lambda);
  if (lambda < x * DBL_MIN) {
    if (!Number.isFinite(x)) return 0;
    return Math.exp(-lambda + x * Math.log(lambda) - lgamma(x + 1));
  }
  return Math.exp(-stirlerr(x) - bd0(x, lambda)) / Math.sqrt(2 * Math.PI * x);
}

/** Binomial density C(n,x) p^x q^(n-x) for real x, n (Loader). */
export function dbinomRaw(x: number, n: number, p: number, q: number): number {
  if (p === 0) return x === 0 ? 1 : 0;
  if (q === 0) return x === n ? 1 : 0;
  if (x === 0) {
    if (n === 0) return 1;
    const lc = p < 0.1 ? -bd0(n, n * q) - n * p : n * Math.log(q);
    return Math.exp(lc);
  }
  if (x === n) {
    const lc = q < 0.1 ? -bd0(n, n * p) - n * q : n * Math.log(p);
    return Math.exp(lc);
  }
  if (x < 0 || x > n) return 0;
  const lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
  const lf = LN_2PI + Math.log(x) + Math.log1p(-x / n);
  return Math.exp(lc - 0.5 * lf);
}

/** [P(a,x), Q(a,x)] regularized incomplete gamma functions (a > 0). */
export function gammaPQ(a: number, x: number): [number, number] {
  if (Number.isNaN(a) || Number.isNaN(x) || a <= 0) return [NaN, NaN];
  if (x <= 0) return [0, 1];
  if (x === Infinity) return [1, 0];
  const maxIt = Math.ceil(2000 + 60 * Math.sqrt(a));
  if (x < a + 1) {
    let term = 1;
    let sum = 1;
    let n = a;
    for (let i = 0; i < maxIt; i++) {
      n += 1;
      term *= x / n;
      sum += term;
      if (term < sum * 1e-17) break;
    }
    const P = Math.min(1, dpoisRaw(a, x) * sum);
    return [P, 1 - P];
  }
  // continued fraction (modified Lentz) for Q
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= maxIt; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS * 2) break;
  }
  const Q = Math.min(1, a * dpoisRaw(a, x) * h);
  return [1 - Q, Q];
}

function betacf(a: number, b: number, x: number): number {
  const maxIt = Math.ceil(2000 + 80 * Math.sqrt(Math.max(a, b)));
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIt; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS * 2) break;
  }
  return h;
}

/**
 * [I_x(a,b), 1 - I_x(a,b)] regularized incomplete beta function, with both
 * tails computed directly. `y` may be supplied as an accurate value of 1 - x.
 */
export function betaIPQ(a: number, b: number, x: number, y: number = 1 - x): [number, number] {
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(x) || a <= 0 || b <= 0) return [NaN, NaN];
  if (x <= 0) return [0, 1];
  if (y <= 0) return [1, 0];
  const n = a + b;
  if (x < (a + 1) / (n + 2)) {
    const pre = (dbinomRaw(a, n, x, y) * b) / n;
    const I = Math.min(1, (pre * betacf(a, b, x)) / 1);
    return [I, 1 - I];
  }
  const pre = (dbinomRaw(b, n, y, x) * a) / n;
  const J = Math.min(1, pre * betacf(b, a, y));
  return [1 - J, J];
}

/** log Beta(a, b). */
export function lbeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/* ------------------------------------------------------------------ */
/* Normal distribution                                                 */
/* ------------------------------------------------------------------ */

export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return 1;
  const ax = Math.abs(x);
  const [P, Q] = gammaPQ(0.5, ax * ax);
  if (x > 0) return Q;
  return 1 + P;
}

export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return 0;
  const ax = Math.abs(x);
  const [P, Q] = gammaPQ(0.5, ax * ax);
  const v = ax < 0.8 ? P : 1 - Q;
  return x > 0 ? v : -v;
}

/** Standard normal CDF Phi(z). */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / SQRT2);
}

/** Standard normal survival function 1 - Phi(z). */
export function normSf(z: number): number {
  return 0.5 * erfc(z / SQRT2);
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT_2PI;
}

/** Inverse standard normal CDF: Wichura's AS241 (PPND16), ~1e-16 relative. */
export function normPpf(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  const q = p - 0.5;
  let r: number;
  let val: number;
  if (Math.abs(q) <= 0.425) {
    r = 0.180625 - q * q;
    return (
      (q *
        (((((((2509.0809287301226727 * r + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) *
          r +
          13731.693765509461125) *
          r +
          1971.5909503065514427) *
          r +
          133.14166789178437745) *
          r +
          3.387132872796366608)) /
      (((((((5226.495278852854561 * r + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) *
        r +
        5394.1960214247511077) *
        r +
        687.1870074920579083) *
        r +
        42.313330701600911252) *
        r +
        1)
    );
  }
  r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  if (r <= 5) {
    r -= 1.6;
    val =
      (((((((7.7454501427834140764e-4 * r + 0.0227238449892691845833) * r + 0.24178072517745061177) *
        r +
        1.27045825245236838258) *
        r +
        3.64784832476320460504) *
        r +
        5.7694972214606914055) *
        r +
        4.6303378461565452959) *
        r +
        1.42343711074968357734) /
      (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 0.0151986665636164571966) *
        r +
        0.14810397642748007459) *
        r +
        0.68976733498510000455) *
        r +
        1.6763848301838038494) *
        r +
        2.05319162663775882187) *
        r +
        1);
  } else {
    r -= 5;
    val =
      (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r +
        0.0012426609473880784386) *
        r +
        0.026532189526576123093) *
        r +
        0.29656057182850489123) *
        r +
        1.7848265399172913358) *
        r +
        5.4637849111641143699) *
        r +
        6.6579046435011037772) /
      (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r +
        1.8463183175100546818e-5) *
        r +
        7.868691311456132591e-4) *
        r +
        0.0148753612908506148525) *
        r +
        0.13692988092273580531) *
        r +
        0.59983220655588793769) *
        r +
        1);
  }
  return q < 0 ? -val : val;
}

/* ------------------------------------------------------------------ */
/* Student t and F distributions                                       */
/* ------------------------------------------------------------------ */

/** [P(T <= t), P(T > t)] for Student's t with `df` degrees of freedom. */
export function tCdfSf(t: number, df: number): [number, number] {
  if (Number.isNaN(t) || !(df > 0)) return [NaN, NaN];
  if (t === 0) return [0.5, 0.5];
  if (t === Infinity) return [1, 0];
  if (t === -Infinity) return [0, 1];
  const t2 = t * t;
  const denom = df + t2;
  const w = df / denom;
  const y = Number.isFinite(t2) ? t2 / denom : 1;
  const [I, Ic] = betaIPQ(df / 2, 0.5, w, y);
  const small = I / 2;
  const big = (1 + Ic) / 2;
  return t < 0 ? [small, big] : [big, small];
}

/** Two-sided p-value for a t statistic. */
export function tTwoSidedP(t: number, df: number): number {
  if (Number.isNaN(t)) return NaN;
  if (!Number.isFinite(t)) return 0;
  const t2 = t * t;
  const denom = df + t2;
  return Math.min(1, betaIPQ(df / 2, 0.5, df / denom, t2 / denom)[0]);
}

function tPdf(t: number, df: number): number {
  const lc = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(lc - ((df + 1) / 2) * Math.log1p((t * t) / df));
}

/** Quantile of Student's t: x with P(T <= x) = p. */
export function tQuantile(p: number, df: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1 || !(df > 0)) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  if (p === 0.5) return 0;
  if (p > 0.5) return -tQuantile(1 - p, df);
  // p < 0.5: solve cdf(x) = p for x < 0 with bracketing + safeguarded Newton
  const f = (x: number) => tCdfSf(x, df)[0] - p;
  let hi = 0;
  let lo = -1;
  for (let i = 0; i < 2100 && f(lo) > 0; i++) {
    hi = lo;
    lo *= 2;
  }
  let x = 0.5 * (lo + hi);
  for (let i = 0; i < 300; i++) {
    const fx = f(x);
    if (fx === 0) return x;
    if (fx < 0) lo = x;
    else hi = x;
    const d = tPdf(x, df);
    let xn = d > 0 ? x - fx / d : NaN;
    if (!(xn > lo && xn < hi)) xn = 0.5 * (lo + hi);
    if (Math.abs(xn - x) <= 1e-15 * Math.max(1, Math.abs(xn))) return xn;
    x = xn;
  }
  return x;
}

/** Upper-tail probability of the F distribution with (d1, d2) degrees of freedom. */
export function fSf(f: number, d1: number, d2: number): number {
  if (Number.isNaN(f)) return NaN;
  if (f <= 0) return 1;
  if (f === Infinity) return 0;
  const den = d1 * f + d2;
  return betaIPQ(d1 / 2, d2 / 2, (d1 * f) / den, d2 / den)[1];
}

/* ------------------------------------------------------------------ */
/* Number formatting                                                   */
/* ------------------------------------------------------------------ */

export function fmt(x: number, sig = 6): string {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  let s: string;
  if (ax < 1e-4 || ax >= 1e10) {
    s = x.toExponential(sig - 1).replace(/\.?0+e/, 'e');
  } else {
    s = x.toPrecision(sig);
    if (s.includes('e')) s = String(Number(s));
    else if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  }
  return s.replace('e+', 'e');
}

export function fmtP(p: number): string {
  if (Number.isNaN(p)) return 'NaN';
  if (p === 0) return '0';
  if (p < 1e-4) return p.toExponential(3).replace('e-', 'e-');
  return p.toFixed(5);
}

export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
  const first = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = first, i = 0; v <= max + step * 1e-9 && i < 1000; v += step, i++) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Data parsing                                                        */
/* ------------------------------------------------------------------ */

export interface Rejected {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedData {
  xs: number[];
  ys: number[];
  rejected: Rejected[];
  /** Header labels detected in the first line, if any. */
  xLabel?: string;
  yLabel?: string;
}

export const MAX_POINTS = 100_000;

const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Parse one numeric token (accepts unicode minus, quotes, a decimal comma). */
export function parseNumberToken(raw: string): number | null {
  let t = raw.trim().replace(/^["']|["']$/g, '').trim().replace(/[−–]/g, '-');
  if (t === '') return null;
  if (/^[+-]?\d+,\d+$/.test(t)) t = t.replace(',', '.');
  if (!NUM_RE.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Split one data line into tokens, choosing the delimiter automatically. */
export function splitLine(line: string): string[] {
  const t = line.trim();
  let parts: string[];
  if (t.includes('\t')) parts = t.split('\t');
  else if (t.includes(';')) parts = t.split(';');
  else if (t.includes(',')) {
    if (/^[+-]?\d*,\d+\s+[+-]?\d*,\d+$/.test(t)) parts = t.split(/\s+/);
    else parts = t.split(/\s*,\s*/);
  } else parts = t.split(/\s+/);
  parts = parts.map((p) => p.trim());
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function isCommentOrBlank(line: string): boolean {
  const t = line.trim();
  return t === '' || t.startsWith('#') || t.startsWith('//');
}

/** Parse two columns of numbers (x then y per line). */
export function parsePairs(text: string): ParsedData {
  const out: ParsedData = { xs: [], ys: [], rejected: [] };
  const lines = text.split(/\r?\n/);
  let seenFirst = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (isCommentOrBlank(line)) continue;
    const parts = splitLine(line);
    const nums = parts.map(parseNumberToken);
    if (!seenFirst) {
      seenFirst = true;
      if (parts.length >= 2 && nums.every((n) => n === null)) {
        out.xLabel = (parts[0] ?? '').replace(/^["']|["']$/g, '');
        out.yLabel = (parts[1] ?? '').replace(/^["']|["']$/g, '');
        continue;
      }
    }
    if (parts.length !== 2) {
      out.rejected.push({ line: i + 1, text: line.trim().slice(0, 80), reason: `expected 2 values, found ${parts.length}` });
      continue;
    }
    const x = nums[0];
    const y = nums[1];
    if (x === null || x === undefined || y === null || y === undefined) {
      const badTok = x == null ? parts[0] : parts[1];
      out.rejected.push({ line: i + 1, text: line.trim().slice(0, 80), reason: `not a number: "${badTok ?? ''}"` });
      continue;
    }
    if (out.xs.length >= MAX_POINTS) {
      out.rejected.push({ line: i + 1, text: line.trim().slice(0, 80), reason: `more than ${MAX_POINTS} points (ignored)` });
      continue;
    }
    out.xs.push(x);
    out.ys.push(y);
  }
  return out;
}

/** Parse a list of numbers separated by commas, spaces, semicolons or newlines. */
function parseList(text: string): { values: (number | null)[]; tokens: string[] } {
  const tokens = text
    .split(/\r?\n/)
    .filter((l) => !isCommentOrBlank(l))
    .flatMap((l) => (l.includes(';') ? l.split(';') : /^[+-]?\d*,\d+(\s|$)/.test(l.trim()) && !/,\s*\S/.test(l.trim().replace(/^[^,]*,\d+/, '')) ? l.trim().split(/\s+/) : l.split(/[\s,]+/)))
    .map((t) => t.trim())
    .filter((t) => t !== '');
  return { values: tokens.map(parseNumberToken), tokens };
}

/** Parse an x list and a y list; they must have the same length. */
export function parseLists(xText: string, yText: string): ParsedData | { error: string } {
  const a = parseList(xText);
  const b = parseList(yText);
  const out: ParsedData = { xs: [], ys: [], rejected: [] };
  const bad = (side: string, list: { values: (number | null)[]; tokens: string[] }) => {
    list.values.forEach((v, i) => {
      if (v === null) out.rejected.push({ line: i + 1, text: list.tokens[i] ?? '', reason: `${side} value is not a number` });
    });
  };
  bad('x', a);
  bad('y', b);
  if (a.values.length !== b.values.length) {
    return { error: `The x list has ${a.values.length} values but the y list has ${b.values.length}; they must match.` };
  }
  if (a.values.length > MAX_POINTS) return { error: `Too many points (limit ${MAX_POINTS}).` };
  for (let i = 0; i < a.values.length; i++) {
    const x = a.values[i];
    const y = b.values[i];
    if (x == null || y == null) continue;
    out.xs.push(x);
    out.ys.push(y);
  }
  return out;
}

/** Build pairs from two raw string columns (e.g. picked from a CSV). Line numbers start at `firstLine`. */
export function pairsFromColumns(xRaw: string[], yRaw: string[], firstLine = 2): ParsedData {
  const out: ParsedData = { xs: [], ys: [], rejected: [] };
  const n = Math.min(xRaw.length, yRaw.length);
  for (let i = 0; i < n; i++) {
    const xr = xRaw[i] ?? '';
    const yr = yRaw[i] ?? '';
    const x = parseNumberToken(xr);
    const y = parseNumberToken(yr);
    if (x === null || y === null) {
      if (xr.trim() === '' && yr.trim() === '') continue;
      out.rejected.push({
        line: firstLine + i,
        text: `${xr}, ${yr}`.slice(0, 80),
        reason: x === null ? `x is not a number: "${xr}"` : `y is not a number: "${yr}"`,
      });
      continue;
    }
    if (out.xs.length >= MAX_POINTS) break;
    out.xs.push(x);
    out.ys.push(y);
  }
  return out;
}

/** Guess the delimiter of a CSV-like text from its first non-empty line. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const counts: [string, number][] = [
    ['\t', first.split('\t').length - 1],
    [';', first.split(';').length - 1],
    [',', first.split(',').length - 1],
  ];
  counts.sort((p, q) => q[1] - p[1]);
  const best = counts[0];
  return best && best[1] > 0 ? best[0] : ',';
}

/* ------------------------------------------------------------------ */
/* Basic statistics                                                    */
/* ------------------------------------------------------------------ */

export function mean(a: number[]): number {
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}

/** Average ranks (ties share the mean of their rank positions), 1-based. */
export function averageRanks(a: number[]): number[] {
  const idx = a.map((_, i) => i).sort((i, j) => (a[i] as number) - (a[j] as number));
  const ranks = new Array<number>(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && a[idx[j + 1] as number] === a[idx[i] as number]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k] as number] = r;
    i = j + 1;
  }
  return ranks;
}

export interface PearsonResult {
  r: number;
  p: number;
  n: number;
  ci: [number, number] | null;
}

export function pearson(xs: number[], ys: number[], confidence = 0.95): PearsonResult {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (!(sxx > 0) || !(syy > 0)) return { r: NaN, p: NaN, n, ci: null };
  let r = sxy / Math.sqrt(sxx * syy);
  r = Math.max(-1, Math.min(1, r));
  let p = NaN;
  if (n > 2) {
    p = Math.abs(r) === 1 ? 0 : tTwoSidedP((r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r), n - 2);
  }
  let ci: [number, number] | null = null;
  if (n > 3 && Math.abs(r) < 1) {
    const z = Math.atanh(r);
    const se = 1 / Math.sqrt(n - 3);
    const zc = normPpf(1 - (1 - confidence) / 2);
    ci = [Math.tanh(z - zc * se), Math.tanh(z + zc * se)];
  }
  return { r, p, n, ci };
}

export function spearman(xs: number[], ys: number[]): { rho: number; p: number } {
  const res = pearson(averageRanks(xs), averageRanks(ys));
  return { rho: res.r, p: res.p };
}

/** Number of permutations of n items with exactly k inversions, for k <= kmax (Mahonian numbers, doubles). */
function mahonianCdf(n: number, c: number): number {
  // returns P(inversions <= c) for a uniformly random permutation of n items
  const maxK = n * (n - 1) / 2;
  const cc = Math.min(c, maxK);
  let row = new Array<number>(cc + 1).fill(0);
  row[0] = 1;
  for (let m = 2; m <= n; m++) {
    const next = new Array<number>(cc + 1).fill(0);
    // next[k] = sum_{j=0}^{min(k, m-1)} row[k-j]
    let window = 0;
    for (let k = 0; k <= cc; k++) {
      window += row[k] as number;
      if (k - m >= 0) window -= row[k - m] as number;
      next[k] = window;
    }
    row = next;
  }
  let total = 0;
  for (const v of row) total += v;
  let fact = 1;
  for (let i = 2; i <= n; i++) fact *= i;
  return total / fact;
}

/** Count discordant pairs (strict) using a merge sort on y after sorting by (x, y). */
function countDiscordant(xs: number[], ys: number[]): number {
  const n = xs.length;
  const order = xs.map((_, i) => i).sort((a, b) => (xs[a] as number) - (xs[b] as number) || (ys[a] as number) - (ys[b] as number));
  let arr = order.map((i) => ys[i] as number);
  let buf = new Array<number>(n);
  let swaps = 0;
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      let k = lo;
      while (i < mid && j < hi) {
        if ((arr[j] as number) < (arr[i] as number)) {
          swaps += mid - i;
          buf[k++] = arr[j++] as number;
        } else buf[k++] = arr[i++] as number;
      }
      while (i < mid) buf[k++] = arr[i++] as number;
      while (j < hi) buf[k++] = arr[j++] as number;
    }
    const t = arr;
    arr = buf;
    buf = t;
  }
  return swaps;
}

function tieStats(a: number[]): { pairs: number; t3: number; t5: number } {
  const counts = new Map<number, number>();
  for (const v of a) counts.set(v, (counts.get(v) ?? 0) + 1);
  let pairs = 0;
  let t3 = 0;
  let t5 = 0;
  for (const t of counts.values()) {
    if (t > 1) {
      pairs += (t * (t - 1)) / 2;
      t3 += t * (t - 1) * (t - 2);
      t5 += t * (t - 1) * (2 * t + 5);
    }
  }
  return { pairs, t3, t5 };
}

export interface KendallResult {
  tau: number;
  p: number;
  method: 'exact' | 'asymptotic';
}

/** Kendall's tau-b with scipy-compatible p-value (exact for n <= 33 without ties). */
export function kendall(xs: number[], ys: number[]): KendallResult {
  const n = xs.length;
  const tot = (n * (n - 1)) / 2;
  const xt = tieStats(xs);
  const yt = tieStats(ys);
  if (n < 2 || xt.pairs === tot || yt.pairs === tot) return { tau: NaN, p: NaN, method: 'asymptotic' };
  // joint ties
  const joint = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${xs[i]}|${ys[i]}`;
    joint.set(key, (joint.get(key) ?? 0) + 1);
  }
  let ntie = 0;
  for (const t of joint.values()) ntie += (t * (t - 1)) / 2;
  const dis = countDiscordant(xs, ys);
  const conMinusDis = tot - xt.pairs - yt.pairs + ntie - 2 * dis;
  const tau = Math.max(-1, Math.min(1, conMinusDis / Math.sqrt(tot - xt.pairs) / Math.sqrt(tot - yt.pairs)));
  const noTies = xt.pairs === 0 && yt.pairs === 0;
  if (noTies && (n <= 33 || Math.min(dis, tot - dis) <= 1)) {
    const c = Math.min(dis, tot - dis);
    const p = Math.min(1, 2 * mahonianCdf(n, c));
    return { tau, p, method: 'exact' };
  }
  const m = n * (n - 1);
  const v =
    (m * (2 * n + 5) - xt.t5 - yt.t5) / 18 +
    (2 * xt.pairs * yt.pairs) / m +
    (xt.t3 * yt.t3) / (9 * m * (n - 2));
  const z = conMinusDis / Math.sqrt(v);
  return { tau, p: Math.min(1, 2 * normSf(Math.abs(z))), method: 'asymptotic' };
}

/* ------------------------------------------------------------------ */
/* Simple linear regression (closed form)                              */
/* ------------------------------------------------------------------ */

export interface LinearStats {
  n: number;
  df: number;
  slope: number;
  intercept: number;
  seSlope: number;
  seIntercept: number;
  tSlope: number;
  tIntercept: number;
  pSlope: number;
  pIntercept: number;
  ciSlope: [number, number];
  ciIntercept: [number, number];
  r: number;
  r2: number;
  adjR2: number;
  /** Standard error of the estimate sqrt(SSE / (n - 2)). */
  s: number;
  F: number;
  pF: number;
  sse: number;
  sst: number;
  xbar: number;
  ybar: number;
  sxx: number;
  tCrit: number;
  confidence: number;
}

export function linearStats(xs: number[], ys: number[], confidence = 0.95): LinearStats | { error: string } {
  const n = xs.length;
  if (n < 2) return { error: 'At least 2 points are required.' };
  const xbar = mean(xs);
  const ybar = mean(ys);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - xbar;
    const dy = (ys[i] as number) - ybar;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (!(sxx > 0)) return { error: 'All x values are identical, so no line can be fitted.' };
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const e = (ys[i] as number) - (intercept + slope * (xs[i] as number));
    sse += e * e;
  }
  const df = n - 2;
  const r2 = syy > 0 ? Math.max(0, 1 - sse / syy) : NaN;
  const r = syy > 0 ? (sxy / Math.sqrt(sxx * syy)) : NaN;
  const nanTuple: [number, number] = [NaN, NaN];
  const base = {
    n,
    df,
    slope,
    intercept,
    r,
    r2,
    adjR2: df > 0 ? 1 - ((1 - r2) * (n - 1)) / df : NaN,
    sse,
    sst: syy,
    xbar,
    ybar,
    sxx,
    confidence,
  };
  if (df < 1) {
    return {
      ...base,
      seSlope: NaN,
      seIntercept: NaN,
      tSlope: NaN,
      tIntercept: NaN,
      pSlope: NaN,
      pIntercept: NaN,
      ciSlope: nanTuple,
      ciIntercept: nanTuple,
      s: NaN,
      F: NaN,
      pF: NaN,
      tCrit: NaN,
    };
  }
  const s = Math.sqrt(sse / df);
  const seSlope = s / Math.sqrt(sxx);
  const seIntercept = s * Math.sqrt(1 / n + (xbar * xbar) / sxx);
  const tSlope = slope / seSlope;
  const tIntercept = intercept / seIntercept;
  const tCrit = tQuantile(1 - (1 - confidence) / 2, df);
  const F = sse > 0 ? (r2 / (1 - r2)) * df : Infinity;
  return {
    ...base,
    s,
    seSlope,
    seIntercept,
    tSlope,
    tIntercept,
    pSlope: tTwoSidedP(tSlope, df),
    pIntercept: tTwoSidedP(tIntercept, df),
    ciSlope: [slope - tCrit * seSlope, slope + tCrit * seSlope],
    ciIntercept: [intercept - tCrit * seIntercept, intercept + tCrit * seIntercept],
    F,
    pF: Number.isFinite(F) ? fSf(F, 1, df) : 0,
    tCrit,
  };
}

/* ------------------------------------------------------------------ */
/* Least squares via Householder QR                                    */
/* ------------------------------------------------------------------ */

export interface Lsq {
  beta: number[];
  /** (X'X)^-1 */
  xtxInv: number[][];
  /** residual sum of squares in the fitted (possibly transformed) space */
  sse: number;
  dof: number;
  n: number;
  k: number;
}

/** Solve min |X b - z|; throws on a rank-deficient design. */
export function lstsq(X: number[][], z: number[]): Lsq {
  const n = X.length;
  const k = (X[0] ?? []).length;
  if (n < k) throw new Error('Not enough points for this model.');
  const A = X.map((row) => row.slice());
  const b = z.slice();
  const rdiag: number[] = [];
  for (let j = 0; j < k; j++) {
    let norm = 0;
    for (let i = j; i < n; i++) norm = Math.hypot(norm, (A[i] as number[])[j] as number);
    if (norm === 0) throw new Error('Singular design matrix.');
    const ajj = (A[j] as number[])[j] as number;
    const alpha = ajj > 0 ? -norm : norm;
    const v: number[] = new Array<number>(n).fill(0);
    for (let i = j; i < n; i++) v[i] = (A[i] as number[])[j] as number;
    v[j] = (v[j] as number) - alpha;
    let vnorm2 = 0;
    for (let i = j; i < n; i++) vnorm2 += (v[i] as number) ** 2;
    if (vnorm2 > 0) {
      for (let c = j; c < k; c++) {
        let dot = 0;
        for (let i = j; i < n; i++) dot += (v[i] as number) * ((A[i] as number[])[c] as number);
        const f = (2 * dot) / vnorm2;
        for (let i = j; i < n; i++) (A[i] as number[])[c] = ((A[i] as number[])[c] as number) - f * (v[i] as number);
      }
      let dotb = 0;
      for (let i = j; i < n; i++) dotb += (v[i] as number) * (b[i] as number);
      const fb = (2 * dotb) / vnorm2;
      for (let i = j; i < n; i++) b[i] = (b[i] as number) - fb * (v[i] as number);
    }
    rdiag.push(Math.abs((A[j] as number[])[j] as number));
  }
  const maxR = Math.max(...rdiag);
  for (const d of rdiag) {
    if (!(d > maxR * 1e-11)) throw new Error('The x values do not support this model (rank-deficient design).');
  }
  // back substitution R beta = b[0..k-1]
  const beta = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = b[i] as number;
    for (let j = i + 1; j < k; j++) s -= ((A[i] as number[])[j] as number) * (beta[j] as number);
    beta[i] = s / ((A[i] as number[])[i] as number);
  }
  // R^-1 (upper triangular)
  const Rinv: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let c = 0; c < k; c++) {
    for (let i = c; i >= 0; i--) {
      let s = i === c ? 1 : 0;
      for (let j = i + 1; j <= c; j++) s -= ((A[i] as number[])[j] as number) * ((Rinv[j] as number[])[c] as number);
      (Rinv[i] as number[])[c] = s / ((A[i] as number[])[i] as number);
    }
  }
  const xtxInv: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let m = Math.max(i, j); m < k; m++) s += ((Rinv[i] as number[])[m] as number) * ((Rinv[j] as number[])[m] as number);
      (xtxInv[i] as number[])[j] = s;
    }
  }
  let sse = 0;
  for (let i = 0; i < n; i++) {
    let fit = 0;
    for (let j = 0; j < k; j++) fit += ((X[i] as number[])[j] as number) * (beta[j] as number);
    const e = (z[i] as number) - fit;
    sse += e * e;
  }
  return { beta, xtxInv, sse, dof: n - k, n, k };
}

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

export type ModelKind =
  | 'linear'
  | 'poly2'
  | 'poly3'
  | 'poly4'
  | 'poly5'
  | 'poly6'
  | 'exponential'
  | 'logarithmic'
  | 'power';

export const MODEL_KINDS: ModelKind[] = [
  'linear',
  'poly2',
  'poly3',
  'poly4',
  'poly5',
  'poly6',
  'exponential',
  'logarithmic',
  'power',
];

export const MODEL_LABEL: Record<ModelKind, string> = {
  linear: 'Linear',
  poly2: 'Quadratic (deg 2)',
  poly3: 'Cubic (deg 3)',
  poly4: 'Polynomial deg 4',
  poly5: 'Polynomial deg 5',
  poly6: 'Polynomial deg 6',
  exponential: 'Exponential',
  logarithmic: 'Logarithmic',
  power: 'Power',
};

export interface Interval3 {
  yhat: number;
  lo: number;
  hi: number;
}

export interface ModelFit {
  ok: true;
  kind: ModelKind;
  label: string;
  /** Coefficients in natural form: linear [intercept, slope]; poly [c0..cd]; exp [a, b]; log [a, b]; power [a, b]. */
  coef: number[];
  equation: string;
  n: number;
  /** number of fitted parameters */
  k: number;
  predict: (x: number) => number;
  fitted: number[];
  residuals: number[];
  stdResiduals: number[];
  sse: number;
  sst: number;
  r2: number;
  adjR2: number;
  rmse: number;
  /** sqrt(SSE / (n - k)) on the original scale */
  s: number;
  aic: number;
  aicc: number;
  /** Interval for the mean response (type 'mean') or a new observation (type 'pred'). */
  interval: (x0: number, confidence: number, type: 'mean' | 'pred') => Interval3;
  /** Is the response log-transformed (exp / power)? */
  logResponse: boolean;
  /** Smallest / largest x that the model is defined for (log / power need x > 0). */
  xDomainMin: number;
  /** Centering parameters for polynomial models (u = (x - mu) / scale). */
  center?: { mu: number; scale: number; coefU: number[] };
}

export interface ModelFail {
  ok: false;
  kind: ModelKind;
  label: string;
  reason: string;
}

export type FitResult = ModelFit | ModelFail;

function polyRawFromCentered(c: number[], mu: number, scale: number): number[] {
  // p(x) = sum_k c_k ((x - mu)/scale)^k  ->  raw coefficients a_j
  const d = c.length - 1;
  const binom = (n: number, k: number) => {
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  };
  const a = new Array<number>(d + 1).fill(0);
  for (let k = 0; k <= d; k++) {
    for (let j = 0; j <= k; j++) {
      a[j] = (a[j] as number) + (c[k] as number) * Math.pow(scale, -k) * binom(k, j) * Math.pow(-mu, k - j);
    }
  }
  return a;
}

function signedTerm(c: number, body: string, first: boolean, sig: number): string {
  const mag = fmt(Math.abs(c), sig);
  const sign = c < 0 ? '-' : '+';
  const term = body === '' ? mag : mag === '1' ? body : `${mag}${body}`;
  if (first) return c < 0 ? `-${term}` : term;
  return ` ${sign} ${term}`;
}

export function polyEquation(coef: number[], sig = 6): string {
  let s = 'y = ';
  let first = true;
  for (let j = 0; j < coef.length; j++) {
    const c = coef[j] as number;
    const body = j === 0 ? '' : j === 1 ? 'x' : `x^${j}`;
    s += signedTerm(c, body, first, sig);
    first = false;
  }
  return s;
}

const T_OF_CONF = (confidence: number, df: number) => tQuantile(1 - (1 - confidence) / 2, df);

/** Fit a model of the given kind; never throws. */
export function fitModel(kind: ModelKind, xs: number[], ys: number[]): FitResult {
  const label = MODEL_LABEL[kind];
  const n = xs.length;
  const fail = (reason: string): ModelFail => ({ ok: false, kind, label, reason });
  try {
    if (n < 2) return fail('Needs at least 2 points.');
    const deg = kind === 'linear' ? 1 : kind.startsWith('poly') ? Number(kind.slice(4)) : 1;
    const isPoly = kind === 'linear' || kind.startsWith('poly');
    const nParams = 2 + (isPoly ? deg - 1 : 0);
    if (n < nParams + 1 && kind !== 'linear') return fail(`Needs at least ${nParams + 1} points (has ${n}).`);

    let xmin = Infinity;
    let xmax = -Infinity;
    for (const x of xs) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
    if (!(xmax > xmin)) return fail('All x values are identical.');

    let basis: (x: number) => number[];
    let zs: number[];
    let logResponse = false;
    let center: { mu: number; scale: number; coefU: number[] } | undefined;
    let xDomainMin = -Infinity;

    if (isPoly) {
      const mu = mean(xs);
      let scale = 0;
      for (const x of xs) scale = Math.max(scale, Math.abs(x - mu));
      basis = (x) => {
        const u = (x - mu) / scale;
        const row = new Array<number>(deg + 1);
        let p = 1;
        for (let j = 0; j <= deg; j++) {
          row[j] = p;
          p *= u;
        }
        return row;
      };
      zs = ys;
      center = { mu, scale, coefU: [] };
    } else if (kind === 'exponential') {
      for (const y of ys) if (!(y > 0)) return fail('Requires all y values to be positive (y > 0).');
      basis = (x) => [1, x];
      zs = ys.map((y) => Math.log(y));
      logResponse = true;
    } else if (kind === 'logarithmic') {
      for (const x of xs) if (!(x > 0)) return fail('Requires all x values to be positive (x > 0).');
      basis = (x) => [1, Math.log(x)];
      zs = ys;
      xDomainMin = 0;
    } else {
      for (const x of xs) if (!(x > 0)) return fail('Requires all x values to be positive (x > 0).');
      for (const y of ys) if (!(y > 0)) return fail('Requires all y values to be positive (y > 0).');
      basis = (x) => [1, Math.log(x)];
      zs = ys.map((y) => Math.log(y));
      logResponse = true;
      xDomainMin = 0;
    }

    const X = xs.map((x) => basis(x));
    const fit = lstsq(X, zs);
    const k = fit.k;
    const beta = fit.beta;

    let coef: number[];
    let predict: (x: number) => number;
    let equation: string;
    if (isPoly) {
      const c = center as { mu: number; scale: number; coefU: number[] };
      c.coefU = beta.slice();
      coef = polyRawFromCentered(beta, c.mu, c.scale);
      predict = (x) => {
        const u = (x - c.mu) / c.scale;
        let acc = 0;
        for (let j = beta.length - 1; j >= 0; j--) acc = acc * u + (beta[j] as number);
        return acc;
      };
      if (kind === 'linear') {
        // present the line as intercept + slope * x
        equation = polyEquation(coef);
      } else {
        equation = polyEquation(coef);
      }
    } else if (kind === 'exponential') {
      const a = Math.exp(beta[0] as number);
      const b = beta[1] as number;
      coef = [a, b];
      predict = (x) => a * Math.exp(b * x);
      equation = `y = ${fmt(a)} * e^(${fmt(b)} * x)`;
    } else if (kind === 'logarithmic') {
      coef = [beta[0] as number, beta[1] as number];
      predict = (x) => (coef[0] as number) + (coef[1] as number) * Math.log(x);
      equation = `y = ${fmt(coef[0] as number)} ${(coef[1] as number) < 0 ? '-' : '+'} ${fmt(Math.abs(coef[1] as number))} * ln(x)`;
    } else {
      const a = Math.exp(beta[0] as number);
      const b = beta[1] as number;
      coef = [a, b];
      predict = (x) => a * Math.pow(x, b);
      equation = `y = ${fmt(a)} * x^${fmt(b)}`;
    }

    const fitted = xs.map((x) => predict(x));
    const ybar = mean(ys);
    let sse = 0;
    let sst = 0;
    const residuals = ys.map((y, i) => {
      const e = y - (fitted[i] as number);
      sse += e * e;
      sst += (y - ybar) * (y - ybar);
      return e;
    });
    const dof = n - k;
    const r2 = sst > 0 ? 1 - sse / sst : NaN;
    const adjR2 = dof > 0 && sst > 0 ? 1 - ((1 - r2) * (n - 1)) / dof : NaN;
    const s = dof > 0 ? Math.sqrt(sse / dof) : NaN;
    const aic = sse > 0 ? n * Math.log(sse / n) + 2 * k : -Infinity;
    const aicc = n - k - 1 > 0 ? aic + (2 * k * (k + 1)) / (n - k - 1) : NaN;

    // leverage for identity-link models (hat diagonal in the design space)
    const stdResiduals = residuals.map((e, i) => {
      if (!(s > 0)) return NaN;
      if (logResponse) return e / s;
      const row = X[i] as number[];
      let h = 0;
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) h += (row[a] as number) * ((fit.xtxInv[a] as number[])[b] as number) * (row[b] as number);
      const denom = Math.sqrt(Math.max(1e-12, 1 - h));
      return e / (s * denom);
    });

    const sz = fit.dof > 0 ? Math.sqrt(fit.sse / fit.dof) : NaN;
    const interval = (x0: number, confidence: number, type: 'mean' | 'pred'): Interval3 => {
      const row = basis(x0);
      let q = 0;
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) q += (row[a] as number) * ((fit.xtxInv[a] as number[])[b] as number) * (row[b] as number);
      let zhat = 0;
      for (let a = 0; a < k; a++) zhat += (row[a] as number) * (beta[a] as number);
      const t = T_OF_CONF(confidence, fit.dof);
      const se = sz * Math.sqrt(type === 'mean' ? q : 1 + q);
      const lo = zhat - t * se;
      const hi = zhat + t * se;
      return logResponse
        ? { yhat: Math.exp(zhat), lo: Math.exp(lo), hi: Math.exp(hi) }
        : { yhat: zhat, lo, hi };
    };

    return {
      ok: true,
      kind,
      label,
      coef,
      equation,
      n,
      k,
      predict,
      fitted,
      residuals,
      stdResiduals,
      sse,
      sst,
      r2,
      adjR2,
      rmse: Math.sqrt(sse / n),
      s,
      aic,
      aicc,
      interval,
      logResponse,
      xDomainMin,
      center,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Fit every model; returns results in MODEL_KINDS order. */
export function fitAll(xs: number[], ys: number[]): FitResult[] {
  return MODEL_KINDS.map((k) => fitModel(k, xs, ys));
}

export type RankBy = 'adjR2' | 'aic' | 'aicc' | 'rmse' | 'r2';

/** Sort successful fits best-first by the chosen criterion. */
export function rankFits(fits: ModelFit[], by: RankBy): ModelFit[] {
  const score = (f: ModelFit): number => {
    switch (by) {
      case 'adjR2':
        return Number.isFinite(f.adjR2) ? -f.adjR2 : Infinity;
      case 'r2':
        return Number.isFinite(f.r2) ? -f.r2 : Infinity;
      case 'rmse':
        return f.rmse;
      case 'aic':
        return f.aic;
      case 'aicc':
        return Number.isFinite(f.aicc) ? f.aicc : Infinity;
      default:
        return Infinity;
    }
  };
  return fits.slice().sort((a, b) => score(a) - score(b));
}

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/* ------------------------------------------------------------------ */

export interface Palette {
  fg: string;
  muted: string;
  grid: string;
  point: string;
  curve: string;
  band: string;
  accent: string;
  /** Background fill; omitted for on-screen charts. */
  bg?: string;
  font: string;
}

export interface ChartOptions {
  width: number;
  height: number;
  xs: number[];
  ys: number[];
  model: ModelFit;
  kind: 'fit' | 'residuals';
  showCI: boolean;
  showPI: boolean;
  confidence: number;
  residualAxis: 'x' | 'fitted';
  xLabel: string;
  yLabel: string;
  palette: Palette;
  predictPoint?: { x: number; y: number } | null;
  title?: string;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tickLabel(v: number, step: number): string {
  const digits = step > 0 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return fmt(v, 3);
  return Number(v.toFixed(Math.min(digits + 1, 8))).toString();
}

const MAX_DRAWN_POINTS = 3000;

export function buildChartSvg(o: ChartOptions): string {
  const { width: W, height: H, palette: P } = o;
  const m = { l: 62, r: 16, t: o.title ? 30 : 14, b: 44 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const n = o.xs.length;
  const stride = Math.max(1, Math.ceil(n / MAX_DRAWN_POINTS));
  const parts: string[] = [];
  const f2 = (v: number) => v.toFixed(2);

  let xs = o.xs;
  const ys = o.ys;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const x of xs) {
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
  }
  const model = o.model;

  const curveXs: number[] = [];
  const NC = 160;
  const xpad = (xmax - xmin) * 0.04;
  let cx0 = xmin - xpad;
  const cx1 = xmax + xpad;
  if (model.xDomainMin !== -Infinity && cx0 <= model.xDomainMin) cx0 = model.xDomainMin + (xmin - model.xDomainMin) * 0.1;
  for (let i = 0; i <= NC; i++) curveXs.push(cx0 + ((cx1 - cx0) * i) / NC);

  let yvals: number[];
  let series: { x: number; y: number }[] = [];
  let curve: { x: number; y: number }[] = [];
  let ci: Interval3[] = [];
  let pi: Interval3[] = [];
  let xAxisLabel = o.xLabel;
  let yAxisLabel = o.yLabel;

  if (o.kind === 'fit') {
    series = xs.map((x, i) => ({ x, y: ys[i] as number }));
    curve = curveXs.map((x) => ({ x, y: model.predict(x) }));
    if (o.showCI) ci = curveXs.map((x) => model.interval(x, o.confidence, 'mean'));
    if (o.showPI) pi = curveXs.map((x) => model.interval(x, o.confidence, 'pred'));
    yvals = ys.slice();
  } else {
    const rx = o.residualAxis === 'x' ? xs : model.fitted;
    series = rx.map((x, i) => ({ x, y: model.residuals[i] as number }));
    yvals = model.residuals.slice();
    xAxisLabel = o.residualAxis === 'x' ? o.xLabel : `Fitted ${o.yLabel}`;
    yAxisLabel = `Residual (${o.yLabel} - fitted)`;
    xs = rx;
    xmin = Infinity;
    xmax = -Infinity;
    for (const x of xs) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
  }

  let ymin = Math.min(...yvals);
  let ymax = Math.max(...yvals);
  if (o.kind === 'residuals') {
    const a = Math.max(Math.abs(ymin), Math.abs(ymax)) || 1;
    ymin = -a;
    ymax = a;
  } else {
    const range = ymax - ymin || Math.abs(ymax) || 1;
    const lim = (v: number) => Number.isFinite(v) && v >= ymin - range && v <= ymax + range;
    for (const c of curve) if (lim(c.y)) { ymin = Math.min(ymin, c.y); ymax = Math.max(ymax, c.y); }
    for (const b of ci) { if (lim(b.lo)) ymin = Math.min(ymin, b.lo); if (lim(b.hi)) ymax = Math.max(ymax, b.hi); }
    for (const b of pi) { if (lim(b.lo)) ymin = Math.min(ymin, b.lo); if (lim(b.hi)) ymax = Math.max(ymax, b.hi); }
    if (o.predictPoint && lim(o.predictPoint.y)) { ymin = Math.min(ymin, o.predictPoint.y); ymax = Math.max(ymax, o.predictPoint.y); }
  }
  const ypad = (ymax - ymin || 1) * 0.06;
  ymin -= ypad;
  ymax += ypad;
  const px0 = o.kind === 'fit' ? cx0 : xmin - (xmax - xmin || 1) * 0.04;
  const px1 = o.kind === 'fit' ? cx1 : xmax + (xmax - xmin || 1) * 0.04;
  const sx = (x: number) => m.l + ((x - px0) / (px1 - px0 || 1)) * iw;
  const sy = (y: number) => m.t + ih - ((y - ymin) / (ymax - ymin || 1)) * ih;
  const clampY = (y: number) => Math.max(m.t - 4, Math.min(m.t + ih + 4, sy(y)));

  const xTicks = niceTicks(px0, px1, Math.max(3, Math.floor(iw / 90)));
  const yTicks = niceTicks(ymin, ymax, Math.max(3, Math.floor(ih / 50)));
  const xStep = xTicks.length > 1 ? (xTicks[1] as number) - (xTicks[0] as number) : 1;
  const yStep = yTicks.length > 1 ? (yTicks[1] as number) - (yTicks[0] as number) : 1;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${escapeXml(P.font)}" role="img" aria-label="${escapeXml(o.kind === 'fit' ? 'Scatter plot with fitted regression curve' : 'Residual plot')}">`
  );
  if (P.bg) parts.push(`<rect width="${W}" height="${H}" fill="${P.bg}"/>`);
  if (o.title) {
    parts.push(`<text x="${W / 2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="${P.fg}">${escapeXml(o.title)}</text>`);
  }
  parts.push(`<clipPath id="plotclip"><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></clipPath>`);
  for (const t of yTicks) {
    parts.push(`<line x1="${m.l}" x2="${m.l + iw}" y1="${f2(sy(t))}" y2="${f2(sy(t))}" stroke="${P.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${m.l - 7}" y="${f2(sy(t) + 3.5)}" text-anchor="end" font-size="10.5" fill="${P.muted}">${escapeXml(tickLabel(t, yStep))}</text>`);
  }
  for (const t of xTicks) {
    parts.push(`<line x1="${f2(sx(t))}" x2="${f2(sx(t))}" y1="${m.t}" y2="${m.t + ih}" stroke="${P.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${f2(sx(t))}" y="${m.t + ih + 15}" text-anchor="middle" font-size="10.5" fill="${P.muted}">${escapeXml(tickLabel(t, xStep))}</text>`);
  }
  parts.push(`<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="none" stroke="${P.muted}" stroke-opacity="0.5"/>`);
  if (o.kind === 'residuals') {
    parts.push(`<line x1="${m.l}" x2="${m.l + iw}" y1="${f2(sy(0))}" y2="${f2(sy(0))}" stroke="${P.accent}" stroke-width="1.25" stroke-dasharray="5 4"/>`);
  }
  parts.push('<g clip-path="url(#plotclip)">');
  const bandPath = (arr: Interval3[]) => {
    const top = arr.map((b, i) => `${f2(sx(curveXs[i] as number))},${f2(clampY(b.hi))}`);
    const bot = arr.map((b, i) => `${f2(sx(curveXs[i] as number))},${f2(clampY(b.lo))}`).reverse();
    return `M${top.join('L')}L${bot.join('L')}Z`;
  };
  if (o.kind === 'fit') {
    if (o.showPI && pi.length) parts.push(`<path d="${bandPath(pi)}" fill="${P.band}" fill-opacity="0.12" stroke="${P.band}" stroke-opacity="0.35" stroke-dasharray="4 3"/>`);
    if (o.showCI && ci.length) parts.push(`<path d="${bandPath(ci)}" fill="${P.band}" fill-opacity="0.28" stroke="none"/>`);
    const d = curve
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${f2(sx(c.x))},${f2(clampY(c.y))}`)
      .join('');
    parts.push(`<path d="${d}" fill="none" stroke="${P.curve}" stroke-width="2.25" stroke-linejoin="round"/>`);
  }
  for (let i = 0; i < series.length; i += stride) {
    const p = series[i] as { x: number; y: number };
    const tip =
      o.kind === 'fit'
        ? `#${i + 1}: x = ${fmt(p.x)}, y = ${fmt(p.y)}, fitted = ${fmt(model.fitted[i] as number)}, residual = ${fmt(model.residuals[i] as number)}`
        : `#${i + 1}: ${o.residualAxis === 'x' ? 'x' : 'fitted'} = ${fmt(p.x)}, residual = ${fmt(p.y)}`;
    parts.push(
      `<circle cx="${f2(sx(p.x))}" cy="${f2(sy(p.y))}" r="${n > 400 ? 2.4 : 3.6}" fill="${P.point}" fill-opacity="${n > 400 ? 0.55 : 0.85}" stroke="${P.bg ?? 'none'}" stroke-width="0.8"><title>${escapeXml(tip)}</title></circle>`
    );
  }
  if (o.kind === 'fit' && o.predictPoint) {
    const pp = o.predictPoint;
    parts.push(`<circle cx="${f2(sx(pp.x))}" cy="${f2(sy(pp.y))}" r="5.5" fill="none" stroke="${P.accent}" stroke-width="2.25"><title>${escapeXml(`prediction: x = ${fmt(pp.x)}, y-hat = ${fmt(pp.y)}`)}</title></circle>`);
  }
  parts.push('</g>');
  parts.push(`<text x="${m.l + iw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="${P.fg}">${escapeXml(xAxisLabel)}</text>`);
  parts.push(
    `<text transform="translate(14 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${P.fg}">${escapeXml(yAxisLabel)}</text>`
  );
  parts.push('</svg>');
  return parts.join('');
}

/** CSV of the residuals table. */
export function residualsCsv(xs: number[], ys: number[], model: ModelFit): string {
  const lines = ['index,x,y,fitted,residual,std_residual'];
  for (let i = 0; i < xs.length; i++) {
    lines.push(
      [i + 1, xs[i], ys[i], model.fitted[i], model.residuals[i], model.stdResiduals[i]]
        .map((v) => (typeof v === 'number' ? String(Number((v as number).toPrecision(12))) : String(v)))
        .join(',')
    );
  }
  return lines.join('\n');
}
