'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

function parseColor(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]); const g = Number(rgbMatch[2]); const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = h / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) { const v = Math.round(ln * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
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
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function Swatch({ label, color, css }: { label: string; color: RGB; css?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(color) }} />
      <span className="flex items-center justify-between font-mono text-sm">
        {toHex(color)}
        <CopyButton value={toHex(color)} size="icon-sm" />
      </span>
      <span className="font-mono text-xs text-muted-foreground">rgb({color.r}, {color.g}, {color.b})</span>
      {css && (
        <span className="flex items-center justify-between font-mono text-2xs text-muted-foreground">
          {css}
          <CopyButton value={css} size="icon-sm" />
        </span>
      )}
    </div>
  );
}

export default function ColorInvertTool() {
  const [input, setInput] = useState('#3b82f6');
  const [amount, setAmount] = useState(100);

  const result = useMemo(() => {
    const c = parseColor(input);
    if (!c) return { error: 'Enter a valid color (#hex or rgb()).' };
    const rgbInv: RGB = { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b };
    const t = amount / 100;
    const mixed: RGB = {
      r: Math.round(c.r * (1 - t) + rgbInv.r * t),
      g: Math.round(c.g * (1 - t) + rgbInv.g * t),
      b: Math.round(c.b * (1 - t) + rgbInv.b * t),
    };
    const hsl = rgbToHsl(c);
    const lumInv: RGB = hslToRgb({ h: hsl.h, s: hsl.s, l: 100 - hsl.l });
    return { c, rgbInv, mixed, lumInv, cssFilter: `invert(${amount}%)` };
  }, [input, amount]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color" className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseColor(input) ? toHex(parseColor(input) as RGB) : '#3b82f6'}
                onChange={(e) => setInput(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color"
              />
              <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label={`Invert amount: ${amount}%`} className="min-w-[220px] flex-1">
            <Slider value={[amount]} min={0} max={100} step={1} onValueChange={(v) => setAmount(v[0] ?? 100)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch label="Original" color={result.c} />
            <Swatch label="RGB inverse" color={result.rgbInv} />
            <Swatch label={`Mixed (${amount}%)`} color={result.mixed} css={`filter: ${result.cssFilter}`} />
            <Swatch label="Lightness flip" color={result.lumInv} />
          </div>
          <StatBar
            items={[
              `RGB inverse ${toHex(result.rgbInv)}`,
              `lightness flip ${toHex(result.lumInv)}`,
              `filter ${result.cssFilter}`,
            ]}
          />
        </>
      )}
    </div>
  );
}
