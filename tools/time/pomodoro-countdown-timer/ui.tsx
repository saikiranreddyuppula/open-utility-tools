'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Pause, Play, Plus, RotateCcw, SkipForward, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { cn } from '@/lib/utils';
import {
  COUNTDOWN_PRESETS_MIN,
  DEFAULT_SETTINGS,
  INTERVAL_PRESETS,
  addTime,
  alertFor,
  beepPattern,
  countdownMs,
  describeDuration,
  formatCountdown,
  initialEngine,
  intervalTotalMs,
  notificationFor,
  pauseEngine,
  phaseAt,
  pomodoroPreview,
  remainingMs,
  resetEngine,
  sanitizeMode,
  sanitizeSettings,
  skipPhase,
  startEngine,
  tick,
  type AlertKind,
  type Engine,
  type IntervalSettings,
  type Mode,
  type Phase,
  type PhaseEnd,
  type PhaseKind,
  type PomodoroSettings,
  type TimerSettings,
} from './logic';

const STORAGE_KEY = 'oneut:pomodoro-timer:v1';

interface Prefs {
  volume: number;
  sound: boolean;
  notify: boolean;
  wake: boolean;
}

const DEFAULT_PREFS: Prefs = { volume: 70, sound: true, notify: false, wake: false };

const PHASE_COLOR: Record<PhaseKind, string> = {
  countdown: 'text-primary',
  work: 'text-destructive',
  short: 'text-success',
  long: 'text-primary',
  prep: 'text-warning',
  rest: 'text-success',
};

type AudioCtor = typeof AudioContext;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Integer input that tolerates an empty field while typing. */
function NumInput({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
  suffix,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} className={className}>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          aria-label={label}
          disabled={disabled}
          value={draft ?? String(value)}
          onFocus={() => setDraft(String(value))}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Math.round(Number(e.target.value));
            if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="h-8 w-20 font-mono"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled, id }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; id: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className={cn('text-xs', disabled && 'opacity-50')}>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-2xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function Ring({ fraction, colorClass, children }: { fraction: number; colorClass: string; children: React.ReactNode }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
      <svg viewBox="0 0 200 200" className={cn('absolute inset-0 size-full -rotate-90', colorClass)} aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          data-testid="ring-progress"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">{children}</div>
    </div>
  );
}

