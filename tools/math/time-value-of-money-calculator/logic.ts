/**
 * Time value of money maths: TVM solver, amortization schedule, NPV / IRR / MIRR / XNPV / XIRR,
 * payback periods and inflation helpers. Pure TypeScript, no dependencies.
 *
 * Sign convention (financial calculator): cash you pay out is negative, cash you receive is positive.
 *   PV * (1+i)^N + PMT * (1 + i*k) * ((1+i)^N - 1) / i + FV = 0       k = 1 for payments at the beginning
 */

// ---------------------------------------------------------------- rates

/** Effective rate per payment period from a nominal annual rate (%), P/Y and C/Y (C/Y = 0 means continuous). */
export function periodRate(iyPct: number, py: number, cy: number): number {
  const r = iyPct / 100;
  if (cy === 0) return Math.expm1(r / py);
  return Math.expm1((cy / py) * Math.log1p(r / cy));
}

/** Inverse of periodRate: nominal annual rate in percent. */
export function nominalRatePct(i: number, py: number, cy: number): number {
  if (cy === 0) return Math.log1p(i) * py * 100;
  return cy * Math.expm1((py / cy) * Math.log1p(i)) * 100;
}

/** Effective annual rate (fraction). */
export function effectiveAnnualRate(iyPct: number, cy: number): number {
  const r = iyPct / 100;
  return cy === 0 ? Math.expm1(r) : Math.expm1(cy * Math.log1p(r / cy));
}

// ---------------------------------------------------------------- generic root finding

/** Brent's method on [a, b] with f(a) and f(b) of opposite sign (or zero). */
export function brent(f: (x: number) => number, a: number, b: number, tol = 1e-14, maxIter = 300): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return NaN;
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 0; iter < maxIter; iter++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    if (Math.abs(d) > tol1) b += d;
    else b += xm >= 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return b;
}

/** Find all sign-change roots of f on [lo, hi] using `steps` samples, refined with Brent. */
export function scanRoots(f: (x: number) => number, lo: number, hi: number, steps: number): number[] {
  const roots: number[] = [];
  let xPrev = lo;
  let fPrev = f(lo);
  if (fPrev === 0) roots.push(lo);
  for (let k = 1; k <= steps; k++) {
    const x = lo + ((hi - lo) * k) / steps;
    const fx = f(x);
    if (Number.isFinite(fx) && Number.isFinite(fPrev)) {
      if (fx === 0) {
        roots.push(x);
      } else if (fPrev !== 0 && fPrev * fx < 0) {
        const r = brent(f, xPrev, x);
        if (Number.isFinite(r)) roots.push(r);
      }
    }
    xPrev = x;
    fPrev = fx;
  }
  return roots;
}

// ---------------------------------------------------------------- TVM equation

export type TvmVar = 'n' | 'iy' | 'pv' | 'pmt' | 'fv';

export interface TvmInput {
  n: number;
  iy: number;
  pv: number;
  pmt: number;
  fv: number;
  py: number;
  cy: number;
  begin: boolean;
}

function growthFactor(i: number, n: number): number {
  return Math.exp(n * Math.log1p(i));
}

/** ((1+i)^n - 1) / i, with the i -> 0 limit n. */
function annuityFactor(i: number, n: number): number {
  if (Math.abs(i) < 1e-12) return n;
  return Math.expm1(n * Math.log1p(i)) / i;
}

export function tvmFutureValue(i: number, n: number, pv: number, pmt: number, begin: boolean): number {
  const k = begin ? 1 : 0;
  return -(pv * growthFactor(i, n) + pmt * (1 + i * k) * annuityFactor(i, n));
}

export function tvmPresentValue(i: number, n: number, pmt: number, fv: number, begin: boolean): number {
  const k = begin ? 1 : 0;
  return -(fv + pmt * (1 + i * k) * annuityFactor(i, n)) / growthFactor(i, n);
}

export function tvmPayment(i: number, n: number, pv: number, fv: number, begin: boolean): number {
  const k = begin ? 1 : 0;
  return -(fv + pv * growthFactor(i, n)) / ((1 + i * k) * annuityFactor(i, n));
}

