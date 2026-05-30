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

// Tailwind CSS v3 default palette (hex per family/shade).
const PALETTE: Record<string, Record<string, string>> = {
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

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
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

interface Lab {
  L: number;
  a: number;
  b: number;
}

function rgbToLab({ r, g, b }: RGB): Lab {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const rl = srgb[0] ?? 0;
  const gl = srgb[1] ?? 0;
  const bl = srgb[2] ?? 0;
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

interface Token {
  family: string;
  shade: string;
  token: string;
  hex: string;
  lab: Lab;
}

const TOKENS: Token[] = [];
for (const [family, shades] of Object.entries(PALETTE)) {
  for (const shade of SHADES) {
    const hex = shades[shade];
    if (hex === undefined) continue;
    TOKENS.push({ family, shade, token: `${family}-${shade}`, hex, lab: rgbToLab(hexToRgb(hex)) });
  }
}

function deltaLab(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function NearestTailwindColor() {
  const [color, setColor] = useState('#2f74c0');

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return null;
    const lab = rgbToLab(rgb);
    const scored = TOKENS.map((t) => ({ ...t, dist: deltaLab(lab, t.lab) }));
    scored.sort((p, n) => p.dist - n.dist);
    const top = scored.slice(0, 5);
    const best = top[0];
    return { input: rgb, top, family: best?.family ?? null };
  }, [color]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color">
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-44 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {!result ? (
        <ErrorBanner error="Enter a valid color (e.g. #2f74c0 or rgb(47,116,192))." />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Closest Tailwind tokens">
              <CopyButton
                value={() => result.top.map((t) => `${t.token} ${t.hex} (ΔE ${t.dist.toFixed(2)})`).join('\n')}
              />
            </PanelHeader>
            <div className="divide-y">
              {result.top.map((t, i) => (
                <div key={t.token} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-5 shrink-0 text-right font-mono text-2xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="h-8 w-12 shrink-0 rounded border" style={{ backgroundColor: t.hex }} />
                  <code className="w-32 shrink-0 font-mono text-sm">{t.token}</code>
                  <code className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{t.hex}</code>
                  <span className="min-w-0 flex-1 text-right font-mono text-xs text-muted-foreground tabular">
                    ΔE {t.dist.toFixed(2)}
                  </span>
                  <CopyButton value={t.token} size="icon-sm" />
                </div>
              ))}
            </div>
            <StatBar items={[`input ${toHex(result.input)}`, `${TOKENS.length} tokens`]} />
          </Panel>

          {result.family && (
            <Panel>
              <PanelHeader title={`${result.family} ramp`} />
              <div className="flex overflow-x-auto">
                {SHADES.map((shade) => {
                  const families = PALETTE[result.family ?? ''];
                  const hex = families ? families[shade] : undefined;
                  if (hex === undefined) return null;
                  const dark = ['50', '100', '200', '300', '400'].includes(shade);
                  return (
                    <div
                      key={shade}
                      className="flex min-w-[64px] flex-1 flex-col items-center justify-end gap-1 py-3"
                      style={{ backgroundColor: hex, color: dark ? '#000' : '#fff' }}
                      title={`${result.family}-${shade} ${hex}`}
                    >
                      <span className="text-2xs font-medium">{shade}</span>
                      <span className="font-mono text-[10px] opacity-80">{hex}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
