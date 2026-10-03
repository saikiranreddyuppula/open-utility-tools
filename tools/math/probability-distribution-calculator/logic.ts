/**
 * Probability distribution numerics: special functions, 14 distributions
 * (pdf/pmf, cdf, sf, quantile, moments) and plotting helpers.
 * Pure TypeScript, no dependencies.
 *
 * Accuracy notes: prefactors of the incomplete gamma / beta functions use
 * Loader's saddle-point algorithm (stirlerr + bd0), which avoids the
 * catastrophic cancellation of exp(a*log(x) - x - lgamma(a)) for large
 * parameters. Continued fractions use the modified Lentz method.
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
/* Root finding helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Safeguarded Newton (rtsafe): solves h(x) = 0 for a monotone increasing h
 * with derivative dh, starting from a bracket [a, b] with h(a) <= 0 <= h(b).
 */
function rtsafe(
  h: (x: number) => number,
  dh: (x: number) => number,
  a: number,
  b: number,
  guess: number
): number {
  let lo = a;
  let hi = b;
  let x = guess > lo && guess < hi ? guess : 0.5 * (lo + hi);
  let dxOld = hi - lo;
  let dx = dxOld;
  let f = h(x);
  let df = dh(x);
  for (let i = 0; i < 300; i++) {
    if (f === 0) return x;
    if (f < 0) lo = x;
    else hi = x;
    const newtonOk = Number.isFinite(df) && df > 0;
    let xn = newtonOk ? x - f / df : NaN;
    if (!newtonOk || !(xn > lo && xn < hi) || Math.abs(2 * f) > Math.abs(dxOld * df)) {
      dxOld = dx;
      dx = 0.5 * (hi - lo);
      xn = lo + dx;
      if (xn === lo || xn === hi) return xn;
    } else {
      dxOld = dx;
      dx = f / df;
      xn = x - dx;
    }
    if (Math.abs(xn - x) <= 4e-16 * Math.max(Math.abs(xn), 1e-300)) return xn;
    x = xn;
    f = h(x);
    df = dh(x);
  }
  return x;
}

interface ContLike {
  lo: number;
  hi: number;
  pdf(x: number): number;
  cdf(x: number): number;
  sf(x: number): number;
}

function contQuantile(d: ContLike, p: number, guess: number, scale: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return d.lo;
  if (p === 1) return d.hi;
  const upper = p > 0.5;
  const target = 1 - p;
  const h = upper ? (x: number) => target - d.sf(x) : (x: number) => d.cdf(x) - p;
  const dh = (x: number) => d.pdf(x);
  let x0 = Number.isFinite(guess) ? guess : 0;
  x0 = Math.min(Math.max(x0, Number.isFinite(d.lo) ? d.lo : -Infinity), d.hi);
  let step = Number.isFinite(scale) && scale > 0 ? scale : Math.max(1, Math.abs(x0));
  const h0 = h(x0);
  if (h0 === 0) return x0;
  let a: number;
  let b: number;
  if (h0 < 0) {
    a = x0;
    b = x0 + step;
    for (let i = 0; i < 2100; i++) {
      if (b >= d.hi) {
        b = d.hi;
        if (!(h(b) >= 0)) return d.hi;
        break;
      }
      if (h(b) >= 0) break;
      a = b;
      step *= 2;
      b = a + step;
    }
  } else {
    b = x0;
    a = x0 - step;
    for (let i = 0; i < 2100; i++) {
      if (a <= d.lo) {
        a = d.lo;
        if (!(h(a) <= 0)) return d.lo;
        break;
      }
      if (h(a) <= 0) break;
      b = a;
      step *= 2;
      a = b - step;
    }
  }
  return rtsafe(h, dh, a, b, x0);
}

interface DiscLike {
  lo: number;
  hi: number;
  cdf(x: number): number;
  sf(x: number): number;
}

