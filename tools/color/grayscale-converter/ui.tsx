'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RGB = { r: number; g: number; b: number };
type Method = 'luminance' | 'average' | 'desaturation';

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) {
    const r = hex[0] ?? '0';
    const g = hex[1] ?? '0';
    const b = hex[2] ?? '0';
    const num = parseInt(r + r + g + g + b + b, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map((p) => parseFloat(p));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    if (
      r !== undefined &&
      g !== undefined &&
      b !== undefined &&
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b)
    ) {
      const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
      return { r: clamp(r), g: clamp(g), b: clamp(b) };
    }
  }
  return null;
}

function rgbToHex({ r, g, b }: RGB): string {
  return (
    '#' +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  );
}

function grayValue({ r, g, b }: RGB, method: Method): number {
  switch (method) {
    case 'luminance':
      // Rec. 709 perceptual luminance weights.
      return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    case 'average':
      return Math.round((r + g + b) / 3);
    case 'desaturation':
      // HSL lightness = midpoint of max and min channels.
      return Math.round((Math.max(r, g, b) + Math.min(r, g, b)) / 2);
  }
}

const METHOD_LABEL: Record<Method, string> = {
  luminance: 'Luminance (Rec. 709)',
  average: 'Average of channels',
  desaturation: 'Desaturation (HSL)',
};

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className="h-28 w-full rounded-md border"
        style={{ backgroundColor: color }}
        aria-label={`${label} ${color}`}
      />
    </div>
  );
}

export default function GrayscaleConverterTool() {
  const [value, setValue] = useState('#3b82f6');
  const [method, setMethod] = useState<Method>('luminance');

  const parsed = useMemo(() => parseColor(value), [value]);
  const error = value.trim() && !parsed ? 'Enter a valid HEX or rgb() color.' : null;

  const result = useMemo(() => {
    if (!parsed) return null;
    const gray = grayValue(parsed, method);
    const out: RGB = { r: gray, g: gray, b: gray };
    return { gray, hex: rgbToHex(out), rgb: `rgb(${gray}, ${gray}, ${gray})` };
  }, [parsed, method]);

  return (
    <Panel>
      <PanelHeader title="Grayscale Converter" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label="Color" className="min-w-[220px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parsed ? rgbToHex(parsed) : '#000000'}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                aria-label="Color picker"
              />
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="#3b82f6 or rgb(59, 130, 246)"
                className="font-mono"
              />
            </div>
          </Field>
          <Field label="Method">
            <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
              <TabsList>
                <TabsTrigger value="luminance">Luminance</TabsTrigger>
                <TabsTrigger value="average">Average</TabsTrigger>
                <TabsTrigger value="desaturation">Desaturate</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {parsed && result ? (
          <>
            <div className="flex gap-4">
              <Swatch label="Original" color={rgbToHex(parsed)} />
              <Swatch label={METHOD_LABEL[method]} color={result.hex} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Grayscale HEX">
                <div className="flex items-center gap-2">
                  <Input value={result.hex} readOnly className="font-mono" />
                  <CopyButton value={result.hex} />
                </div>
              </Field>
              <Field label="Grayscale RGB">
                <div className="flex items-center gap-2">
                  <Input value={result.rgb} readOnly className="font-mono" />
                  <CopyButton value={result.rgb} />
                </div>
              </Field>
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
