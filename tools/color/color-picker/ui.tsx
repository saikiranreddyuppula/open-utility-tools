'use client';

import { useState } from 'react';
import { Pipette } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import {
  parseColor,
  toHex,
  toRgbString,
  toHslString,
  toOklchString,
  type RGB,
} from '@/lib/color/convert';

// EyeDropper is experimental; type it minimally.
interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

export default function ColorPickerTool() {
  const [rgb, setRgb] = useState<RGB>({ r: 91, g: 91, b: 214, a: 1 });

  const formats = [
    { label: 'HEX', value: toHex(rgb) },
    { label: 'RGB', value: toRgbString(rgb) },
    { label: 'HSL', value: toHslString(rgb) },
    { label: 'OKLCH', value: toOklchString(rgb) },
  ];

  const eyedrop = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const res = await new Ctor().open();
      const c = parseColor(res.sRGBHex);
      if (c) setRgb(c);
    } catch {
      /* cancelled */
    }
  };

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        <div className="h-40 flex-1 rounded-lg border" style={{ backgroundColor: toRgbString(rgb) }} />
        <div className="flex flex-col gap-2">
          <input
            type="color"
            value={toHex(rgb)}
            onChange={(e) => setRgb(parseColor(e.target.value) ?? rgb)}
            className="h-12 w-full cursor-pointer rounded-md border p-1 sm:w-40"
            aria-label="Color picker"
          />
          {hasEyeDropper && (
            <Button variant="secondary" size="sm" onClick={eyedrop}>
              <Pipette className="size-3.5" /> Eyedropper
            </Button>
          )}
        </div>
      </div>

      <Panel>
        <PanelHeader title="Channels (RGB)" />
        <div className="space-y-2 p-3">
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-3">
              <span className="w-4 font-mono text-xs uppercase text-muted-foreground">{ch}</span>
              <Slider
                value={[rgb[ch]]}
                onValueChange={([v]) => setRgb((p) => ({ ...p, [ch]: v ?? 0 }))}
                min={0}
                max={255}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-xs tabular">{Math.round(rgb[ch])}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Formats" />
        <div className="divide-y">
          {formats.map((f) => (
            <div key={f.label} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 font-mono text-2xs font-medium text-muted-foreground">{f.label}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{f.value}</code>
              <CopyButton value={f.value} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