/** Smallest integer k in [lo, hi] with P(X <= k) >= p. */
function discQuantile(d: DiscLike, p: number, mean: number, sd: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return d.lo;
  if (p === 1) return d.hi;
  const upper = p > 0.5;
  const ge = upper
    ? (k: number) => d.sf(k) <= (1 - p) * (1 + 1e-12)
    : (k: number) => d.cdf(k) >= p * (1 - 1e-12);
  let k0 = Number.isFinite(mean) ? Math.round(mean) : d.lo;
  k0 = Math.min(Math.max(k0, d.lo), d.hi);
  let step = Math.max(1, Math.ceil(Number.isFinite(sd) ? sd : 1));
  let a: number; // ge(a) false (or a = lo - 1)
  let b: number; // ge(b) true
  if (ge(k0)) {
    b = k0;
    a = b - step;
    while (a >= d.lo && ge(a)) {
      b = a;
      step *= 2;
      a = b - step;
    }
    if (a < d.lo - 1) a = d.lo - 1;
  } else {
    a = k0;
    b = a + step;
    for (let i = 0; i < 2100; i++) {
      if (b >= d.hi) {
        b = d.hi;
        break;
      }
      if (ge(b)) break;
      a = b;
      step *= 2;
      b = a + step;
    }
    if (!ge(b)) return d.hi;
  }
  while (b - a > 1) {
    const mid = Math.floor((a + b) / 2);
    if (ge(mid)) b = mid;
    else a = mid;
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* Distribution model                                                  */
/* ------------------------------------------------------------------ */

export interface DistStats {
  mean: number;
  variance: number;
  skewness: number;
  exKurtosis: number;
  /** Modes; empty when undefined or when every value in the support is a mode. */
  mode: number[];
  modeNote?: string;
}

export interface Dist {
  kind: 'continuous' | 'discrete';
  /** Support bounds (may be infinite). */
  lo: number;
  hi: number;
  /** Density (continuous) or mass (discrete; 0 at non-integers). */
  pdf(x: number): number;
  /** P(X <= x) */
  cdf(x: number): number;
  /** P(X > x) */
  sf(x: number): number;
  /** Smallest x with P(X <= x) >= p (discrete) / the inverse CDF (continuous). */
  quantile(p: number): number;
  stats: DistStats;
}

export type DistId =
  | 'normal'
  | 't'
  | 'chisq'
  | 'f'
  | 'exponential'
  | 'uniform'
  | 'gamma'
  | 'beta'
  | 'lognormal'
  | 'binomial'
  | 'poisson'
  | 'geometric'
  | 'negbinomial'
  | 'hypergeometric';

export interface ParamSpec {
  key: string;
  label: string;
  def: number;
  min?: number;
  max?: number;
  minExclusive?: boolean;
  maxExclusive?: boolean;
  integer?: boolean;
  hint?: string;
  options?: { value: number; label: string }[];
}

export interface DistSpec {
  id: DistId;
  name: string;
  kind: 'continuous' | 'discrete';
  params: ParamSpec[];
  /** One-line description of the parameterization. */
  blurb: string;
  validate?: (v: Record<string, number>) => string | null;
  create: (v: Record<string, number>) => Dist;
}

/* ---- continuous ---- */

function makeNormal(mu: number, sigma: number): Dist {
  const z = (x: number) => (x - mu) / sigma;
  return {
    kind: 'continuous',
    lo: -Infinity,
    hi: Infinity,
    pdf: (x) => normPdf(z(x)) / sigma,
    cdf: (x) => normCdf(z(x)),
    sf: (x) => normSf(z(x)),
    quantile: (p) => mu + sigma * normPpf(p),
    stats: { mean: mu, variance: sigma * sigma, skewness: 0, exKurtosis: 0, mode: [mu] },
  };
}

function tTails(t: number, nu: number): { lowerTail: number; upperTail: number } {
  // returns P(T < -|t|) = P(T > |t|) as the small tail and its complement
  const t2 = t * t;
  const denom = nu + t2;
  const w = nu / denom;
  const y = Number.isFinite(t2) ? t2 / denom : 1;
  const [I, Ic] = betaIPQ(nu / 2, 0.5, w, y);
  return { lowerTail: I / 2, upperTail: (1 + Ic) / 2 };
}

function makeT(nu: number): Dist {
  const cdf = (x: number) => {
    if (x === 0) return 0.5;
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const { lowerTail, upperTail } = tTails(x, nu);
    return x < 0 ? lowerTail : upperTail;
  };
  const lc = lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(nu * Math.PI);
  const dist: Dist = {
    kind: 'continuous',
    lo: -Infinity,
    hi: Infinity,
    pdf: (x) => Math.exp(lc - ((nu + 1) / 2) * Math.log1p((x * x) / nu)),
    cdf,
    sf: (x) => cdf(-x),
    quantile: () => NaN,
    stats: {
      mean: nu > 1 ? 0 : NaN,
      variance: nu > 2 ? nu / (nu - 2) : nu > 1 ? Infinity : NaN,
      skewness: nu > 3 ? 0 : NaN,
      exKurtosis: nu > 4 ? 6 / (nu - 4) : nu > 2 ? Infinity : NaN,
      mode: [0],
    },
  };
  dist.quantile = (p) => {
    if (p === 0.5) return 0;
    // symmetric: solve in the lower tail and reflect
    if (p > 0.5) return -dist.quantile(1 - p);
    return contQuantile(dist, p, -1, 1);
  };
  return dist;
}

function makeGammaRate(shape: number, rate: number): Dist {
  const scale = 1 / rate;
  const dist: Dist = {
    kind: 'continuous',
    lo: 0,
    hi: Infinity,
    pdf: (x) => {
      if (x < 0) return 0;
      if (x === 0) return shape < 1 ? Infinity : shape === 1 ? rate : 0;
      if (!Number.isFinite(x)) return 0;
      const lam = x * rate;
      if (shape < 1) return (dpoisRaw(shape, lam) * shape) / x;
      return dpoisRaw(shape - 1, lam) * rate;
    },
    cdf: (x) => (x <= 0 ? 0 : gammaPQ(shape, x * rate)[0]),
    sf: (x) => (x <= 0 ? 1 : gammaPQ(shape, x * rate)[1]),
    quantile: () => NaN,
    stats: {
      mean: shape * scale,
      variance: shape * scale * scale,
      skewness: 2 / Math.sqrt(shape),
      exKurtosis: 6 / shape,
      mode: [shape >= 1 ? (shape - 1) * scale : 0],
    },
  };
  dist.quantile = (p) => {
    // Wilson-Hilferty style start
    const z = normPpf(Math.min(Math.max(p, 1e-300), 1 - 1e-16));
    const c = 1 / (9 * shape);
    const g = shape * Math.pow(Math.max(1 - c + z * Math.sqrt(c), 0.01), 3) * scale;
    return contQuantile(dist, p, g > 0 ? g : shape * scale, Math.sqrt(shape) * scale);
  };
  return dist;
}

function makeChiSq(k: number): Dist {
  const g = makeGammaRate(k / 2, 0.5);
  return {
    ...g,
    stats: {
      mean: k,
      variance: 2 * k,
      skewness: Math.sqrt(8 / k),
      exKurtosis: 12 / k,
      mode: [Math.max(k - 2, 0)],
    },
  };
}

function makeF(d1: number, d2: number): Dist {
  const dist: Dist = {
    kind: 'continuous',
    lo: 0,
    hi: Infinity,
    pdf: (x) => {
      if (x < 0) return 0;
      if (x === 0) return d1 < 2 ? Infinity : d1 === 2 ? 1 : 0;
      if (!Number.isFinite(x)) return 0;
      const f = 1 / (d2 + x * d1);
      const q = d2 * f;
      const p = x * d1 * f;
      if (d1 >= 2) {
        return ((d1 * q) / 2) * dbinomRaw((d1 - 2) / 2, (d1 + d2 - 2) / 2, p, q);
      }
      return ((d1 * d1 * q) / (2 * p * (d1 + d2))) * dbinomRaw(d1 / 2, (d1 + d2) / 2, p, q);
    },
    cdf: (x) => {
      if (x <= 0) return 0;
      if (x === Infinity) return 1;
      const den = d1 * x + d2;
      return betaIPQ(d1 / 2, d2 / 2, (d1 * x) / den, d2 / den)[0];
    },
    sf: (x) => {
      if (x <= 0) return 1;
      if (x === Infinity) return 0;
      const den = d1 * x + d2;
      return betaIPQ(d1 / 2, d2 / 2, (d1 * x) / den, d2 / den)[1];
    },
    quantile: () => NaN,
    stats: {
      mean: d2 > 2 ? d2 / (d2 - 2) : NaN,
      variance:
        d2 > 4
          ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) * (d2 - 2) * (d2 - 4))
          : d2 > 2
            ? Infinity
            : NaN,
      skewness:
        d2 > 6
          ? ((2 * d1 + d2 - 2) * Math.sqrt(8 * (d2 - 4))) /
            ((d2 - 6) * Math.sqrt(d1 * (d1 + d2 - 2)))
          : d2 > 3
            ? Infinity
            : NaN,
      exKurtosis:
        d2 > 8
          ? (12 *
              (d1 * (5 * d2 - 22) * (d1 + d2 - 2) + (d2 - 4) * (d2 - 2) * (d2 - 2))) /
            (d1 * (d2 - 6) * (d2 - 8) * (d1 + d2 - 2))
          : d2 > 4
            ? Infinity
            : NaN,
      mode: [d1 > 2 ? ((d1 - 2) / d1) * (d2 / (d2 + 2)) : 0],
    },
  };
  dist.quantile = (p) => {
    const m = d2 > 2 ? d2 / (d2 - 2) : 1;
    return contQuantile(dist, p, m, Math.max(1, m));
  };
  return dist;
}

