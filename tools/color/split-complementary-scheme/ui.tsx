'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

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

interface Swatch {
  role: string;
  hex: string;
  rgb: string;
  hsl: string;
}

export default function SplitComplementarySchemeTool() {
  const [base, setBase] = useState('#0ea5e9');
  const [split, setSplit] = useState(30);
  const [lightNudge, setLightNudge] = useState(0);

  const baseRgb = useMemo(() => parseColor(base), [base]);
  const error = base.trim() && !baseRgb ? 'Enter a valid HEX or rgb() color.' : null;

  const scheme = useMemo(() => {
    if (!baseRgb) return [];
    const hsl = rgbToHsl(baseRgb);
    const nudge = lightNudge / 100;
    const make = (hueOffset: number, role: string, applyNudge: boolean): Swatch => {
      const h = (((hsl.h + hueOffset) % 360) + 360) % 360;
      const l = applyNudge ? Math.min(1, Math.max(0, hsl.l + nudge)) : hsl.l;
      const c = hslToRgb({ h, s: hsl.s, l });
      const ch = rgbToHsl(c);
      return {
        role,
        hex: rgbToHex(c),
        rgb: `rgb(${c.r}, ${c.g}, ${c.b})`,
        hsl: `hsl(${Math.round(ch.h)}, ${Math.round(ch.s * 100)}%, ${Math.round(ch.l * 100)}%)`,
      };
    };
    return [
      make(0, 'Base', false),
      make(180 - split, 'Split 1', true),
      make(180 + split, 'Split 2', true),
    ];
  }, [baseRgb, split, lightNudge]);

  const allHex = scheme.map((s) => s.hex).join(', ');

  return (
    <Panel>
      <PanelHeader title="Split-Complementary Scheme" />
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
          <Field label={`Split angle: ${split}°`} className="min-w-[180px]">
            <Slider
              value={[split]}
              min={15}
              max={60}
              step={1}
              onValueChange={(v) => setSplit(v[0] ?? split)}
            />
          </Field>
          <Field label={`Lightness nudge: ${lightNudge > 0 ? '+' : ''}${lightNudge}%`} className="min-w-[180px]">
            <Slider
              value={[lightNudge]}
              min={-30}
              max={30}
              step={1}
              onValueChange={(v) => setLightNudge(v[0] ?? lightNudge)}
            />
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {scheme.length > 0 ? (
          <>
            <div className="flex h-16 w-full overflow-hidden rounded-md border">
              {scheme.map((s, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} title={s.hex} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {scheme.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="h-12 w-12 shrink-0 rounded border" style={{ backgroundColor: s.hex }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      {s.role}
                    </div>
                    <div className="font-mono text-xs">{s.hex}</div>
                    <div className="truncate font-mono text-2xs text-muted-foreground">{s.rgb}</div>
                    <div className="truncate font-mono text-2xs text-muted-foreground">{s.hsl}</div>
                  </div>
                  <CopyButton value={s.hex} size="icon-sm" />
                </div>
              ))}
            </div>

            <StatBar items={[`base + complement ±${split}°`]} />

            <div className="flex items-center gap-2">
              <Input value={allHex} readOnly className="font-mono text-xs" />
              <CopyButton value={allHex} label="Copy all" />
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
