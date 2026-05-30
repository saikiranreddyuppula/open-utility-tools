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
interface HSL {
  h: number;
  s: number;
  l: number;
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1] ?? '';
    if (h.length === 3) {
      const r0 = h[0] ?? '0';
      const g0 = h[1] ?? '0';
      const b0 = h[2] ?? '0';
      return { r: parseInt(r0 + r0, 16), g: parseInt(g0 + g0, 16), b: parseInt(b0 + b0, 16) };
    }
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    if ([r, g, b].every((v) => Number.isFinite(v))) {
      return {
        r: Math.max(0, Math.min(255, Math.round(r))),
        g: Math.max(0, Math.min(255, Math.round(g))),
        b: Math.max(0, Math.min(255, Math.round(b))),
      };
    }
  }
  const hsl = /^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?/.exec(s);
  if (hsl) {
    const h = Number(hsl[1]);
    const ss = Number(hsl[2]);
    const l = Number(hsl[3]);
    if ([h, ss, l].every((v) => Number.isFinite(v))) {
      return hslToRgb({ h: ((h % 360) + 360) % 360, s: Math.max(0, Math.min(100, ss)), l: Math.max(0, Math.min(100, l)) });
    }
  }
  return null;
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
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = ln - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbStr({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}
function hslStr({ h, s, l }: HSL): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function Swatch({ title, rgb }: { title: string; rgb: RGB }) {
  const hsl = rgbToHsl(rgb);
  const values = [
    { label: 'HEX', value: toHex(rgb) },
    { label: 'RGB', value: rgbStr(rgb) },
    { label: 'HSL', value: hslStr(hsl) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="h-24 w-full rounded-md border" style={{ backgroundColor: rgbStr(rgb) }} />
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      {values.map((v) => (
        <div key={v.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1">
          <span className="text-2xs text-muted-foreground">{v.label}</span>
          <span className="flex items-center gap-1 font-mono text-xs">
            <span>{v.value}</span>
            <CopyButton value={v.value} size="icon-sm" />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ComplementaryColorFinderTool() {
  const [color, setColor] = useState('#3b82f6');

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return { error: 'Enter a valid HEX, RGB, or HSL color.' };
    const hsl = rgbToHsl(rgb);
    const compHsl: HSL = { h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l };
    const comp = hslToRgb(compHsl);
    const inverse: RGB = { r: 255 - rgb.r, g: 255 - rgb.g, b: 255 - rgb.b };
    return { base: rgb, comp, inverse };
  }, [color]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color (HEX / RGB / HSL)" className="min-w-[260px] flex-1">
            <div className="flex items-center gap-2">
              <input type="color" value={color.startsWith('#') && color.length === 7 ? color : '#3b82f6'} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color picker" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" placeholder="#3b82f6" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Base · Complement (180° hue) · RGB inverse" />
          <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-3">
            <Swatch title="Base" rgb={result.base} />
            <Swatch title="Complement (hue +180°)" rgb={result.comp} />
            <Swatch title="RGB inverse (255 − c)" rgb={result.inverse} />
          </div>
          <StatBar items={['Complement keeps S & L; inverse differs from it']} />
        </Panel>
      )}
    </div>
  );
}
