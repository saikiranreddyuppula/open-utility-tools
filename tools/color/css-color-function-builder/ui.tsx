'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Space = 'rgb' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'srgb' | 'display-p3';

interface ChannelSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  def: number;
}

const SPACES: Record<Space, { name: string; legacy: boolean; channels: [ChannelSpec, ChannelSpec, ChannelSpec] }> = {
  rgb: { name: 'rgb()', legacy: true, channels: [
    { label: 'R', min: 0, max: 255, step: 1, unit: '', def: 59 },
    { label: 'G', min: 0, max: 255, step: 1, unit: '', def: 130 },
    { label: 'B', min: 0, max: 255, step: 1, unit: '', def: 246 },
  ] },
  hsl: { name: 'hsl()', legacy: true, channels: [
    { label: 'H', min: 0, max: 360, step: 1, unit: 'deg', def: 217 },
    { label: 'S', min: 0, max: 100, step: 1, unit: '%', def: 91 },
    { label: 'L', min: 0, max: 100, step: 1, unit: '%', def: 60 },
  ] },
  hwb: { name: 'hwb()', legacy: false, channels: [
    { label: 'H', min: 0, max: 360, step: 1, unit: 'deg', def: 217 },
    { label: 'W', min: 0, max: 100, step: 1, unit: '%', def: 10 },
    { label: 'Blackness', min: 0, max: 100, step: 1, unit: '%', def: 4 },
  ] },
  lab: { name: 'lab()', legacy: false, channels: [
    { label: 'L', min: 0, max: 100, step: 0.1, unit: '', def: 55 },
    { label: 'a', min: -125, max: 125, step: 1, unit: '', def: 10 },
    { label: 'b', min: -125, max: 125, step: 1, unit: '', def: -65 },
  ] },
  lch: { name: 'lch()', legacy: false, channels: [
    { label: 'L', min: 0, max: 100, step: 0.1, unit: '', def: 55 },
    { label: 'C', min: 0, max: 150, step: 1, unit: '', def: 66 },
    { label: 'H', min: 0, max: 360, step: 1, unit: 'deg', def: 279 },
  ] },
  oklab: { name: 'oklab()', legacy: false, channels: [
    { label: 'L', min: 0, max: 1, step: 0.001, unit: '', def: 0.62 },
    { label: 'a', min: -0.4, max: 0.4, step: 0.001, unit: '', def: 0.02 },
    { label: 'b', min: -0.4, max: 0.4, step: 0.001, unit: '', def: -0.18 },
  ] },
  oklch: { name: 'oklch()', legacy: false, channels: [
    { label: 'L', min: 0, max: 1, step: 0.001, unit: '', def: 0.62 },
    { label: 'C', min: 0, max: 0.4, step: 0.001, unit: '', def: 0.18 },
    { label: 'H', min: 0, max: 360, step: 1, unit: 'deg', def: 264 },
  ] },
  srgb: { name: 'color(srgb …)', legacy: false, channels: [
    { label: 'R', min: 0, max: 1, step: 0.001, unit: '', def: 0.231 },
    { label: 'G', min: 0, max: 1, step: 0.001, unit: '', def: 0.51 },
    { label: 'B', min: 0, max: 1, step: 0.001, unit: '', def: 0.965 },
  ] },
  'display-p3': { name: 'color(display-p3 …)', legacy: false, channels: [
    { label: 'R', min: 0, max: 1, step: 0.001, unit: '', def: 0.25 },
    { label: 'G', min: 0, max: 1, step: 0.001, unit: '', def: 0.5 },
    { label: 'B', min: 0, max: 1, step: 0.001, unit: '', def: 0.95 },
  ] },
};

interface LinRGB { r: number; g: number; b: number }

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

function linToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hslToLinSrgb(h: number, s: number, l: number): LinRGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = ln - c / 2;
  return { r: srgbToLin(r + m), g: srgbToLin(g + m), b: srgbToLin(b + m) };
}

function hwbToLinSrgb(h: number, w: number, bl: number): LinRGB {
  let wn = w / 100;
  let bn = bl / 100;
  if (wn + bn > 1) { const sum = wn + bn; wn /= sum; bn /= sum; }
  const base = hslToLinSrgb(h, 100, 50); // pure hue in linear
  const apply = (v: number) => srgbToLin(linToSrgb(v) * (1 - wn - bn) + wn);
  return { r: apply(base.r), g: apply(base.g), b: apply(base.b) };
}