function makeExponential(rate: number): Dist {
  return {
    kind: 'continuous',
    lo: 0,
    hi: Infinity,
    pdf: (x) => (x < 0 ? 0 : rate * Math.exp(-rate * x)),
    cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-rate * x)),
    sf: (x) => (x <= 0 ? 1 : Math.exp(-rate * x)),
    quantile: (p) => (p < 0 || p > 1 ? NaN : p === 1 ? Infinity : -Math.log1p(-p) / rate),
    stats: {
      mean: 1 / rate,
      variance: 1 / (rate * rate),
      skewness: 2,
      exKurtosis: 6,
      mode: [0],
    },
  };
}

function makeUniform(a: number, b: number): Dist {
  const w = b - a;
  return {
    kind: 'continuous',
    lo: a,
    hi: b,
    pdf: (x) => (x < a || x > b ? 0 : 1 / w),
    cdf: (x) => (x <= a ? 0 : x >= b ? 1 : (x - a) / w),
    sf: (x) => (x <= a ? 1 : x >= b ? 0 : (b - x) / w),
    quantile: (p) => (p < 0 || p > 1 ? NaN : a + p * w),
    stats: {
      mean: (a + b) / 2,
      variance: (w * w) / 12,
      skewness: 0,
      exKurtosis: -1.2,
      mode: [],
      modeNote: 'any value in [a, b]',
    },
  };
}

