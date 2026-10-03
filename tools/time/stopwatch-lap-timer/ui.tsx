'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { cn } from '@/lib/utils';
import {
  INITIAL_STATE,
  computeLaps,
  elapsedMs,
  formatDiff,
  formatLapTime,
  formatStopwatch,
  formatTitleTime,
  lapStats,
  lapWatch,
  lapsToCsv,
  lapsToTsv,
  pauseWatch,
  resetWatch,
  restoreState,
  startWatch,
  toPersisted,
  type StopwatchState,
} from './logic';

const STORAGE_KEY = 'oneut:stopwatch:v1';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

function Display({ state, isFs }: { state: StopwatchState; isFs: boolean }) {
  const [live, setLive] = useState(0);
  const running = state.status === 'running';

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = (): void => {
      setLive(elapsedMs(state, performance.now()));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [running, state]);

  const t = running ? live : state.accumulated;
  const text = formatStopwatch(t);
  const main = text.slice(0, -3);
  const cs = text.slice(-3);
  const lastSplit = state.splits[state.splits.length - 1] ?? 0;
  const currentLap = Math.max(0, t - lastSplit);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        data-testid="stopwatch-display"
        role="timer"
        aria-live="off"
        aria-label={`Elapsed time ${text}`}
        className="font-mono font-semibold leading-none tracking-tight tabular"
        style={{ fontSize: isFs ? 'clamp(3rem, 15vw, 16rem)' : 'clamp(2.25rem, 11vw, 5.75rem)' }}
      >
        {main}
        <span className="text-muted-foreground" style={{ fontSize: '0.6em' }}>
          {cs}
        </span>
      </div>
      <div className="h-5 font-mono text-sm text-muted-foreground tabular" data-testid="current-lap">
        {state.status === 'idle' ? ' ' : `Lap ${state.splits.length + 1}  ${formatLapTime(currentLap)}`}
      </div>
    </div>
  );
}

