'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

// FNV-1a 32-bit hash of a string -> unsigned 32-bit seed.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) seeded from a 32-bit value.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

const GOLDEN_ANGLE = 137.508;

export default function PaletteFromNumbersTool() {
  const [seed, setSeed] = useState('order-48291');
  const [size, setSize] = useState(6);

  const palette = useMemo(() => {
    const digest = fnv1a(seed.length ? seed : 'seed');
    const rand = mulberry32(digest);
    const startHue = (digest % 36000) / 100; // 0..360 deterministic offset
    const out: { hex: string; hsl: string; index: number }[] = [];
    for (let i = 0; i < size; i++) {
      const h = (((startHue + i * GOLDEN_ANGLE) % 360) + 360) % 360;
      // Pull S and L from PRNG inside pleasant bands.
      const s = 0.55 + rand() * 0.3; // 55%..85%
      const l = 0.45 + rand() * 0.2; // 45%..65%
      const c = hslToRgb({ h, s, l });
      out.push({
        hex: rgbToHex(c),
        hsl: `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
        index: i + 1,
      });
    }
    return out;
  }, [seed, size]);

  const cssVars = useMemo(
    () => ':root {\n' + palette.map((p, i) => `  --c-${i + 1}: ${p.hex};`).join('\n') + '\n}',
    [palette],
  );

  const seedDigest = useMemo(() => fnv1a(seed.length ? seed : 'seed'), [seed]);

  return (
    <Panel>
      <PanelHeader title="Palette from Numbers" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label="Seed (number or string)" className="min-w-[240px] flex-1">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="font-mono"
              placeholder="user-id, 42, any string…"
            />
          </Field>
          <Field label={`Colors: ${size}`} className="min-w-[180px]">
            <Slider
              value={[size]}
              min={2}
              max={12}
              step={1}
              onValueChange={(v) => setSize(v[0] ?? size)}
            />
          </Field>
        </OptionsBar>

        <div className="flex h-14 w-full overflow-hidden rounded-md border">
          {palette.map((p, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: p.hex }} title={p.hex} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {palette.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border p-2">
              <div className="h-9 w-9 shrink-0 rounded border" style={{ backgroundColor: p.hex }} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs">{p.hex}</div>
                <div className="truncate font-mono text-2xs text-muted-foreground">{p.hsl}</div>
              </div>
              <CopyButton value={p.hex} size="icon-sm" />
            </div>
          ))}
        </div>

        <StatBar items={[`${palette.length} colors`, `digest 0x${seedDigest.toString(16)}`, 'deterministic']} />

        <Panel>
          <PanelHeader title="CSS custom properties">
            <CopyButton value={cssVars} label="Copy" />
          </PanelHeader>
          <pre className="max-h-48 overflow-auto p-3 font-mono text-xs">{cssVars}</pre>
        </Panel>
      </div>
    </Panel>
  );
}