function makeBeta(a: number, b: number): Dist {
  const s = a + b;
  let mode: number[];
  let modeNote: string | undefined;
  if (a === 1 && b === 1) {
    mode = [];
    modeNote = 'any value in [0, 1]';
  } else if (a < 1 && b < 1) mode = [0, 1];
  else if (a <= 1 && b > 1) mode = [0];
  else if (a > 1 && b <= 1) mode = [1];
  else mode = [(a - 1) / (s - 2)];
  const dist: Dist = {
    kind: 'continuous',
    lo: 0,
    hi: 1,
    pdf: (x) => {
      if (x < 0 || x > 1) return 0;
      if (x === 0) return a < 1 ? Infinity : a === 1 ? b : 0;
      if (x === 1) return b < 1 ? Infinity : b === 1 ? a : 0;
      if (a <= 2 || b <= 2) {
        return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - lbeta(a, b));
      }
      return ((s - 1) * dbinomRaw(a - 1, s - 2, x, 1 - x));
    },
    cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : betaIPQ(a, b, x)[0]),
    sf: (x) => (x <= 0 ? 1 : x >= 1 ? 0 : betaIPQ(a, b, x)[1]),
    quantile: () => NaN,
    stats: {
      mean: a / s,
      variance: (a * b) / (s * s * (s + 1)),
      skewness: (2 * (b - a) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(a * b)),
      exKurtosis:
        (6 * ((a - b) * (a - b) * (s + 1) - a * b * (s + 2))) / (a * b * (s + 2) * (s + 3)),
      mode,
      modeNote,
    },
  };
  dist.quantile = (p) => {
    const m = a / s;
    return contQuantile(dist, p, m, Math.sqrt((a * b) / (s * s * (s + 1))));
  };
  return dist;
}

function makeLogNormal(mu: number, sigma: number): Dist {
  const s2 = sigma * sigma;
  const es2 = Math.exp(s2);
  return {
    kind: 'continuous',
    lo: 0,
    hi: Infinity,
    pdf: (x) =>
      x <= 0 ? 0 : Math.exp(-0.5 * ((Math.log(x) - mu) / sigma) ** 2) / (x * sigma * SQRT_2PI),
    cdf: (x) => (x <= 0 ? 0 : normCdf((Math.log(x) - mu) / sigma)),
    sf: (x) => (x <= 0 ? 1 : normSf((Math.log(x) - mu) / sigma)),
    quantile: (p) => (p < 0 || p > 1 ? NaN : Math.exp(mu + sigma * normPpf(p))),
    stats: {
      mean: Math.exp(mu + s2 / 2),
      variance: (es2 - 1) * Math.exp(2 * mu + s2),
      skewness: (es2 + 2) * Math.sqrt(es2 - 1),
      exKurtosis: Math.exp(4 * s2) + 2 * Math.exp(3 * s2) + 3 * Math.exp(2 * s2) - 6,
      mode: [Math.exp(mu - s2)],
    },
  };
}

/* ---- discrete ---- */

function intOrZero(f: (k: number) => number): (x: number) => number {
  return (x) => (Number.isInteger(x) ? f(x) : 0);
}

function makeBinomial(n: number, p: number): Dist {
  const q = 1 - p;
  const mean = n * p;
  const variance = n * p * q;
  const k0 = Math.floor((n + 1) * p);
  const modes = Number.isInteger((n + 1) * p) && k0 > 0 && k0 <= n ? [k0 - 1, k0] : [Math.min(k0, n)];
  const pmf = (k: number) => (k < 0 || k > n ? 0 : dbinomRaw(k, n, p, q));
  const dist: Dist = {
    kind: 'discrete',
    lo: 0,
    hi: n,
    pdf: intOrZero(pmf),
    cdf: (x) => {
      const k = Math.floor(x);
      if (k < 0) return 0;
      if (k >= n) return 1;
      return betaIPQ(n - k, k + 1, q, p)[0];
    },
    sf: (x) => {
      const k = Math.floor(x);
      if (k < 0) return 1;
      if (k >= n) return 0;
      return betaIPQ(n - k, k + 1, q, p)[1];
    },
    quantile: () => NaN,
    stats: {
      mean,
      variance,
      skewness: (1 - 2 * p) / Math.sqrt(variance),
      exKurtosis: (1 - 6 * p * q) / variance,
      mode: modes,
    },
  };
  dist.quantile = (pp) => discQuantile(dist, pp, mean, Math.sqrt(variance));
  return dist;
}

