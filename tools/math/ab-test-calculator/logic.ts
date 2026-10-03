/**
 * A/B test statistics: Wilson / Newcombe intervals, two-proportion z-test,
 * chi-square, Fisher's exact test, post-hoc power, Bayesian Beta-Binomial
 * comparison (deterministic numeric integration) and sample-size planning.
 * Pure TypeScript, no dependencies.
 *
 * The special-function block (lgamma, incomplete gamma / beta, erfc, normal
 * quantile) is the same battle-tested code as the probability-distribution
 * calculator, duplicated on purpose so tools stay self-contained.
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
/* Basic helpers                                                       */
/* ------------------------------------------------------------------ */

/** Two-sided standard-normal critical value for a given confidence level, e.g. 0.95 -> 1.95996. */
export function zTwoSided(confidence: number): number {
  return normPpf(1 - (1 - confidence) / 2);
}

export interface Interval {
  lo: number;
  hi: number;
}

/** Wilson score interval for a binomial proportion. */
export function wilson(x: number, n: number, z: number): Interval {
  if (n <= 0) return { lo: NaN, hi: NaN };
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lo: x === 0 ? 0 : Math.max(0, center - half),
    hi: x === n ? 1 : Math.min(1, center + half),
  };
}

/** Newcombe (method 10, Wilson-based) interval for p2 - p1 (here: B minus A). */
export function newcombeDiff(
  xA: number,
  nA: number,
  xB: number,
  nB: number,
  z: number
): Interval {
  const pA = xA / nA;
  const pB = xB / nB;
  const wA = wilson(xA, nA, z);
  const wB = wilson(xB, nB, z);
  const d = pB - pA;
  return {
    lo: d - Math.sqrt((pB - wB.lo) ** 2 + (wA.hi - pA) ** 2),
    hi: d + Math.sqrt((wB.hi - pB) ** 2 + (pA - wA.lo) ** 2),
  };
}

/** Katz log-method interval for the relative risk pB/pA (null when a count is zero). */
export function logRatioCI(
  xA: number,
  nA: number,
  xB: number,
  nB: number,
  z: number
): Interval | null {
  if (xA <= 0 || xB <= 0) return null;
  const rr = xB / nB / (xA / nA);
  const se = Math.sqrt(1 / xB - 1 / nB + 1 / xA - 1 / nA);
  return { lo: rr * Math.exp(-z * se), hi: rr * Math.exp(z * se) };
}

/* ------------------------------------------------------------------ */
/* Frequentist tests                                                   */
/* ------------------------------------------------------------------ */

export interface ZTestResult {
  z: number;
  pTwo: number;
  /** One-sided p for the alternative pB > pA. */
  pGreater: number;
  pooled: number;
  /** false when the pooled rate is 0 or 1, so the statistic is undefined. */
  defined: boolean;
}

export function zTestTwoProportions(xA: number, nA: number, xB: number, nB: number): ZTestResult {
  const pooled = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (!(se > 0)) return { z: NaN, pTwo: 1, pGreater: 1, pooled, defined: false };
  const z = (xB / nB - xA / nA) / se;
  return { z, pTwo: Math.min(1, erfc(Math.abs(z) / SQRT2)), pGreater: normSf(z), pooled, defined: true };
}

export interface ChiSquareResult {
  chi2: number;
  p: number;
  chi2Yates: number;
  pYates: number;
  defined: boolean;
  /** Smallest expected cell count of the 2x2 table. */
  minExpected: number;
}

export function chiSquare2x2(xA: number, nA: number, xB: number, nB: number): ChiSquareResult {
  const a = xA;
  const b = nA - xA;
  const c = xB;
  const d = nB - xB;
  const N = nA + nB;
  const r1 = nA;
  const r2 = nB;
  const c1 = a + c;
  const c2 = b + d;
  const minExpected = Math.min((r1 * c1) / N, (r1 * c2) / N, (r2 * c1) / N, (r2 * c2) / N);
  if (c1 === 0 || c2 === 0) {
    return { chi2: NaN, p: 1, chi2Yates: NaN, pYates: 1, defined: false, minExpected };
  }
  const det = a * d - b * c;
  const denom = r1 * r2 * c1 * c2;
  const chi2 = (N * det * det) / denom;
  const adj = Math.max(0, Math.abs(det) - N / 2);
  const chi2Yates = (N * adj * adj) / denom;
  return {
    chi2,
    p: erfc(Math.sqrt(chi2 / 2)),
    chi2Yates,
    pYates: erfc(Math.sqrt(chi2Yates / 2)),
    defined: true,
    minExpected,
  };
}

