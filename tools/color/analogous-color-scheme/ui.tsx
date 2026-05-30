'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

type Count = '3' | '5' | '7';

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = s.startsWith('#') ? s.slice(1) : /^[0-9a-f]{3,8}$/.test(s) ? s : '';
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
    }
    if (hex.length === 6 || hex.length === 8) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    }
    return null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1] !== undefined) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
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
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = ln - c / 2;
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export default function AnalogousColorScheme() {
  const [base, setBase] = useState('#3b82f6');
  const [spread, setSpread] = useState(30);
  const [count, setCount] = useState<Count>('5');
  const [varyL, setVaryL] = useState(false);

  const result = useMemo(() => {
    const rgb = parseColor(base);
    if (!rgb) return null;
    const hsl = rgbToHsl(rgb);
    const n = Number(count);
    const half = Math.floor(n / 2);
    const out: { hsl: HSL; hex: string; rgb: RGB; offset: number }[] = [];
    for (let i = 0; i < n; i++) {
      const k = i - half; // symmetric: -half .. +half
      const h = hsl.h + k * spread;
      const l = varyL ? hsl.l + k * 4 : hsl.l;
      const cHsl: HSL = { h: ((h % 360) + 360) % 360, s: hsl.s, l };
      const cRgb = hslToRgb(cHsl);
      out.push({ hsl: cHsl, hex: toHex(cRgb), rgb: cRgb, offset: k * spread });
    }
    return { base: hsl, colors: out };
  }, [base, spread, count, varyL]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Base color">
            <Input value={base} onChange={(e) => setBase(e.target.value)} className="w-40 font-mono" />
          </Field>
          <Field label="Count">
            <Tabs value={count} onValueChange={(v) => setCount(v as Count)}>
              <TabsList>
                <TabsTrigger value="3">3</TabsTrigger>
                <TabsTrigger value="5">5</TabsTrigger>
                <TabsTrigger value="7">7</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`Hue spread: ${spread}°`} className="min-w-[200px] flex-1">
            <Slider value={[spread]} min={5} max={60} step={1} onValueChange={(v) => setSpread(v[0] ?? 30)} />
          </Field>
          <Field label="Vary lightness">
            <Switch checked={varyL} onCheckedChange={setVaryL} />
          </Field>
        </OptionsBar>
      </Panel>

      {!result ? (
        <ErrorBanner error="Enter a valid base color (e.g. #3b82f6 or rgb(59,130,246))." />
      ) : (
        <Panel>
          <PanelHeader title="Analogous palette">
            <CopyButton value={() => result.colors.map((c) => c.hex).join('\n')} label="Copy all" />
          </PanelHeader>
          <div className="flex overflow-hidden">
            {result.colors.map((c, i) => {
              const text = relLuminance(c.rgb) > 0.45 ? '#000' : '#fff';
              return (
                <div
                  key={i}
                  className="flex min-h-[120px] flex-1 flex-col items-center justify-end gap-1 p-3"
                  style={{ backgroundColor: c.hex, color: text }}
                >
                  <span className="text-2xs uppercase tracking-wide opacity-80">
                    {c.offset === 0 ? 'base' : `${c.offset > 0 ? '+' : ''}${c.offset}°`}
                  </span>
                  <code className="font-mono text-xs">{c.hex}</code>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.colors.map((c, i) => (
              <div
                key={`row-${i}`}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block h-5 w-5 rounded border" style={{ backgroundColor: c.hex }} />
                  <code className="font-mono text-xs">{c.hex}</code>
                </span>
                <span className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
                  <span>
                    hsl({Math.round(c.hsl.h)}, {Math.round(c.hsl.s)}%, {Math.round(c.hsl.l)}%)
                  </span>
                  <CopyButton value={c.hex} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `base hue ${Math.round(result.base.h)}°`,
              `${result.colors.length} colors`,
              `spread ${spread}°`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