function makePoisson(lambda: number): Dist {
  const modes = Number.isInteger(lambda) ? [lambda - 1, lambda] : [Math.floor(lambda)];
  const dist: Dist = {
    kind: 'discrete',
    lo: 0,
    hi: Infinity,
    pdf: intOrZero((k) => (k < 0 ? 0 : dpoisRaw(k, lambda))),
    cdf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 0 : gammaPQ(k + 1, lambda)[1];
    },
    sf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 1 : gammaPQ(k + 1, lambda)[0];
    },
    quantile: () => NaN,
    stats: {
      mean: lambda,
      variance: lambda,
      skewness: 1 / Math.sqrt(lambda),
      exKurtosis: 1 / lambda,
      mode: modes.filter((m) => m >= 0),
    },
  };
  dist.quantile = (p) => discQuantile(dist, p, lambda, Math.sqrt(lambda));
  return dist;
}

/** Shift a discrete distribution by an integer offset (support start moves too). */
function shifted(d: Dist, shift: number): Dist {
  if (shift === 0) return d;
  return {
    kind: 'discrete',
    lo: d.lo + shift,
    hi: d.hi + shift,
    pdf: (x) => d.pdf(x - shift),
    cdf: (x) => d.cdf(x - shift),
    sf: (x) => d.sf(x - shift),
    quantile: (p) => d.quantile(p) + shift,
    stats: {
      ...d.stats,
      mean: d.stats.mean + shift,
      mode: d.stats.mode.map((m) => m + shift),
    },
  };
}

/** Negative binomial: failures before the r-th success (r >= 1). */
function makeNegBinomialFailures(r: number, p: number): Dist {
  const q = 1 - p;
  const mean = (r * q) / p;
  const variance = (r * q) / (p * p);
  const m0 = r > 1 ? Math.floor(((r - 1) * q) / p) : 0;
  const dist: Dist = {
    kind: 'discrete',
    lo: 0,
    hi: Infinity,
    pdf: intOrZero((k) => {
      if (k < 0) return 0;
      if (k === 0) return Math.exp(r * Math.log(p));
      return (r / (r + k)) * dbinomRaw(r, r + k, p, q);
    }),
    cdf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 0 : betaIPQ(r, k + 1, p, q)[0];
    },
    sf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 1 : betaIPQ(r, k + 1, p, q)[1];
    },
    quantile: () => NaN,
    stats: {
      mean,
      variance,
      skewness: (2 - p) / Math.sqrt(r * q),
      exKurtosis: 6 / r + (p * p) / (r * q),
      mode: [m0],
    },
  };
  dist.quantile = (pp) => discQuantile(dist, pp, mean, Math.sqrt(variance));
  return dist;
}

function makeGeometricFailures(p: number): Dist {
  const q = 1 - p;
  const lq = Math.log1p(-p);
  const mean = q / p;
  const variance = q / (p * p);
  return {
    kind: 'discrete',
    lo: 0,
    hi: Infinity,
    pdf: intOrZero((k) => (k < 0 ? 0 : p * Math.exp(k * lq))),
    cdf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 0 : -Math.expm1((k + 1) * lq);
    },
    sf: (x) => {
      const k = Math.floor(x);
      return k < 0 ? 1 : Math.exp((k + 1) * lq);
    },
    quantile: (pp) => {
      if (Number.isNaN(pp) || pp < 0 || pp > 1) return NaN;
      if (pp === 0) return 0;
      if (pp === 1) return Infinity;
      // smallest k with 1 - q^(k+1) >= pp  =>  k >= log(1-pp)/log(q) - 1
      let k = Math.max(0, Math.ceil(Math.log1p(-pp) / lq - 1 - 1e-12));
      // fix rounding
      const ok = (kk: number) => (pp > 0.5 ? Math.exp((kk + 1) * lq) <= (1 - pp) * (1 + 1e-12) : -Math.expm1((kk + 1) * lq) >= pp * (1 - 1e-12));
      while (k > 0 && ok(k - 1)) k--;
      while (!ok(k)) k++;
      return k;
    },
    stats: {
      mean,
      variance,
      skewness: (2 - p) / Math.sqrt(q),
      exKurtosis: 6 + (p * p) / q,
      mode: [0],
    },
  };
}