export interface FisherResult {
  /** Two-sided: sum of all table probabilities <= the observed one. */
  pTwo: number;
  /** One-sided for the alternative pB > pA. */
  pGreater: number;
  /** Sample odds ratio (B vs A), Infinity / 0 when a cell is zero. */
  oddsRatio: number;
}

/** Hypergeometric pmf P(X = k) for population N, K successes, n draws (Loader). */
function dhyper(k: number, K: number, N: number, n: number): number {
  const p = n / N;
  const q = 1 - p;
  const p1 = dbinomRaw(k, K, p, q);
  const p2 = dbinomRaw(n - k, N - K, p, q);
  const p3 = dbinomRaw(n, N, p, q);
  return (p1 * p2) / p3;
}

export const FISHER_MAX_N = 2_000_000_000;

/** Fisher's exact test for [[xA, nA-xA],[xB, nB-xB]]. */
export function fisherExact(xA: number, nA: number, xB: number, nB: number): FisherResult {
  const N = nA + nB;
  const K = xA + xB;
  const lo = Math.max(0, nA - (N - K));
  const hi = Math.min(nA, K);
  const oddsNum = xB * (nA - xA);
  const oddsDen = (nB - xB) * xA;
  const oddsRatio = oddsDen === 0 ? (oddsNum === 0 ? NaN : Infinity) : oddsNum / oddsDen;
  if (lo === hi) return { pTwo: 1, pGreater: 1, oddsRatio };
  const mode = Math.min(hi, Math.max(lo, Math.floor(((nA + 1) * (K + 1)) / (N + 2))));
  const pm = dhyper(mode, K, N, nA);
  const pObs = dhyper(xA, K, N, nA);
  const cutoff = pObs * (1 + 1e-7);
  let two = 0;
  let cdfObs = 0; // P(X <= xA)
  // walk up from the mode
  let term = pm;
  for (let k = mode, i = 0; k <= hi && i < 5e6; k++, i++) {
    if (term <= cutoff) two += term;
    if (k <= xA) cdfObs += term;
    term *= ((K - k) * (nA - k)) / ((k + 1) * (N - K - nA + k + 1));
    if (term < 1e-320) break;
  }
  term = pm;
  for (let k = mode, i = 0; k > lo && i < 5e6; k--, i++) {
    term *= (k * (N - K - nA + k)) / ((K - k + 1) * (nA - k + 1));
    if (term < 1e-320) break;
    if (term <= cutoff) two += term;
    if (k - 1 <= xA) cdfObs += term;
  }
  return { pTwo: Math.min(1, two), pGreater: Math.min(1, cdfObs), oddsRatio };
}

/** Post-hoc power of the pooled two-proportion z-test at the observed rates. */
export function observedPower(
  xA: number,
  nA: number,
  xB: number,
  nB: number,
  alpha: number,
  sides: 1 | 2
): number {
  return powerForRates(xA / nA, nA, xB / nB, nB, alpha, sides);
}

/** Power of the pooled z-test to detect true rates p1 (n1) vs p2 (n2). */
export function powerForRates(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
  alpha: number,
  sides: 1 | 2
): number {
  const delta = p2 - p1;
  const pbar = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se0 = Math.sqrt(pbar * (1 - pbar) * (1 / n1 + 1 / n2));
  const se1 = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  if (!(se1 > 0)) return delta === 0 ? alpha : 1;
  if (sides === 1) {
    const zc = normPpf(1 - alpha);
    return normCdf((delta - zc * se0) / se1);
  }
  const zc = normPpf(1 - alpha / 2);
  return normCdf((delta - zc * se0) / se1) + normCdf((-delta - zc * se0) / se1);
}

/** Smallest absolute uplift over pA that reaches `power` with the given group sizes. */
export function minDetectableDelta(
  pA: number,
  nA: number,
  nB: number,
  alpha: number,
  power: number,
  sides: 1 | 2
): number {
  if (!(pA > 0 && pA < 1)) return NaN;
  let lo = 0;
  let hi = 1 - pA - 1e-12;
  if (powerForRates(pA, nA, pA + hi, nB, alpha, sides) < power) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (powerForRates(pA, nA, pA + mid, nB, alpha, sides) >= power) hi = mid;
    else lo = mid;
  }
  return hi;
}