/** Number of periods (may be fractional). Returns NaN when there is no solution. */
export function tvmPeriods(i: number, pmt: number, pv: number, fv: number, begin: boolean): number {
  const k = begin ? 1 : 0;
  if (Math.abs(i) < 1e-12) {
    if (pmt === 0) return NaN;
    return -(pv + fv) / pmt;
  }
  const a = (pmt * (1 + i * k)) / i;
  const num = a - fv;
  const den = a + pv;
  if (den === 0 || num / den <= 0) return NaN;
  return Math.log(num / den) / Math.log1p(i);
}

/** Residual of the TVM equation, scaled by a positive factor so it never overflows. */
function tvmResidual(i: number, n: number, pv: number, pmt: number, fv: number, k: number): number {
  if (i >= 0) {
    // divide by (1+i)^n
    const v = Math.exp(-n * Math.log1p(i));
    const af = Math.abs(i) < 1e-12 ? n * v : (1 - v) / i;
    return pv + pmt * (1 + i * k) * af + fv * v;
  }
  const g = growthFactor(i, n);
  return pv * g + pmt * (1 + i * k) * annuityFactor(i, n) + fv;
}

export interface RateSolution {
  i: number;
  /** Other per-period rates that also satisfy the equation (rare). */
  others: number[];
  method: 'closed-form' | 'newton' | 'bracketing';
}

/** Solve for the periodic rate i. Newton first, scanning + Brent as the safe fallback. */
export function tvmRate(n: number, pv: number, pmt: number, fv: number, begin: boolean): RateSolution | null {
  const k = begin ? 1 : 0;
  if (n <= 0) return null;
  if (pmt === 0) {
    if (pv === 0 || -fv / pv <= 0) return null;
    return { i: Math.exp(Math.log(-fv / pv) / n) - 1, others: [], method: 'closed-form' };
  }
  const f = (i: number) => tvmResidual(i, n, pv, pmt, fv, k);
  const scale = Math.abs(pv) + Math.abs(pmt) * Math.max(1, n) + Math.abs(fv);

  // Newton from a 10 % annual-ish guess
  let i = 0.01;
  let ok = false;
  for (let iter = 0; iter < 100; iter++) {
    const fi = f(i);
    const h = Math.max(1e-7, Math.abs(i) * 1e-6);
    const d = (f(i + h) - f(i - h)) / (2 * h);
    if (!Number.isFinite(fi) || !Number.isFinite(d) || d === 0) break;
    let next = i - fi / d;
    if (next <= -0.999999) next = (i - 0.999999) / 2;
    if (next > 1e6) break;
    if (Math.abs(next - i) < 1e-15 * Math.max(1, Math.abs(next))) {
      i = next;
      ok = Math.abs(f(i)) <= 1e-9 * Math.max(1, scale);
      break;
    }
    i = next;
  }
  if (ok && i > -0.999999) {
    const roots = bracketRoots(f);
    const others = roots.filter((r) => Math.abs(r - i) > 1e-7);
    return { i, others, method: 'newton' };
  }
  const roots = bracketRoots(f);
  if (roots.length === 0) return null;
  roots.sort((a, b) => Math.abs(a) - Math.abs(b));
  const first = roots[0] as number;
  return { i: first, others: roots.slice(1), method: 'bracketing' };
}

function bracketRoots(f: (i: number) => number): number[] {
  // sample uniformly in u = ln(1+i): i from -99.9 % to ~ +2,000,000 %
  const uLo = Math.log(0.001);
  const uHi = Math.log(20001);
  const g = (u: number) => f(Math.expm1(u));
  const us = scanRoots(g, uLo, uHi, 3000);
  return us.map((u) => Math.expm1(u));
}

export interface TvmSolution {
  variable: TvmVar;
  value: number;
  /** Effective rate per payment period actually used. */
  periodRate: number;
  input: TvmInput;
  warnings: string[];
}

