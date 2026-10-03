/**
 * Pure RFC 5545 (iCalendar) generation helpers: escaping, line folding, recurrence rules and
 * occurrence expansion, VTIMEZONE generation derived from Intl, and calendar deep links.
 * Framework-free so it can be unit-tested.
 */

export const FLOATING = 'floating';
export const PRODID = '-//Open Utility Tools//Calendar Event Generator//EN';

export type Freq = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type MonthlyMode = 'dayOfMonth' | 'nthWeekday';
export type EndMode = 'never' | 'count' | 'until';
export type EventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
export type Transp = 'OPAQUE' | 'TRANSPARENT';
export type ReminderUnit = 'minutes' | 'hours' | 'days' | 'weeks';
export type TimeMode = 'allday' | 'utc' | 'tzid' | 'floating';

export interface Reminder {
  amount: number;
  unit: ReminderUnit;
}

export interface Attendee {
  name: string;
  email: string;
  rsvp: boolean;
}

export interface RecurrenceSpec {
  freq: Freq;
  interval: number;
  /** Weekly: 0 = Sunday … 6 = Saturday. Empty means "the weekday of the start date". */
  byDay: number[];
  monthlyMode: MonthlyMode;
  /** Monthly day-of-month: 0 = same day as the start date, -1 = last day, 1..31. */
  monthDay: number;
  /** Monthly/yearly nth weekday: 1..4 or -1 (last). */
  nth: number;
  /** 0..6 = a specific weekday, 7 = "weekday" (Mon-Fri). */
  nthWeekday: number;
  endMode: EndMode;
  count: number;
  /** Inclusive last day, YYYY-MM-DD. */
  until: string;
}

export interface IcsEvent {
  uid: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** For all-day events this is the LAST day (inclusive); DTEND is written as the day after. */
  endDate: string;
  endTime: string;
  tz: string;
  location: string;
  description: string;
  url: string;
  organizerName: string;
  organizerEmail: string;
  attendees: Attendee[];
  status: EventStatus;
  transp: Transp;
  reminders: Reminder[];
  recurrence: RecurrenceSpec;
}

export interface Issue {
  level: 'error' | 'warning';
  eventIndex: number | null;
  message: string;
}

export interface GenerateOptions {
  /** Prefer UTC (`Z`) times for non-recurring timed events. */
  utc: boolean;
  now?: Date;
}

export interface GenerateResult {
  ics: string;
  issues: Issue[];
  /** Resolved time mode per event, with an optional explanation when it differs from the preference. */
  modes: { mode: TimeMode; reason?: string }[];
}

