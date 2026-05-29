'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

// Tailwind CSS v3 default palette (HEX values).
const TW_PALETTE: Record<string, Record<string, string>> = {
  slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a', '950': '#020617' },
  gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827', '950': '#030712' },
  zinc: { '50': '#fafafa', '100': '#f4f4f5', '200': '#e4e4e7', '300': '#d4d4d8', '400': '#a1a1aa', '500': '#71717a', '600': '#52525b', '700': '#3f3f46', '800': '#27272a', '900': '#18181b', '950': '#09090b' },
  neutral: { '50': '#fafafa', '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a3a3a3', '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717', '950': '#0a0a0a' },
  stone: { '50': '#fafaf9', '100': '#f5f5f4', '200': '#e7e5e4', '300': '#d6d3d1', '400': '#a8a29e', '500': '#78716c', '600': '#57534e', '700': '#44403c', '800': '#292524', '900': '#1c1917', '950': '#0c0a09' },
  red: { '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5', '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a' },
  orange: { '50': '#fff7ed', '100': '#ffedd5', '200': '#fed7aa', '300': '#fdba74', '400': '#fb923c', '500': '#f97316', '600': '#ea580c', '700': '#c2410c', '800': '#9a3412', '900': '#7c2d12', '950': '#431407' },
  amber: { '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f', '950': '#451a03' },
  yellow: { '50': '#fefce8', '100': '#fef9c3', '200': '#fef08a', '300': '#fde047', '400': '#facc15', '500': '#eab308', '600': '#ca8a04', '700': '#a16207', '800': '#854d0e', '900': '#713f12', '950': '#422006' },
  lime: { '50': '#f7fee7', '100': '#ecfccb', '200': '#d9f99d', '300': '#bef264', '400': '#a3e635', '500': '#84cc16', '600': '#65a30d', '700': '#4d7c0f', '800': '#3f6212', '900': '#365314', '950': '#1a2e05' },
  green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac', '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d', '950': '#052e16' },
  emerald: { '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22' },
  teal: { '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4', '400': '#2dd4bf', '500': '#14b8a6', '600': '#0d9488', '700': '#0f766e', '800': '#115e59', '900': '#134e4a', '950': '#042f2e' },
  cyan: { '50': '#ecfeff', '100': '#cffafe', '200': '#a5f3fc', '300': '#67e8f9', '400': '#22d3ee', '500': '#06b6d4', '600': '#0891b2', '700': '#0e7490', '800': '#155e75', '900': '#164e63', '950': '#083344' },
  sky: { '50': '#f0f9ff', '100': '#e0f2fe', '200': '#bae6fd', '300': '#7dd3fc', '400': '#38bdf8', '500': '#0ea5e9', '600': '#0284c7', '700': '#0369a1', '800': '#075985', '900': '#0c4a6e', '950': '#082f49' },
  blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554' },
  indigo: { '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b' },
  violet: { '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa', '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95', '950': '#2e1065' },
  purple: { '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff', '300': '#d8b4fe', '400': '#c084fc', '500': '#a855f7', '600': '#9333ea', '700': '#7e22ce', '800': '#6b21a8', '900': '#581c87', '950': '#3b0764' },
  fuchsia: { '50': '#fdf4ff', '100': '#fae8ff', '200': '#f5d0fe', '300': '#f0abfc', '400': '#e879f9', '500': '#d946ef', '600': '#c026d3', '700': '#a21caf', '800': '#86198f', '900': '#701a75', '950': '#4a044e' },
  pink: { '50': '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8', '300': '#f9a8d4', '400': '#f472b6', '500': '#ec4899', '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843', '950': '#500724' },
  rose: { '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af', '400': '#fb7185', '500': '#f43f5e', '600': '#e11d48', '700': '#be123c', '800': '#9f1239', '900': '#881337', '950': '#4c0519' },
};

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

function parseColor(input: string): [number, number, number] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const rgbMatch = /^rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/i.exec(trimmed);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return [r, g, b];
    }
    return null;
  }
  return hexToRgb(trimmed);
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

interface Nearest {
  name: string;
  shade: string;
  hex: string;
  delta: number;
}

function findNearest(rgb: [number, number, number]): Nearest {
  let best: Nearest = { name: '', shade: '', hex: '#000000', delta: Infinity };
  for (const [name, shades] of Object.entries(TW_PALETTE)) {
    for (const [shade, hex] of Object.entries(shades)) {
      const candidate = hexToRgb(hex);
      if (!candidate) continue;
      const dr = rgb[0] - candidate[0];
      const dg = rgb[1] - candidate[1];
      const db = rgb[2] - candidate[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < best.delta) {
        best = { name, shade, hex, delta: d };
      }
    }
  }
  return best;
}

