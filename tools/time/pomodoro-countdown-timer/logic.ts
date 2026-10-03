/**
 * Countdown / Pomodoro / Interval timer engine. Pure TypeScript.
 *
 * The engine stores a target end timestamp (Date.now() based) while running, so the remaining
 * time is exact even when the tab was throttled or in the background. Phases are produced by
 * `phaseAt()`; `tick()` advances through as many phases as have elapsed.
 */

export type Mode = 'countdown' | 'pomodoro' | 'interval';
export type PhaseKind = 'countdown' | 'work' | 'short' | 'long' | 'prep' | 'rest';

export interface Phase {
  kind: PhaseKind;
  ms: number;
  label: string;
  /** Pomodoro: 1-based work session; Interval: 1-based round. */
  number?: number;
}

export interface CountdownSettings {
  h: number;
  m: number;
  s: number;
}

export interface PomodoroSettings {
  work: number; // minutes
  short: number;
  long: number;
  every: number; // long break after this many work sessions
  autoStart: boolean;
}

export interface IntervalSettings {
  work: number; // seconds
  rest: number;
  rounds: number;
  prep: number;
}

export interface TimerSettings {
  countdown: CountdownSettings;
  pomodoro: PomodoroSettings;
  interval: IntervalSettings;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  countdown: { h: 0, m: 5, s: 0 },
  pomodoro: { work: 25, short: 5, long: 15, every: 4, autoStart: false },
  interval: { work: 20, rest: 10, rounds: 8, prep: 10 },
};

export const COUNTDOWN_PRESETS_MIN = [1, 3, 5, 10, 15, 25, 30, 60];

