'use client';

import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

function normalizeHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = normalizeHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
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
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: normalizeHue(h), s, l };
}

function hslToHex(c: Hsl): string {
  const [r, g, b] = hslToRgb(c.h, c.s, c.l);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function rgbText(c: Hsl): string {
  const [r, g, b] = hslToRgb(c.h, c.s, c.l);
  return `rgb(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)})`;
}

function hslText(c: Hsl): string {
  return `hsl(${Math.round(c.h)}, ${Math.round(c.s * 100)}%, ${Math.round(c.l * 100)}%)`;
}

function parseColor(input: string): Hsl {
  const s = input.trim().toLowerCase();
  if (!s) throw new Error('Enter a base color.');

  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hexMatch && hexMatch[1] !== undefined) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return rgbToHsl(r, g, b);
  }

  const rgbMatch = /^rgba?\s*\(([^)]*)\)$/.exec(s);
  if (rgbMatch && rgbMatch[1] !== undefined) {
    const parts = rgbMatch[1]
      .split(/[\s,/]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (![r, g, b].every(Number.isFinite)) throw new Error('Invalid rgb() value.');
    return rgbToHsl(r, g, b);
  }

  const hslMatch = /^hsla?\s*\(([^)]*)\)$/.exec(s);
  if (hslMatch && hslMatch[1] !== undefined) {
    const parts = hslMatch[1]
      .split(/[\s,/]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const h = Number((parts[0] ?? '').replace(/deg$/, ''));
    const sat = Number((parts[1] ?? '').replace(/%$/, '')) / 100;
    const lig = Number((parts[2] ?? '').replace(/%$/, '')) / 100;
    if (![h, sat, lig].every(Number.isFinite)) throw new Error('Invalid hsl() value.');
    return { h: normalizeHue(h), s: clamp01(sat), l: clamp01(lig) };
  }

  throw new Error('Unrecognized color. Use HEX (#e11d48), rgb(), or hsl().');
}

function buildTriad(base: Hsl, vary: boolean): Hsl[] {
  const { h, s, l } = base;
  // Small per-swatch lightness variation makes a more usable UI set.
  const deltas = vary ? [0, -0.06, 0.06] : [0, 0, 0];
  const hues = [h, normalizeHue(h + 120), normalizeHue(h + 240)];
  return hues.map((hue, i) => ({
    h: hue,
    s,
    l: clamp01(l + (deltas[i] ?? 0)),
  }));
}

function Swatch({ color, role }: { color: Hsl; role: string }) {
  const hex = hslToHex(color);
  const textDark = color.l > 0.55;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className="flex h-28 items-end justify-between p-2"
        style={{ backgroundColor: hex }}
      >
        <span className={`font-mono text-xs ${textDark ? 'text-black/70' : 'text-white/85'}`}>
          {role}
        </span>
        <CopyButton value={hex} size="icon-sm" />
      </div>
      <div className="space-y-0.5 px-2 py-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono">{hex}</span>
          <CopyButton value={hex} size="icon-sm" />
        </div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="truncate font-mono">{rgbText(color)}</span>
          <CopyButton value={rgbText(color)} size="icon-sm" />
        </div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="truncate font-mono">{hslText(color)}</span>
          <CopyButton value={hslText(color)} size="icon-sm" />
        </div>
      </div>
    </div>
  );
}

const ROLES = ['primary', 'secondary', 'tertiary'];

export default function TriadicColorScheme() {
  const [value, setValue] = useState('#e11d48');
  const [vary, setVary] = useState(false);

  const result = useMemo(() => {
    try {
      const base = parseColor(value);
      return { palette: buildTriad(base, vary), error: null as string | null };
    } catch (e) {
      return { palette: [] as Hsl[], error: e instanceof Error ? e.message : 'Invalid color' };
    }
  }, [value, vary]);

  const cssBlock = useMemo(() => {
    return result.palette
      .map((c, i) => `--color-${ROLES[i] ?? `c${i + 1}`}: ${hslToHex(c)};`)
      .join('\n');
  }, [result.palette]);

  return (
    <Panel>
      <PanelHeader title="Triadic Color Scheme" />
      <OptionsBar>
        <Field label="Base color" className="min-w-[220px]">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="#e11d48 or hsl(347,77%,50%)"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <Field label="Lightness variation">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={vary} onCheckedChange={setVary} />
            <span className="text-sm text-muted-foreground">
              {vary ? 'Per-swatch ±6% L' : 'Locked S / L'}
            </span>
          </div>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {result.palette.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {result.palette.map((c, i) => (
              <Swatch key={`${i}-${Math.round(c.h)}`} color={c} role={ROLES[i] ?? `c${i + 1}`} />
            ))}
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-md border bg-muted/30">
              <div className="flex h-8 items-center justify-between border-b px-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>CSS variables</span>
                <CopyButton value={() => cssBlock} label="Copy all" />
              </div>
              <pre className="overflow-auto px-3 py-2 font-mono text-xs">{cssBlock}</pre>
            </div>
          </div>
          <StatBar items={[`${result.palette.length} colors`, 'Triadic (120° steps)']} />
        </>
      )}
    </Panel>
  );
}