const ALL_NAMES = Object.keys(TW_PALETTE);
const ALL_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export default function TailwindColorsTool() {
  const [mode, setMode] = useState<'find' | 'lookup'>('find');

  // find mode
  const [colorInput, setColorInput] = useState('#5b9bd5');
  const findRgb = useMemo(() => parseColor(colorInput), [colorInput]);
  const nearest = useMemo(() => (findRgb ? findNearest(findRgb) : null), [findRgb]);
  const findError =
    colorInput.trim() && !findRgb ? 'Enter a valid HEX (#3b82f6) or rgb() color.' : null;
  const findPickerHex = findRgb ? toHex(findRgb) : '#5b9bd5';

  // lookup mode
  const [name, setName] = useState('blue');
  const [shade, setShade] = useState('500');
  const lookupHex = TW_PALETTE[name]?.[shade] ?? null;
  const token = `${name}-${shade}`;
  const lookupRgb = lookupHex ? hexToRgb(lookupHex) : null;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'find' | 'lookup')}>
            <TabsList>
              <TabsTrigger value="find">Color → Tailwind</TabsTrigger>
              <TabsTrigger value="lookup">Token → HEX</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      {mode === 'find' ? (
        <>
          <ErrorBanner error={findError} />
          <OptionsBar>
            <Field label="Color (HEX or rgb)" className="min-w-[240px]">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={findPickerHex}
                  onChange={(e) => setColorInput(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  aria-label="Pick color"
                />
                <Input
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  placeholder="#5b9bd5 or rgb(91,155,213)"
                  className="h-9 font-mono"
                />
              </div>
            </Field>
          </OptionsBar>

          {nearest ? (
            <Panel>
              <PanelHeader title="Closest Tailwind color">
                <CopyButton value={`${nearest.name}-${nearest.shade}`} />
              </PanelHeader>
              <div className="flex items-center gap-4 p-4">
                <span
                  className="size-16 shrink-0 rounded-md border"
                  style={{ backgroundColor: nearest.hex }}
                />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-lg font-semibold">
                    {nearest.name}-{nearest.shade}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">{nearest.hex}</span>
                </div>
              </div>
              <StatBar
                items={[
                  nearest.delta === 0
                    ? 'Exact match'
                    : `Δ ${Math.round(Math.sqrt(nearest.delta))}`,
                  `bg-${nearest.name}-${nearest.shade}`,
                  `text-${nearest.name}-${nearest.shade}`,
                ]}
              />
            </Panel>
          ) : null}
        </>
      ) : (
        <>
          <OptionsBar>
            <Field label="Color">
              <Select value={name} onValueChange={(v) => setName(v)}>
                <SelectTrigger className="h-9 w-40 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_NAMES.map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Shade">
              <Select value={shade} onValueChange={(v) => setShade(v)}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_SHADES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <Panel>
            <PanelHeader title={token}>
              {lookupHex ? <CopyButton value={lookupHex} /> : null}
            </PanelHeader>
            {lookupHex ? (
              <>
                <div className="flex items-center gap-4 p-4">
                  <span
                    className="size-16 shrink-0 rounded-md border"
                    style={{ backgroundColor: lookupHex }}
                  />
                  <span className="font-mono text-lg font-semibold">{lookupHex}</span>
                </div>
                <StatBar
                  items={[
                    `bg-${token}`,
                    lookupRgb ? `rgb(${lookupRgb.join(', ')})` : false,
                  ]}
                />
              </>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                That shade is not available for this color.
              </div>
            )}
          </Panel>
        </>
      )}

      <Panel>
        <PanelHeader title="Full palette" />
        <div className="space-y-2 p-3">
          {ALL_NAMES.map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-2xs capitalize text-muted-foreground">{n}</span>
              <div className="flex flex-1 gap-1">
                {ALL_SHADES.map((s) => {
                  const hex = TW_PALETTE[n]?.[s];
                  if (!hex) return null;
                  return (
                    <button
                      key={s}
                      type="button"
                      title={`${n}-${s} ${hex}`}
                      onClick={() => {
                        setMode('lookup');
                        setName(n);
                        setShade(s);
                      }}
                      className="h-6 flex-1 rounded border border-border/40 transition-transform hover:scale-110"
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