function need(v: number, name: string): number {
  if (!Number.isFinite(v)) throw new Error(`${name} must be a number.`);
  return v;
}

/** Solve for exactly one of N, I/Y, PV, PMT, FV. The value of `target` in `inp` is ignored. */
export function solveTvm(inp: TvmInput, target: TvmVar): TvmSolution {
  const { py, cy, begin } = inp;
  if (!Number.isFinite(py) || py <= 0) throw new Error('Payments per year (P/Y) must be greater than 0.');
  if (!Number.isFinite(cy) || cy < 0) throw new Error('Compounding per year (C/Y) must be 0 (continuous) or greater.');
  const warnings: string[] = [];
  const out: TvmInput = { ...inp };
  if (target !== 'n') {
    need(inp.n, 'N');
    if (inp.n < 0) throw new Error('N (number of periods) cannot be negative.');
  }
  if (target !== 'pv') need(inp.pv, 'PV');
  if (target !== 'pmt') need(inp.pmt, 'PMT');
  if (target !== 'fv') need(inp.fv, 'FV');

  let i: number;
  if (target === 'iy') {
    if (inp.n <= 0) throw new Error('N must be greater than 0 to solve for the rate.');
    if (inp.pv === 0 && inp.pmt === 0) throw new Error('Enter a non-zero PV or PMT to solve for the rate.');
    if (inp.pv === 0 && inp.fv === 0) throw new Error('PV and FV cannot both be zero when solving for the rate.');
    const sol = tvmRate(inp.n, inp.pv, inp.pmt, inp.fv, begin);
    if (!sol) {
      throw new Error(
        'No interest rate satisfies these values. Check the signs: money you pay out must be negative and money you receive positive.'
      );
    }
    i = sol.i;
    if (sol.others.length > 0) {
      warnings.push(
        `More than one rate satisfies the equation (per period: ${[sol.i, ...sol.others]
          .map((r) => (r * 100).toPrecision(6) + '%')
          .join(', ')}); showing the one closest to zero.`
      );
    }
    const iy = nominalRatePct(i, py, cy);
    out.iy = iy;
    return { variable: 'iy', value: iy, periodRate: i, input: out, warnings };
  }

  need(inp.iy, 'I/Y');
  const base = 1 + inp.iy / 100 / (cy === 0 ? 1 : cy);
  if (cy !== 0 && base <= 0) throw new Error('The interest rate is too negative for this compounding frequency.');
  i = periodRate(inp.iy, py, cy);
  if (!Number.isFinite(i) || i <= -1) throw new Error('Invalid interest rate.');

  switch (target) {
    case 'fv': {
      const v = tvmFutureValue(i, inp.n, inp.pv, inp.pmt, begin);
      out.fv = v;
      return { variable: 'fv', value: v, periodRate: i, input: out, warnings };
    }
    case 'pv': {
      const v = tvmPresentValue(i, inp.n, inp.pmt, inp.fv, begin);
      out.pv = v;
      return { variable: 'pv', value: v, periodRate: i, input: out, warnings };
    }
    case 'pmt': {
      if (inp.n === 0) throw new Error('N must be greater than 0 to solve for the payment.');
      const v = tvmPayment(i, inp.n, inp.pv, inp.fv, begin);
      out.pmt = v;
      return { variable: 'pmt', value: v, periodRate: i, input: out, warnings };
    }
    case 'n': {
      const v = tvmPeriods(i, inp.pmt, inp.pv, inp.fv, begin);
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(
          'No number of periods satisfies these values. The payment may be too small to cover the interest, or the signs of PV, PMT and FV are inconsistent (cash out negative, cash in positive).'
        );
      }
      out.n = v;
      return { variable: 'n', value: v, periodRate: i, input: out, warnings };
    }
  }
}

// ---------------------------------------------------------------- schedule

export type ScheduleKind = 'loan' | 'growth';