export default function PomodoroCountdownTimer() {
  const [mode, setMode] = useState<Mode>('countdown');
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [engine, setEngine] = useState<Engine>(() => initialEngine('countdown', DEFAULT_SETTINGS));
  const [now, setNow] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [wakeSupported, setWakeSupported] = useState(false);
  const [notifySupported, setNotifySupported] = useState(false);

  const engineRef = useRef(engine);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  const prefsRef = useRef(prefs);
  const audioRef = useRef<AudioContext | null>(null);
  const lastBucket = useRef(-1);
  const baseTitle = useRef<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    settingsRef.current = settings;
    prefsRef.current = prefs;
  }, [mode, settings, prefs]);

  /* ---- load / save settings ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw) as Record<string, unknown>;
        const s = sanitizeSettings(o['settings']);
        const m = sanitizeMode(o['mode']);
        const p = (o['prefs'] ?? {}) as Partial<Prefs>;
        const next: Prefs = {
          volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 100 ? p.volume : DEFAULT_PREFS.volume,
          sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_PREFS.sound,
          notify: p.notify === true && typeof Notification !== 'undefined' && Notification.permission === 'granted',
          wake: p.wake === true,
        };
        setSettings(s);
        setMode(m);
        setPrefs(next);
        const e = initialEngine(m, s);
        engineRef.current = e;
        setEngine(e);
      }
    } catch {
      /* storage unavailable or corrupt: keep defaults */
    }
    setWakeSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
    setNotifySupported(typeof Notification !== 'undefined');
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, mode, settings, prefs }));
    } catch {
      /* ignore */
    }
  }, [loaded, mode, settings, prefs]);

  /* ---- audio ---- */
  const ensureAudio = useCallback((): AudioContext | null => {
    try {
      if (!audioRef.current) {
        const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return null;
        audioRef.current = new Ctor();
      }
      if (audioRef.current.state === 'suspended') void audioRef.current.resume().catch(() => undefined);
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  const playPattern = useCallback(
    (kind: AlertKind) => {
      const ctx = ensureAudio();
      if (!ctx) return;
      const vol = Math.pow(prefsRef.current.volume / 100, 2) * 0.5;
      if (vol <= 0) return;
      const t0 = ctx.currentTime + 0.03;
      for (const b of beepPattern(kind)) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = b.freq;
        const s = t0 + b.at;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(vol, s + 0.012);
        g.gain.setValueAtTime(vol, s + Math.max(0.013, b.dur - 0.04));
        g.gain.linearRampToValueAtTime(0, s + b.dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(s);
        osc.stop(s + b.dur + 0.02);
      }
    },
    [ensureAudio]
  );

  useEffect(
    () => () => {
      const ctx = audioRef.current;
      audioRef.current = null;
      if (ctx) void ctx.close().catch(() => undefined);
    },
    []
  );

  /* ---- title ---- */
  const stopFlash = useCallback(() => {
    if (flashTimer.current) {
      clearInterval(flashTimer.current);
      flashTimer.current = null;
      if (baseTitle.current !== null) document.title = baseTitle.current;
    }
  }, []);

  const startFlash = useCallback(
    (text: string) => {
      stopFlash();
      if (baseTitle.current === null) baseTitle.current = document.title;
      const base = baseTitle.current;
      let on = false;
      let n = 0;
      flashTimer.current = setInterval(() => {
        on = !on;
        document.title = on ? `⏰ ${text}` : base;
        if (++n > 60) stopFlash();
      }, 800);
    },
    [stopFlash]
  );

  useEffect(() => {
    const onAttention = (): void => {
      if (document.visibilityState === 'visible') stopFlash();
    };
    document.addEventListener('visibilitychange', onAttention);
    window.addEventListener('focus', onAttention);
    return () => {
      document.removeEventListener('visibilitychange', onAttention);
      window.removeEventListener('focus', onAttention);
      stopFlash();
    };
  }, [stopFlash]);

  /* ---- alerts ---- */
  const raiseAlert = useCallback(
    (ev: PhaseEnd) => {
      const p = prefsRef.current;
      if (p.sound) playPattern(alertFor(ev));
      const n = notificationFor(ev);
      if (p.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(n.title, { body: n.body, tag: 'oneut-timer' });
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
      if (document.visibilityState !== 'visible' || !document.hasFocus()) startFlash(n.title);
    },
    [playPattern, startFlash]
  );

  /* ---- engine loop ---- */
  const commit = useCallback((e: Engine) => {
    engineRef.current = e;
    setEngine(e);
  }, []);

  const step = useCallback(() => {
    const e = engineRef.current;
    if (e.status !== 'running') return;
    const t = Date.now();
    const { engine: next, events } = tick(modeRef.current, e, settingsRef.current, t);
    if (next !== e) commit(next);
    if (events.length) {
      const worked = events.filter((ev) => ev.from.kind === 'work').length;
      if (worked) setCompleted((c) => c + worked);
      const last = events[events.length - 1];
      if (last) raiseAlert(last);
    }
    const bucket = Math.ceil(remainingMs(next, t) / 100); // ceil: changes exactly when the shown second does
    if (bucket !== lastBucket.current || events.length) {
      lastBucket.current = bucket;
      setNow(t);
    }
  }, [commit, raiseAlert]);

  const running = engine.status === 'running';
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = (): void => {
      step();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const id = setInterval(step, 250); // keeps ticking in background tabs where rAF is paused
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [running, step]);

  /* ---- wake lock ---- */
  useEffect(() => {
    if (!prefs.wake || !running || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async (): Promise<void> => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release().catch(() => undefined);
        else sentinel = s;
      } catch {
        /* denied or unsupported */
      }
    };
    void acquire();
    const onVis = (): void => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release().catch(() => undefined);
    };
  }, [prefs.wake, running]);

  /* ---- actions ---- */
  const toggle = useCallback(() => {
    ensureAudio();
    stopFlash();
    const t = Date.now();
    const e = engineRef.current;
    const next = e.status === 'running' ? pauseEngine(e, t) : startEngine(modeRef.current, e, settingsRef.current, t);
    if (next.status === 'running' && e.status === 'done') setCompleted(0);
    lastBucket.current = -1;
    commit(next);
    setNow(t);
  }, [commit, ensureAudio, stopFlash]);

  const reset = useCallback(() => {
    stopFlash();
    setCompleted(0);
    commit(resetEngine(modeRef.current, settingsRef.current));
  }, [commit, stopFlash]);

  const skip = useCallback(() => {
    const t = Date.now();
    const e = engineRef.current;
    if (e.status === 'done') return;
    if (modeRef.current === 'countdown') return;
    commit(skipPhase(modeRef.current, e, settingsRef.current, t));
    setNow(t);
  }, [commit]);

  const addMinute = useCallback(() => {
    const t = Date.now();
    commit(addTime(engineRef.current, 60000));
    setNow(t);
  }, [commit]);

  const changeMode = (m: Mode): void => {
    if (m === mode) return;
    stopFlash();
    setCompleted(0);
    modeRef.current = m;
    setMode(m);
    commit(initialEngine(m, settingsRef.current));
  };

  const patch = <K extends keyof TimerSettings>(key: K, value: Partial<TimerSettings[K]>): void => {
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...value } }));
  };

  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]): void => setPrefs((p) => ({ ...p, [key]: value }));

  const toggleNotify = async (on: boolean): Promise<void> => {
    setHint(null);
    if (!on) {
      setPref('notify', false);
      return;
    }
    if (typeof Notification === 'undefined') {
      setHint('Desktop notifications are not supported in this browser.');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = 'denied';
      }
    }
    if (perm === 'granted') setPref('notify', true);
    else setHint('Notification permission was not granted. Allow it in your browser\'s site settings and try again.');
  };

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const onButton = e.target instanceof HTMLElement && e.target.closest('button:not([role="tab"]), a, [role="button"], [role="switch"], [role="slider"]') !== null;
      if (e.code === 'Space' || e.key === ' ') {
        if (onButton) return;
        e.preventDefault();
        toggle();
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, reset]);

  /* ---- derived view ---- */
  const phase: Phase | null = phaseAt(mode, engine.index, settings);
  const idle = engine.status === 'idle';
  const remaining = idle ? (phase?.ms ?? 0) : remainingMs(engine, now);
  const phaseMs = phase?.ms ?? 0;
  const fraction = engine.status === 'done' ? 0 : phaseMs > 0 ? Math.min(1, remaining / phaseMs) : 0;
  const kind: PhaseKind = phase?.kind ?? 'countdown';
  const colorClass = engine.status === 'done' ? 'text-success' : PHASE_COLOR[kind];
  const locked = engine.status === 'running' || engine.status === 'paused';
  const timeText = formatCountdown(remaining);
  const ready = idle && engine.index > 0;

  const phaseTitle = engine.status === 'done' ? "Time's up" : phase ? phase.label : '';
  const subtitle = useMemo(() => {
    if (engine.status === 'done') return mode === 'pomodoro' ? '' : 'Finished';
    if (mode === 'pomodoro' && phase) {
      const every = settings.pomodoro.every;
      const n = phase.number ?? 1;
      return phase.kind === 'work' ? `Session ${((n - 1) % every) + 1} of ${every}` : `After session ${((n - 1) % every) + 1} of ${every}`;
    }
    if (mode === 'interval' && phase) {
      return phase.kind === 'prep' ? 'Starting soon' : `Round ${phase.number ?? 1} of ${settings.interval.rounds}`;
    }
    return '';
  }, [engine.status, mode, phase, settings.pomodoro.every, settings.interval.rounds]);

  /* the tab title carries the countdown */
  const titleText = running || engine.status === 'paused' ? `${timeText} • ${phase?.label ?? 'Timer'}` : null;
  useEffect(() => {
    if (titleText === null || flashTimer.current) return;
    if (baseTitle.current === null) baseTitle.current = document.title;
    document.title = titleText;
  }, [titleText]);
  useEffect(() => {
    if (titleText === null && !flashTimer.current && baseTitle.current !== null) {
      document.title = baseTitle.current;
      baseTitle.current = null;
    }
  }, [titleText]);

  const preview = useMemo(() => pomodoroPreview(engine.index, 8, settings.pomodoro), [engine.index, settings.pomodoro]);
  const intervalTotal = intervalTotalMs(settings.interval);
  const countdownTotal = countdownMs(settings.countdown);

  const setCountdownMinutes = (min: number): void => patch('countdown', { h: Math.floor(min / 60), m: min % 60, s: 0 });
  const applyIntervalPreset = (s: IntervalSettings): void => patch('interval', s);

  const canStart = mode !== 'countdown' || countdownTotal > 0 || engine.status === 'paused';

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={(v) => changeMode(v as Mode)}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="countdown" disabled={locked}>Countdown</TabsTrigger>
          <TabsTrigger value="pomodoro" disabled={locked}>Pomodoro</TabsTrigger>
          <TabsTrigger value="interval" disabled={locked}>Interval</TabsTrigger>
        </TabsList>
      </Tabs>
      {locked && <p className="-mt-1 text-2xs text-muted-foreground">Reset the timer to switch modes or change its settings.</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* TIMER */}
        <Panel>
          <div className="flex flex-col items-center gap-5 p-5">
            <Ring fraction={fraction} colorClass={colorClass}>
              <div className={cn('text-xs font-semibold uppercase tracking-widest', colorClass)} data-testid="phase-label">
                {ready ? `Ready: ${phaseTitle}` : phaseTitle}
              </div>
              <div
                role="timer"
                aria-label={`Time remaining ${timeText}`}
                data-testid="timer-display"
                className="font-mono text-5xl font-semibold leading-none tracking-tight tabular sm:text-6xl"
              >
                {timeText}
              </div>
              <div className="h-4 text-xs text-muted-foreground" data-testid="phase-sub">{subtitle}</div>
            </Ring>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="lg"
                className="h-11 min-w-28 text-base"
                disabled={!canStart}
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  toggle();
                }}
                data-testid="start-pause"
              >
                {running ? (
                  <>
                    <Pause className="size-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> {engine.status === 'paused' ? 'Resume' : engine.status === 'done' ? 'Restart' : 'Start'}
                  </>
                )}
              </Button>
              {mode !== 'countdown' && (
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-11"
                  disabled={engine.status === 'done'}
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    skip();
                  }}
                  data-testid="skip"
                >
                  <SkipForward className="size-4" /> Skip
                </Button>
              )}
              {mode === 'countdown' && (
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-11"
                  disabled={!(running || engine.status === 'paused')}
                  onClick={(e) => {
                    if (e.detail > 0) e.currentTarget.blur();
                    addMinute();
                  }}
                  data-testid="plus-minute"
                >
                  <Plus className="size-4" /> 1 min
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="h-11"
                disabled={idle && engine.index === 0}
                onClick={(e) => {
                  if (e.detail > 0) e.currentTarget.blur();
                  reset();
                }}
                data-testid="reset"
              >
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
            <p className="text-center text-2xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 font-mono">Space</kbd> start / pause ·{' '}
              <kbd className="rounded border bg-muted px-1 font-mono">R</kbd> reset
            </p>
          </div>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={[
              mode === 'pomodoro' && `${completed} focus session${completed === 1 ? '' : 's'} completed`,
              mode === 'interval' && `total ${describeDuration(intervalTotal)}`,
              mode === 'countdown' && `set to ${describeDuration(countdownTotal)}`,
              'end time is stored as a timestamp, so it stays accurate in background tabs',
            ]}
          />
        </Panel>

        {/* SETTINGS */}
        <div className="flex flex-col gap-3">
          <Panel>
            <PanelHeader title={mode === 'countdown' ? 'Countdown' : mode === 'pomodoro' ? 'Pomodoro' : 'Interval'} />
            <div className="space-y-3 p-3">
              {mode === 'countdown' && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <NumInput label="Hours" value={settings.countdown.h} min={0} max={99} disabled={locked} onChange={(n) => patch('countdown', { h: n })} />
                    <NumInput label="Minutes" value={settings.countdown.m} min={0} max={59} disabled={locked} onChange={(n) => patch('countdown', { m: n })} />
                    <NumInput label="Seconds" value={settings.countdown.s} min={0} max={59} disabled={locked} onChange={(n) => patch('countdown', { s: n })} />
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
                    {COUNTDOWN_PRESETS_MIN.map((m) => (
                      <Button key={m} variant="outline" size="sm" disabled={locked} onClick={() => setCountdownMinutes(m)}>
                        {m === 60 ? '1 h' : `${m} min`}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {mode === 'pomodoro' && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <NumInput label="Focus" value={settings.pomodoro.work} min={1} max={240} suffix="min" disabled={locked} onChange={(n) => patch('pomodoro', { work: n })} />
                    <NumInput label="Short break" value={settings.pomodoro.short} min={1} max={120} suffix="min" disabled={locked} onChange={(n) => patch('pomodoro', { short: n })} />
                    <NumInput label="Long break" value={settings.pomodoro.long} min={1} max={240} suffix="min" disabled={locked} onChange={(n) => patch('pomodoro', { long: n })} />
                    <NumInput label="Long break every" value={settings.pomodoro.every} min={1} max={12} suffix="sessions" disabled={locked} onChange={(n) => patch('pomodoro', { every: n })} />
                  </div>
                  <ToggleRow
                    id="auto-start"
                    label="Auto-start next phase"
                    hint="Otherwise each break and focus session waits for you to press Start."
                    checked={settings.pomodoro.autoStart}
                    onChange={(v) => patch('pomodoro', { autoStart: v } as Partial<PomodoroSettings>)}
                  />
                  <div className="flex flex-wrap gap-1" aria-label="Upcoming phases">
                    {preview.map((p, i) => (
                      <span
                        key={i}
                        className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs', i === 0 && 'bg-accent font-semibold')}
                        title={`${p.label} · ${describeDuration(p.ms)}`}
                      >
                        <span className={cn('size-1.5 rounded-full bg-current', PHASE_COLOR[p.kind])} />
                        {p.kind === 'work' ? 'Focus' : p.kind === 'long' ? 'Long' : 'Short'} {Math.round(p.ms / 60000)}m
                      </span>
                    ))}
                  </div>
                </>
              )}
              {mode === 'interval' && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <NumInput label="Work" value={settings.interval.work} min={1} max={3600} suffix="s" disabled={locked} onChange={(n) => patch('interval', { work: n })} />
                    <NumInput label="Rest" value={settings.interval.rest} min={0} max={3600} suffix="s" disabled={locked} onChange={(n) => patch('interval', { rest: n })} />
                    <NumInput label="Rounds" value={settings.interval.rounds} min={1} max={99} disabled={locked} onChange={(n) => patch('interval', { rounds: n })} />
                    <NumInput label="Get ready" value={settings.interval.prep} min={0} max={600} suffix="s" disabled={locked} onChange={(n) => patch('interval', { prep: n })} />
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
                    {INTERVAL_PRESETS.map((p) => (
                      <Button key={p.id} variant="outline" size="sm" disabled={locked} onClick={() => applyIntervalPreset(p.s)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Total {describeDuration(intervalTotal)}. The timer moves from work to rest by itself and does not rest after the last round.
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Alerts">
              <Volume2 className="size-3.5 text-muted-foreground" />
            </PanelHeader>
            <div className="space-y-3 p-3">
              <ToggleRow id="sound" label="Sound" checked={prefs.sound} onChange={(v) => setPref('sound', v)} />
              <div className="flex items-center gap-3">
                <span className="w-14 text-2xs uppercase tracking-wide text-muted-foreground">Volume</span>
                <Slider
                  value={[prefs.volume]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={!prefs.sound}
                  aria-label="Volume"
                  onValueChange={(v) => setPref('volume', v[0] ?? 70)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" disabled={!prefs.sound} onClick={() => playPattern('done')} data-testid="test-sound">
                  <Bell className="size-3.5" /> Test sound
                </Button>
              </div>
              <ToggleRow
                id="notify"
                label="Desktop notification"
                hint={notifySupported ? 'Asks for permission when you switch it on.' : 'Not supported in this browser.'}
                checked={prefs.notify}
                disabled={!notifySupported}
                onChange={(v) => void toggleNotify(v)}
              />
              <ToggleRow
                id="wake"
                label="Keep screen awake while running"
                hint={wakeSupported ? 'Uses the Screen Wake Lock API.' : 'Not supported in this browser.'}
                checked={prefs.wake}
                disabled={!wakeSupported}
                onChange={(v) => setPref('wake', v)}
              />
              {hint && <p className="text-2xs text-destructive">{hint}</p>}
              <p className="text-2xs text-muted-foreground">The tab title also shows the time left and flashes when time is up while you are in another tab.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
