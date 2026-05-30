'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Stop {
  id: number;
  pct: string;
  decl: string;
}

let nextId = 10;

function sanitizeName(raw: string): string {
  const n = raw.trim().replace(/[^A-Za-z0-9_-]/g, '-');
  if (!n) return 'my-animation';
  return /^[A-Za-z_-]/.test(n) ? n : `a-${n}`;
}

export default function KeyframesGeneratorTool() {
  const [name, setName] = useState('pulse');
  const [stops, setStops] = useState<Stop[]>([
    { id: 1, pct: '0', decl: 'transform: scale(1); opacity: 1;' },
    { id: 2, pct: '50', decl: 'transform: scale(1.15); opacity: 0.7;' },
    { id: 3, pct: '100', decl: 'transform: scale(1); opacity: 1;' },
  ]);
  const [duration, setDuration] = useState('1.5s');
  const [timing, setTiming] = useState('ease-in-out');
  const [delay, setDelay] = useState('0s');
  const [iteration, setIteration] = useState('infinite');
  const [direction, setDirection] = useState('normal');
  const [fillMode, setFillMode] = useState('none');
  const [playState, setPlayState] = useState('running');
  const [restartKey, setRestartKey] = useState(0);

  const addStop = () =>
    setStops((s) => [...s, { id: nextId++, pct: '100', decl: '' }]);

  const safeName = useMemo(() => sanitizeName(name), [name]);

  const keyframesCss = useMemo(() => {
    const sorted = [...stops]
      .map((s) => {
        const n = Number(s.pct);
        return { ...s, num: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 };
      })
      .filter((s) => s.decl.trim() !== '')
      .sort((a, b) => a.num - b.num);

    if (sorted.length === 0) {
      return `@keyframes ${safeName} {\n  /* add at least one keyframe stop */\n}`;
    }

    const lines = sorted.map((s) => {
      const decl = s.decl
        .trim()
        .replace(/;\s*$/, '')
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => `    ${d};`)
        .join('\n');
      return `  ${s.num}% {\n${decl}\n  }`;
    });

    return `@keyframes ${safeName} {\n${lines.join('\n')}\n}`;
  }, [stops, safeName]);

  const shorthand = useMemo(() => {
    const it = iteration.trim() || '1';
    return `${safeName} ${duration} ${timing} ${delay} ${it} ${direction} ${fillMode}`.replace(
      /\s+/g,
      ' ',
    );
  }, [safeName, duration, timing, delay, iteration, direction, fillMode]);

  const fullCss = useMemo(
    () =>
      `${keyframesCss}\n\n.element {\n  animation: ${shorthand};\n  animation-play-state: ${playState};\n}`,
    [keyframesCss, shorthand, playState],
  );

  // Inject keyframes into a style tag for the live preview.
  useEffect(() => {
    const styleId = 'kf-preview-style';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = keyframesCss;
    return () => {
      // keep it; reused across renders
    };
  }, [keyframesCss]);

  const previewStyle: React.CSSProperties = {
    animation: shorthand,
    animationPlayState: playState,
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Keyframes" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Animation name">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-48 font-mono" />
            </Field>
          </OptionsBar>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="w-24">Stop %</span>
              <span className="flex-1">CSS declarations</span>
              <span className="w-8" />
            </div>
            {stops.map((s) => (
              <div key={s.id} className="flex items-start gap-2">
                <Input
                  value={s.pct}
                  onChange={(e) =>
                    setStops((st) => st.map((x) => (x.id === s.id ? { ...x, pct: e.target.value } : x)))
                  }
                  inputMode="numeric"
                  className="w-24 font-mono"
                />
                <Input
                  value={s.decl}
                  onChange={(e) =>
                    setStops((st) => st.map((x) => (x.id === s.id ? { ...x, decl: e.target.value } : x)))
                  }
                  placeholder="transform: translateX(0); opacity: 1;"
                  className="flex-1 font-mono"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setStops((st) => st.filter((x) => x.id !== s.id))}
                  aria-label="Remove stop"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={addStop}>
                <Plus className="size-3.5" /> Add stop
              </Button>
            </div>
          </div>

          <OptionsBar>
            <Field label="Duration">
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="w-24 font-mono" />
            </Field>
            <Field label="Timing function">
              <Select value={timing} onValueChange={setTiming}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Delay">
              <Input value={delay} onChange={(e) => setDelay(e.target.value)} className="w-24 font-mono" />
            </Field>
            <Field label="Iterations">
              <Input
                value={iteration}
                onChange={(e) => setIteration(e.target.value)}
                className="w-28 font-mono"
                placeholder="infinite"
              />
            </Field>
            <Field label="Direction">
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['normal', 'reverse', 'alternate', 'alternate-reverse'].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fill mode">
              <Select value={fillMode} onValueChange={setFillMode}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['none', 'forwards', 'backwards', 'both'].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Play state">
              <Select value={playState} onValueChange={setPlayState}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">running</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Preview">
            <Button variant="ghost" size="sm" onClick={() => setRestartKey((k) => k + 1)}>
              <RefreshCw className="size-3.5" /> Restart
            </Button>
          </PanelHeader>
          <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/40 p-8">
            <div
              key={restartKey}
              className="size-20 rounded-lg bg-primary"
              style={previewStyle}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="CSS">
            <CopyButton value={() => fullCss} label="Copy" />
            <DownloadButton data={() => fullCss} filename="animation.css" />
          </PanelHeader>
          <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
            {fullCss}
          </pre>
          <StatBar items={[`name: ${safeName}`, `${stops.length} stops`, shorthand]} />
        </Panel>
      </div>
    </div>
  );
}
