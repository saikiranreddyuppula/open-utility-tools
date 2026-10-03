/**
 * Salary <-> hourly pay conversion maths. Pure, framework-free, gross pay only (no taxes).
 *
 * Model
 *  - Everything is anchored on the base hourly rate. Weekly and bi-weekly figures are "pay for a worked
 *    week / pair of weeks"; monthly, semi-monthly and quarterly figures are the annual amount divided by
 *    12, 24 and 4. With 52 paid weeks this gives the familiar annual / 26 for bi-weekly.
 *  - Paid time off (salaried / paid holidays + vacation): annual pay covers every scheduled hour.
 *  - Unpaid time off: days off are not paid, so annual pay covers only the hours actually worked.
 *  - Overtime applies to hourly input only: hours per week above the threshold are paid at the multiplier.
 */

export type Period =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly (every 2 weeks)' },
  { id: 'semimonthly', label: 'Semi-monthly (twice a month)' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annual', label: 'Annual' },
];

export const PERIOD_SHORT: Record<Period, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export interface Schedule {
  hoursPerWeek: number;
  daysPerWeek: number;
  weeksPerYear: number;
  paidHolidays: number;
  vacationDays: number;
  /** true: days off are unpaid (reduces pay). false: paid time off (salaried). */
  unpaidTimeOff: boolean;
  /** Hours per week above which overtime applies (hourly input only). */
  overtimeThreshold: number;
  overtimeMultiplier: number;
}

export const DEFAULT_SCHEDULE: Schedule = {
  hoursPerWeek: 40,
  daysPerWeek: 5,
  weeksPerYear: 52,
  paidHolidays: 0,
  vacationDays: 0,
  unpaidTimeOff: false,
  overtimeThreshold: 40,
  overtimeMultiplier: 1.5,
};

export function validateSchedule(s: Schedule): string | null {
  if (!Number.isFinite(s.hoursPerWeek) || s.hoursPerWeek <= 0 || s.hoursPerWeek > 168)
    return 'Hours per week must be between 0 and 168.';
  if (!Number.isFinite(s.daysPerWeek) || s.daysPerWeek <= 0 || s.daysPerWeek > 7)
    return 'Days per week must be between 0 and 7.';
  if (s.hoursPerWeek / s.daysPerWeek > 24) return 'That schedule needs more than 24 hours in a day.';
  if (!Number.isFinite(s.weeksPerYear) || s.weeksPerYear <= 0 || s.weeksPerYear > 53)
    return 'Weeks per year must be between 0 and 53.';
  if (!Number.isFinite(s.paidHolidays) || s.paidHolidays < 0) return 'Holidays must be 0 or more days.';
  if (!Number.isFinite(s.vacationDays) || s.vacationDays < 0) return 'Vacation days must be 0 or more.';
  if (s.paidHolidays + s.vacationDays >= s.daysPerWeek * s.weeksPerYear)
    return 'Holidays + vacation days must be fewer than the working days in the year.';
  if (!Number.isFinite(s.overtimeThreshold) || s.overtimeThreshold <= 0)
    return 'Overtime threshold must be greater than 0.';
  if (!Number.isFinite(s.overtimeMultiplier) || s.overtimeMultiplier < 1)
    return 'Overtime multiplier must be at least 1.';
  return null;
}

export interface PayBreakdown {
  /** Base hourly rate. */
  rate: number;
  amounts: Record<Period, number>;
  hoursPerWeek: number;
  hoursPerDay: number;
  regularHoursWeek: number;
  overtimeHoursWeek: number;
  /** Gross for a worked week including overtime premium. */
  weeklyGross: number;
  timeOffDays: number;
  /** Scheduled hours in the year (hours/week x weeks/year). */
  scheduledHoursYear: number;
  /** Hours actually worked in the year (scheduled minus time off). */
  hoursWorkedYear: number;
  /** Hours the annual pay is computed over. */
  hoursPaidYear: number;
  annual: number;
  /** Annual gross / hours actually worked. */
  effectiveHourly: number;
  overtimeApplied: boolean;
}

function dayCount(s: Schedule): number {
  return s.paidHolidays + s.vacationDays;
}