export const INTERVAL_PRESETS: { id: string; label: string; s: IntervalSettings }[] = [
  { id: 'tabata', label: 'Tabata 20/10 × 8', s: { work: 20, rest: 10, rounds: 8, prep: 10 } },
  { id: 'hiit', label: 'HIIT 30/30 × 10', s: { work: 30, rest: 30, rounds: 10, prep: 10 } },
  { id: 'emom', label: 'EMOM 50/10 × 10', s: { work: 50, rest: 10, rounds: 10, prep: 5 } },
  { id: 'boxing', label: 'Boxing 3 min/1 min × 12', s: { work: 180, rest: 60, rounds: 12, prep: 10 } },
];

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Countdown clock: mm:ss, or h:mm:ss from one hour. Rounds UP so 0:00 only shows at the end. */
export function formatCountdown(ms: number): string {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor(t / 60) % 60;
  const s = t % 60;
  const p = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** "1 h 5 min 30 s" style summary of a duration. */
export function describeDuration(ms: number): string {
  const total = Math.round(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || parts.length === 0) parts.push(`${s} s`);
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Schedules                                                           */
/* ------------------------------------------------------------------ */

export function countdownMs(c: CountdownSettings): number {
  return Math.max(0, Math.round(c.h) * 3600000 + Math.round(c.m) * 60000 + Math.round(c.s) * 1000);
}

export function pomodoroPhase(i: number, p: PomodoroSettings): Phase {
  if (i % 2 === 0) {
    const n = i / 2 + 1;
    return { kind: 'work', ms: p.work * 60000, label: 'Focus', number: n };
  }
  const afterWork = (i + 1) / 2;
  const long = afterWork % Math.max(1, p.every) === 0;
  return long
    ? { kind: 'long', ms: p.long * 60000, label: 'Long break', number: afterWork }
    : { kind: 'short', ms: p.short * 60000, label: 'Short break', number: afterWork };
}

export interface IntervalPhase extends Phase {
  round: number;
}

/** prep (optional) then work, rest × rounds; no rest after the final round. */
export function buildIntervalSchedule(c: IntervalSettings): IntervalPhase[] {
  const out: IntervalPhase[] = [];
  if (c.prep > 0) out.push({ kind: 'prep', ms: c.prep * 1000, label: 'Get ready', round: 0 });
  for (let r = 1; r <= c.rounds; r++) {
    out.push({ kind: 'work', ms: c.work * 1000, label: 'Work', number: r, round: r });
    if (r < c.rounds && c.rest > 0) out.push({ kind: 'rest', ms: c.rest * 1000, label: 'Rest', number: r, round: r });
  }
  return out;
}

export function intervalTotalMs(c: IntervalSettings): number {
  return buildIntervalSchedule(c).reduce((a, p) => a + p.ms, 0);
}

/** Phase at index `i` for a mode, or null once finished. */
export function phaseAt(mode: Mode, i: number, s: TimerSettings): Phase | null {
  if (i < 0) return null;
  if (mode === 'countdown') return i === 0 ? { kind: 'countdown', ms: countdownMs(s.countdown), label: 'Countdown' } : null;
  if (mode === 'pomodoro') return pomodoroPhase(i, s.pomodoro);
  return buildIntervalSchedule(s.interval)[i] ?? null;
}

/** Preview of the next `count` pomodoro phases starting at index `from`. */
export function pomodoroPreview(from: number, count: number, p: PomodoroSettings): Phase[] {
  return Array.from({ length: count }, (_, k) => pomodoroPhase(from + k, p));
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export type EngineStatus = 'idle' | 'running' | 'paused' | 'done';

export interface Engine {
  status: EngineStatus;
  /** Index of the current phase. */
  index: number;
  /** Date.now() at which the current phase ends (running only). */
  endsAt: number | null;
  /** Remaining ms in the current phase (idle / paused: exact; running: at last update). */
  remaining: number;
}

export interface PhaseEnd {
  from: Phase;
  to: Phase | null;
}

export function initialEngine(mode: Mode, s: TimerSettings): Engine {
  return { status: 'idle', index: 0, endsAt: null, remaining: phaseAt(mode, 0, s)?.ms ?? 0 };
}

export function remainingMs(e: Engine, now: number): number {
  if (e.status === 'running' && e.endsAt !== null) return Math.max(0, e.endsAt - now);
  return e.remaining;
}

export function startEngine(mode: Mode, e: Engine, s: TimerSettings, now: number): Engine {
  if (e.status === 'running') return e;
  if (e.status === 'done') return startEngine(mode, initialEngine(mode, s), s, now);
  const remaining = e.status === 'idle' ? (phaseAt(mode, e.index, s)?.ms ?? 0) : e.remaining;
  if (remaining <= 0) return e;
  return { status: 'running', index: e.index, endsAt: now + remaining, remaining };
}

export function pauseEngine(e: Engine, now: number): Engine {
  if (e.status !== 'running') return e;
  return { ...e, status: 'paused', endsAt: null, remaining: remainingMs(e, now) };
}

export function addTime(e: Engine, ms: number): Engine {
  if (e.status === 'running' && e.endsAt !== null) return { ...e, endsAt: e.endsAt + ms, remaining: e.remaining + ms };
  if (e.status === 'paused' || e.status === 'idle') return { ...e, remaining: Math.max(0, e.remaining + ms) };
  return e;
}

/** Whether the timer keeps running into the next phase by itself. */
export function autoContinues(mode: Mode, s: TimerSettings): boolean {
  if (mode === 'interval') return true;
  if (mode === 'pomodoro') return s.pomodoro.autoStart;
  return false;
}

/**
 * Advance by wall-clock time. Walks across every phase boundary that has passed (so a throttled
 * or sleeping tab catches up correctly) and reports each boundary as an event.
 */
export function tick(mode: Mode, e: Engine, s: TimerSettings, now: number): { engine: Engine; events: PhaseEnd[] } {
  const events: PhaseEnd[] = [];
  let cur = e;
  const auto = autoContinues(mode, s);
  let guard = 0;
  while (cur.status === 'running' && cur.endsAt !== null && now >= cur.endsAt && guard++ < 10000) {
    const from = phaseAt(mode, cur.index, s);
    const next = phaseAt(mode, cur.index + 1, s);
    if (!from) {
      cur = { status: 'done', index: cur.index, endsAt: null, remaining: 0 };
      break;
    }
    events.push({ from, to: next });
    if (!next) {
      cur = { status: 'done', index: cur.index, endsAt: null, remaining: 0 };
    } else if (auto && next.ms > 0) {
      cur = { status: 'running', index: cur.index + 1, endsAt: cur.endsAt + next.ms, remaining: next.ms };
    } else {
      cur = { status: 'idle', index: cur.index + 1, endsAt: null, remaining: next.ms };
    }
  }
  return { engine: cur, events };
}

/** Skip the current phase (counts as a boundary but is not an alert-worthy "time up"). */
export function skipPhase(mode: Mode, e: Engine, s: TimerSettings, now: number): Engine {
  const next = phaseAt(mode, e.index + 1, s);
  if (!next) return { status: 'done', index: e.index, endsAt: null, remaining: 0 };
  const keepRunning = e.status === 'running' && autoContinues(mode, s);
  if (keepRunning && next.ms > 0) return { status: 'running', index: e.index + 1, endsAt: now + next.ms, remaining: next.ms };
  return { status: 'idle', index: e.index + 1, endsAt: null, remaining: next.ms };
}

export function resetEngine(mode: Mode, s: TimerSettings): Engine {
  return initialEngine(mode, s);
}

/** Total scheduled time for modes with a finite schedule, else null. */
export function totalMs(mode: Mode, s: TimerSettings): number | null {
  if (mode === 'countdown') return countdownMs(s.countdown);
  if (mode === 'interval') return intervalTotalMs(s.interval);
  return null;
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export type AlertKind = 'done' | 'work' | 'rest';

export interface Beep {
  freq: number;
  /** seconds from the start of the pattern */
  at: number;
  dur: number;
}

export function beepPattern(kind: AlertKind): Beep[] {
  switch (kind) {
    case 'done':
      return [0, 0.32, 0.64, 1.1, 1.42, 1.74].map((at, i) => ({ freq: i % 3 === 2 ? 1175 : 880, at, dur: 0.2 }));
    case 'work':
      return [
        { freq: 988, at: 0, dur: 0.14 },
        { freq: 1319, at: 0.22, dur: 0.22 },
      ];
    case 'rest':
      return [{ freq: 587, at: 0, dur: 0.45 }];
  }
}

/** Which alert (if any) a phase boundary should trigger. */
export function alertFor(ev: PhaseEnd): AlertKind {
  if (!ev.to) return 'done';
  return ev.to.kind === 'work' ? 'work' : 'rest';
}

/** Notification title/body for a boundary. */
export function notificationFor(ev: PhaseEnd): { title: string; body: string } {
  if (!ev.to) return { title: "Time's up", body: ev.from.kind === 'countdown' ? 'Your countdown has finished.' : 'All done. Nice work!' };
  return { title: `${ev.from.label} finished`, body: `Next: ${ev.to.label} (${describeDuration(ev.to.ms)})` };
}

/* ------------------------------------------------------------------ */
/* Settings sanitising (localStorage is untrusted)                     */
/* ------------------------------------------------------------------ */

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export function sanitizeSettings(raw: unknown): TimerSettings {
  const d = DEFAULT_SETTINGS;
  const r = obj(raw);
  const c = obj(r['countdown']);
  const p = obj(r['pomodoro']);
  const i = obj(r['interval']);
  return {
    countdown: { h: num(c['h'], d.countdown.h, 0, 99), m: num(c['m'], d.countdown.m, 0, 59), s: num(c['s'], d.countdown.s, 0, 59) },
    pomodoro: {
      work: num(p['work'], d.pomodoro.work, 1, 240),
      short: num(p['short'], d.pomodoro.short, 1, 120),
      long: num(p['long'], d.pomodoro.long, 1, 240),
      every: num(p['every'], d.pomodoro.every, 1, 12),
      autoStart: typeof p['autoStart'] === 'boolean' ? p['autoStart'] : d.pomodoro.autoStart,
    },
    interval: {
      work: num(i['work'], d.interval.work, 1, 3600),
      rest: num(i['rest'], d.interval.rest, 0, 3600),
      rounds: num(i['rounds'], d.interval.rounds, 1, 99),
      prep: num(i['prep'], d.interval.prep, 0, 600),
    },
  };
}

export function sanitizeMode(v: unknown): Mode {
  return v === 'pomodoro' || v === 'interval' || v === 'countdown' ? v : 'countdown';
}