function makeHypergeometric(N: number, K: number, n: number): Dist {
  const lo = Math.max(0, n - (N - K));
  const hi = Math.min(n, K);
  const b = N - K;
  const pp = n / N;
  const qq = (N - n) / N;
  const mean = (n * K) / N;
  const variance = N > 1 ? n * (K / N) * (1 - K / N) * ((N - n) / (N - 1)) : 0;
  const pmf = (k: number) => {
    if (k < lo || k > hi) return 0;
    const p1 = dbinomRaw(k, K, pp, qq);
    const p2 = dbinomRaw(n - k, b, pp, qq);
    const p3 = dbinomRaw(n, N, pp, qq);
    return (p1 * p2) / p3;
  };
  const modeF = Math.floor(((n + 1) * (K + 1)) / (N + 2));
  const modeC = Math.min(Math.max(modeF, lo), hi);
  // Sum pmf away from `k` in the direction of the tail that does not contain the mean.
  const tailSum = (start: number, dir: 1 | -1, limit: number): number => {
    let k = start;
    let term = pmf(k);
    let sum = 0;
    for (let i = 0; i < 5e6; i++) {
      if (k < lo || k > hi) break;
      sum += term;
      // ratio pmf(k+dir)/pmf(k)
      let ratio: number;
      if (dir === 1) ratio = ((K - k) * (n - k)) / ((k + 1) * (N - K - n + k + 1));
      else ratio = (k * (N - K - n + k)) / ((K - k + 1) * (n - k + 1));
      term *= ratio;
      k += dir;
      if (term < sum * 1e-18 && (dir === 1 ? k > limit : k < limit)) break;
    }
    return sum;
  };
  const lowerAt = (k: number): number => {
    // P(X <= k), k integer within [lo, hi)
    if (k >= modeC) return -1;
    return tailSum(k, -1, modeC);
  };
  const dist: Dist = {
    kind: 'discrete',
    lo,
    hi,
    pdf: intOrZero(pmf),
    cdf: (x) => {
      const k = Math.floor(x);
      if (k < lo) return 0;
      if (k >= hi) return 1;
      if (k < modeC) return Math.min(1, lowerAt(k));
      const s = tailSum(k + 1, 1, modeC);
      return Math.max(0, 1 - s);
    },
    sf: (x) => {
      const k = Math.floor(x);
      if (k < lo) return 1;
      if (k >= hi) return 0;
      if (k >= modeC) return Math.min(1, tailSum(k + 1, 1, modeC));
      return Math.max(0, 1 - lowerAt(k));
    },
    quantile: () => NaN,
    stats: {
      mean,
      variance,
      skewness:
        N > 2 && variance > 0
          ? ((N - 2 * K) * Math.sqrt(N - 1) * (N - 2 * n)) /
            (Math.sqrt(n * K * (N - K) * (N - n)) * (N - 2))
          : NaN,
      exKurtosis:
        N > 3 && variance > 0
          ? (((N - 1) * N * N * (N * (N + 1) - 6 * K * (N - K) - 6 * n * (N - n)) +
              6 * n * K * (N - K) * (N - n) * (5 * N - 6)) /
              (n * K * (N - K) * (N - n) * (N - 2) * (N - 3)))
          : NaN,
      mode: lo === hi ? [lo] : [modeC],
    },
  };
  dist.quantile = (p) => discQuantile(dist, p, mean, Math.sqrt(variance));
  return dist;
}

/* ------------------------------------------------------------------ */
/* Registry of distributions                                           */
/* ------------------------------------------------------------------ */

const TRIALS_OPTIONS = (what: string) => [
  { value: 1, label: `Trials (count includes the ${what})` },
  { value: 0, label: `Failures before the ${what}` },
];

