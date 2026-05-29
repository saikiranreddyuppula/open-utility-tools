'use client';

import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/** Parse #rgb / #rrggbb / rgb() into RGB 0-255. Throws on invalid. */
function parseColor(input: string): Rgb {
  const s = input.trim().toLowerCase();
  if (!s) throw new Error('Enter a color.');

  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hexMatch && hexMatch[1] !== undefined) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
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
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
  }

  throw new Error(`Unrecognized color: "${input.trim()}". Use HEX or rgb().`);
}

/** Linear interpolation of channels. t=0 => a, t=1 => b. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function ColorPreview({ label, hex, error }: { label: string; hex: string; error: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-9 w-9 shrink-0 rounded-md border"
        style={error ? undefined : { backgroundColor: hex }}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ColorMixerTool() {
  const [colorA, setColorA] = useState('#ff0000');
  const [colorB, setColorB] = useState('#0000ff');
  const [pct, setPct] = useState(50);

  const parsedA = useMemo(() => {
    try {
      return { rgb: parseColor(colorA), error: null as string | null };
    } catch (e) {
      return { rgb: null, error: e instanceof Error ? e.message : 'Invalid color A' };
    }
  }, [colorA]);

  const parsedB = useMemo(() => {
    try {
      return { rgb: parseColor(colorB), error: null as string | null };
    } catch (e) {
      return { rgb: null, error: e instanceof Error ? e.message : 'Invalid color B' };
    }
  }, [colorB]);

  const error = parsedA.error ?? parsedB.error;

  const mixed = useMemo(() => {
    if (!parsedA.rgb || !parsedB.rgb) return null;
    return mix(parsedA.rgb, parsedB.rgb, pct / 100);
  }, [parsedA.rgb, parsedB.rgb, pct]);

  const mixedHex = mixed ? rgbToHex(mixed) : '';
  const mixedRgb = mixed
    ? `rgb(${clampByte(mixed.r)}, ${clampByte(mixed.g)}, ${clampByte(mixed.b)})`
    : '';

  return (
    <Panel>
      <PanelHeader title="Color Mixer / Blender" />
      <OptionsBar>
        <Field label="Color A" className="min-w-[180px]">
          <Input
            value={colorA}
            onChange={(e) => setColorA(e.target.value)}
            placeholder="#ff0000"
            spellCheck={false}
          />
        </Field>
        <Field label="Color B" className="min-w-[180px]">
          <Input
            value={colorB}
            onChange={(e) => setColorB(e.target.value)}
            placeholder="#0000ff"
            spellCheck={false}
          />
        </Field>
      </OptionsBar>

      <ErrorBanner error={error} />

      <Field label={`Mix: ${100 - pct}% A / ${pct}% B`}>
        <Slider
          value={[pct]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setPct(v[0] ?? 50)}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ColorPreview label="A" hex={parsedA.rgb ? rgbToHex(parsedA.rgb) : ''} error={!parsedA.rgb} />
        <ColorPreview label="B" hex={parsedB.rgb ? rgbToHex(parsedB.rgb) : ''} error={!parsedB.rgb} />
      </div>

      {mixed && (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div className="h-32 w-full" style={{ backgroundColor: mixedHex }} />
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{mixedHex}</span>
                <CopyButton value={mixedHex} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{mixedRgb}</span>
                <CopyButton value={mixedRgb} />
              </div>
            </div>
          </div>
          <StatBar
            items={[
              `R ${clampByte(mixed.r)}`,
              `G ${clampByte(mixed.g)}`,
              `B ${clampByte(mixed.b)}`,
            ]}
          />
        </>
      )}
    </Panel>
  );
}
