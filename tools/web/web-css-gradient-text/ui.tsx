'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type GradientType = 'linear' | 'radial';
type RadialShape = 'circle' | 'ellipse';

interface Stop {
  id: number;
  color: string;
  pos: number;
}

let nextId = 1;
function stop(color: string, pos: number): Stop {
  return { id: nextId++, color, pos };
}

function clampHex(v: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '#000000';
}

export default function CssGradientTextTool() {
  const [type, setType] = useState<GradientType>('linear');
  const [angle, setAngle] = useState(90);
  const [shape, setShape] = useState<RadialShape>('ellipse');
  const [fontSize, setFontSize] = useState(48);
  const [sample, setSample] = useState('Gradient Text');
  const [stops, setStops] = useState<Stop[]>(() => [stop('#6366f1', 0), stop('#ec4899', 100)]);

  const gradient = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    const stopStr = sorted.map((s) => `${clampHex(s.color)} ${s.pos}%`).join(', ');
    if (type === 'linear') return `linear-gradient(${angle}deg, ${stopStr})`;
    return `radial-gradient(${shape}, ${stopStr})`;
  }, [stops, type, angle, shape]);

  const css = useMemo(
    () =>
      [
        `background-image: ${gradient};`,
        '-webkit-background-clip: text;',
        'background-clip: text;',
        '-webkit-text-fill-color: transparent;',
        'color: transparent;',
      ].join('\n'),
    [gradient],
  );

  const previewStyle: CSSProperties = {
    backgroundImage: gradient,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    fontSize: `${fontSize}px`,
    fontWeight: 800,
    lineHeight: 1.1,
  };

  const updateStop = (id: number, patch: Partial<Pick<Stop, 'color' | 'pos'>>) =>
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeStop = (id: number) => setStops((prev) => prev.filter((s) => s.id !== id));
  const addStop = () => setStops((prev) => [...prev, stop('#10b981', 50)]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Gradient" />
        <div className="space-y-4 p-3">
          <OptionsBar>
            <Field label="Type" className="w-32">
              <Select value={type} onValueChange={(v) => setType(v as GradientType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">linear</SelectItem>
                  <SelectItem value="radial">radial</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {type === 'linear' ? (
              <Field label={`Angle: ${angle}deg`} className="min-w-[180px] flex-1">
                <Slider value={[angle]} min={0} max={360} step={1} onValueChange={(v) => setAngle(v[0] ?? 90)} />
              </Field>
            ) : (
              <Field label="Shape" className="w-32">
                <Select value={shape} onValueChange={(v) => setShape(v as RadialShape)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">circle</SelectItem>
                    <SelectItem value="ellipse">ellipse</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label={`Font size: ${fontSize}px`} className="min-w-[160px] flex-1">
              <Slider value={[fontSize]} min={16} max={120} step={1} onValueChange={(v) => setFontSize(v[0] ?? 48)} />
            </Field>
          </OptionsBar>

          <Field label="Sample text">
            <Input value={sample} onChange={(e) => setSample(e.target.value)} />
          </Field>

          <Field label="Color stops">
            <div className="space-y-2">
              {stops.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs text-muted-foreground">{idx + 1}</span>
                  <input
                    type="color"
                    value={clampHex(s.color)}
                    onChange={(e) => updateStop(s.id, { color: e.target.value })}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-transparent"
                    aria-label={`Stop ${idx + 1} color`}
                  />
                  <Input
                    value={s.color}
                    onChange={(e) => updateStop(s.id, { color: e.target.value })}
                    className="h-8 w-28 font-mono"
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <Slider
                      value={[s.pos]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => updateStop(s.id, { pos: v[0] ?? s.pos })}
                      className="flex-1"
                    />
                    <span className="w-10 shrink-0 text-right font-mono text-xs">{s.pos}%</span>
                  </div>
                  <button
                    className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    onClick={() => removeStop(s.id)}
                    disabled={stops.length <= 2}
                    aria-label="Remove stop"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={addStop}
              >
                <Plus className="size-3.5" /> Add stop
              </button>
            </div>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview & CSS">
          <CopyButton value={() => css} label="Copy CSS" />
        </PanelHeader>
        <div className="flex min-h-[160px] items-center justify-center break-words p-6 text-center">
          <span style={previewStyle}>{sample || 'Gradient Text'}</span>
        </div>
        <div className="p-3">
          <pre className="overflow-auto whitespace-pre rounded bg-muted px-3 py-2 font-mono text-xs">{css}</pre>
        </div>
        <StatBar items={[type, `${stops.length} stops`, `${fontSize}px`]} />
      </Panel>
    </div>
  );
}
