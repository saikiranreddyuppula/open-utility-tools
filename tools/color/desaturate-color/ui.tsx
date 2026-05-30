'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RGB { r: number; g: number; b: number }
interface HSL { h: number; s: number; l: number }

type Method = 'hsl' | 'luminance';

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

function lumaGray({ r, g, b }: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function DesaturateColorTool() {
  const [color, setColor] = useState('#e0533d');
  const [amount, setAmount] = useState(50);
  const [method, setMethod] = useState<Method>('hsl');

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return { error: 'Enter a valid HEX (#e0533d) or RGB color.' };
    const k = amount / 100;

    let out: RGB;
    if (method === 'hsl') {
      const hsl = rgbToHsl(rgb);
      out = hslToRgb({ h: hsl.h, s: hsl.s * (1 - k), l: hsl.l });
    } else {
      const gray = lumaGray(rgb);
      out = {
        r: rgb.r * (1 - k) + gray * k,
        g: rgb.g * (1 - k) + gray * k,
        b: rgb.b * (1 - k) + gray * k,
      };
    }
    const outHsl = rgbToHsl(out);
    const satFilter = (1 - k).toFixed(2);

    return {
      beforeSwatch: rgbStr(rgb),
      afterSwatch: toHex(out),
      rows: [
        { label: 'HEX', value: toHex(out) },
        { label: 'RGB', value: rgbStr(out) },
        { label: 'HSL', value: hslStr(outHsl) },
        { label: 'CSS filter', value: `saturate(${satFilter})` },
      ],
    };
  }, [color, amount, method]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color (HEX or RGB)" className="min-w-[220px]">
            <div className="flex items-center gap-2">
              <input type="color" value={color.startsWith('#') && color.length === 7 ? color : '#e0533d'} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color picker" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" placeholder="#e0533d" />
            </div>
          </Field>
          <Field label="Method">
            <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
              <TabsList>
                <TabsTrigger value="hsl">HSL saturation</TabsTrigger>
                <TabsTrigger value="luminance">Toward gray</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`Desaturate: ${amount}%`} className="min-w-[220px] flex-1">
            <Slider value={[amount]} min={0} max={100} step={1} onValueChange={(v) => setAmount(v[0] ?? 0)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-2 gap-3 p-3">
            <div className="flex flex-col items-center gap-2">
              <div className="h-20 w-full rounded-md border" style={{ backgroundColor: result.beforeSwatch }} />
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">Before</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-20 w-full rounded-md border" style={{ backgroundColor: result.afterSwatch }} />
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">After</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[method === 'hsl' ? 'HSL: S × (1 − amount)' : 'Luminance-preserving blend toward gray', `${amount}% applied`]} />
        </Panel>
      )}
    </div>
  );
}
