'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Method = 'mix' | 'hsl';

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
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }: RGB): HSL {
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
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function rgbStr({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export default function ColorTonesGeneratorTool() {
  const [base, setBase] = useState('#e11d48');
  const [gray, setGray] = useState('#808080');
  const [steps, setSteps] = useState(10);
  const [method, setMethod] = useState<Method>('mix');

  const baseRgb = useMemo(() => parseColor(base), [base]);
  const grayRgb = useMemo(() => parseColor(gray), [gray]);

  const error =
    (base.trim() && !baseRgb) || (gray.trim() && !grayRgb)
      ? 'Enter valid HEX or rgb() colors for both fields.'
      : null;

  const tones = useMemo(() => {
    if (!baseRgb || !grayRgb) return [];
    const out: { hex: string; rgb: string }[] = [];
    out.push({ hex: rgbToHex(baseRgb), rgb: rgbStr(baseRgb) });
    const baseHsl = rgbToHsl(baseRgb);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let c: RGB;
      if (method === 'mix') {
        c = {
          r: baseRgb.r + (grayRgb.r - baseRgb.r) * t,
          g: baseRgb.g + (grayRgb.g - baseRgb.g) * t,
          b: baseRgb.b + (grayRgb.b - baseRgb.b) * t,
        };
      } else {
        // Reduce saturation toward 0 while preserving hue and lightness.
        c = hslToRgb({ h: baseHsl.h, s: baseHsl.s * (1 - t), l: baseHsl.l });
      }
      out.push({ hex: rgbToHex(c), rgb: rgbStr(c) });
    }
    return out;
  }, [baseRgb, grayRgb, steps, method]);

  const cssVars = useMemo(
    () => ':root {\n' + tones.map((t, i) => `  --tone-${i * 100}: ${t.hex};`).join('\n') + '\n}',
    [tones],
  );

  return (
    <Panel>
      <PanelHeader title="Color Tones Generator" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label="Base color" className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={baseRgb ? rgbToHex(baseRgb) : '#000000'}
                onChange={(e) => setBase(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                aria-label="Base color picker"
              />
              <Input value={base} onChange={(e) => setBase(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Gray target" className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={grayRgb ? rgbToHex(grayRgb) : '#808080'}
                onChange={(e) => setGray(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                aria-label="Gray target picker"
              />
              <Input value={gray} onChange={(e) => setGray(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label={`Steps: ${steps}`} className="min-w-[180px]">
            <Slider
              value={[steps]}
              min={2}
              max={20}
              step={1}
              onValueChange={(v) => setSteps(v[0] ?? steps)}
            />
          </Field>
          <Field label="Method">
            <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
              <TabsList>
                <TabsTrigger value="mix">Mix to gray</TabsTrigger>
                <TabsTrigger value="hsl">HSL desaturate</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {tones.length > 0 ? (
          <>
            <div className="flex h-14 w-full overflow-hidden rounded-md border">
              {tones.map((t, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: t.hex }} title={t.hex} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {tones.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="h-9 w-9 shrink-0 rounded border" style={{ backgroundColor: t.hex }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{i === 0 ? `${t.hex} (base)` : t.hex}</div>
                    <div className="truncate font-mono text-2xs text-muted-foreground">{t.rgb}</div>
                  </div>
                  <CopyButton value={t.hex} size="icon-sm" />
                </div>
              ))}
            </div>

            <StatBar
              items={[`${tones.length} swatches`, method === 'mix' ? 'Mixed toward gray' : 'HSL desaturation']}
            />

            <Panel>
              <PanelHeader title="CSS custom properties">
                <CopyButton value={cssVars} label="Copy" />
              </PanelHeader>
              <pre className="max-h-48 overflow-auto p-3 font-mono text-xs">{cssVars}</pre>
            </Panel>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