// D65 XYZ <-> linear sRGB
function linSrgbToXyz({ r, g, b }: LinRGB): [number, number, number] {
  return [
    0.4123908 * r + 0.3575843 * g + 0.1804808 * b,
    0.2126390 * r + 0.7151687 * g + 0.0721923 * b,
    0.0193308 * r + 0.1191948 * g + 0.9505322 * b,
  ];
}
function xyzToLinSrgb(x: number, y: number, z: number): LinRGB {
  return {
    r: 3.2409699 * x - 1.5373832 * y - 0.4986108 * z,
    g: -0.9692436 * x + 1.8759675 * y + 0.0415551 * z,
    b: 0.0556301 * x - 0.2039770 * y + 1.0569715 * z,
  };
}

const WHITE: [number, number, number] = [0.9504559, 1.0, 1.0890578];

function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const d = 6 / 29;
  const inv = (t: number) => (t > d ? t * t * t : 3 * d * d * (t - 4 / 29));
  return [inv(fx) * WHITE[0], inv(fy) * WHITE[1], inv(fz) * WHITE[2]];
}

function lchToLab(L: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return [L, c * Math.cos(rad), c * Math.sin(rad)];
}

function oklabToLinSrgb(L: number, a: number, b: number): LinRGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

// Display-P3 linear -> linear sRGB via XYZ
function p3ToLinSrgb({ r, g, b }: LinRGB): LinRGB {
  const x = 0.4865709 * r + 0.2656677 * g + 0.1982173 * b;
  const y = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b;
  const z = 0.0000000 * r + 0.0451134 * g + 1.0439444 * b;
  return xyzToLinSrgb(x, y, z);
}

function fmt(n: number, step: number): string {
  if (step >= 1) return Math.round(n).toString();
  const dp = step >= 0.1 ? 1 : 3;
  return Number(n.toFixed(dp)).toString();
}

