'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseColor(raw: string): RGBA | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const named = NAMED[s];
  if (named) return parseColor(named);
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const exp = (n: string): number => parseInt(n + n, 16);
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      const aCh = hex[3];
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r: exp(r), g: exp(g), b: exp(b), a: aCh !== undefined ? exp(aCh) / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b, a };
    }
    return null;
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m && m[1] !== undefined) {
    const p = m[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(p[0]);
    const g = Number(p[1]);
    const b = Number(p[2]);
    if (![r, g, b].every(Number.isFinite)) return null;
    let a = 1;
    const aRaw = p[3];
    if (aRaw !== undefined) {
      a = aRaw.endsWith('%') ? Number(aRaw.slice(0, -1)) / 100 : Number(aRaw);
      if (!Number.isFinite(a)) a = 1;
    }
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
  }
  return null;
}

function toHex(c: { r: number; g: number; b: number }): string {
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
}

/** source-over compositing of opaque src over opaque dst with src alpha a. */
function over(dst: { r: number; g: number; b: number }, src: RGBA): { r: number; g: number; b: number } {
  const a = src.a;
  return {
    r: src.r * a + dst.r * (1 - a),
    g: src.g * a + dst.g * (1 - a),
    b: src.b * a + dst.b * (1 - a),
  };
}

interface Layer {
  id: number;
  color: string;
  alpha: number; // 0..100 (overrides parsed color alpha when blended)
}

let nextId = 3;

export default function AlphaBlendTool() {
  const [bg, setBg] = useState('#ffffff');
  const [layers, setLayers] = useState<Layer[]>([
    { id: 1, color: '#3498db', alpha: 50 },
    { id: 2, color: '#e74c3c', alpha: 40 },
  ]);

  const result = useMemo(() => {
    const bgc = parseColor(bg);
    if (!bgc) return { error: 'Enter a valid opaque background color.' };
    let acc: { r: number; g: number; b: number } = { r: bgc.r, g: bgc.g, b: bgc.b };
    const steps: { hex: string }[] = [];
    for (const layer of layers) {
      const c = parseColor(layer.color);
      if (!c) return { error: `Invalid layer color: "${layer.color}"` };
      const a = clamp(layer.alpha / 100, 0, 1);
      acc = over(acc, { r: c.r, g: c.g, b: c.b, a });
      steps.push({ hex: toHex(acc) });
    }
    const flat = { r: Math.round(acc.r), g: Math.round(acc.g), b: Math.round(acc.b) };
    return {
      bgStr: toHex(bgc),
      flatHex: toHex(flat),
      flatRgb: `rgb(${flat.r}, ${flat.g}, ${flat.b})`,
      steps,
    };
  }, [bg, layers]);

  const updateLayer = (id: number, patch: Partial<Layer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const addLayer = () => {
    setLayers((ls) => [...ls, { id: nextId++, color: '#000000', alpha: 50 }]);
  };
  const removeLayer = (id: number) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.startsWith('#') && bg.length === 7 ? bg : '#ffffff'}
              onChange={(e) => setBg(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border p-1"
              aria-label="Background"
            />
            <Field label="Background (opaque)">
              <Input value={bg} onChange={(e) => setBg(e.target.value)} className="w-36 font-mono" />
            </Field>
          </div>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Translucent layers (top stacks last)">
          <Button variant="ghost" size="sm" onClick={addLayer}>
            <Plus className="size-3.5" /> Add layer
          </Button>
        </PanelHeader>
        <div className="space-y-3 p-3">
          {layers.map((layer) => (
            <div key={layer.id} className="flex flex-wrap items-end gap-3">
              <input
                type="color"
                value={layer.color.startsWith('#') && layer.color.length === 7 ? layer.color : '#000000'}
                onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Layer color"
              />
              <Field label="Color">
                <Input
                  value={layer.color}
                  onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                  className="w-32 font-mono"
                />
              </Field>
              <Field label={`Alpha: ${layer.alpha}%`} className="min-w-[160px] flex-1">
                <Slider
                  value={[layer.alpha]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => updateLayer(layer.id, { alpha: v[0] ?? 0 })}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeLayer(layer.id)}
                disabled={layers.length <= 1}
                title="Remove layer"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Flattened color">
            <CopyButton value={() => `${result.flatHex} / ${result.flatRgb}`} />
          </PanelHeader>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-md border">
              <div className="h-24" style={{ backgroundColor: result.flatHex }} />
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">HEX</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    {result.flatHex}
                    <CopyButton value={result.flatHex} size="icon-sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">RGB</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    {result.flatRgb}
                    <CopyButton value={result.flatRgb} size="icon-sm" />
                  </span>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="text-2xs px-2 py-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Composite stack
              </div>
              <div className="flex h-[calc(100%-1.5rem)] min-h-20">
                <div className="flex-1" style={{ backgroundColor: result.bgStr }} title="background" />
                {result.steps.map((st, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: st.hex }} title={st.hex} />
                ))}
              </div>
            </div>
          </div>
          <StatBar items={[`${layers.length} layer(s) over ${result.bgStr}`, `result ${result.flatHex}`]} />
        </Panel>
      )}
    </div>
  );
}