export default function StopwatchTool() {
  const [state, setState] = useState<StopwatchState>(INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [fsSupported, setFsSupported] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const originalTitle = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* restore a stopwatch that was running when the page was closed or reloaded */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = restoreState(JSON.parse(raw) as unknown, performance.now(), Date.now());
        if (restored) setState(restored);
      }
    } catch {
      /* storage unavailable or corrupt */
    }
    setFsSupported(typeof document !== 'undefined' && document.fullscreenEnabled === true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  /* document.title shows the running time (interval keeps it fresh in background tabs) */
  const running = state.status === 'running';
  useEffect(() => {
    if (!running) return;
    if (originalTitle.current === null) originalTitle.current = document.title;
    const update = (): void => {
      document.title = `${formatTitleTime(elapsedMs(stateRef.current, performance.now()))} • Stopwatch`;
    };
    update();
    const id = setInterval(update, 250);
    return () => {
      clearInterval(id);
      if (originalTitle.current !== null) {
        document.title = originalTitle.current;
        originalTitle.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    const onFs = (): void => setIsFs(document.fullscreenElement !== null && document.fullscreenElement === displayRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* actions */
  const toggle = useCallback(() => {
    const perf = performance.now();
    const epoch = Date.now();
    setState((s) => (s.status === 'running' ? pauseWatch(s, perf) : startWatch(s, perf, epoch)));
  }, []);
  const lap = useCallback(() => {
    const perf = performance.now();
    setState((s) => lapWatch(s, perf));
  }, []);
  const reset = useCallback(() => setState(resetWatch()), []);

  const toggleFullscreen = useCallback(async () => {
    const el = displayRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* denied */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const onButton = e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]') !== null;
      if (e.code === 'Space' || e.key === ' ') {
        if (onButton) return;
        e.preventDefault();
        toggle();
      } else if (e.key === 'l' || e.key === 'L') {
        lap();
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      } else if ((e.key === 'f' || e.key === 'F') && fsSupported) {
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, lap, reset, toggleFullscreen, fsSupported]);

  const rows = useMemo(() => computeLaps(state.splits), [state.splits]);
  const stats = useMemo(() => lapStats(rows), [rows]);
  const shown = useMemo(() => [...rows].reverse(), [rows]);

  const blurIfPointer = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (e.detail > 0) e.currentTarget.blur();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={displayRef}
        className={cn(
          'flex flex-col items-center justify-center gap-5 border bg-card px-4 py-8',
          isFs ? 'min-h-screen rounded-none border-0 bg-background' : 'rounded-lg'
        )}
      >
        <Display state={state} isFs={isFs} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="lg"
            className="h-11 min-w-28 text-base"
            onClick={(e) => {
              blurIfPointer(e);
              toggle();
            }}
            data-testid="start-pause"
          >
            {state.status === 'running' ? (
              <>
                <Pause className="size-4" /> Pause
              </>
            ) : (
              <>
                <Play className="size-4" /> {state.status === 'paused' ? 'Resume' : 'Start'}
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-11 min-w-24 text-base"
            disabled={state.status !== 'running'}
            onClick={(e) => {
              blurIfPointer(e);
              lap();
            }}
            data-testid="lap"
          >
            <Flag className="size-4" /> Lap
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 min-w-24 text-base"
            disabled={state.status === 'idle' && state.accumulated === 0}
            onClick={(e) => {
              blurIfPointer(e);
              reset();
            }}
            data-testid="reset"
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
          {fsSupported && (
            <Button
              size="lg"
              variant="ghost"
              className="h-11"
              onClick={(e) => {
                blurIfPointer(e);
                void toggleFullscreen();
              }}
              aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFs ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              <span className="hidden sm:inline">{isFs ? 'Exit' : 'Fullscreen'}</span>
            </Button>
          )}
        </div>
        <p className="text-center text-2xs text-muted-foreground">
          Shortcuts:{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">Space</kbd> start / pause ·{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">L</kbd> lap ·{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">R</kbd> reset
          {fsSupported && (
            <>
              {' '}· <kbd className="rounded border bg-muted px-1 font-mono">F</kbd> fullscreen
            </>
          )}
        </p>
      </div>

      <Panel>
        <PanelHeader title={`Laps${rows.length ? ` · ${rows.length}` : ''}`}>
          <CopyButton value={() => lapsToTsv(rows)} label="Copy" disabled={rows.length === 0} />
          <DownloadButton data={() => lapsToCsv(rows)} filename="laps.csv" mime="text/csv;charset=utf-8" label="CSV" disabled={rows.length === 0} />
        </PanelHeader>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Press <b>Lap</b> (or <kbd className="rounded border bg-muted px-1 font-mono text-xs">L</kbd>) while the stopwatch is running to record a split.
          </p>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[340px] border-collapse text-sm" data-testid="laps-table">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                <tr className="text-left text-2xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="w-16 px-3 py-1.5 font-medium">Lap</th>
                  <th scope="col" className="px-3 py-1.5 font-medium">Lap time</th>
                  <th scope="col" className="px-3 py-1.5 font-medium">Split</th>
                  <th scope="col" className="px-3 py-1.5 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono tabular">
                {shown.map((r) => {
                  const idx = r.n - 1;
                  const best = idx === stats.bestIndex;
                  const worst = idx === stats.worstIndex;
                  return (
                    <tr
                      key={r.n}
                      data-testid={`lap-row-${r.n}`}
                      data-highlight={best ? 'best' : worst ? 'worst' : undefined}
                      className={cn(best && 'bg-success/10 text-success', worst && 'bg-destructive/10 text-destructive')}
                    >
                      <td className="px-3 py-1.5">
                        {r.n}
                        {best && <span className="ml-1.5 font-sans text-2xs uppercase">best</span>}
                        {worst && <span className="ml-1.5 font-sans text-2xs uppercase">slowest</span>}
                      </td>
                      <td className="px-3 py-1.5 font-semibold">{formatLapTime(r.lap)}</td>
                      <td className="px-3 py-1.5">{formatLapTime(r.split)}</td>
                      <td className={cn('px-3 py-1.5', !best && !worst && 'text-muted-foreground')}>{r.diff === null ? '–' : formatDiff(r.diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <StatBar
          className="h-auto min-h-7 py-1"
          items={[
            `${stats.count} lap${stats.count === 1 ? '' : 's'}`,
            stats.average !== null && `average ${formatLapTime(stats.average)}`,
            stats.best !== null && `best ${formatLapTime(stats.best)}`,
            stats.worst !== null && `worst ${formatLapTime(stats.worst)}`,
            stats.count > 0 && `total ${formatLapTime(stats.total)}`,
          ]}
        />
      </Panel>
      <p className="text-2xs text-muted-foreground">
        Time comes from the browser&apos;s monotonic clock and is accumulated across pauses, so it does not drift. A running stopwatch keeps running if you reload or reopen this page (stored locally in your browser only).
      </p>
    </div>
  );
}
