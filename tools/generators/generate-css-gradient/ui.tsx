'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

type GradientType = 'linear' | 'radial';
type RadialShape = 'circle' | 'ellipse';

interface Stop {
  id: string;
  color: string;
  pos: number;
}

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

function newId(): string {
  try {
    return webcrypto.randomUUID();
  } catch {
    return `s-${Math.random().toString(36).slice(2)}`;
  }
}

function buildGradient(
  type: GradientType,
  angle: number,
  shape: RadialShape,
  stops: Stop[],
): string {
  const ordered = [...stops].sort((a, b) => a.pos - b.pos);
  const stopStr = ordered.map((s) => `${s.color} ${s.pos}%`).join(', ');
  if (type === 'linear') {
    return `linear-gradient(${angle}deg, ${stopStr})`;
  }
  return `radial-gradient(${shape} at center, ${stopStr})`;
}

export default function CssGradientGenerator() {
  const [type, setType] = useState<GradientType>('linear');
  const [angle, setAngle] = useState(90);
  const [shape, setShape] = useState<RadialShape>('circle');
  const [stops, setStops] = useState<Stop[]>([
    { id: newId(), color: '#6366f1', pos: 0 },
    { id: newId(), color: '#ec4899', pos: 100 },
  ]);

  const gradient = useMemo(
    () => buildGradient(type, angle, shape, stops),
    [type, angle, shape, stops],
  );

  const css = useMemo(() => `background: ${gradient};`, [gradient]);

  const addStop = () => {
    setStops((prev) => {
      const lastPos = prev.length > 0 ? (prev[prev.length - 1]?.pos ?? 100) : 100;
      const pos = Math.min(100, Math.round(lastPos / 2) + 25);
      return [...prev, { id: newId(), color: '#22c55e', pos }];
    });
  };

  const removeStop = (id: string) => {
    setStops((prev) => (prev.length > 2 ? prev.filter((s) => s.id !== id) : prev));
  };

  const updateStop = (id: string, patch: Partial<Stop>) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as GradientType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {type === 'linear' ? (
            <Field label={`Angle: ${angle}deg`}>
              <Slider
                min={0}
                max={360}
                step={1}
                value={[angle]}
                onValueChange={(v) => setAngle(v[0] ?? angle)}
              />
            </Field>
          ) : (
            <Field label="Shape">
              <Select value={shape} onValueChange={(v) => setShape(v as RadialShape)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="ellipse">Ellipse</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Color stops">
          <Button type="button" variant="outline" size="sm" onClick={addStop}>
            <Plus className="mr-2 h-4 w-4" />
            Add stop
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-3">
          {stops.map((stop) => (
            <div key={stop.id} className="flex items-end gap-3">
              <Field label="Color" className="shrink-0">
                <Input
                  type="color"
                  value={stop.color}
                  onChange={(e) => updateStop(stop.id, { color: e.target.value })}
                  className="h-9 w-14 p-1"
                />
              </Field>
              <Field label="Hex" className="w-32 shrink-0">
                <Input
                  value={stop.color}
                  onChange={(e) => updateStop(stop.id, { color: e.target.value })}
                  className="font-mono"
                />
              </Field>
              <Field label={`Position: ${stop.pos}%`} className="flex-1">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[stop.pos]}
                  onValueChange={(v) => updateStop(stop.id, { pos: v[0] ?? stop.pos })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeStop(stop.id)}
                disabled={stops.length <= 2}
                aria-label="Remove stop"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="h-48 w-full rounded-md border border-border" style={{ background: gradient }} />
      </Panel>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={css} />
        </PanelHeader>
        <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">{css}</pre>
        <StatBar items={[`type: ${type}`, `${stops.length} stops`]} />
      </Panel>
    </div>
  );
}
