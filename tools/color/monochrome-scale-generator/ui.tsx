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
type Stepping = 'linear' | 'oklch';

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

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
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

// ---- OKLCH helpers (sRGB <-> OKLab) for perceptual lightness stepping ----
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp255(v * 255);
}
type OKLab = { L: number; a: number; b: number };
function rgbToOklab({ r, g, b }: RGB): OKLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}
function oklabToRgb({ L, a, b }: OKLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const SCALE_LABELS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export default function MonochromeScaleGeneratorTool() {
  const [base, setBase] = useState('#7c3aed');
  const [steps, setSteps] = useState(9);
  const [stepping, setStepping] = useState<Stepping>('linear');
  const [satFalloff, setSatFalloff] = useState(true);

  const baseRgb = useMemo(() => parseColor(base), [base]);
  const error = base.trim() && !baseRgb ? 'Enter a valid HEX or rgb() color.' : null;

  const ramp = useMemo(() => {
    if (!baseRgb) return [];
    const baseHsl = rgbToHsl(baseRgb);
    const lLow = 0.1;
    const lHigh = 0.95;
    const baseOklab = rgbToOklab(baseRgb);
    // chroma magnitude in OKLab, to scale at extremes
    const out: { label: string; hex: string; rgb: string; hsl: string }[] = [];
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0.5 : i / (steps - 1);
      const lTarget = lerp(lHigh, lLow, t); // index 0 = lightest
      // Saturation falloff: reduce sat near both extremes for naturalness.
      const center = 1 - Math.abs(t - 0.5) * 2; // 1 at middle, 0 at ends
      const satScale = satFalloff ? 0.55 + 0.45 * center : 1;
      let c: RGB;
      if (stepping === 'linear') {
        c = hslToRgb({ h: baseHsl.h, s: Math.min(1, baseHsl.s * satScale), l: lTarget });
      } else {
        // Perceptual: set OKLab L, scale a/b (chroma) by satScale, keep hue direction.
        c = oklabToRgb({ L: lTarget, a: baseOklab.a * satScale, b: baseOklab.b * satScale });
      }
      const hsl = rgbToHsl(c);
      out.push({
        label: SCALE_LABELS[i] ?? String((i + 1) * 100),
        hex: rgbToHex(c),
        rgb: `rgb(${c.r}, ${c.g}, ${c.b})`,
        hsl: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`,
      });
    }
    return out;
  }, [baseRgb, steps, stepping, satFalloff]);

  const cssVars = useMemo(
    () => ':root {\n' + ramp.map((r) => `  --mono-${r.label}: ${r.hex};`).join('\n') + '\n}',
    [ramp],
  );

  return (
    <Panel>
      <PanelHeader title="Monochromatic Scale Generator" />
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
          <Field label={`Steps: ${steps}`} className="min-w-[180px]">
            <Slider
              value={[steps]}
              min={3}
              max={11}
              step={1}
              onValueChange={(v) => setSteps(v[0] ?? steps)}
            />
          </Field>
          <Field label="Stepping">
            <Tabs value={stepping} onValueChange={(v) => setStepping(v as Stepping)}>
              <TabsList>
                <TabsTrigger value="linear">Linear (HSL)</TabsTrigger>
                <TabsTrigger value="oklch">Perceptual (OKLCH)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`Saturation falloff: ${satFalloff ? 'on' : 'off'}`}>
            <Tabs
              value={satFalloff ? 'on' : 'off'}
              onValueChange={(v) => setSatFalloff(v === 'on')}
            >
              <TabsList>
                <TabsTrigger value="on">On</TabsTrigger>
                <TabsTrigger value="off">Off</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {ramp.length > 0 ? (
          <>
            <div className="flex h-14 w-full overflow-hidden rounded-md border">
              {ramp.map((r, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: r.hex }} title={r.hex} />
              ))}
            </div>

            <Panel>
              <div className="divide-y">
                {ramp.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="w-10 shrink-0 font-mono text-2xs text-muted-foreground tabular">
                      {r.label}
                    </span>
                    <span className="h-7 w-14 shrink-0 rounded border" style={{ backgroundColor: r.hex }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs">{r.hex}</div>
                      <div className="truncate font-mono text-2xs text-muted-foreground">
                        {r.rgb} · {r.hsl}
                      </div>
                    </div>
                    <CopyButton value={r.hex} size="icon-sm" />
                  </div>
                ))}
              </div>
            </Panel>

            <StatBar
              items={[
                `${ramp.length} steps`,
                stepping === 'linear' ? 'HSL lightness sweep' : 'OKLCH perceptual sweep',
              ]}
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