export function defaultRecurrence(): RecurrenceSpec {
  return {
    freq: 'NONE',
    interval: 1,
    byDay: [],
    monthlyMode: 'dayOfMonth',
    monthDay: 0,
    nth: 1,
    nthWeekday: 1,
    endMode: 'never',
    count: 10,
    until: '',
  };
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                      */
/* ------------------------------------------------------------------ */

const pad = (n: number, w = 2): string => String(Math.abs(Math.trunc(n))).padStart(w, '0');

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

export interface HM {
  h: number;
  mi: number;
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeap(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Days since 1970-01-01 for a proleptic Gregorian civil date. */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(z0: number): YMD {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfDays(days: number): number {
  return (((days + 4) % 7) + 7) % 7;
}

export function parseDate(s: string): YMD | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function parseTime(s: string): HM | null {
  const mt = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!mt) return null;
  const h = Number(mt[1]);
  const mi = Number(mt[2]);
  if (h > 23 || mi > 59) return null;
  return { h, mi };
}

export function formatYmd(v: YMD): string {
  return `${pad(v.y, 4)}-${pad(v.m)}-${pad(v.d)}`;
}

function ymdCompact(v: YMD): string {
  return `${pad(v.y, 4)}${pad(v.m)}${pad(v.d)}`;
}

function localStamp(v: YMD, t: HM, sec = 0): string {
  return `${ymdCompact(v)}T${pad(t.h)}${pad(t.mi)}${pad(sec)}`;
}

function utcStamp(ms: number): string {
  const dt = new Date(ms);
  return (
    `${pad(dt.getUTCFullYear(), 4)}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function isoDow(wd: number): number {
  return (wd + 6) % 7; // Monday = 0
}

/* ------------------------------------------------------------------ */
/* Text escaping & folding                                              */
/* ------------------------------------------------------------------ */

const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function sanitize(s: string): string {
  return s.replace(LONE_SURROGATE_RE, '�').replace(CONTROL_RE, '');
}

/** Escape a TEXT value per RFC 5545 §3.3.11: backslash, semicolon, comma and newlines. */
export function escapeText(s: string): string {
  return sanitize(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Parameter value: DQUOTE-wrap when it contains `;` `:` `,`; double quotes are not allowed in values. */
export function escapeParam(s: string): string {
  const v = sanitize(s).replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
  return /[;:,]/.test(v) ? `"${v}"` : v;
}

function utf8Len(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * Fold a content line so no physical line exceeds 75 octets (excluding CRLF). Continuation
 * lines start with one space (which counts toward the 75). Multi-byte characters, surrogate
 * pairs and `\x` escape pairs are never split.
 */
export function foldLine(line: string, limit = 75): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  const chars = Array.from(line);
  for (let i = 0; i < chars.length; i++) {
    let unit = chars[i] ?? '';
    if (unit === '\\' && i + 1 < chars.length) {
      unit += chars[i + 1] ?? '';
      i++;
    }
    let n = 0;
    for (const c of unit) n += utf8Len(c.codePointAt(0) ?? 0);
    if (bytes + n > limit && cur.length > 0 && cur !== ' ') {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += unit;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function utf8Bytes(s: string): number {
  let n = 0;
  for (const c of s) n += utf8Len(c.codePointAt(0) ?? 0);
  return n;
}

function prop(name: string, value: string, params: [string, string][] = []): string {
  const p = params.map(([k, v]) => `;${k}=${v}`).join('');
  return `${name}${p}:${value}`;
}

/* ------------------------------------------------------------------ */
/* Time zones via Intl                                                  */
/* ------------------------------------------------------------------ */

const OFFSET_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = OFFSET_FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    OFFSET_FMT_CACHE.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  if (tz === FLOATING || tz === 'UTC') return true;
  try {
    offsetFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** UTC offset in minutes of `tz` at the instant `utcMs`. */
export function offsetMinutesAt(tz: string, utcMs: number): number {
  if (tz === 'UTC' || tz === FLOATING) return 0;
  const sec = Math.floor(utcMs / 1000);
  const parts = offsetFormatter(tz).formatToParts(new Date(sec * 1000));
  const v: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') v[p.type] = Number(p.value);
  }
  const h = (v.hour ?? 0) === 24 ? 0 : (v.hour ?? 0);
  const asUtc = Date.UTC(v.year ?? 1970, (v.month ?? 1) - 1, v.day ?? 1, h, v.minute ?? 0, v.second ?? 0);
  return Math.round((asUtc - sec * 1000) / 60000);
}

/**
 * Convert a wall-clock time in `tz` to a UTC instant. For an ambiguous time (clocks go back) the
 * first occurrence is used; for a non-existent time (clocks go forward) the offset in effect
 * before the gap is used - both per RFC 5545 §3.3.5.
 */
export function zonedToUtc(tz: string, date: YMD, time: HM, sec = 0): number {
  const local = Date.UTC(date.y, date.m - 1, date.d, time.h, time.mi, sec);
  if (tz === 'UTC' || tz === FLOATING) return local;
  const before = offsetMinutesAt(tz, local - 36 * 3600000);
  const after = offsetMinutesAt(tz, local + 36 * 3600000);
  const candidates = before === after ? [before] : [before, after];
  const valid: number[] = [];
  for (const off of candidates) {
    const utc = local - off * 60000;
    if (offsetMinutesAt(tz, utc) === off) valid.push(utc);
  }
  if (valid.length > 0) return Math.min(...valid);
  return local - before * 60000;
}

function tzAbbrev(tz: string, utcMs: number): string {
  // en-US only has abbreviations for US zones; try a few English locales before settling for "GMT+1".
  let fallback = '';
  for (const loc of ['en-US', 'en-GB', 'en-AU', 'en-NZ', 'en-ZA', 'en-IN', 'en-CA']) {
    try {
      const parts = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(utcMs));
      const n = (parts.find((p) => p.type === 'timeZoneName')?.value ?? '').replace(/[^\x20-\x7E]/g, '').trim();
      if (!n) continue;
      if (!/^(GMT|UTC)[+-]/.test(n)) return n;
      fallback = fallback || n;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export interface Transition {
  utc: number;
  from: number;
  to: number;
}

const TRANSITION_CACHE = new Map<string, Transition[]>();

/** Offset changes of `tz` between Jan 1 of `fromYear` and Dec 31 of `toYear` (UTC). */
export function findTransitions(tz: string, fromYear: number, toYear: number): Transition[] {
  const key = `${tz}|${fromYear}|${toYear}`;
  const hit = TRANSITION_CACHE.get(key);
  if (hit) return hit;
  const out: Transition[] = [];
  if (tz !== 'UTC' && tz !== FLOATING) {
    const start = Date.UTC(fromYear, 0, 1);
    const end = Date.UTC(toYear + 1, 0, 1);
    const step = 3 * 86400000;
    let prevT = start;
    let prevO = offsetMinutesAt(tz, start);
    for (let t = start + step; prevT < end; t += step) {
      const tt = Math.min(t, end);
      const o = offsetMinutesAt(tz, tt);
      if (o !== prevO) {
        let lo = prevT;
        let hi = tt;
        while (hi - lo > 60000) {
          const mid = lo + Math.floor((hi - lo) / 2 / 60000) * 60000;
          if (mid <= lo) break;
          if (offsetMinutesAt(tz, mid) === prevO) lo = mid;
          else hi = mid;
        }
        out.push({ utc: hi, from: prevO, to: offsetMinutesAt(tz, hi) });
      }
      prevT = tt;
      prevO = o;
    }
  }
  if (TRANSITION_CACHE.size > 200) TRANSITION_CACHE.clear();
  TRANSITION_CACHE.set(key, out);
  return out;
}

function offsetStr(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
}

function ymdFromMs(ms: number): { ymd: YMD; hm: HM; sec: number; wd: number } {
  const dt = new Date(ms);
  const ymd = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  return { ymd, hm: { h: dt.getUTCHours(), mi: dt.getUTCMinutes() }, sec: dt.getUTCSeconds(), wd: dt.getUTCDay() };
}

interface ObservanceInfo {
  kind: 'DAYLIGHT' | 'STANDARD';
  tr: Transition;
  local: { ymd: YMD; hm: HM; sec: number; wd: number };
}

function describe(tr: Transition): ObservanceInfo {
  return {
    kind: tr.to > tr.from ? 'DAYLIGHT' : 'STANDARD',
    tr,
    // Onset is expressed in the local time in effect BEFORE the change (TZOFFSETFROM).
    local: ymdFromMs(tr.utc + tr.from * 60000),
  };
}

function nthRuleOf(info: ObservanceInfo): number[] {
  const { d } = info.local.ymd;
  const nth = Math.ceil(d / 7);
  const isLast = d + 7 > daysInMonth(info.local.ymd.y, info.local.ymd.m);
  return isLast ? [nth, -1] : [nth];
}

function matchesNth(info: ObservanceInfo, nth: number): boolean {
  const { y, m, d } = info.local.ymd;
  return nth > 0 ? Math.ceil(d / 7) === nth : d + 7 > daysInMonth(y, m);
}

/**
 * Build a VTIMEZONE component (as content lines) for `tz` covering fromYear..toYear.
 * Regular yearly rules are written as RRULE observances; irregular zones fall back to explicit onsets.
 */
export function buildVtimezone(tz: string, fromYear: number, toYear: number): string[] {
  const head = ['BEGIN:VTIMEZONE', prop('TZID', tz), prop('X-LIC-LOCATION', tz)];
  const tail = ['END:VTIMEZONE'];
  const trs = findTransitions(tz, fromYear, toYear);
  const stamp = (v: ObservanceInfo['local']): string => localStamp(v.ymd, v.hm, v.sec);

  if (trs.length === 0) {
    const off = offsetMinutesAt(tz, Date.UTC(fromYear, 0, 1));
    return [
      ...head,
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      prop('TZOFFSETFROM', offsetStr(off)),
      prop('TZOFFSETTO', offsetStr(off)),
      prop('TZNAME', escapeText(tzAbbrev(tz, Date.UTC(fromYear, 0, 1)) || offsetStr(off))),
      'END:STANDARD',
      ...tail,
    ];
  }

  const infos = trs.map(describe);
  const years = toYear - fromYear + 1;
  const dst = infos.filter((i) => i.kind === 'DAYLIGHT');
  const std = infos.filter((i) => i.kind === 'STANDARD');

  const ruleFor = (list: ObservanceInfo[]): { nth: number } | null => {
    const first = list[0];
    if (!first || list.length !== years) return null;
    for (const cand of nthRuleOf(first)) {
      const ok = list.every(
        (i, idx) =>
          new Date(i.tr.utc).getUTCFullYear() === fromYear + idx &&
          i.tr.from === first.tr.from &&
          i.tr.to === first.tr.to &&
          i.local.ymd.m === first.local.ymd.m &&
          i.local.wd === first.local.wd &&
          i.local.hm.h === first.local.hm.h &&
          i.local.hm.mi === first.local.hm.mi &&
          i.local.sec === first.local.sec &&
          matchesNth(i, cand)
      );
      if (ok) return { nth: cand };
    }
    return null;
  };

  const rDst = ruleFor(dst);
  const rStd = ruleFor(std);
  const lines = [...head];
  const name = (i: ObservanceInfo): string => escapeText(tzAbbrev(tz, i.tr.utc + 1000) || offsetStr(i.tr.to));

  if (rDst && rStd) {
    for (const [list, rule] of [
      [dst, rDst],
      [std, rStd],
    ] as const) {
      const first = list[0];
      if (!first) continue;
      lines.push(
        `BEGIN:${first.kind}`,
        prop('DTSTART', stamp(first.local)),
        prop('TZOFFSETFROM', offsetStr(first.tr.from)),
        prop('TZOFFSETTO', offsetStr(first.tr.to)),
        prop('TZNAME', name(first)),
        prop('RRULE', `FREQ=YEARLY;BYMONTH=${first.local.ymd.m};BYDAY=${rule.nth}${WEEKDAY_CODES[first.local.wd] ?? 'SU'}`),
        `END:${first.kind}`
      );
    }
    return [...lines, ...tail];
  }

  // Irregular rules: baseline + one explicit observance per transition.
  const firstTr = trs[0];
  if (firstTr) {
    const base = Date.UTC(fromYear, 0, 1);
    lines.push(
      `BEGIN:${firstTr.to > firstTr.from ? 'STANDARD' : 'DAYLIGHT'}`,
      prop('DTSTART', localStamp({ y: fromYear, m: 1, d: 1 }, { h: 0, mi: 0 })),
      prop('TZOFFSETFROM', offsetStr(firstTr.from)),
      prop('TZOFFSETTO', offsetStr(firstTr.from)),
      prop('TZNAME', escapeText(tzAbbrev(tz, base) || offsetStr(firstTr.from))),
      `END:${firstTr.to > firstTr.from ? 'STANDARD' : 'DAYLIGHT'}`
    );
  }
  for (const i of infos) {
    lines.push(
      `BEGIN:${i.kind}`,
      prop('DTSTART', stamp(i.local)),
      prop('TZOFFSETFROM', offsetStr(i.tr.from)),
      prop('TZOFFSETTO', offsetStr(i.tr.to)),
      prop('TZNAME', name(i)),
      `END:${i.kind}`
    );
  }
  return [...lines, ...tail];
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                           */
/* ------------------------------------------------------------------ */

function effectiveWeekdays(ev: IcsEvent, startDay: number): number[] {
  const set = new Set<number>(ev.recurrence.byDay.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (set.size === 0) set.add(weekdayOfDays(startDay));
  return [...set].sort((a, b) => isoDow(a) - isoDow(b));
}

/** Days (of month) matching the "nth weekday" spec in month y/m, ascending. */
export function nthWeekdayDays(y: number, m: number, nth: number, weekday: number): number[] {
  const dim = daysInMonth(y, m);
  const matching: number[] = [];
  for (let d = 1; d <= dim; d++) {
    const wd = weekdayOfDays(daysFromCivil(y, m, d));
    if (weekday === 7 ? wd >= 1 && wd <= 5 : wd === weekday) matching.push(d);
  }
  const idx = nth > 0 ? nth - 1 : matching.length + nth;
  const hit = matching[idx];
  return idx >= 0 && hit !== undefined ? [hit] : [];
}

function monthDaysFor(y: number, m: number, r: RecurrenceSpec, startDay: number): number[] {
  const dim = daysInMonth(y, m);
  if (r.monthlyMode === 'nthWeekday') return nthWeekdayDays(y, m, r.nth, r.nthWeekday);
  const want = r.monthDay === 0 ? startDay : r.monthDay;
  if (want === -1) return [dim];
  return want >= 1 && want <= dim ? [want] : [];
}

export interface Expansion {
  /** Epoch-day numbers of occurrence start dates. */
  days: number[];
  truncated: boolean;
}

/**
 * Expand the recurrence into occurrence start dates (wall-clock dates). Mirrors RFC 5545
 * semantics: non-existent dates (e.g. the 31st in a 30-day month) are skipped, COUNT includes only
 * generated instances on/after DTSTART, UNTIL is inclusive.
 */
export function expandRecurrence(ev: IcsEvent, max = 500): Expansion {
  const start = parseDate(ev.startDate);
  if (!start) return { days: [], truncated: false };
  const r = ev.recurrence;
  const startDay = daysFromCivil(start.y, start.m, start.d);
  if (r.freq === 'NONE') return { days: [startDay], truncated: false };

  const interval = clampInt(r.interval, 1, 999);
  const cap = r.endMode === 'count' ? clampInt(r.count, 1, 99999) : Number.POSITIVE_INFINITY;
  const want = Math.min(cap, max + 1);
  const untilParsed = r.endMode === 'until' ? parseDate(r.until) : null;
  const untilDay = untilParsed ? daysFromCivil(untilParsed.y, untilParsed.m, untilParsed.d) : Number.POSITIVE_INFINITY;
  const out: number[] = [];
  const endDay = daysFromCivil(9999, 12, 31);

  // Returns false once generation should stop.
  const push = (day: number): boolean => {
    if (day < startDay) return true;
    if (day > untilDay || day > endDay) return false;
    out.push(day);
    return out.length < want;
  };

  const MAX_PERIODS = 20000;
  if (r.freq === 'DAILY') {
    for (let k = 0; k < MAX_PERIODS; k++) if (!push(startDay + k * interval)) break;
  } else if (r.freq === 'WEEKLY') {
    const wds = effectiveWeekdays(ev, startDay);
    const week0 = startDay - isoDow(weekdayOfDays(startDay));
    outer: for (let k = 0; k < MAX_PERIODS; k++) {
      const base = week0 + 7 * interval * k;
      for (const wd of wds) if (!push(base + isoDow(wd))) break outer;
    }
  } else if (r.freq === 'MONTHLY') {
    const idx0 = start.y * 12 + (start.m - 1);
    outer2: for (let k = 0; k < MAX_PERIODS; k++) {
      const idx = idx0 + k * interval;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      if (y > 9999) break;
      for (const d of monthDaysFor(y, m, r, start.d)) if (!push(daysFromCivil(y, m, d))) break outer2;
    }
  } else {
    outer3: for (let k = 0; k < MAX_PERIODS; k++) {
      const y = start.y + k * interval;
      if (y > 9999) break;
      const days =
        r.monthlyMode === 'nthWeekday'
          ? nthWeekdayDays(y, start.m, r.nth, r.nthWeekday)
          : start.d <= daysInMonth(y, start.m)
            ? [start.d]
            : [];
      for (const d of days) if (!push(daysFromCivil(y, start.m, d))) break outer3;
    }
  }
  const truncated = out.length > max;
  return { days: truncated ? out.slice(0, max) : out, truncated };
}

export interface OccurrenceView {
  label: string;
  startDate: string;
}

export function formatDay(days: number): string {
  const v = civilFromDays(days);
  return `${WEEKDAY_SHORT[weekdayOfDays(days)] ?? ''}, ${v.d} ${MONTH_SHORT[v.m - 1] ?? ''} ${v.y}`;
}

/** Human-readable preview lines for the first `n` occurrences. */
export function previewOccurrences(ev: IcsEvent, n = 10): { lines: OccurrenceView[]; total: number; truncated: boolean } {
  const exp = expandRecurrence(ev, 500);
  const start = parseDate(ev.startDate);
  const end = parseDate(ev.endDate);
  const sd = start ? daysFromCivil(start.y, start.m, start.d) : 0;
  const ed = end ? daysFromCivil(end.y, end.m, end.d) : sd;
  const spanDays = Math.max(0, ed - sd);
  const lines = exp.days.slice(0, n).map((day) => {
    const base = formatDay(day);
    let label: string;
    if (ev.allDay) {
      label = spanDays > 0 ? `${base} → ${formatDay(day + spanDays)}` : base;
    } else {
      const endPart = spanDays > 0 ? `${formatDay(day + spanDays)} ${ev.endTime}` : ev.endTime;
      label = `${base}, ${ev.startTime} – ${endPart}`;
    }
    return { label, startDate: formatYmd(civilFromDays(day)) };
  });
  return { lines, total: exp.days.length, truncated: exp.truncated };
}

/* ------------------------------------------------------------------ */
/* Time mode resolution                                                 */
/* ------------------------------------------------------------------ */

export function resolveTimeMode(ev: IcsEvent, utcPref: boolean): { mode: TimeMode; reason?: string } {
  if (ev.allDay) return { mode: 'allday' };
  if (ev.tz === FLOATING) return { mode: 'floating' };
  if (ev.tz === 'UTC') return { mode: 'utc' };
  if (!utcPref) return { mode: 'tzid' };
  if (ev.recurrence.freq === 'NONE') return { mode: 'utc' };

  // Recurring events: UTC times only stay correct for zones without DST and when the UTC date equals the local date.
  const start = parseDate(ev.startDate);
  const t = parseTime(ev.startTime);
  if (!start || !t) return { mode: 'utc' };
  const fixed = findTransitions(ev.tz, start.y, start.y + 5).length === 0;
  const utc = new Date(zonedToUtc(ev.tz, start, t));
  const sameDate = utc.getUTCFullYear() === start.y && utc.getUTCMonth() + 1 === start.m && utc.getUTCDate() === start.d;
  if (fixed && sameDate) return { mode: 'utc' };
  return {
    mode: 'tzid',
    reason: fixed
      ? 'Repeating event: written with a time zone because the UTC date differs from your local date, which would shift weekdays.'
      : 'Repeating event: written with a time zone (and VTIMEZONE) so the local time stays the same across daylight-saving changes.',
  };
}

/* ------------------------------------------------------------------ */
/* RRULE                                                                */
/* ------------------------------------------------------------------ */

function untilValue(ev: IcsEvent, mode: TimeMode): string | null {
  const u = parseDate(ev.recurrence.until);
  if (!u) return null;
  if (mode === 'allday') return ymdCompact(u);
  if (mode === 'floating') return `${ymdCompact(u)}T235959`;
  return utcStamp(zonedToUtc(ev.tz, u, { h: 23, mi: 59 }, 59));
}

export function buildRRule(ev: IcsEvent, mode: TimeMode): string | null {
  const r = ev.recurrence;
  if (r.freq === 'NONE') return null;
  const start = parseDate(ev.startDate);
  if (!start) return null;
  const startDay = daysFromCivil(start.y, start.m, start.d);
  const parts: string[] = [`FREQ=${r.freq}`];
  const interval = clampInt(r.interval, 1, 999);
  if (interval > 1) parts.push(`INTERVAL=${interval}`);

  const nthPart = (): void => {
    const nth = clampInt(r.nth, -1, 4) === 0 ? 1 : clampInt(r.nth, -1, 4);
    if (r.nthWeekday === 7) {
      parts.push('BYDAY=MO,TU,WE,TH,FR', `BYSETPOS=${nth}`);
    } else {
      parts.push(`BYDAY=${nth}${WEEKDAY_CODES[clampInt(r.nthWeekday, 0, 6)] ?? 'MO'}`);
    }
  };

  if (r.freq === 'WEEKLY') {
    parts.push(`BYDAY=${effectiveWeekdays(ev, startDay).map((d) => WEEKDAY_CODES[d] ?? 'MO').join(',')}`);
  } else if (r.freq === 'MONTHLY') {
    if (r.monthlyMode === 'nthWeekday') nthPart();
    else parts.push(`BYMONTHDAY=${r.monthDay === 0 ? start.d : clampInt(r.monthDay, -1, 31)}`);
  } else if (r.freq === 'YEARLY') {
    parts.push(`BYMONTH=${start.m}`);
    if (r.monthlyMode === 'nthWeekday') nthPart();
    else parts.push(`BYMONTHDAY=${start.d}`);
  }

  if (r.endMode === 'count') parts.push(`COUNT=${clampInt(r.count, 1, 99999)}`);
  else if (r.endMode === 'until') {
    const u = untilValue(ev, mode);
    if (u) parts.push(`UNTIL=${u}`);
  }
  return parts.join(';');
}

/** Does the start date itself satisfy the recurrence rule? (RFC 5545 asks that DTSTART be synchronised.) */
export function startMatchesRule(ev: IcsEvent): boolean {
  const start = parseDate(ev.startDate);
  if (!start || ev.recurrence.freq === 'NONE') return true;
  const startDay = daysFromCivil(start.y, start.m, start.d);
  const exp = expandRecurrence({ ...ev, recurrence: { ...ev.recurrence, endMode: 'never' } }, 1);
  return exp.days[0] === startDay;
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function normalizeUrl(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (!/^[a-z][a-z0-9+.-]*:$/i.test(u.protocol)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function wallMinutes(date: YMD, time: HM): number {
  return daysFromCivil(date.y, date.m, date.d) * 1440 + time.h * 60 + time.mi;
}

export function validateEvent(ev: IcsEvent, index: number): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string): void => void issues.push({ level: 'error', eventIndex: index, message });
  const warn = (message: string): void => void issues.push({ level: 'warning', eventIndex: index, message });

  if (!ev.title.trim()) warn('Title is empty - most calendars will show "(no title)".');

  const sd = parseDate(ev.startDate);
  const ed = parseDate(ev.endDate);
  if (!sd) err('Start date is missing or invalid.');
  if (!ed) err('End date is missing or invalid.');
  if (sd && (sd.y < 1900 || sd.y > 2200)) err('Start year must be between 1900 and 2200.');
  if (ed && (ed.y < 1900 || ed.y > 2200)) err('End year must be between 1900 and 2200.');

  if (!ev.allDay) {
    const st = parseTime(ev.startTime);
    const et = parseTime(ev.endTime);
    if (!st) err('Start time is missing or invalid.');
    if (!et) err('End time is missing or invalid.');
    if (sd && ed && st && et) {
      const a = wallMinutes(sd, st);
      const b = wallMinutes(ed, et);
      if (b < a) err('The event ends before it starts.');
      else if (b === a) warn('Start and end are identical (a zero-length event).');
    }
    if (ev.tz !== FLOATING && !isValidTimeZone(ev.tz)) err(`Unknown time zone "${ev.tz}".`);
  } else if (sd && ed) {
    if (daysFromCivil(ed.y, ed.m, ed.d) < daysFromCivil(sd.y, sd.m, sd.d)) err('The last day is before the first day.');
  }

  const r = ev.recurrence;
  if (r.freq !== 'NONE') {
    if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 999) err('Repeat interval must be a whole number from 1 to 999.');
    if (r.endMode === 'count' && (!Number.isInteger(r.count) || r.count < 1 || r.count > 99999)) err('Occurrence count must be a whole number from 1 to 99999.');
    if (r.endMode === 'until') {
      const u = parseDate(r.until);
      if (!u) err('Choose an end date for the repeat ("Until").');
      else if (sd && daysFromCivil(u.y, u.m, u.d) < daysFromCivil(sd.y, sd.m, sd.d)) err('The repeat end date is before the start date.');
    }
    if (r.monthlyMode === 'dayOfMonth' && r.freq === 'MONTHLY' && (!Number.isInteger(r.monthDay) || r.monthDay < -1 || r.monthDay > 31)) {
      err('Day of month must be 1-31 (or leave blank for the start date\'s day).');
    }
    if (sd && !err_has(issues) && !startMatchesRule(ev)) {
      warn('The start date does not match the repeat pattern; calendars may skip or include it inconsistently. Move the start to the first matching date.');
    }
    if (r.freq === 'MONTHLY' && r.monthlyMode === 'dayOfMonth' && sd) {
      const day = r.monthDay === 0 ? sd.d : r.monthDay;
      if (day >= 29 && day <= 31) warn(`Months without a day ${day} are skipped (use "last day of month" to avoid that).`);
    }
    if (r.freq === 'YEARLY' && r.monthlyMode === 'dayOfMonth' && sd && sd.m === 2 && sd.d === 29) {
      warn('A yearly repeat on 29 February only occurs in leap years.');
    }
  }

  for (const [i, rem] of ev.reminders.entries()) {
    if (!Number.isInteger(rem.amount) || rem.amount < 0 || rem.amount > 99999) err(`Reminder ${i + 1}: amount must be a whole number from 0 to 99999.`);
  }

  const org = ev.organizerEmail.trim();
  if (org && !isValidEmail(org)) err('Organizer email looks invalid.');
  if (!org && ev.organizerName.trim()) warn('Organizer name is ignored without an organizer email.');
  for (const [i, a] of ev.attendees.entries()) {
    if (!a.email.trim() && !a.name.trim()) continue;
    if (!isValidEmail(a.email)) err(`Attendee ${i + 1}: email is missing or invalid.`);
  }
  if (ev.url.trim() && !normalizeUrl(ev.url)) warn('URL is not a valid absolute URL and was left out.');
  return issues;
}

function err_has(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

/* ------------------------------------------------------------------ */
/* Calendar generation                                                  */
/* ------------------------------------------------------------------ */

export function durationValue(r: Reminder): string {
  const n = clampInt(r.amount, 0, 99999);
  if (n === 0) return 'PT0S';
  switch (r.unit) {
    case 'weeks':
      return `-P${n}W`;
    case 'days':
      return `-P${n}D`;
    case 'hours':
      return `-PT${n}H`;
    case 'minutes':
      return `-PT${n}M`;
  }
}

function addDaysYmd(v: YMD, n: number): YMD {
  return civilFromDays(daysFromCivil(v.y, v.m, v.d) + n);
}

/** Last year an event's rule needs time zone data for. */
function lastYearNeeded(ev: IcsEvent, startYear: number): number {
  if (ev.recurrence.freq === 'NONE') return startYear + 1;
  if (ev.recurrence.endMode === 'never') return startYear + 10;
  const exp = expandRecurrence(ev, 500);
  const last = exp.days[exp.days.length - 1];
  const y = last === undefined ? startYear : civilFromDays(last).y;
  return Math.min(Math.max(y + 1, startYear + 1), startYear + 40);
}

function eventLines(ev: IcsEvent, now: Date, mode: TimeMode): string[] {
  const lines: string[] = ['BEGIN:VEVENT', prop('UID', escapeText(ev.uid)), prop('DTSTAMP', utcStamp(now.getTime()))];
  const sd = parseDate(ev.startDate) as YMD;
  const ed = parseDate(ev.endDate) as YMD;
  if (mode === 'allday') {
    lines.push(prop('DTSTART', ymdCompact(sd), [['VALUE', 'DATE']]));
    lines.push(prop('DTEND', ymdCompact(addDaysYmd(ed, 1)), [['VALUE', 'DATE']]));
  } else {
    const st = parseTime(ev.startTime) as HM;
    const et = parseTime(ev.endTime) as HM;
    if (mode === 'utc') {
      lines.push(prop('DTSTART', utcStamp(zonedToUtc(ev.tz, sd, st))));
      lines.push(prop('DTEND', utcStamp(zonedToUtc(ev.tz, ed, et))));
    } else if (mode === 'tzid') {
      lines.push(prop('DTSTART', localStamp(sd, st), [['TZID', escapeParam(ev.tz)]]));
      lines.push(prop('DTEND', localStamp(ed, et), [['TZID', escapeParam(ev.tz)]]));
    } else {
      lines.push(prop('DTSTART', localStamp(sd, st)));
      lines.push(prop('DTEND', localStamp(ed, et)));
    }
  }
  const rrule = buildRRule(ev, mode);
  if (rrule) lines.push(prop('RRULE', rrule));
  if (ev.title.trim()) lines.push(prop('SUMMARY', escapeText(ev.title.trim())));
  if (ev.description.trim()) lines.push(prop('DESCRIPTION', escapeText(ev.description.replace(/\s+$/, ''))));
  if (ev.location.trim()) lines.push(prop('LOCATION', escapeText(ev.location.trim())));
  const url = normalizeUrl(ev.url);
  if (url) lines.push(prop('URL', url));
  lines.push(prop('STATUS', ev.status), prop('TRANSP', ev.transp), prop('SEQUENCE', '0'));

  const org = ev.organizerEmail.trim();
  if (org) {
    const params: [string, string][] = ev.organizerName.trim() ? [['CN', escapeParam(ev.organizerName)]] : [];
    lines.push(prop('ORGANIZER', `mailto:${org}`, params));
  }
  for (const a of ev.attendees) {
    if (!a.email.trim()) continue;
    const params: [string, string][] = [];
    if (a.name.trim()) params.push(['CN', escapeParam(a.name)]);
    params.push(['ROLE', 'REQ-PARTICIPANT'], ['PARTSTAT', 'NEEDS-ACTION'], ['RSVP', a.rsvp ? 'TRUE' : 'FALSE']);
    lines.push(prop('ATTENDEE', `mailto:${a.email.trim()}`, params));
  }
  for (const rem of ev.reminders) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      prop('DESCRIPTION', escapeText(ev.title.trim() || 'Reminder')),
      prop('TRIGGER', durationValue(rem)),
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

export function generateCalendar(events: IcsEvent[], opts: GenerateOptions): GenerateResult {
  const issues: Issue[] = [];
  events.forEach((ev, i) => issues.push(...validateEvent(ev, i)));
  const modes = events.map((ev) => resolveTimeModeSafe(ev, opts.utc));
  if (events.length === 0) {
    issues.push({ level: 'error', eventIndex: null, message: 'Add at least one event.' });
  }
  if (issues.some((i) => i.level === 'error')) return { ics: '', issues, modes };

  const now = opts.now ?? new Date();
  const tzWindows = new Map<string, [number, number]>();
  events.forEach((ev, i) => {
    if (modes[i]?.mode !== 'tzid') return;
    const sy = (parseDate(ev.startDate) as YMD).y;
    const ey = Math.max(lastYearNeeded(ev, sy), (parseDate(ev.endDate) as YMD).y);
    const cur = tzWindows.get(ev.tz);
    tzWindows.set(ev.tz, cur ? [Math.min(cur[0], sy - 1), Math.max(cur[1], ey)] : [sy - 1, ey]);
  });

  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', prop('PRODID', PRODID), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const [tz, [a, b]] of tzWindows) lines.push(...buildVtimezone(tz, a, b));
  events.forEach((ev, i) => lines.push(...eventLines(ev, now, modes[i]?.mode ?? 'utc')));
  lines.push('END:VCALENDAR');
  return { ics: lines.map((l) => foldLine(l)).join('\r\n') + '\r\n', issues, modes };
}

function resolveTimeModeSafe(ev: IcsEvent, utcPref: boolean): { mode: TimeMode; reason?: string } {
  try {
    return resolveTimeMode(ev, utcPref);
  } catch {
    return { mode: 'utc' };
  }
}

/* ------------------------------------------------------------------ */
/* "Add to calendar" links                                              */
/* ------------------------------------------------------------------ */

export type Provider = 'google' | 'outlook' | 'office365' | 'yahoo';

const enc = encodeURIComponent;

function fullDetails(ev: IcsEvent): string {
  const url = normalizeUrl(ev.url);
  return [ev.description.trim(), url ?? ''].filter(Boolean).join('\n\n');
}

function isoUtc(ms: number): string {
  return utcStamp(ms).replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
}

/** Build provider deep links as pure strings. Returns null when the event is not valid. */
export function providerUrl(ev: IcsEvent, provider: Provider): string | null {
  const sd = parseDate(ev.startDate);
  const ed = parseDate(ev.endDate);
  if (!sd || !ed) return null;
  const title = ev.title.trim();
  const details = fullDetails(ev);
  const loc = ev.location.trim();
  const floating = ev.tz === FLOATING;
  let startG: string;
  let endG: string;
  let startIso: string;
  let endIso: string;

  if (ev.allDay) {
    const endEx = addDaysYmd(ed, 1);
    startG = ymdCompact(sd);
    endG = ymdCompact(endEx);
    startIso = formatYmd(sd);
    endIso = formatYmd(endEx);
  } else {
    const st = parseTime(ev.startTime);
    const et = parseTime(ev.endTime);
    if (!st || !et) return null;
    if (floating) {
      startG = localStamp(sd, st);
      endG = localStamp(ed, et);
      startIso = `${formatYmd(sd)}T${pad(st.h)}:${pad(st.mi)}:00`;
      endIso = `${formatYmd(ed)}T${pad(et.h)}:${pad(et.mi)}:00`;
    } else {
      const a = zonedToUtc(ev.tz, sd, st);
      const b = zonedToUtc(ev.tz, ed, et);
      startG = utcStamp(a);
      endG = utcStamp(b);
      startIso = isoUtc(a);
      endIso = isoUtc(b);
    }
  }

  if (provider === 'google') {
    let u = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(title)}&dates=${startG}/${endG}`;
    if (details) u += `&details=${enc(details)}`;
    if (loc) u += `&location=${enc(loc)}`;
    if (!ev.allDay && !floating && ev.tz !== 'UTC') u += `&ctz=${enc(ev.tz)}`;
    const mode = resolveTimeModeSafe(ev, true).mode;
    const rr = buildRRule(ev, mode);
    if (rr) u += `&recur=${enc(`RRULE:${rr}`)}`;
    return u;
  }
  if (provider === 'yahoo') {
    let u = `https://calendar.yahoo.com/?v=60&title=${enc(title)}`;
    if (ev.allDay) {
      u += `&st=${startG}&dur=allday`;
      if (daysFromCivil(ed.y, ed.m, ed.d) > daysFromCivil(sd.y, sd.m, sd.d)) u += `&et=${ymdCompact(ed)}`;
    } else {
      u += `&st=${startG}&et=${endG}`;
    }
    if (details) u += `&desc=${enc(details)}`;
    if (loc) u += `&in_loc=${enc(loc)}`;
    return u;
  }
  const base =
    provider === 'outlook'
      ? 'https://outlook.live.com/calendar/0/deeplink/compose'
      : 'https://outlook.office.com/calendar/0/deeplink/compose';
  let u = `${base}?path=${enc('/calendar/action/compose')}&rru=addevent&subject=${enc(title)}&startdt=${enc(startIso)}&enddt=${enc(endIso)}`;
  if (ev.allDay) u += '&allday=true';
  if (details) u += `&body=${enc(details)}`;
  if (loc) u += `&location=${enc(loc)}`;
  return u;
}

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

export const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Dublin',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

export function listTimeZones(): string[] {
  let zones: string[] = [];
  try {
    const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof f === 'function') zones = f.call(Intl, 'timeZone');
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = FALLBACK_TIMEZONES.slice();
  const set = new Set<string>(zones);
  set.delete('UTC');
  return ['UTC', ...[...set].sort()];
}

export function localDateString(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function blankEvent(uid: string, tz: string, startDate: string, endDate: string): IcsEvent {
  return {
    uid,
    title: '',
    allDay: false,
    startDate,
    startTime: '10:00',
    endDate,
    endTime: '11:00',
    tz,
    location: '',
    description: '',
    url: '',
    organizerName: '',
    organizerEmail: '',
    attendees: [],
    status: 'CONFIRMED',
    transp: 'OPAQUE',
    reminders: [],
    recurrence: defaultRecurrence(),
  };
}

/** Shift the end by the same delta as the start moved, keeping the event's duration. */
export function shiftEndWithStart(ev: IcsEvent, next: { startDate?: string; startTime?: string }): Pick<IcsEvent, 'endDate' | 'endTime'> {
  const keep = { endDate: ev.endDate, endTime: ev.endTime };
  const osd = parseDate(ev.startDate);
  const oed = parseDate(ev.endDate);
  const nsd = parseDate(next.startDate ?? ev.startDate);
  if (!osd || !oed || !nsd) return keep;
  const dayDelta = daysFromCivil(nsd.y, nsd.m, nsd.d) - daysFromCivil(osd.y, osd.m, osd.d);
  if (ev.allDay) return { endDate: formatYmd(addDaysYmd(oed, dayDelta)), endTime: ev.endTime };
  const ost = parseTime(ev.startTime);
  const oet = parseTime(ev.endTime);
  const nst = parseTime(next.startTime ?? ev.startTime);
  if (!ost || !oet || !nst) return keep;
  const total = wallMinutes(oed, oet) + (dayDelta * 1440 + (nst.h * 60 + nst.mi) - (ost.h * 60 + ost.mi));
  const day = Math.floor(total / 1440);
  const rem = total - day * 1440;
  return {
    endDate: formatYmd(civilFromDays(day)),
    endTime: `${pad(Math.floor(rem / 60))}:${pad(rem % 60)}`,
  };
}

export function describeRecurrence(ev: IcsEvent): string {
  const r = ev.recurrence;
  if (r.freq === 'NONE') return 'Does not repeat';
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[r.freq];
  const every = r.interval > 1 ? `Every ${r.interval} ${unit}s` : `Every ${unit}`;
  const tail = r.endMode === 'count' ? `, ${r.count} times` : r.endMode === 'until' ? `, until ${r.until}` : '';
  return every + tail;
}

/** First date on/after the start that satisfies the repeat rule, plus the matching end shift. */
export function alignStartToRule(ev: IcsEvent): Pick<IcsEvent, 'startDate' | 'endDate' | 'endTime'> | null {
  if (ev.recurrence.freq === 'NONE') return null;
  const exp = expandRecurrence({ ...ev, recurrence: { ...ev.recurrence, endMode: 'never' } }, 1);
  const first = exp.days[0];
  if (first === undefined) return null;
  const startDate = formatYmd(civilFromDays(first));
  return { startDate, ...shiftEndWithStart(ev, { startDate }) };
}

/** Suggested "nth weekday" pattern that matches a given start date (e.g. 2026-03-10 -> 2nd Tuesday). */
export function nthPatternOf(startDate: string): { nth: number; weekday: number } | null {
  const v = parseDate(startDate);
  if (!v) return null;
  const weekday = weekdayOfDays(daysFromCivil(v.y, v.m, v.d));
  const nth = Math.ceil(v.d / 7);
  return { nth: nth > 4 ? -1 : nth, weekday };
}
