'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
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

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

export default function LightenDarkenColorTool() {
  const [color, setColor] = useState('#3b82f6');
  const [amount, setAmount] = useState(20);

  const base = useMemo(() => hexToRgb(color), [color]);
  const error = color.trim() && !base ? 'Enter a valid HEX color, e.g. #3b82f6.' : null;

  const result = useMemo(() => {
    if (!base) return null;
    const [h, s, l] = rgbToHsl(base[0], base[1], base[2]);
    const newL = Math.min(100, Math.max(0, l + amount));
    const rgb = hslToRgb(h, s, newL);
    return {
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      rgb,
      l,
      newL,
    };
  }, [base, amount]);

  const baseHex = base ? rgbToHex(base[0], base[1], base[2]) : '#000000';

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={error} />
      <OptionsBar>
        <Field label="Base color" className="min-w-[240px]">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={baseHex}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 p-1"
              aria-label="Pick base color"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#3b82f6"
              className="h-9 font-mono"
            />
          </div>
        </Field>
        <Field
          className="min-w-[260px] flex-1"
          label={amount >= 0 ? `Lighten by ${amount}%` : `Darken by ${-amount}%`}
          hint="drag left to darken, right to lighten"
        >
          <Slider
            value={[amount]}
            min={-100}
            max={100}
            step={1}
            onValueChange={([v]) => setAmount(v ?? 0)}
          />
        </Field>
      </OptionsBar>

      {base && result ? (
        <Panel>
          <PanelHeader title="Before / After">
            <CopyButton value={result.hex} />
          </PanelHeader>
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2 p-4">
              <span
                className="h-24 w-full rounded-md border"
                style={{ backgroundColor: baseHex }}
              />
              <span className="text-2xs text-muted-foreground">Original</span>
              <span className="font-mono text-sm">{baseHex}</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <span
                className="h-24 w-full rounded-md border"
                style={{ backgroundColor: result.hex }}
              />
              <span className="text-2xs text-muted-foreground">
                {amount >= 0 ? 'Lightened' : 'Darkened'}
              </span>
              <span className="font-mono text-sm">{result.hex}</span>
            </div>
          </div>
          <StatBar
            items={[
              `rgb(${result.rgb.join(', ')})`,
              `lightness ${result.l.toFixed(0)}% → ${result.newL.toFixed(0)}%`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