/* ------------------------------------------------------------------ */
/* Bayesian Beta-Binomial comparison                                   */
/* ------------------------------------------------------------------ */

export interface BetaPost {
  a: number;
  b: number;
}

/** Posterior of a conversion rate under a Beta(prior, prior) prior. */
export function posterior(conversions: number, visitors: number, prior = 1): BetaPost {
  return { a: prior + conversions, b: prior + visitors - conversions };
}

/** Beta density for a, b >= 1 using Loader's saddle-point form (accurate for huge counts). */
export function betaPdf(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return 0;
  if (a >= 1 && b >= 1) return (a + b - 1) * dbinomRaw(a - 1, a + b - 2, x, 1 - x);
  if (x === 0 || x === 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - lbeta(a, b));
}

export function betaCdf(a: number, b: number, x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : betaIPQ(a, b, x)[0];
}

export function betaSf(a: number, b: number, x: number): number {
  return x <= 0 ? 1 : x >= 1 ? 0 : betaIPQ(a, b, x)[1];
}

export function betaMean(p: BetaPost): number {
  return p.a / (p.a + p.b);
}

export function betaSd(p: BetaPost): number {
  const s = p.a + p.b;
  return Math.sqrt((p.a * p.b) / (s * s * (s + 1)));
}

const GL_X = [
  -0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.755404408355003,
  -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
  0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438,
  0.755404408355003, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499,
];
const GL_W = [
  0.027152459411754095, 0.06225352393864789, 0.09515851168249278, 0.12462897125553388,
  0.14959598881657674, 0.16915651939500254, 0.18260341504492358, 0.1894506104550685,
  0.1894506104550685, 0.18260341504492358, 0.16915651939500254, 0.14959598881657674,
  0.12462897125553388, 0.09515851168249278, 0.06225352393864789, 0.027152459411754095,
];

/** Composite 16-point Gauss-Legendre quadrature. */
function gaussLegendre(f: (x: number) => number, a: number, b: number, panels: number): number {
  const w = (b - a) / panels;
  let total = 0;
  for (let i = 0; i < panels; i++) {
    const mid = a + (i + 0.5) * w;
    const half = w / 2;
    let s = 0;
    for (let j = 0; j < 16; j++) s += (GL_W[j] as number) * f(mid + half * (GL_X[j] as number));
    total += s * half;
  }
  return total;
}

/** Integration window covering essentially all of the mass of a Beta posterior. */
function betaWindow(p: BetaPost): [number, number] {
  const m = betaMean(p);
  const s = betaSd(p);
  return [Math.max(0, m - 40 * s), Math.min(1, m + 40 * s)];
}

const PANELS = 220;

/** P(U > V) for independent U ~ Beta(u), V ~ Beta(v). */
export function probGreater(u: BetaPost, v: BetaPost): number {
  let val: number;
  if (betaSd(u) <= betaSd(v)) {
    const [lo, hi] = betaWindow(u);
    val = gaussLegendre((x) => betaPdf(u.a, u.b, x) * betaCdf(v.a, v.b, x), lo, hi, PANELS);
  } else {
    const [lo, hi] = betaWindow(v);
    val = gaussLegendre((y) => betaPdf(v.a, v.b, y) * betaSf(u.a, u.b, y), lo, hi, PANELS);
  }
  return Math.min(1, Math.max(0, val));
}

/** E[(U - V)+] : expected shortfall of V relative to U (in rate units). */
export function expectedPositiveDiff(u: BetaPost, v: BetaPost): number {
  const mu = betaMean(u);
  const mv = betaMean(v);
  let val: number;
  if (betaSd(u) <= betaSd(v)) {
    const [lo, hi] = betaWindow(u);
    val = gaussLegendre(
      (x) =>
        betaPdf(u.a, u.b, x) *
        (x * betaCdf(v.a, v.b, x) - mv * betaCdf(v.a + 1, v.b, x)),
      lo,
      hi,
      PANELS
    );
  } else {
    const [lo, hi] = betaWindow(v);
    val = gaussLegendre(
      (y) =>
        betaPdf(v.a, v.b, y) *
        (mu * betaSf(u.a + 1, u.b, y) - y * betaSf(u.a, u.b, y)),
      lo,
      hi,
      PANELS
    );
  }
  return Math.max(0, val);
}

