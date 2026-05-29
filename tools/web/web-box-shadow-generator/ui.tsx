'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

function clampHex(value: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : '#000000';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
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

export default function BoxShadowGeneratorTool() {
  const [offsetX, setOffsetX] = useState(4);
  const [offsetY, setOffsetY] = useState(6);
  const [blur, setBlur] = useState(16);
  const [spread, setSpread] = useState(0);
  const [color, setColor] = useState('#1e293b');
  const [opacity, setOpacity] = useState(25);
  const [inset, setInset] = useState(false);

  const rgba = useMemo(() => {
    const { r, g, b } = hexToRgb(clampHex(color));
    const a = Math.min(Math.max(opacity, 0), 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }, [color, opacity]);

  const shadowValue = useMemo(() => {
    const parts = [
      inset ? 'inset' : '',
      `${offsetX}px`,
      `${offsetY}px`,
      `${blur}px`,
      `${spread}px`,
      rgba,
    ].filter(Boolean);
    return parts.join(' ');
  }, [inset, offsetX, offsetY, blur, spread, rgba]);

  const css = useMemo(() => `box-shadow: ${shadowValue};`, [shadowValue]);
  const tailwind = useMemo(
    () => `shadow-[${shadowValue.replace(/\s+/g, '_')}]`,
    [shadowValue],
  );

  const slider = (
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    step = 1,
  ) => (
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => {
          const next = vals[0];
          if (next != null && Number.isFinite(next)) set(next);
        }}
        className="flex-1"
      />
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) set(n);
        }}
        className="w-20"
      />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Controls" />
        <div className="flex flex-col gap-4">
          <Field label={`Offset X (${offsetX}px)`}>
            {slider(offsetX, setOffsetX, -100, 100)}
          </Field>
          <Field label={`Offset Y (${offsetY}px)`}>
            {slider(offsetY, setOffsetY, -100, 100)}
          </Field>
          <Field label={`Blur (${blur}px)`}>
            {slider(blur, setBlur, 0, 200)}
          </Field>
          <Field label={`Spread (${spread}px)`}>
            {slider(spread, setSpread, -100, 100)}
          </Field>
          <Field label={`Opacity (${opacity}%)`}>
            {slider(opacity, setOpacity, 0, 100)}
          </Field>
          <OptionsBar>
            <Field label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={clampHex(color)}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  aria-label="Shadow color"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-28 font-mono"
                />
              </div>
            </Field>
            <Field label="Inset">
              <Switch checked={inset} onCheckedChange={setInset} />
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview">
          <CopyButton value={css} />
        </PanelHeader>
        <div className="flex min-h-[220px] items-center justify-center rounded-md border bg-muted/40 p-8">
          <div
            className="h-28 w-44 rounded-lg bg-background"
            style={{ boxShadow: shadowValue }}
          />
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
              {css}
            </code>
            <CopyButton value={css} />
          </div>
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
              {tailwind}
            </code>
            <CopyButton value={tailwind} />
          </div>
        </div>
        <StatBar
          items={[
            inset ? 'inset' : 'outset',
            `x ${offsetX} / y ${offsetY}`,
            `blur ${blur} / spread ${spread}`,
            rgba,
          ]}
        />
      </Panel>
    </div>
  );
}
