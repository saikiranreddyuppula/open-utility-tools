'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'index' | 'rgb';

interface RGB {
  r: number;
  g: number;
  b: number;
}

const SYSTEM: RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 128, g: 0, b: 0 },
  { r: 0, g: 128, b: 0 },
  { r: 128, g: 128, b: 0 },
  { r: 0, g: 0, b: 128 },
  { r: 128, g: 0, b: 128 },
  { r: 0, g: 128, b: 128 },
  { r: 192, g: 192, b: 192 },
  { r: 128, g: 128, b: 128 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 0, b: 255 },
  { r: 0, g: 255, b: 255 },
  { r: 255, g: 255, b: 255 },
];

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function indexToRgb(i: number): RGB | null {
  if (!Number.isInteger(i) || i < 0 || i > 255) return null;
  if (i < 16) {
    return SYSTEM[i] ?? null;
  }
  if (i < 232) {
    const n = i - 16;
    const ri = Math.floor(n / 36);
    const gi = Math.floor((n % 36) / 6);
    const bi = n % 6;
    const r = CUBE_LEVELS[ri];
    const g = CUBE_LEVELS[gi];
    const b = CUBE_LEVELS[bi];
    if (r === undefined || g === undefined || b === undefined) return null;
    return { r, g, b };
  }
  const v = 8 + (i - 232) * 10;
  return { r: v, g: v, b: v };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const exp = (n: string): number => parseInt(n + n, 16);
    if (hex.length === 3) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r: exp(r), g: exp(g), b: exp(b) };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m && m[1] !== undefined) {
    const p = m[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(p[0]);
    const g = Number(p[1]);
    const b = Number(p[2]);
    if (![r, g, b].every(Number.isFinite)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
  }
  // plain "r g b" or "r,g,b"
  const p = s.split(/[,\s]+/).filter(Boolean);
  if (p.length === 3) {
    const r = Number(p[0]);
    const g = Number(p[1]);
    const b = Number(p[2]);
    if ([r, g, b].every(Number.isFinite)) {
      return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
    }
  }
  return null;
}

function dist2(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function nearestIndex(c: RGB): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const pc = indexToRgb(i);
    if (!pc) continue;
    const d = dist2(c, pc);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function toHex(c: RGB): string {
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
}

export default function Ansi256Tool() {
  const [mode, setMode] = useState<Mode>('index');
  const [idx, setIdx] = useState('39');
  const [rgbInput, setRgbInput] = useState('#5fafff');

  const result = useMemo(() => {
    if (mode === 'index') {
      const n = Number(idx.trim());
      if (!Number.isInteger(n)) return { error: 'Enter a whole number 0–255.' };
      const c = indexToRgb(n);
      if (!c) return { error: 'Index out of range (0–255).' };
      return {
        index: n,
        rgb: c,
        hex: toHex(c),
        rgbStr: `rgb(${c.r}, ${c.g}, ${c.b})`,
        exact: true,
      };
    }
    const c = parseColor(rgbInput);
    if (!c) return { error: 'Enter a valid color (#hex, rgb(), or "r g b").' };
    const n = nearestIndex(c);
    const pc = indexToRgb(n);
    if (!pc) return { error: 'Lookup failed.' };
    const d = Math.sqrt(dist2(c, pc));
    return {
      index: n,
      rgb: pc,
      hex: toHex(pc),
      rgbStr: `rgb(${pc.r}, ${pc.g}, ${pc.b})`,
      exact: d < 0.5,
      distance: d,
      input: c,
    };
  }, [mode, idx, rgbInput]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="index">Index → RGB</TabsTrigger>
                <TabsTrigger value="rgb">RGB → Index</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'index' ? (
            <Field label="ANSI index (0–255)">
              <Input value={idx} onChange={(e) => setIdx(e.target.value)} inputMode="numeric" className="w-28" />
            </Field>
          ) : (
            <Field label="Color">
              <Input value={rgbInput} onChange={(e) => setRgbInput(e.target.value)} className="w-40 font-mono" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() => `index ${result.index} = ${result.hex} (\\e[38;5;${result.index}m)`}
            />
          </PanelHeader>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-md border">
              <div className="h-24" style={{ backgroundColor: result.hex }} />
              <div className="text-2xs px-3 py-2 font-mono text-muted-foreground">palette match</div>
            </div>
            <div className="grid content-start gap-2">
              {[
                { label: 'Index', value: String(result.index) },
                { label: 'HEX', value: result.hex },
                { label: 'RGB', value: result.rgbStr },
                { label: 'Foreground SGR', value: `\\e[38;5;${result.index}m` },
                { label: 'Background SGR', value: `\\e[48;5;${result.index}m` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    {row.value}
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StatBar
            items={[
              mode === 'rgb' && 'distance' in result && result.distance !== undefined
                ? result.exact
                  ? 'exact palette match'
                  : `nearest (Δ ≈ ${result.distance.toFixed(1)})`
                : `index ${result.index} → ${result.hex}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