export const DIST_SPECS: DistSpec[] = [
  {
    id: 'normal',
    name: 'Normal',
    kind: 'continuous',
    blurb: 'Bell curve with mean μ and standard deviation σ.',
    params: [
      { key: 'mu', label: 'Mean', def: 0 },
      { key: 'sigma', label: 'Std dev', def: 1, min: 0, minExclusive: true },
    ],
    create: (v) => makeNormal(v.mu as number, v.sigma as number),
  },
  {
    id: 't',
    name: "Student's t",
    kind: 'continuous',
    blurb: 'Heavy-tailed bell curve with ν degrees of freedom.',
    params: [{ key: 'nu', label: 'Degrees of freedom', def: 10, min: 0, minExclusive: true, max: 1e9 }],
    create: (v) => makeT(v.nu as number),
  },
  {
    id: 'chisq',
    name: 'Chi-square (χ²)',
    kind: 'continuous',
    blurb: 'Sum of k squared standard normals.',
    params: [{ key: 'k', label: 'Degrees of freedom', def: 5, min: 0, minExclusive: true, max: 1e9 }],
    create: (v) => makeChiSq(v.k as number),
  },
  {
    id: 'f',
    name: 'F',
    kind: 'continuous',
    blurb: 'Ratio of two scaled chi-square variables (d1 and d2 degrees of freedom).',
    params: [
      { key: 'd1', label: 'Numerator df', def: 5, min: 0, minExclusive: true, max: 1e9 },
      { key: 'd2', label: 'Denominator df', def: 10, min: 0, minExclusive: true, max: 1e9 },
    ],
    create: (v) => makeF(v.d1 as number, v.d2 as number),
  },
  {
    id: 'exponential',
    name: 'Exponential',
    kind: 'continuous',
    blurb: 'Waiting time between events at rate λ (mean 1/λ).',
    params: [{ key: 'rate', label: 'Rate', def: 1, min: 0, minExclusive: true }],
    create: (v) => makeExponential(v.rate as number),
  },
  {
    id: 'uniform',
    name: 'Uniform',
    kind: 'continuous',
    blurb: 'Constant density on the interval from the minimum a to the maximum b.',
    params: [
      { key: 'a', label: 'Minimum', def: 0 },
      { key: 'b', label: 'Maximum', def: 1 },
    ],
    validate: (v) => ((v.a as number) < (v.b as number) ? null : 'Minimum a must be less than maximum b.'),
    create: (v) => makeUniform(v.a as number, v.b as number),
  },
  {
    id: 'gamma',
    name: 'Gamma',
    kind: 'continuous',
    blurb: 'Shape k and rate β (scale θ = 1/β); the exponential is shape 1.',
    params: [
      { key: 'shape', label: 'Shape', def: 2, min: 0, minExclusive: true, max: 1e9 },
      { key: 'rate', label: 'Rate', def: 1, min: 0, minExclusive: true },
    ],
    create: (v) => makeGammaRate(v.shape as number, v.rate as number),
  },
  {
    id: 'beta',
    name: 'Beta',
    kind: 'continuous',
    blurb: 'Distribution on [0, 1] with shape parameters α and β.',
    params: [
      { key: 'a', label: 'Shape alpha', def: 2, min: 0, minExclusive: true, max: 1e9 },
      { key: 'b', label: 'Shape beta', def: 5, min: 0, minExclusive: true, max: 1e9 },
    ],
    create: (v) => makeBeta(v.a as number, v.b as number),
  },
  {
    id: 'lognormal',
    name: 'Log-normal',
    kind: 'continuous',
    blurb: 'ln X is normal with mean μ and standard deviation σ.',
    params: [
      { key: 'mu', label: 'Log-mean', def: 0 },
      { key: 'sigma', label: 'Log-std dev', def: 1, min: 0, minExclusive: true },
    ],
    create: (v) => makeLogNormal(v.mu as number, v.sigma as number),
  },
  {
    id: 'binomial',
    name: 'Binomial',
    kind: 'discrete',
    blurb: 'Number of successes in n independent trials, each succeeding with probability p.',
    params: [
      { key: 'n', label: 'Trials', def: 20, min: 1, max: 1e9, integer: true },
      { key: 'p', label: 'Success prob.', def: 0.3, min: 0, max: 1, minExclusive: true, maxExclusive: true },
    ],
    create: (v) => makeBinomial(v.n as number, v.p as number),
  },
  {
    id: 'poisson',
    name: 'Poisson',
    kind: 'discrete',
    blurb: 'Number of events in a fixed interval with mean (and variance) λ.',
    params: [{ key: 'lambda', label: 'Mean', def: 4, min: 0, minExclusive: true, max: 1e8 }],
    create: (v) => makePoisson(v.lambda as number),
  },
  {
    id: 'geometric',
    name: 'Geometric',
    kind: 'discrete',
    blurb: 'Number of trials until the first success (probability p per trial).',
    params: [
      { key: 'p', label: 'Success prob.', def: 0.25, min: 0, max: 1, minExclusive: true, maxExclusive: true },
      { key: 'trials', label: 'Count', def: 1, options: TRIALS_OPTIONS('first success') },
    ],
    create: (v) => shifted(makeGeometricFailures(v.p as number), v.trials === 1 ? 1 : 0),
  },
  {
    id: 'negbinomial',
    name: 'Negative binomial',
    kind: 'discrete',
    blurb: 'Number of trials (or failures) needed to reach r successes.',
    params: [
      { key: 'r', label: 'Successes', def: 3, min: 1, max: 1e9, integer: true },
      { key: 'p', label: 'Success prob.', def: 0.4, min: 0, max: 1, minExclusive: true, maxExclusive: true },
      { key: 'trials', label: 'Count', def: 0, options: TRIALS_OPTIONS('r-th success') },
    ],
    create: (v) =>
      shifted(makeNegBinomialFailures(v.r as number, v.p as number), v.trials === 1 ? (v.r as number) : 0),
  },
  {
    id: 'hypergeometric',
    name: 'Hypergeometric',
    kind: 'discrete',
    blurb: 'Successes among n draws without replacement from N items, K of which are successes.',
    params: [
      { key: 'N', label: 'Population size', def: 50, min: 1, max: 1e9, integer: true },
      { key: 'K', label: 'Successes in population', def: 12, min: 0, max: 1e9, integer: true },
      { key: 'n', label: 'Draws', def: 10, min: 0, max: 1e9, integer: true },
    ],
    validate: (v) => {
      if ((v.K as number) > (v.N as number)) return 'K (successes in population) cannot exceed N.';
      if ((v.n as number) > (v.N as number)) return 'n (draws) cannot exceed N.';
      return null;
    },
    create: (v) => makeHypergeometric(v.N as number, v.K as number, v.n as number),
  },
];

