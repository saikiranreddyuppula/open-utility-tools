'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hexMatch) {
    const h = hexMatch[1] ?? '';
    if (h.length === 3) {
      const r0 = h[0] ?? '0';
      const g0 = h[1] ?? '0';
      const b0 = h[2] ?? '0';
      return {
        r: parseInt(r0 + r0, 16),
        g: parseInt(g0 + g0, 16),
        b: parseInt(b0 + b0, 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v))) {
      return {
        r: Math.max(0, Math.min(255, Math.round(r))),
        g: Math.max(0, Math.min(255, Math.round(g))),
        b: Math.max(0, Math.min(255, Math.round(b))),
      };
    }
  }
  return null;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

const HUE_NAMES = [
  'red',
  'orange',
  'yellow',
  'chartreuse',
  'green',
  'spring green',
  'cyan',
  'azure',
  'blue',
  'violet',
  'magenta',
  'rose',
];

function hueName(h: number): string {
  // 12 buckets of 30deg, centered so red spans wrap-around.
  const idx = Math.floor(((h + 15) % 360) / 30);
  return HUE_NAMES[idx] ?? 'red';
}

function nameColor(rgb: RGB): { label: string; h: number; s: number; l: number } {
  const { h, s, l } = rgbToHsl(rgb);

  // Achromatic special cases.
  if (l <= 4) return { label: 'black', h, s, l };
  if (l >= 96 && s < 8) return { label: 'white', h, s, l };
  if (s < 8) {
    let grayWord = 'gray';
    if (l < 25) grayWord = 'very dark gray';
    else if (l < 45) grayWord = 'dark gray';
    else if (l < 65) grayWord = 'gray';
    else if (l < 85) grayWord = 'light gray';
    else grayWord = 'very light gray';
    return { label: grayWord, h, s, l };
  }

  let lightWord = '';
  if (l < 20) lightWord = 'very dark';
  else if (l < 40) lightWord = 'dark';
  else if (l < 60) lightWord = 'medium';
  else if (l < 80) lightWord = 'light';
  else lightWord = 'very light';

  let satWord = '';
  if (s < 25) satWord = 'grayish';
  else if (s < 60) satWord = 'muted';
  else satWord = 'vivid';

  const base = hueName(h);
  return { label: `${lightWord} ${satWord} ${base}`, h, s, l };
}

export default function ColorShadeNamerTool() {
  const [color, setColor] = useState('#5a9bd4');

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return { error: 'Enter a valid HEX (#5a9bd4) or RGB (rgb(90,155,212)) color.' };
    const named = nameColor(rgb);
    const swatch = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    return {
      label: named.label,
      swatch,
      rows: [
        { label: 'Descriptive name', value: named.label },
        { label: 'HSL', value: `hsl(${Math.round(named.h)}, ${Math.round(named.s)}%, ${Math.round(named.l)}%)` },
        { label: 'Hue bucket', value: hueName(named.h) },
      ],
    };
  }, [color]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color (HEX or RGB)" className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseColor(color) ? (color.startsWith('#') && color.length === 7 ? color : '#5a9bd4') : '#5a9bd4'}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color picker"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" placeholder="#5a9bd4" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Generated name">
            <CopyButton value={() => result.label} />
          </PanelHeader>
          <div className="flex flex-col items-center gap-3 p-4">
            <div className="h-24 w-full rounded-md border" style={{ backgroundColor: result.swatch }} />
            <span className="text-xl font-semibold capitalize">{result.label}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="capitalize">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Rule-based, fully offline', 'No dictionary lookup']} />
        </Panel>
      )}
    </div>
  );
}