export interface BayesResult {
  probBBeatsA: number;
  /** Expected loss (in conversion-rate units) if you ship B and A was actually better. */
  lossChooseB: number;
  /** Expected loss if you keep A and B was actually better. */
  lossChooseA: number;
  postA: BetaPost;
  postB: BetaPost;
}

export function bayesCompare(
  xA: number,
  nA: number,
  xB: number,
  nB: number,
  prior = 1
): BayesResult {
  const postA = posterior(xA, nA, prior);
  const postB = posterior(xB, nB, prior);
  return {
    probBBeatsA: probGreater(postB, postA),
    lossChooseB: expectedPositiveDiff(postA, postB),
    lossChooseA: expectedPositiveDiff(postB, postA),
    postA,
    postB,
  };
}

/* ------------------------------------------------------------------ */
/* Sample size                                                         */
/* ------------------------------------------------------------------ */

export interface SampleSizeInput {
  /** Baseline conversion rate as a fraction (0.10 = 10 %). */
  baseline: number;
  /** Minimum detectable effect: relative fraction (0.2 = +20 %) or absolute fraction (0.02 = 2 pp). */
  mde: number;
  mdeType: 'relative' | 'absolute';
  /** Significance level, e.g. 0.05. */
  alpha: number;
  /** Power, e.g. 0.8. */
  power: number;
  sides: 1 | 2;
  /** Number of variants including the control (>= 2). */
  variants: number;
  /** Apply a Bonferroni correction for (variants - 1) comparisons against the control. */
  bonferroni: boolean;
  /** Visitors per day entering the test across all variants; 0/undefined = unknown. */
  dailyTraffic?: number;
}

export interface SampleSizeResult {
  p1: number;
  p2: number;
  alphaUsed: number;
  zAlpha: number;
  zBeta: number;
  perVariant: number;
  total: number;
  days: number | null;
}