export interface ScheduleRow {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface Schedule {
  kind: ScheduleKind;
  rows: ScheduleRow[];
  openingBalance: number;
  totalPayments: number;
  totalInterest: number;
  /** True when N is fractional and the last row holds an adjusted final payment. */
  finalAdjusted: boolean;
}

export const MAX_SCHEDULE_ROWS = 12000;

/** Period-by-period balance table. The balance is shown positive (loan balance or account value). */
export function buildSchedule(i: number, n: number, pv: number, pmt: number, fv: number, begin: boolean): Schedule | null {
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SCHEDULE_ROWS) return null;
  const K = Math.ceil(n - 1e-9);
  const fractional = Math.abs(n - Math.round(n)) > 1e-9;
  const bal: number[] = [pv];
  const ints: number[] = [];
  const pays: number[] = [];
  let b = pv;
  for (let k = 1; k <= K; k++) {
    let p = pmt;
    if (fractional && k === K) {
      p = begin ? -fv / (1 + i) - b : -fv - b * (1 + i);
    }
    let interest: number;
    if (begin) {
      interest = (b + p) * i;
      b = b + p + interest;
    } else {
      interest = b * i;
      b = b + interest + p;
    }
    pays.push(p);
    ints.push(interest);
    bal.push(b);
  }
  const sum = bal.reduce((s, x) => s + x, 0);
  const s = sum >= 0 ? 1 : -1;
  const eff = pays.map((p) => s * p);
  const kind: ScheduleKind = eff.reduce((a, x) => a + x, 0) < 0 ? 'loan' : 'growth';
  const rows: ScheduleRow[] = [];
  let totalPayments = 0;
  let totalInterest = 0;
  for (let k = 1; k <= K; k++) {
    const e = eff[k - 1] as number;
    const interest = s * (ints[k - 1] as number);
    const payment = kind === 'loan' ? -e : e;
    const principal = kind === 'loan' ? -e - interest : e + interest;
    rows.push({ period: k, payment, interest, principal, balance: s * (bal[k] as number) });
    totalPayments += Math.abs(payment);
    totalInterest += interest;
  }
  return {
    kind,
    rows,
    openingBalance: s * pv,
    totalPayments,
    totalInterest,
    finalAdjusted: fractional,
  };
}

export function scheduleHeaders(kind: ScheduleKind): string[] {
  return kind === 'loan'
    ? ['Period', 'Payment', 'Interest', 'Principal', 'Balance']
    : ['Period', 'Deposit', 'Interest earned', 'Net growth', 'Balance'];
}

export function scheduleCsv(sch: Schedule, decimals = 2): string {
  const f = (x: number) => x.toFixed(decimals);
  const lines = [scheduleHeaders(sch.kind).join(',')];
  lines.push(`0,,,,${f(sch.openingBalance)}`);
  for (const r of sch.rows) lines.push([r.period, f(r.payment), f(r.interest), f(r.principal), f(r.balance)].join(','));
  return lines.join('\n');
}

// ---------------------------------------------------------------- cash flows

export function npv(rate: number, cfs: number[]): number {
  let s = 0;
  for (let t = 0; t < cfs.length; t++) s += (cfs[t] as number) / Math.pow(1 + rate, t);
  return s;
}

/** Excel's NPV(): the first value is one period away (t = 1). */
export function npvExcel(rate: number, cfs: number[]): number {
  return npv(rate, cfs) / (1 + rate);
}

export function signChanges(cfs: number[]): number {
  let prev = 0;
  let n = 0;
  for (const c of cfs) {
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (prev !== 0 && s !== prev) n++;
    prev = s;
  }
  return n;
}

/**
 * Overflow-safe, sign-faithful scaled value of sum(cf_t * exp(-u * w_t)): the terms are scaled by the
 * largest exponent, which is a positive factor and therefore keeps every sign and zero.
 */
