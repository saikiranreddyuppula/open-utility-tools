'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  let h = m[1] ?? '';
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function BoxShadowGeneratorTool() {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(10);
  const [blur, setBlur] = useState(15);
  const [spread, setSpread] = useState(-3);
  const [color, setColor] = useState('#000000');
  const [opacity, setOpacity] = useState(25);
  const [inset, setInset] = useState(false);

  const rgba = useMemo(() => {
    const rgb = hexToRgb(color);
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(opacity / 100).toFixed(2)})`;
  }, [color, opacity]);

  const shadowValue = useMemo(
    () => `${inset ? 'inset ' : ''}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${rgba}`,
    [inset, offsetX, offsetY, blur, spread, rgba],
  );

  const css = `box-shadow: ${shadowValue};`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Controls" />
          <div className="flex flex-col gap-4 p-4">
            <Field label={`Offset X: ${offsetX}px`}>
              <Slider
                value={[offsetX]}
                min={-100}
                max={100}
                step={1}
                onValueChange={([v]) => setOffsetX(v ?? 0)}
              />
            </Field>
            <Field label={`Offset Y: ${offsetY}px`}>
              <Slider
                value={[offsetY]}
                min={-100}
                max={100}
                step={1}
                onValueChange={([v]) => setOffsetY(v ?? 0)}
              />
            </Field>
            <Field label={`Blur: ${blur}px`}>
              <Slider
                value={[blur]}
                min={0}
                max={150}
                step={1}
                onValueChange={([v]) => setBlur(v ?? 0)}
              />
            </Field>
            <Field label={`Spread: ${spread}px`}>
              <Slider
                value={[spread]}
                min={-50}
                max={100}
                step={1}
                onValueChange={([v]) => setSpread(v ?? 0)}
              />
            </Field>
            <Field label={`Opacity: ${opacity}%`}>
              <Slider
                value={[opacity]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setOpacity(v ?? 0)}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={hexToRgb(color) ? color : '#000000'}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 p-1"
                aria-label="Pick shadow color"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#000000"
                className="h-9 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="inset" checked={inset} onCheckedChange={setInset} />
              <Label htmlFor="inset">Inset</Label>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Preview" />
          <div className="flex flex-1 items-center justify-center bg-[conic-gradient(#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:20px_20px] p-12">
            <div
              className="flex h-32 w-44 items-center justify-center rounded-lg bg-card text-sm text-muted-foreground"
              style={{ boxShadow: shadowValue }}
            >
              box-shadow
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={css} />
        </PanelHeader>
        <pre className="overflow-x-auto p-3 font-mono text-sm">{css}</pre>
        <StatBar items={[`value: ${shadowValue}`, inset && 'inset shadow']} />
      </Panel>
    </div>
  );
}