export function sampleSizePerVariant(
  p1: number,
  p2: number,
  alpha: number,
  power: number,
  sides: 1 | 2
): { n: number; zAlpha: number; zBeta: number } {
  const zAlpha = normPpf(1 - (sides === 2 ? alpha / 2 : alpha));
  const zBeta = normPpf(power);
  const pbar = (p1 + p2) / 2;
  const num =
    zAlpha * Math.sqrt(2 * pbar * (1 - pbar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  const n = (num * num) / ((p2 - p1) * (p2 - p1));
  return { n: Math.ceil(n - 1e-9), zAlpha, zBeta };
}

export function computeSampleSize(inp: SampleSizeInput): SampleSizeResult | { error: string } {
  const { baseline, mde, alpha, power } = inp;
  if (!(baseline > 0 && baseline < 1)) return { error: 'Baseline conversion rate must be between 0% and 100% (exclusive).' };
  if (!(mde > 0)) return { error: 'Minimum detectable effect must be greater than 0.' };
  if (!(alpha > 0 && alpha < 1)) return { error: 'Significance level must be between 0 and 1.' };
  if (!(power > 0 && power < 1)) return { error: 'Power must be between 0 and 1.' };
  if (!Number.isInteger(inp.variants) || inp.variants < 2) return { error: 'Number of variants must be a whole number of at least 2 (including the control).' };
  const p2 = inp.mdeType === 'relative' ? baseline * (1 + mde) : baseline + mde;
  if (!(p2 < 1)) {
    return { error: `Baseline plus effect gives a conversion rate of ${(p2 * 100).toFixed(2)}%, which must stay below 100%.` };
  }
  const comparisons = inp.variants - 1;
  const alphaUsed = inp.bonferroni ? alpha / comparisons : alpha;
  const { n, zAlpha, zBeta } = sampleSizePerVariant(baseline, p2, alphaUsed, power, inp.sides);
  if (!Number.isFinite(n)) return { error: 'Could not compute a sample size for these inputs.' };
  const total = n * inp.variants;
  const days = inp.dailyTraffic && inp.dailyTraffic > 0 ? Math.ceil(total / inp.dailyTraffic) : null;
  return { p1: baseline, p2, alphaUsed, zAlpha, zBeta, perVariant: n, total, days };
}

/* ------------------------------------------------------------------ */
/* Significance report for one comparison                              */
/* ------------------------------------------------------------------ */

export interface ComparisonInput {
  xA: number;
  nA: number;
  xB: number;
  nB: number;
  /** Confidence level, e.g. 0.95. */
  confidence: number;
  sides: 1 | 2;
  /** Number of B-type variants compared against A (for Bonferroni). */
  comparisons: number;
  bonferroni: boolean;
}

export interface Comparison {
  pA: number;
  pB: number;
  wilsonA: Interval;
  wilsonB: Interval;
  diff: number;
  diffCI: Interval;
  relUplift: number;
  relCI: Interval | null;
  z: ZTestResult;
  chi: ChiSquareResult;
  fisher: FisherResult | null;
  fisherSkipped: boolean;
  fisherRecommended: boolean;
  /** Which test the verdict uses. */
  primary: 'z' | 'fisher';
  pPrimary: number;
  pZ: number;
  alphaUsed: number;
  ciLevelDiff: number;
  significant: boolean;
  direction: 'better' | 'worse' | 'same';
  power: number;
  mdeDelta: number;
  bayes: BayesResult;
}

export function compare(inp: ComparisonInput): Comparison {
  const { xA, nA, xB, nB, confidence, sides } = inp;
  const alpha = 1 - confidence;
  const alphaUsed = inp.bonferroni && inp.comparisons > 1 ? alpha / inp.comparisons : alpha;
  const zCI = zTwoSided(confidence);
  const ciLevelDiff = 1 - (sides === 2 ? alphaUsed : 2 * alphaUsed);
  const zDiff = zTwoSided(Math.min(0.999999, Math.max(0.5, ciLevelDiff)));
  const pA = xA / nA;
  const pB = xB / nB;
  const z = zTestTwoProportions(xA, nA, xB, nB);
  const chi = chiSquare2x2(xA, nA, xB, nB);
  const tooBig = Math.min(nA, nB) > FISHER_MAX_N || nA + nB > FISHER_MAX_N;
  const fisher = tooBig ? null : fisherExact(xA, nA, xB, nB);
  const fisherRecommended = chi.minExpected < 5 || !chi.defined;
  const primary: 'z' | 'fisher' = fisherRecommended && fisher ? 'fisher' : 'z';
  const pPrimary =
    primary === 'fisher' && fisher
      ? sides === 2
        ? fisher.pTwo
        : fisher.pGreater
      : sides === 2
        ? z.pTwo
        : z.pGreater;
  const significant = pPrimary < alphaUsed;
  const direction: 'better' | 'worse' | 'same' = pB > pA ? 'better' : pB < pA ? 'worse' : 'same';
  const relCI = logRatioCI(xA, nA, xB, nB, zDiff);
  return {
    pA,
    pB,
    wilsonA: wilson(xA, nA, zCI),
    wilsonB: wilson(xB, nB, zCI),
    diff: pB - pA,
    diffCI: newcombeDiff(xA, nA, xB, nB, zDiff),
    relUplift: pA > 0 ? pB / pA - 1 : NaN,
    relCI: relCI ? { lo: relCI.lo - 1, hi: relCI.hi - 1 } : null,
    z,
    chi,
    fisher,
    fisherSkipped: tooBig,
    fisherRecommended,
    primary,
    pPrimary,
    pZ: sides === 2 ? z.pTwo : z.pGreater,
    alphaUsed,
    ciLevelDiff,
    significant,
    direction,
    power: pA > 0 && pA < 1 && pB > 0 && pB < 1 ? observedPower(xA, nA, xB, nB, alphaUsed, sides) : NaN,
    mdeDelta: minDetectableDelta(pA, nA, nB, alphaUsed, 0.8, sides),
    bayes: bayesCompare(xA, nA, xB, nB),
  };
}

/* ------------------------------------------------------------------ */
/* Input parsing & formatting                                          */
/* ------------------------------------------------------------------ */

export function parseCount(raw: string, name: string): number {
  const s = raw.trim().replace(/[,_\s]/g, '');
  if (s === '') throw new Error(`${name} is required.`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  if (!Number.isInteger(n)) throw new Error(`${name} must be a whole number.`);
  if (n < 0) throw new Error(`${name} cannot be negative.`);
  if (n > 1e12) throw new Error(`${name} is too large.`);
  return n;
}

export function fmtPct(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtSigned(x: number, digits = 2, suffix = '%', scale = 100): string {
  if (!Number.isFinite(x)) return '—';
  const v = x * scale;
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 ? '-' : v > 0 ? '+' : ''}${s}${suffix}`;
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 1e-4) return p.toExponential(2);
  if (p >= 0.9995) return '1.000';
  return p.toFixed(p < 0.01 ? 5 : 4);
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
