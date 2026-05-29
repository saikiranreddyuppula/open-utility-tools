'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

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
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

interface Stop {
  color: string;
  pos: number;
}

type GType = 'linear' | 'radial' | 'conic';

export default function GradientGeneratorTool() {
  const [type, setType] = useState<GType>('linear');
  const [angle, setAngle] = useState(90);
  const [stops, setStops] = useState<Stop[]>([
    { color: '#5b5bd6', pos: 0 },
    { color: '#22d3ee', pos: 100 },
  ]);

  const css = useMemo(() => {
    const list = [...stops]
      .sort((a, b) => a.pos - b.pos)
      .map((s) => `${s.color} ${s.pos}%`)
      .join(', ');
    if (type === 'linear') return `linear-gradient(${angle}deg, ${list})`;
    if (type === 'radial') return `radial-gradient(circle, ${list})`;
    return `conic-gradient(from ${angle}deg, ${list})`;
  }, [type, angle, stops]);

  const update = (i: number, patch: Partial<Stop>) =>
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-3">
      <div className="h-48 w-full rounded-lg border" style={{ background: css }} />

      <OptionsBar>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as GType)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
              <SelectItem value="conic">Conic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {type !== 'radial' && (
          <Field label={`Angle · ${angle}°`} className="min-w-44">
            <Slider value={[angle]} onValueChange={([v]) => setAngle(v ?? 90)} min={0} max={360} className="mt-2.5" />
          </Field>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title="Color stops">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStops((p) => [...p, { color: '#ffffff', pos: 50 }])}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <input
                type="color"
                value={s.color}
                onChange={(e) => update(i, { color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border p-0.5"
              />
              <Input value={s.color} onChange={(e) => update(i, { color: e.target.value })} className="w-28 font-mono" />
              <Slider
                value={[s.pos]}
                onValueChange={([v]) => update(i, { pos: v ?? 0 })}
                min={0}
                max={100}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-2xs tabular text-muted-foreground">{s.pos}%</span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setStops((p) => (p.length > 2 ? p.filter((_, idx) => idx !== i) : p))}
                disabled={stops.length <= 2}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={`background: ${css};`} />
        </PanelHeader>
        <code className="block break-all p-3 font-mono text-xs">background: {css};</code>
      </Panel>
    </div>
  );
}
