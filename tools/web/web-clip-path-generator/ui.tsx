'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ShapeType = 'polygon' | 'circle' | 'ellipse' | 'inset';

interface Pt {
  id: number;
  x: number;
  y: number;
}

let nextId = 1;
function pt(x: number, y: number): Pt {
  return { id: nextId++, x, y };
}

const POLY_PRESETS: Record<string, Array<[number, number]>> = {
  Triangle: [
    [50, 0],
    [100, 100],
    [0, 100],
  ],
  Hexagon: [
    [25, 0],
    [75, 0],
    [100, 50],
    [75, 100],
    [25, 100],
    [0, 50],
  ],
  Star: [
    [50, 0],
    [61, 35],
    [98, 35],
    [68, 57],
    [79, 91],
    [50, 70],
    [21, 91],
    [32, 57],
    [2, 35],
    [39, 35],
  ],
  Rhombus: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  'Message bubble': [
    [0, 0],
    [100, 0],
    [100, 75],
    [75, 75],
    [75, 100],
    [50, 75],
    [0, 75],
  ],
  Arrow: [
    [0, 20],
    [60, 20],
    [60, 0],
    [100, 50],
    [60, 100],
    [60, 80],
    [0, 80],
  ],
};

function fmt(n: number): string {
  // Trim trailing zeros; keep up to 2 decimals.
  return parseFloat(n.toFixed(2)).toString();
}

