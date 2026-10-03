/**
 * Stopwatch state machine, lap statistics and formatting. Pure TypeScript.
 *
 * Elapsed time is measured with a monotonic clock (performance.now) accumulated across
 * pauses. A wall-clock epoch (Date.now) is stored alongside so a page reload can resume a
 * running stopwatch.
 */

export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface StopwatchState {
  status: StopwatchStatus;
  /** ms accumulated before the current running segment. */
  accumulated: number;
  /** performance.now() when the current segment began (running only). */
  startPerf: number | null;
  /** Date.now() when the current segment began (running only, persisted). */
  startEpoch: number | null;
  /** Cumulative elapsed ms at each lap press. */
  splits: number[];
}

export const INITIAL_STATE: StopwatchState = {
  status: 'idle',
  accumulated: 0,
  startPerf: null,
  startEpoch: null,
  splits: [],
};

export function elapsedMs(s: StopwatchState, nowPerf: number): number {
  if (s.status === 'running' && s.startPerf !== null) return s.accumulated + Math.max(0, nowPerf - s.startPerf);
  return s.accumulated;
}

export function startWatch(s: StopwatchState, nowPerf: number, nowEpoch: number): StopwatchState {
  if (s.status === 'running') return s;
  return { ...s, status: 'running', startPerf: nowPerf, startEpoch: nowEpoch };
}

export function pauseWatch(s: StopwatchState, nowPerf: number): StopwatchState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', accumulated: elapsedMs(s, nowPerf), startPerf: null, startEpoch: null };
}

/** Record a lap (only while running, and only if time advanced since the last one). */
export function lapWatch(s: StopwatchState, nowPerf: number): StopwatchState {
  if (s.status !== 'running') return s;
  const t = elapsedMs(s, nowPerf);
  const last = s.splits[s.splits.length - 1] ?? 0;
  if (t <= last) return s;
  return { ...s, splits: [...s.splits, t] };
}

export function resetWatch(): StopwatchState {
  return { ...INITIAL_STATE };
}

/* ---- persistence ---- */

export interface PersistedState {
  v: 1;
  status: StopwatchStatus;
  accumulated: number;
  startEpoch: number | null;
  splits: number[];
}

export function toPersisted(s: StopwatchState): PersistedState {
  return { v: 1, status: s.status, accumulated: s.accumulated, startEpoch: s.startEpoch, splits: s.splits };
}

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/** Validate untrusted JSON and rebuild a state, re-anchoring the monotonic clock. */
export function restoreState(raw: unknown, nowPerf: number, nowEpoch: number): StopwatchState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o['v'] !== 1) return null;
  const status = o['status'];
  if (status !== 'idle' && status !== 'running' && status !== 'paused') return null;
  if (!isFiniteNonNeg(o['accumulated'])) return null;
  const splitsRaw = o['splits'];
  if (!Array.isArray(splitsRaw) || !splitsRaw.every(isFiniteNonNeg)) return null;
  const splits = (splitsRaw as number[]).slice(0, 10000);
  if (status !== 'running') {
    return { status, accumulated: o['accumulated'], startPerf: null, startEpoch: null, splits };
  }
  const epoch = o['startEpoch'];
  if (!isFiniteNonNeg(epoch)) return null;
  const sinceStart = Math.max(0, nowEpoch - epoch);
  return { status: 'running', accumulated: o['accumulated'], startPerf: nowPerf - sinceStart, startEpoch: epoch, splits };
}

/* ---- formatting ---- */

/** hh:mm:ss.cc (centiseconds truncated, never rounded up). Hours grow past 99 if needed. */
export function formatStopwatch(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const c = cs % 100;
  const s = Math.floor(cs / 100) % 60;
  const m = Math.floor(cs / 6000) % 60;
  const h = Math.floor(cs / 360000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(c)}`;
}

/** Compact lap format: m:ss.cc, or h:mm:ss.cc from one hour. */
export function formatLapTime(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const c = cs % 100;
  const s = Math.floor(cs / 100) % 60;
  const m = Math.floor(cs / 6000) % 60;
  const h = Math.floor(cs / 360000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}.${p(c)}` : `${m}:${p(s)}.${p(c)}`;
}

/** +m:ss.cc / -m:ss.cc (sign always shown). */
export function formatDiff(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${formatLapTime(Math.abs(ms))}`;
}

/** Whole-second clock for the document title: hh:mm:ss */
export function formatTitleTime(ms: number): string {
  const t = Math.floor(Math.max(0, ms) / 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}

/* ---- laps ---- */

export interface LapRow {
  n: number;
  lap: number;
  split: number;
  /** lap minus the previous lap; null for the first. */
  diff: number | null;
}

export interface LapStats {
  count: number;
  best: number | null;
  worst: number | null;
  /** 0-based row indices of best / worst (first occurrence); null when fewer than 2 laps. */
  bestIndex: number | null;
  worstIndex: number | null;
  average: number | null;
  total: number;
}

export function computeLaps(splits: number[]): LapRow[] {
  return splits.map((split, i) => {
    const prev = i > 0 ? (splits[i - 1] ?? 0) : 0;
    const lap = split - prev;
    const prevLap = i > 0 ? (splits[i - 1] ?? 0) - (i > 1 ? (splits[i - 2] ?? 0) : 0) : null;
    return { n: i + 1, lap, split, diff: prevLap === null ? null : lap - prevLap };
  });
}

export function lapStats(rows: LapRow[]): LapStats {
  if (rows.length === 0) return { count: 0, best: null, worst: null, bestIndex: null, worstIndex: null, average: null, total: 0 };
  let bi = 0;
  let wi = 0;
  let sum = 0;
  rows.forEach((r, i) => {
    sum += r.lap;
    if (r.lap < (rows[bi]?.lap ?? Infinity)) bi = i;
    if (r.lap > (rows[wi]?.lap ?? -Infinity)) wi = i;
  });
  const distinct = rows.length >= 2 && rows[bi]?.lap !== rows[wi]?.lap;
  return {
    count: rows.length,
    best: rows[bi]?.lap ?? null,
    worst: rows[wi]?.lap ?? null,
    bestIndex: distinct ? bi : null,
    worstIndex: distinct ? wi : null,
    average: sum / rows.length,
    total: rows[rows.length - 1]?.split ?? 0,
  };
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function lapsToCsv(rows: LapRow[]): string {
  const head = ['Lap', 'Lap time', 'Split time', 'Difference', 'Lap (ms)', 'Split (ms)'];
  const lines = rows.map((r) =>
    [String(r.n), formatLapTime(r.lap), formatLapTime(r.split), r.diff === null ? '' : formatDiff(r.diff), String(Math.round(r.lap)), String(Math.round(r.split))]
      .map(csvCell)
      .join(',')
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}

/** Tab separated, handy for pasting into a spreadsheet. */
export function lapsToTsv(rows: LapRow[]): string {
  const head = ['Lap', 'Lap time', 'Split time', 'Difference'];
  const lines = rows.map((r) => [String(r.n), formatLapTime(r.lap), formatLapTime(r.split), r.diff === null ? '' : formatDiff(r.diff)].join('\t'));
  return [head.join('\t'), ...lines].join('\n') + '\n';
}