function makeExpSum(cfs: number[], weights: number[]): (u: number) => number {
  const la: number[] = [];
  const sg: number[] = [];
  const w: number[] = [];
  cfs.forEach((c, t) => {
    if (c === 0) return;
    la.push(Math.log(Math.abs(c)));
    sg.push(c > 0 ? 1 : -1);
    w.push(weights[t] as number);
  });
  const ee = new Float64Array(la.length);
  return (u: number) => {
    let m = -Infinity;
    for (let k = 0; k < la.length; k++) {
      const e = (la[k] as number) - u * (w[k] as number);
      ee[k] = e;
      if (e > m) m = e;
    }
    if (!Number.isFinite(m)) return 0;
    let s = 0;
    for (let k = 0; k < la.length; k++) s += (sg[k] as number) * Math.exp((ee[k] as number) - m);
    return s;
  };
}

export interface IrrResult {
  /** Root closest to zero, or null if none in range. */
  rate: number | null;
  roots: number[];
  signChanges: number;
  note: string | null;
}

export const IRR_MIN = -0.99;
export const IRR_MAX = 10;

function findIrrRoots(cfs: number[], weights: number[]): number[] {
  const f = makeExpSum(cfs, weights);
  const us = scanRoots(f, Math.log1p(IRR_MIN), Math.log1p(IRR_MAX), 4000);
  const out: number[] = [];
  for (const u of us) {
    const r = Math.expm1(u);
    if (!out.some((x) => Math.abs(x - r) < 1e-9)) out.push(r);
  }
  return out.sort((a, b) => a - b);
}

function irrFromRoots(cfs: number[], roots: number[]): IrrResult {
  const sc = signChanges(cfs);
  let note: string | null = null;
  if (sc === 0) note = 'The cash flows never change sign, so there is no IRR.';
  else if (roots.length === 0) note = 'No IRR was found between -99 % and 1000 %.';
  else if (sc > 1 || roots.length > 1)
    note = `The cash flows change sign ${sc} times, so more than one IRR is possible${
      roots.length > 1 ? ` (${roots.length} found)` : ''
    }. Use NPV and judgement rather than IRR alone.`;
  let rate: number | null = null;
  for (const r of roots) if (rate === null || Math.abs(r) < Math.abs(rate)) rate = r;
  return { rate, roots, signChanges: sc, note };
}

/** All IRRs in [-99 %, 1000 %]; `rate` is the root closest to zero (as in numpy-financial). */
export function irr(cfs: number[]): IrrResult {
  const sc = signChanges(cfs);
  if (sc === 0) return irrFromRoots(cfs, []);
  const weights = cfs.map((_, t) => t);
  return irrFromRoots(cfs, findIrrRoots(cfs, weights));
}

export function mirr(cfs: number[], financeRate: number, reinvestRate: number): number {
  const n = cfs.length;
  if (n < 2) return NaN;
  const pos = cfs.map((c) => (c > 0 ? c : 0));
  const neg = cfs.map((c) => (c < 0 ? c : 0));
  const numer = Math.abs(npv(reinvestRate, pos));
  const denom = Math.abs(npv(financeRate, neg));
  if (numer === 0 || denom === 0) return NaN;
  return Math.pow(numer / denom, 1 / (n - 1)) * (1 + reinvestRate) - 1;
}

/** PV of the future flows divided by the initial outlay; null if CF0 is not an outlay. */
export function profitabilityIndex(rate: number, cfs: number[]): number | null {
  const c0 = cfs[0] ?? 0;
  if (c0 >= 0) return null;
  let pv = 0;
  for (let t = 1; t < cfs.length; t++) pv += (cfs[t] as number) / Math.pow(1 + rate, t);
  return pv / -c0;
}

/** Fractional payback period (in periods) from cumulative flows; null when never recovered. */
export function paybackPeriod(flows: number[]): number | null {
  let cum = 0;
  let negSeen = false;
  for (let t = 0; t < flows.length; t++) {
    const c = flows[t] as number;
    const prev = cum;
    cum += c;
    if (cum < 0) {
      negSeen = true;
    } else if (negSeen) {
      return t - 1 + -prev / c;
    }
  }
  return negSeen ? null : 0;
}

export function discountedPayback(rate: number, cfs: number[]): number | null {
  return paybackPeriod(cfs.map((c, t) => c / Math.pow(1 + rate, t)));
}

