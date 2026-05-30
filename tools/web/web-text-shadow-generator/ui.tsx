'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Layer {
  id: number;
  x: number;
  y: number;
  blur: number;
  color: string;
  alpha: number; // 0-100
}

let layerId = 0;
const mkLayer = (
  x: number,
  y: number,
  blur: number,
  color: string,
  alpha: number,
): Layer => ({ id: layerId++, x, y, blur, color, alpha });

function clampHex(value: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : '#000000';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = clampHex(hex).replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 0,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 0,
  };
}

function layerToCss(l: Layer): string {
  const { r, g, b } = hexToRgb(l.color);
  const a = Math.min(Math.max(l.alpha, 0), 100) / 100;
  const colorStr =
    a >= 1 ? clampHex(l.color) : `rgba(${r}, ${g}, ${b}, ${a})`;
  return `${l.x}px ${l.y}px ${l.blur}px ${colorStr}`;
}

type Preset = 'neon' | 'long' | 'outline' | 'retro' | 'soft';

function presetLayers(p: Preset): Layer[] {
  switch (p) {
    case 'neon':
      return [
        mkLayer(0, 0, 7, '#00ffea', 100),
        mkLayer(0, 0, 14, '#00ffea', 90),
        mkLayer(0, 0, 28, '#0066ff', 80),
      ];
    case 'long': {
      const out: Layer[] = [];
      for (let i = 1; i <= 8; i++) out.push(mkLayer(i, i, 0, '#94a3b8', 100));
      return out;
    }
    case 'outline':
      return [
        mkLayer(-1, -1, 0, '#000000', 100),
        mkLayer(1, -1, 0, '#000000', 100),
        mkLayer(-1, 1, 0, '#000000', 100),
        mkLayer(1, 1, 0, '#000000', 100),
      ];
    case 'retro':
      return [
        mkLayer(1, 1, 0, '#e11d48', 100),
        mkLayer(2, 2, 0, '#be123c', 100),
        mkLayer(3, 3, 0, '#9f1239', 100),
        mkLayer(4, 4, 6, '#000000', 30),
      ];
    case 'soft':
      return [mkLayer(2, 3, 6, '#1e293b', 35)];
    default:
      return [mkLayer(2, 2, 4, '#000000', 50)];
  }
}

export default function TextShadowGeneratorTool() {
  const [layers, setLayers] = useState<Layer[]>(() => presetLayers('soft'));
  const [text, setText] = useState('Shadow Text');
  const [fontSize, setFontSize] = useState(56);
  const [textColor, setTextColor] = useState('#f8fafc');
  const [bg, setBg] = useState('#0f172a');

  const update = (id: number, patch: Partial<Layer>) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: number) => setLayers((ls) => ls.filter((l) => l.id !== id));
  const add = () => setLayers((ls) => [...ls, mkLayer(2, 2, 4, '#000000', 50)]);
  const applyPreset = (p: Preset) => setLayers(presetLayers(p));

  const shadowValue = useMemo(
    () => (layers.length ? layers.map(layerToCss).join(', ') : 'none'),
    [layers],
  );
  const css = useMemo(() => `text-shadow: ${shadowValue};`, [shadowValue]);

  const numInput = (
    value: number,
    set: (n: number) => void,
    min?: number,
    max?: number,
  ) => (
    <Input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) set(n);
      }}
      className="w-16 font-mono"
    />
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Preset">
            <div className="flex flex-wrap gap-1.5">
              {(['neon', 'long', 'outline', 'retro', 'soft'] as Preset[]).map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                  className="capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <div
          className="flex min-h-[180px] items-center justify-center p-8"
          style={{ backgroundColor: clampHex(bg) }}
        >
          <span
            style={{
              color: clampHex(textColor),
              fontSize: `${fontSize}px`,
              fontWeight: 700,
              textShadow: shadowValue,
              lineHeight: 1.1,
            }}
          >
            {text || 'Shadow Text'}
          </span>
        </div>
        <OptionsBar className="rounded-none border-0 border-t">
          <Field label="Sample text" className="min-w-[180px] flex-1">
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label={`Font size (${fontSize}px)`} className="min-w-[120px]">
            {numInput(fontSize, setFontSize, 8, 200)}
          </Field>
          <Field label="Text color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={clampHex(textColor)}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                aria-label="Text color"
              />
            </div>
          </Field>
          <Field label="Background">
            <input
              type="color"
              value={clampHex(bg)}
              onChange={(e) => setBg(e.target.value)}
              className="h-9 w-10 cursor-pointer rounded border bg-transparent"
              aria-label="Background color"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Shadow layers (stacked, top first)">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add layer
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {layers.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-end gap-3 px-3 py-2">
              <span className="w-6 shrink-0 font-mono text-2xs text-muted-foreground">
                {i + 1}
              </span>
              <Field label="X">{numInput(l.x, (n) => update(l.id, { x: n }), -100, 100)}</Field>
              <Field label="Y">{numInput(l.y, (n) => update(l.id, { y: n }), -100, 100)}</Field>
              <Field label="Blur">
                {numInput(l.blur, (n) => update(l.id, { blur: Math.max(0, n) }), 0, 200)}
              </Field>
              <Field label="Color">
                <input
                  type="color"
                  value={clampHex(l.color)}
                  onChange={(e) => update(l.id, { color: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                  aria-label={`Layer ${i + 1} color`}
                />
              </Field>
              <Field label={`Alpha (${l.alpha}%)`}>
                {numInput(
                  l.alpha,
                  (n) => update(l.id, { alpha: Math.min(100, Math.max(0, n)) }),
                  0,
                  100,
                )}
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(l.id)}
                aria-label="Remove layer"
                className="ml-auto"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {layers.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No layers — text-shadow is <code>none</code>.
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={css} />
        </PanelHeader>
        <div className="flex items-center gap-2 p-3">
          <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
            {css}
          </code>
          <CopyButton value={css} />
        </div>
        <StatBar items={[`${layers.length} layers`]} />
      </Panel>
    </div>
  );
}