export default function ClipPathGeneratorTool() {
  const [shape, setShape] = useState<ShapeType>('polygon');
  const [points, setPoints] = useState<Pt[]>(() =>
    (POLY_PRESETS.Hexagon ?? []).map(([x, y]) => pt(x, y)),
  );

  const [circleR, setCircleR] = useState('50');
  const [circleX, setCircleX] = useState('50');
  const [circleY, setCircleY] = useState('50');

  const [ellRx, setEllRx] = useState('40');
  const [ellRy, setEllRy] = useState('50');
  const [ellX, setEllX] = useState('50');
  const [ellY, setEllY] = useState('50');

  const [insTop, setInsTop] = useState('10');
  const [insRight, setInsRight] = useState('10');
  const [insBottom, setInsBottom] = useState('10');
  const [insLeft, setInsLeft] = useState('10');
  const [insRound, setInsRound] = useState('0');

  const num = (s: string, fallback = 0): number => {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  };

  const value = useMemo(() => {
    if (shape === 'polygon') {
      if (points.length < 3) return 'polygon(0 0, 100% 0, 50% 100%)';
      const pairs = points.map((p) => `${fmt(p.x)}% ${fmt(p.y)}%`).join(', ');
      return `polygon(${pairs})`;
    }
    if (shape === 'circle') {
      return `circle(${fmt(num(circleR, 50))}% at ${fmt(num(circleX, 50))}% ${fmt(num(circleY, 50))}%)`;
    }
    if (shape === 'ellipse') {
      return `ellipse(${fmt(num(ellRx, 40))}% ${fmt(num(ellRy, 50))}% at ${fmt(num(ellX, 50))}% ${fmt(num(ellY, 50))}%)`;
    }
    // inset
    const base = `inset(${fmt(num(insTop))}% ${fmt(num(insRight))}% ${fmt(num(insBottom))}% ${fmt(num(insLeft))}%`;
    const r = num(insRound);
    return r > 0 ? `${base} round ${fmt(r)}px)` : `${base})`;
  }, [
    shape,
    points,
    circleR,
    circleX,
    circleY,
    ellRx,
    ellRy,
    ellX,
    ellY,
    insTop,
    insRight,
    insBottom,
    insLeft,
    insRound,
  ]);

  const css = `clip-path: ${value};\n-webkit-clip-path: ${value};`;

  const updatePt = (id: number, patch: Partial<Pick<Pt, 'x' | 'y'>>) =>
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePt = (id: number) => setPoints((prev) => prev.filter((p) => p.id !== id));
  const addPt = () => setPoints((prev) => [...prev, pt(50, 50)]);
  const applyPolyPreset = (name: string) => {
    const preset = POLY_PRESETS[name];
    if (preset) setPoints(preset.map(([x, y]) => pt(x, y)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Shape" />
        <div className="space-y-4 p-3">
          <Field label="Shape type">
            <Select value={shape} onValueChange={(v) => setShape(v as ShapeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polygon">polygon()</SelectItem>
                <SelectItem value="circle">circle()</SelectItem>
                <SelectItem value="ellipse">ellipse()</SelectItem>
                <SelectItem value="inset">inset()</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {shape === 'polygon' && (
            <>
              <div className="flex flex-wrap gap-1">
                {Object.keys(POLY_PRESETS).map((name) => (
                  <button
                    key={name}
                    className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => applyPolyPreset(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {points.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-6 text-right text-xs text-muted-foreground">{idx + 1}</span>
                    <Input
                      type="number"
                      value={p.x}
                      onChange={(e) => updatePt(p.id, { x: num(e.target.value) })}
                      className="h-8 w-20 font-mono"
                      aria-label={`Point ${idx + 1} X`}
                    />
                    <span className="text-xs text-muted-foreground">% x</span>
                    <Input
                      type="number"
                      value={p.y}
                      onChange={(e) => updatePt(p.id, { y: num(e.target.value) })}
                      className="h-8 w-20 font-mono"
                      aria-label={`Point ${idx + 1} Y`}
                    />
                    <span className="text-xs text-muted-foreground">% y</span>
                    <button
                      className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                      onClick={() => removePt(p.id)}
                      disabled={points.length <= 3}
                      aria-label="Remove point"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={addPt}
                >
                  <Plus className="size-3.5" /> Add point
                </button>
              </div>
            </>
          )}

          {shape === 'circle' && (
            <OptionsBar>
              <Field label="Radius %" className="w-28">
                <Input type="number" value={circleR} onChange={(e) => setCircleR(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Center X %" className="w-28">
                <Input type="number" value={circleX} onChange={(e) => setCircleX(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Center Y %" className="w-28">
                <Input type="number" value={circleY} onChange={(e) => setCircleY(e.target.value)} className="font-mono" />
              </Field>
            </OptionsBar>
          )}

          {shape === 'ellipse' && (
            <OptionsBar>
              <Field label="Radius X %" className="w-28">
                <Input type="number" value={ellRx} onChange={(e) => setEllRx(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Radius Y %" className="w-28">
                <Input type="number" value={ellRy} onChange={(e) => setEllRy(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Center X %" className="w-28">
                <Input type="number" value={ellX} onChange={(e) => setEllX(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Center Y %" className="w-28">
                <Input type="number" value={ellY} onChange={(e) => setEllY(e.target.value)} className="font-mono" />
              </Field>
            </OptionsBar>
          )}

          {shape === 'inset' && (
            <OptionsBar>
              <Field label="Top %" className="w-24">
                <Input type="number" value={insTop} onChange={(e) => setInsTop(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Right %" className="w-24">
                <Input type="number" value={insRight} onChange={(e) => setInsRight(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Bottom %" className="w-24">
                <Input type="number" value={insBottom} onChange={(e) => setInsBottom(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Left %" className="w-24">
                <Input type="number" value={insLeft} onChange={(e) => setInsLeft(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Round px" className="w-24">
                <Input type="number" value={insRound} onChange={(e) => setInsRound(e.target.value)} className="font-mono" />
              </Field>
            </OptionsBar>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview">
          <CopyButton value={() => css} label="Copy CSS" />
        </PanelHeader>
        <div className="flex min-h-[260px] items-center justify-center bg-[length:16px_16px] p-6 [background-image:linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0]">
          <div
            className="size-48 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
            style={{ clipPath: value, WebkitClipPath: value }}
          />
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-start gap-2">
            <code className="block flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted px-3 py-2 font-mono text-xs">
              {css}
            </code>
            <CopyButton value={css} size="icon-sm" />
          </div>
        </div>
        <StatBar
          items={[
            shape,
            shape === 'polygon' ? `${points.length} points` : false,
            `${value.length} chars`,
          ]}
        />
      </Panel>
    </div>
  );
}