export function getSpec(id: DistId): DistSpec {
  const s = DIST_SPECS.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown distribution ${id}`);
  return s;
}

/** Validate raw parameter strings; returns numbers or an error message. */
export function parseParams(
  spec: DistSpec,
  raw: Record<string, string>
): { ok: true; values: Record<string, number> } | { ok: false; error: string } {
  const values: Record<string, number> = {};
  for (const p of spec.params) {
    const s = (raw[p.key] ?? String(p.def)).trim();
    if (s === '') return { ok: false, error: `${p.label} is required.` };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: `${p.label} must be a number.` };
    if (p.integer && !Number.isInteger(n)) return { ok: false, error: `${p.label} must be a whole number.` };
    if (p.min !== undefined && (p.minExclusive ? n <= p.min : n < p.min)) {
      return {
        ok: false,
        error: `${p.label} must be ${p.minExclusive ? 'greater than' : 'at least'} ${p.min}.`,
      };
    }
    if (p.max !== undefined && (p.maxExclusive ? n >= p.max : n > p.max)) {
      return {
        ok: false,
        error: `${p.label} must be ${p.maxExclusive ? 'less than' : 'at most'} ${p.max}.`,
      };
    }
    values[p.key] = n;
  }
  const bad = spec.validate?.(values);
  if (bad) return { ok: false, error: bad };
  return { ok: true, values };
}

export function createDist(id: DistId, values: Record<string, number>): Dist {
  return getSpec(id).create(values);
}

/* ------------------------------------------------------------------ */
/* Probability queries                                                 */
/* ------------------------------------------------------------------ */

/** P(X < x) */
export function probLess(d: Dist, x: number): number {
  return d.kind === 'discrete' ? d.cdf(Math.ceil(x) - 1) : d.cdf(x);
}
/** P(X >= x) */
export function probGreaterEq(d: Dist, x: number): number {
  return d.kind === 'discrete' ? d.sf(Math.ceil(x) - 1) : d.sf(x);
}

/** P(a <= X <= b), tail-aware to avoid cancellation. */
export function probBetween(d: Dist, a: number, b: number): number {
  if (b < a) return 0;
  const upperPart = probGreaterEq(d, a) - d.sf(b);
  const lowerPart = d.cdf(b) - probLess(d, a);
  const useUpper = d.cdf(b) > 0.5 && probLess(d, a) > 0.5;
  return Math.max(0, useUpper ? upperPart : lowerPart);
}

export type PTail = 'right' | 'left' | 'two';

/** p-value for a test statistic against distribution d. */
export function pValue(d: Dist, stat: number, tail: PTail): number {
  const left = d.cdf(stat);
  const right = d.sf(stat);
  if (tail === 'left') return left;
  if (tail === 'right') return right;
  return Math.min(1, 2 * Math.min(left, right));
}

/* ------------------------------------------------------------------ */
/* Formatting & chart helpers                                          */
/* ------------------------------------------------------------------ */

export function fmtNum(x: number, sig = 6): string {
  if (Number.isNaN(x)) return 'undefined';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  let s: string;
  if (ax < 1e-4 || ax >= 1e12) {
    s = x.toExponential(sig - 1);
    s = s.replace(/\.?0+e/, 'e');
  } else {
    s = x.toPrecision(sig);
    if (s.includes('e')) s = String(Number(s));
    else if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  }
  return s.replace('e+', 'e');
}

/** 1-2-5 nice tick values covering [min, max]. */
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

export interface PlotWindow {
  xmin: number;
  xmax: number;
}

/** A sensible x-window for plotting d, extended to include `include` values. */
export function plotWindow(d: Dist, include: number[] = []): PlotWindow {
  let a: number;
  let b: number;
  if (d.kind === 'discrete') {
    a = d.lo;
    b = d.quantile(0.9995);
    const qa = d.quantile(0.0005);
    a = Math.max(d.lo, qa);
    if (!Number.isFinite(b)) b = a + 10;
  } else {
    const wide = [d.quantile(0.001), d.quantile(0.999)] as const;
    const iqr = d.quantile(0.75) - d.quantile(0.25);
    let lo = wide[0];
    let hi = wide[1];
    if (Number.isFinite(iqr) && iqr > 0 && hi - lo > 14 * iqr) {
      lo = d.quantile(0.01);
      hi = d.quantile(0.99);
    }
    a = Number.isFinite(d.lo) ? d.lo : lo;
    b = Number.isFinite(d.hi) ? d.hi : hi;
    if (Number.isFinite(d.lo) && Number.isFinite(lo)) a = Math.max(d.lo, lo);
    if (Number.isFinite(d.hi) && Number.isFinite(hi)) b = Math.min(d.hi, hi);
    if (!Number.isFinite(a)) a = lo;
    if (!Number.isFinite(b)) b = hi;
    const pad = (b - a) * 0.08;
    if (!Number.isFinite(d.lo) || a - pad >= d.lo) a -= pad;
    else a = d.lo;
    if (!Number.isFinite(d.hi) || b + pad <= d.hi) b += pad;
    else b = d.hi;
  }
  for (const v of include) {
    if (Number.isFinite(v)) {
      const pad = Math.max(Math.abs(b - a) * 0.1, d.kind === 'discrete' ? 1 : 0);
      if (v < a) a = v - pad;
      if (v > b) b = v + pad;
    }
  }
  if (d.kind === 'discrete') {
    a = Math.max(Math.floor(a), Number.isFinite(d.lo) ? d.lo : -Infinity);
    b = Math.ceil(b);
    if (Number.isFinite(d.hi)) b = Math.min(b, d.hi);
    if (b <= a) b = a + 1;
  } else if (!(b > a)) {
    a -= 1;
    b += 1;
  }
  return { xmin: a, xmax: b };
}