export default function CssColorFunctionBuilderTool() {
  const [space, setSpace] = useState<Space>('oklch');
  const [vals, setVals] = useState<[number, number, number]>([0.62, 0.18, 264]);
  const [alpha, setAlpha] = useState(100);

  const spec = SPACES[space];

  const onSpaceChange = (s: Space) => {
    setSpace(s);
    const ch = SPACES[s].channels;
    setVals([ch[0].def, ch[1].def, ch[2].def]);
  };

  const setVal = (i: number, v: number) => {
    setVals((prev) => {
      const next: [number, number, number] = [prev[0], prev[1], prev[2]];
      if (i === 0) next[0] = v;
      else if (i === 1) next[1] = v;
      else next[2] = v;
      return next;
    });
  };

  const computed = useMemo(() => {
    const [a, b, c] = vals;
    let lin: LinRGB;
    switch (space) {
      case 'rgb': lin = { r: srgbToLin(a / 255), g: srgbToLin(b / 255), b: srgbToLin(c / 255) }; break;
      case 'srgb': lin = { r: srgbToLin(a), g: srgbToLin(b), b: srgbToLin(c) }; break;
      case 'hsl': lin = hslToLinSrgb(a, b, c); break;
      case 'hwb': lin = hwbToLinSrgb(a, b, c); break;
      case 'lab': { const [x, y, z] = labToXyz(a, b, c); lin = xyzToLinSrgb(x, y, z); break; }
      case 'lch': { const [L, aa, bb] = lchToLab(a, b, c); const [x, y, z] = labToXyz(L, aa, bb); lin = xyzToLinSrgb(x, y, z); break; }
      case 'oklab': lin = oklabToLinSrgb(a, b, c); break;
      case 'oklch': { const rad = (c * Math.PI) / 180; lin = oklabToLinSrgb(a, b * Math.cos(rad), b * Math.sin(rad)); break; }
      case 'display-p3': lin = p3ToLinSrgb({ r: srgbToLin(a), g: srgbToLin(b), b: srgbToLin(c) }); break;
      default: lin = { r: 0, g: 0, b: 0 }; break;
    }
    const eps = 1e-4;
    const inGamut = [lin.r, lin.g, lin.b].every((v) => v >= -eps && v <= 1 + eps);
    const preview = `rgb(${Math.round(clamp01(linToSrgb(clamp01(lin.r))) * 255)}, ${Math.round(clamp01(linToSrgb(clamp01(lin.g))) * 255)}, ${Math.round(clamp01(linToSrgb(clamp01(lin.b))) * 255)})`;
    return { inGamut, preview };
  }, [space, vals]);

  const { modern, legacy } = useMemo(() => {
    const ch = spec.channels;
    const c0 = `${fmt(vals[0], ch[0].step)}${ch[0].unit}`;
    const c1 = `${fmt(vals[1], ch[1].step)}${ch[1].unit}`;
    const c2 = `${fmt(vals[2], ch[2].step)}${ch[2].unit}`;
    const alphaPart = alpha < 100 ? ` / ${(alpha / 100).toFixed(2)}` : '';
    const alphaLegacy = alpha < 100 ? `, ${(alpha / 100).toFixed(2)}` : '';

    let m = '';
    let l: string | null = null;
    switch (space) {
      case 'rgb':
        m = `rgb(${c0} ${c1} ${c2}${alphaPart})`;
        l = alpha < 100 ? `rgba(${c0}, ${c1}, ${c2}${alphaLegacy})` : `rgb(${c0}, ${c1}, ${c2})`;
        break;
      case 'hsl':
        m = `hsl(${c0} ${c1} ${c2}${alphaPart})`;
        l = alpha < 100 ? `hsla(${c0}, ${c1}, ${c2}${alphaLegacy})` : `hsl(${c0}, ${c1}, ${c2})`;
        break;
      case 'hwb': m = `hwb(${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'lab': m = `lab(${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'lch': m = `lch(${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'oklab': m = `oklab(${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'oklch': m = `oklch(${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'srgb': m = `color(srgb ${c0} ${c1} ${c2}${alphaPart})`; break;
      case 'display-p3': m = `color(display-p3 ${c0} ${c1} ${c2}${alphaPart})`; break;
      default: m = ''; break;
    }
    return { modern: m, legacy: l };
  }, [space, vals, alpha, spec]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color function" className="min-w-[200px]">
            <Select value={space} onValueChange={(v) => onSpaceChange(v as Space)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SPACES) as Space[]).map((s) => (
                  <SelectItem key={s} value={s}>{SPACES[s].name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
        <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-3">
          {spec.channels.map((c, i) => {
            const val = vals[i] ?? c.def;
            return (
              <Field key={c.label} label={`${c.label}: ${fmt(val, c.step)}${c.unit}`}>
                <div className="flex items-center gap-2">
                  <Slider value={[val]} min={c.min} max={c.max} step={c.step} onValueChange={(v) => setVal(i, v[0] ?? c.def)} />
                  <Input
                    value={fmt(val, c.step)}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setVal(i, Math.max(c.min, Math.min(c.max, n))); }}
                    inputMode="decimal"
                    className="h-8 w-20 font-mono text-xs"
                  />
                </div>
              </Field>
            );
          })}
          <Field label={`Alpha: ${alpha}%`}>
            <Slider value={[alpha]} min={0} max={100} step={1} onValueChange={(v) => setAlpha(v[0] ?? 100)} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Result">
          <CopyButton value={() => modern} />
        </PanelHeader>
        <div className="flex flex-col items-center gap-3 p-4">
          <div className="h-24 w-full rounded-md border" style={{ backgroundColor: computed.preview }} />
          {computed.inGamut ? (
            <Badge variant="secondary">In sRGB gamut</Badge>
          ) : (
            <Badge variant="destructive">Out of sRGB gamut (clamped preview)</Badge>
          )}
        </div>
        <div className="space-y-3 p-3 pt-0">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">Modern syntax</span>
            <span className="flex items-center gap-2 font-mono text-sm">
              <span>{modern}</span>
              <CopyButton value={modern} size="icon-sm" />
            </span>
          </div>
          {legacy && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Legacy syntax</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{legacy}</span>
                <CopyButton value={legacy} size="icon-sm" />
              </span>
            </div>
          )}
        </div>
        <StatBar items={[`Space: ${spec.name}`, `Preview: ${computed.preview}`]} />
      </Panel>
    </div>
  );
}