export interface CashFlowRow {
  t: number;
  cf: number;
  discounted: number;
  cumulative: number;
  cumulativeDiscounted: number;
}

export function cashFlowTable(rate: number, cfs: number[]): CashFlowRow[] {
  let cum = 0;
  let cumD = 0;
  return cfs.map((cf, t) => {
    const d = cf / Math.pow(1 + rate, t);
    cum += cf;
    cumD += d;
    return { t, cf, discounted: d, cumulative: cum, cumulativeDiscounted: cumD };
  });
}

export function npvCurve(cfs: number[], lo: number, hi: number, points: number): { rate: number; npv: number }[] {
  const out: { rate: number; npv: number }[] = [];
  for (let k = 0; k <= points; k++) {
    const r = lo + ((hi - lo) * k) / points;
    out.push({ rate: r, npv: npv(r, cfs) });
  }
  return out;
}

// ---------------------------------------------------------------- dated cash flows (XNPV / XIRR)

/** Days since 1970-01-01 (UTC) for ISO (YYYY-MM-DD, YYYY/M/D), US (M/D/YYYY) or D.M.YYYY dates; NaN if invalid. */
export function parseDateDays(s: string): number {
  const t = s.trim();
  let y: number;
  let m: number;
  let d: number;
  let mt = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (mt) {
    y = Number(mt[1]);
    m = Number(mt[2]);
    d = Number(mt[3]);
  } else if ((mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) {
    m = Number(mt[1]);
    d = Number(mt[2]);
    y = Number(mt[3]);
  } else if ((mt = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t))) {
    d = Number(mt[1]);
    m = Number(mt[2]);
    y = Number(mt[3]);
  } else {
    return NaN;
  }
  const ms = Date.UTC(y, m - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return NaN;
  return Math.round(ms / 86400000);
}

export function formatDateDays(days: number): string {
  return new Date(days * 86400000).toISOString().slice(0, 10);
}

/** XNPV with an Actual/365 day count, relative to the first date. */
export function xnpv(rate: number, cfs: number[], days: number[]): number {
  const d0 = days[0] as number;
  let s = 0;
  for (let k = 0; k < cfs.length; k++) s += (cfs[k] as number) / Math.pow(1 + rate, ((days[k] as number) - d0) / 365);
  return s;
}

export function xirr(cfs: number[], days: number[]): IrrResult {
  const sc = signChanges(cfs);
  if (sc === 0) return irrFromRoots(cfs, []);
  const d0 = days[0] as number;
  const weights = days.map((d) => (d - d0) / 365);
  return irrFromRoots(cfs, findIrrRoots(cfs, weights));
}

// ---------------------------------------------------------------- parsing cash flow text

export interface ParsedFlows {
  values: number[];
  days: number[] | null;
}

function parseAmountToken(tok: string): number {
  let t = tok.trim().replace(/[$€£¥₹_]/g, '');
  if (t === '') return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
  const n = Number(t);
  return neg ? -n : n;
}

/** Parse "one amount per line / comma / space" or, with dated=true, one "date amount" pair per line. */
export function parseCashFlows(text: string, dated: boolean): ParsedFlows {
  const values: number[] = [];
  if (!dated) {
    const toks = text.split(/[\s,;]+/).filter((x) => x.length > 0);
    for (const tok of toks) {
      const v = parseAmountToken(tok);
      if (Number.isNaN(v)) throw new Error(`Could not read "${tok}" as a number.`);
      values.push(v);
    }
    return { values, days: null };
  }
  const days: number[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  for (const line of lines) {
    const toks = line.split(/[\s,;\t]+/).filter((x) => x.length > 0);
    if (toks.length !== 2) throw new Error(`Line "${line}": expected a date and an amount.`);
    const [a, b] = toks as [string, string];
    let day = parseDateDays(a);
    let amt: number;
    if (Number.isNaN(day)) {
      day = parseDateDays(b);
      amt = parseAmountToken(a);
    } else {
      amt = parseAmountToken(b);
    }
    if (Number.isNaN(day)) throw new Error(`Line "${line}": no valid date (use YYYY-MM-DD or M/D/YYYY).`);
    if (Number.isNaN(amt)) throw new Error(`Line "${line}": could not read the amount.`);
    days.push(day);
    values.push(amt);
  }
  return { values, days };
}

// ---------------------------------------------------------------- inflation

export interface InflationInput {
  amount: number;
  years: number;
  ratePct: number;
}

export interface InflationResult {
  /** What the basket costing `amount` today costs after `years`. */
  futureCost: number;
  /** What `amount` held after `years` can buy, in today's money. */
  purchasingPower: number;
  /** Fraction of purchasing power lost (0..1). */
  powerLost: number;
  factor: number;
}

export function inflationEffect(inp: InflationInput): InflationResult {
  const factor = Math.pow(1 + inp.ratePct / 100, inp.years);
  return {
    futureCost: inp.amount * factor,
    purchasingPower: inp.amount / factor,
    powerLost: 1 - 1 / factor,
    factor,
  };
}

/** Fisher equation: (1 + nominal) = (1 + real)(1 + inflation). All values are fractions. */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}
export function nominalReturn(real: number, inflation: number): number {
  return (1 + real) * (1 + inflation) - 1;
}
export function impliedInflation(nominal: number, real: number): number {
  return (1 + nominal) / (1 + real) - 1;
}

export interface InflationRow {
  year: number;
  priceLevel: number;
  purchasingPower: number;
  nominalValue: number;
  realValue: number;
}

export function inflationTable(amount: number, years: number, inflationPct: number, nominalPct: number): InflationRow[] {
  const rows: InflationRow[] = [];
  const whole = Math.floor(years + 1e-9);
  const ys = Array.from({ length: whole + 1 }, (_, y) => y);
  if (Math.abs(years - whole) > 1e-9) ys.push(years);
  for (const y of ys) {
    const f = Math.pow(1 + inflationPct / 100, y);
    const nominalValue = amount * Math.pow(1 + nominalPct / 100, y);
    rows.push({ year: y, priceLevel: amount * f, purchasingPower: amount / f, nominalValue, realValue: nominalValue / f });
  }
  return rows;
}

// ---------------------------------------------------------------- formatting

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD - US dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - Pound sterling' },
  { code: 'CAD', label: 'CAD - Canadian dollar' },
  { code: 'AUD', label: 'AUD - Australian dollar' },
  { code: 'NZD', label: 'NZD - New Zealand dollar' },
  { code: 'INR', label: 'INR - Indian rupee' },
  { code: 'JPY', label: 'JPY - Japanese yen' },
  { code: 'CNY', label: 'CNY - Chinese yuan' },
  { code: 'CHF', label: 'CHF - Swiss franc' },
  { code: 'SEK', label: 'SEK - Swedish krona' },
  { code: 'NOK', label: 'NOK - Norwegian krone' },
  { code: 'DKK', label: 'DKK - Danish krone' },
  { code: 'PLN', label: 'PLN - Polish zloty' },
  { code: 'MXN', label: 'MXN - Mexican peso' },
  { code: 'BRL', label: 'BRL - Brazilian real' },
  { code: 'ZAR', label: 'ZAR - South African rand' },
  { code: 'SGD', label: 'SGD - Singapore dollar' },
  { code: 'HKD', label: 'HKD - Hong Kong dollar' },
  { code: 'KRW', label: 'KRW - South Korean won' },
  { code: 'AED', label: 'AED - UAE dirham' },
];

const moneyCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '-';
  let f = moneyCache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    } catch {
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    moneyCache.set(currency, f);
  }
  return f.format(value);
}

export function formatNumber(value: number, maxFrac = 4): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac }).format(value);
}

/** Percent from a fraction. */
export function formatPctFrac(fraction: number, maxFrac = 4): string {
  if (!Number.isFinite(fraction)) return '-';
  return `${formatNumber(fraction * 100, maxFrac)}%`;
}

export function parseNum(raw: string): number {
  const t = raw.trim().replace(/[\s_]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
