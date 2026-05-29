'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  parseColor,
  toHex,
  toRgbString,
  toHslString,
  toOklchString,
  rgbToHsv,
  rgbToCmyk,
} from '@/lib/color/convert';

export default function ColorConverterTool() {
  const [input, setInput] = useState('#5b5bd6');

  const rgb = useMemo(() => parseColor(input), [input]);
  const hexForPicker = rgb ? toHex(rgb) : '#000000';

  const formats = rgb
    ? (() => {
        const hsv = rgbToHsv(rgb);
        const cmyk = rgbToCmyk(rgb);
        return [
          { label: 'HEX', value: toHex(rgb, rgb.a < 1) },
          { label: 'RGB', value: toRgbString(rgb) },
          { label: 'HSL', value: toHslString(rgb) },
          { label: 'HSV', value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
          { label: 'CMYK', value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
          { label: 'OKLCH', value: toOklchString(rgb) },
        ];
      })()
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={hexForPicker}
          onChange={(e) => setInput(e.target.value)}
          className="h-12 w-16 cursor-pointer rounded-md border bg-transparent p-1"
          aria-label="Color picker"
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="#5b5bd6, rgb(91,91,214), hsl(240,60%,60%)…"
          className="h-9 max-w-sm flex-1 font-mono"
        />
        <div
          className="h-12 flex-1 rounded-md border"
          style={{ backgroundColor: rgb ? toRgbString(rgb) : 'transparent' }}
        />
      </div>

      {!rgb && input.trim() && <ErrorBanner error="Could not parse that color." />}

      {rgb && (
        <Panel>
          <PanelHeader title="Formats" />
          <div className="divide-y">
            {formats.map((f) => (
              <div key={f.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-16 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                  {f.label}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{f.value}</code>
                <CopyButton value={f.value} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