/** Convert an amount in `period` into a full breakdown. Throws on invalid inputs. */
export function computePay(amount: number, period: Period, s: Schedule): PayBreakdown {
  const err = validateSchedule(s);
  if (err) throw new Error(err);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a pay amount of 0 or more.');

  const hpw = s.hoursPerWeek;
  const hpd = hpw / s.daysPerWeek;
  const off = dayCount(s);
  const scheduledHoursYear = hpw * s.weeksPerYear;
  const hoursWorkedYear = scheduledHoursYear - off * hpd;
  const hoursPaidYear = s.unpaidTimeOff ? hoursWorkedYear : scheduledHoursYear;

  const overtimeApplied = period === 'hourly' && hpw > s.overtimeThreshold;
  const regularHoursWeek = overtimeApplied ? s.overtimeThreshold : hpw;
  const overtimeHoursWeek = overtimeApplied ? hpw - s.overtimeThreshold : 0;
  const weekFactor = regularHoursWeek + overtimeHoursWeek * s.overtimeMultiplier;

  let rate: number;
  switch (period) {
    case 'hourly':
      rate = amount;
      break;
    case 'daily':
      rate = amount / hpd;
      break;
    case 'weekly':
      rate = amount / hpw;
      break;
    case 'biweekly':
      rate = amount / (2 * hpw);
      break;
    case 'semimonthly':
      rate = (amount * 24) / hoursPaidYear;
      break;
    case 'monthly':
      rate = (amount * 12) / hoursPaidYear;
      break;
    case 'quarterly':
      rate = (amount * 4) / hoursPaidYear;
      break;
    case 'annual':
      rate = amount / hoursPaidYear;
      break;
  }

  const weeklyGross = overtimeApplied ? rate * weekFactor : rate * hpw;
  const dailyGross = weeklyGross / s.daysPerWeek;
  const annual = s.unpaidTimeOff
    ? weeklyGross * s.weeksPerYear - off * dailyGross
    : weeklyGross * s.weeksPerYear;

  const amounts: Record<Period, number> = {
    hourly: rate,
    daily: dailyGross,
    weekly: weeklyGross,
    biweekly: weeklyGross * 2,
    semimonthly: annual / 24,
    monthly: annual / 12,
    quarterly: annual / 4,
    annual,
  };

  return {
    rate,
    amounts,
    hoursPerWeek: hpw,
    hoursPerDay: hpd,
    regularHoursWeek,
    overtimeHoursWeek,
    weeklyGross,
    timeOffDays: off,
    scheduledHoursYear,
    hoursWorkedYear,
    hoursPaidYear,
    annual,
    effectiveHourly: annual / hoursWorkedYear,
    overtimeApplied,
  };
}

// ---------------------------------------------------------------- raise

export interface RaiseRow {
  period: Period;
  current: number;
  next: number;
  diff: number;
  pct: number;
}

export interface RaiseResult {
  current: PayBreakdown;
  next: PayBreakdown;
  newAmount: number;
  rows: RaiseRow[];
  effectivePct: number;
}

export function computeRaise(
  amount: number,
  period: Period,
  raise: { type: 'percent' | 'amount'; value: number },
  s: Schedule
): RaiseResult {
  if (!Number.isFinite(raise.value)) throw new Error('Enter a raise value.');
  const newAmount = raise.type === 'percent' ? amount * (1 + raise.value / 100) : amount + raise.value;
  if (newAmount < 0) throw new Error('The new pay would be negative.');
  const current = computePay(amount, period, s);
  const next = computePay(newAmount, period, s);
  const rows: RaiseRow[] = PERIODS.map(({ id }) => {
    const c = current.amounts[id];
    const n = next.amounts[id];
    return { period: id, current: c, next: n, diff: n - c, pct: c === 0 ? 0 : ((n - c) / c) * 100 };
  });
  return {
    current,
    next,
    newAmount,
    rows,
    effectivePct: amount === 0 ? 0 : ((newAmount - amount) / amount) * 100,
  };
}

// ---------------------------------------------------------------- offers

export interface OfferInput {
  amount: number;
  period: Period;
  schedule: Schedule;
  /** Extra annual cash compensation (bonus etc.). */
  bonus: number;
}

export interface OfferResult {
  pay: PayBreakdown;
  bonus: number;
  /** Annual base + bonus. */
  totalAnnual: number;
  /** Total annual / paid hours. */
  hourlyEquivalent: number;
  /** Total annual / hours actually worked. */
  effectiveHourly: number;
  monthlyEquivalent: number;
}

export function evaluateOffer(o: OfferInput): OfferResult {
  if (!Number.isFinite(o.bonus) || o.bonus < 0) throw new Error('Bonus must be 0 or more.');
  const pay = computePay(o.amount, o.period, o.schedule);
  const totalAnnual = pay.annual + o.bonus;
  return {
    pay,
    bonus: o.bonus,
    totalAnnual,
    hourlyEquivalent: totalAnnual / pay.hoursPaidYear,
    effectiveHourly: totalAnnual / pay.hoursWorkedYear,
    monthlyEquivalent: totalAnnual / 12,
  };
}

export interface OfferComparison {
  a: OfferResult;
  b: OfferResult;
  diffAnnual: number;
  diffPct: number;
  diffHourly: number;
  diffEffective: number;
  diffMonthly: number;
  diffHoursWorked: number;
}

