'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface RGB { r: number; g: number; b: number }
interface HSL { h: number; s: number; l: number }

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
    const r = Number(rgb[1]); const g = Number(rgb[2]); const b = Number(rgb[3]);
    if ([r, g, b].every((v) => Number.isFinite(v))) {
      return { r: Math.max(0, Math.min(255, Math.round(r))), g: Math.max(0, Math.min(255, Math.round(g))), b: Math.max(0, Math.min(255, Math.round(b))) };
    }
  }
  return null;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0; let s = 0; const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100; const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0; let g1 = 0; let b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = ln - c / 2;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbStr({ r, g, b }: RGB): string { return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`; }
function hslStr({ h, s, l }: HSL): string { return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`; }

// CSS filter hue-rotate() per the SVG/CSS Filter Effects luminance-preserving matrix.
function cssHueRotate(rgb: RGB, deg: number): RGB {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const m: number[] = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.140,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ];
  const { r, g, b } = rgb;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clamp((m[0] ?? 0) * r + (m[1] ?? 0) * g + (m[2] ?? 0) * b),
    g: clamp((m[3] ?? 0) * r + (m[4] ?? 0) * g + (m[5] ?? 0) * b),
    b: clamp((m[6] ?? 0) * r + (m[7] ?? 0) * g + (m[8] ?? 0) * b),
  };
}

function Result({ title, rgb, hsl }: { title: string; rgb: RGB; hsl?: HSL }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-24 w-full rounded-md border" style={{ backgroundColor: rgbStr(rgb) }} />
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1">
        <span className="text-2xs text-muted-foreground">HEX</span>
        <span className="flex items-center gap-1 font-mono text-xs"><span>{toHex(rgb)}</span><CopyButton value={toHex(rgb)} size="icon-sm" /></span>
      </div>
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1">
        <span className="text-2xs text-muted-foreground">RGB</span>
        <span className="flex items-center gap-1 font-mono text-xs"><span>{rgbStr(rgb)}</span><CopyButton value={rgbStr(rgb)} size="icon-sm" /></span>
      </div>
      {hsl && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1">
          <span className="text-2xs text-muted-foreground">HSL</span>
          <span className="flex items-center gap-1 font-mono text-xs"><span>{hslStr(hsl)}</span><CopyButton value={hslStr(hsl)} size="icon-sm" /></span>
        </div>
      )}
    </div>
  );
}

export default function HueRotateCalculatorTool() {
  const [color, setColor] = useState('#3b82f6');
  const [angle, setAngle] = useState(60);

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return { error: 'Enter a valid HEX (#3b82f6) or RGB color.' };
    const hsl = rgbToHsl(rgb);
    const rotHsl: HSL = { h: (((hsl.h + angle) % 360) + 360) % 360, s: hsl.s, l: hsl.l };
    const hslRotated = hslToRgb(rotHsl);
    const cssRotated = cssHueRotate(rgb, angle);
    return {
      base: rgb,
      baseHsl: hsl,
      hslRotated,
      hslRotatedHsl: rotHsl,
      cssRotated,
      cssString: `hue-rotate(${angle}deg)`,
    };
  }, [color, angle]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color (HEX or RGB)" className="min-w-[220px]">
            <div className="flex items-center gap-2">
              <input type="color" value={color.startsWith('#') && color.length === 7 ? color : '#3b82f6'} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color picker" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" placeholder="#3b82f6" />
            </div>
          </Field>
          <Field label={`Rotation: ${angle > 0 ? '+' : ''}${angle}°`} className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2">
              <Slider value={[angle]} min={-360} max={360} step={1} onValueChange={(v) => setAngle(v[0] ?? 0)} />
              <Input value={String(angle)} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setAngle(Math.max(-360, Math.min(360, Math.round(n)))); }} inputMode="numeric" className="h-8 w-20 font-mono text-xs" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Base · HSL rotation · CSS hue-rotate()">
            <CopyButton value={() => result.cssString} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-3">
            <Result title="Base" rgb={result.base} hsl={result.baseHsl} />
            <Result title="True HSL hue rotation" rgb={result.hslRotated} hsl={result.hslRotatedHsl} />
            <Result title={`CSS filter: ${result.cssString}`} rgb={result.cssRotated} />
          </div>
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">CSS filter</span>
              <span className="flex items-center gap-2 font-mono text-sm"><span>filter: {result.cssString};</span><CopyButton value={`filter: ${result.cssString};`} size="icon-sm" /></span>
            </div>
          </div>
          <StatBar items={['HSL rotates true hue; CSS uses a luminance-preserving matrix — results differ']} />
        </Panel>
      )}
    </div>
  );
}