export function compareOffers(a: OfferInput, b: OfferInput): OfferComparison {
  const ra = evaluateOffer(a);
  const rb = evaluateOffer(b);
  return {
    a: ra,
    b: rb,
    diffAnnual: rb.totalAnnual - ra.totalAnnual,
    diffPct: ra.totalAnnual === 0 ? 0 : ((rb.totalAnnual - ra.totalAnnual) / ra.totalAnnual) * 100,
    diffHourly: rb.hourlyEquivalent - ra.hourlyEquivalent,
    diffEffective: rb.effectiveHourly - ra.effectiveHourly,
    diffMonthly: rb.monthlyEquivalent - ra.monthlyEquivalent,
    diffHoursWorked: rb.pay.hoursWorkedYear - ra.pay.hoursWorkedYear,
  };
}

// ---------------------------------------------------------------- freelance

export interface FreelanceInput {
  /** Gross income the freelancer wants to take out of the business. */
  targetIncome: number;
  /** Annual business expenses (software, insurance, equipment ...). */
  expenses: number;
  /** Hours worked per week (billable + admin). */
  hoursPerWeek: number;
  daysPerWeek: number;
  /** Share of working hours that are billable, 1..100. */
  utilizationPct: number;
  /** Weeks per year not worked (vacation, holidays, sick). */
  weeksOff: number;
}

export interface FreelanceResult {
  revenueNeeded: number;
  workingWeeks: number;
  billableHoursWeek: number;
  billableHoursYear: number;
  billableDaysYear: number;
  hourlyRate: number;
  dayRate: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  /** Hourly rate of an employee paid the target income for the same hours worked, for reference. */
  employeeEquivalentHourly: number;
}

export function freelanceRate(i: FreelanceInput): FreelanceResult {
  if (!Number.isFinite(i.targetIncome) || i.targetIncome < 0) throw new Error('Target income must be 0 or more.');
  if (!Number.isFinite(i.expenses) || i.expenses < 0) throw new Error('Business expenses must be 0 or more.');
  if (!Number.isFinite(i.hoursPerWeek) || i.hoursPerWeek <= 0 || i.hoursPerWeek > 168)
    throw new Error('Hours per week must be between 0 and 168.');
  if (!Number.isFinite(i.daysPerWeek) || i.daysPerWeek <= 0 || i.daysPerWeek > 7)
    throw new Error('Days per week must be between 0 and 7.');
  if (!Number.isFinite(i.utilizationPct) || i.utilizationPct <= 0 || i.utilizationPct > 100)
    throw new Error('Utilization must be between 0 and 100 %.');
  if (!Number.isFinite(i.weeksOff) || i.weeksOff < 0 || i.weeksOff >= 52)
    throw new Error('Weeks off must be between 0 and 51.');
  const workingWeeks = 52 - i.weeksOff;
  const util = i.utilizationPct / 100;
  const billableHoursWeek = i.hoursPerWeek * util;
  const billableHoursYear = billableHoursWeek * workingWeeks;
  const billableDaysYear = i.daysPerWeek * util * workingWeeks;
  const revenueNeeded = i.targetIncome + i.expenses;
  return {
    revenueNeeded,
    workingWeeks,
    billableHoursWeek,
    billableHoursYear,
    billableDaysYear,
    hourlyRate: revenueNeeded / billableHoursYear,
    dayRate: revenueNeeded / billableDaysYear,
    weeklyRevenue: revenueNeeded / 52,
    monthlyRevenue: revenueNeeded / 12,
    employeeEquivalentHourly: i.targetIncome / (i.hoursPerWeek * workingWeeks),
  };
}

// ---------------------------------------------------------------- formatting / parsing

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
  { code: 'CZK', label: 'CZK - Czech koruna' },
  { code: 'MXN', label: 'MXN - Mexican peso' },
  { code: 'BRL', label: 'BRL - Brazilian real' },
  { code: 'ZAR', label: 'ZAR - South African rand' },
  { code: 'SGD', label: 'SGD - Singapore dollar' },
  { code: 'HKD', label: 'HKD - Hong Kong dollar' },
  { code: 'KRW', label: 'KRW - South Korean won' },
  { code: 'AED', label: 'AED - UAE dirham' },
  { code: 'TRY', label: 'TRY - Turkish lira' },
];

const fmtCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let f = fmtCache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    } catch {
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    fmtCache.set(currency, f);
  }
  return f;
}

export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '-';
  return currencyFormatter(currency).format(value);
}

/** Signed money with an explicit + for positive differences. */
export function formatMoneyDiff(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '-';
  const s = currencyFormatter(currency).format(Math.abs(value));
  if (Math.abs(value) < 0.005) return s;
  return (value > 0 ? '+' : '-') + s;
}

export function formatNumber(value: number, maxFrac = 2): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac }).format(value);
}

export function formatPct(value: number, maxFrac = 2): string {
  if (!Number.isFinite(value)) return '-';
  const s = new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac }).format(Math.abs(value));
  if (Math.abs(value) < 0.005) return `${s}%`;
  return `${value > 0 ? '+' : '-'}${s}%`;
}

/** Strict-ish number parser: accepts thousands separators like "52,000". Returns NaN for blank/invalid. */
export function parseAmount(raw: string): number {
  const t = raw.trim().replace(/[\s_]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
