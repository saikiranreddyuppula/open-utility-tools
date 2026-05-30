'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RGB = { r: number; g: number; b: number };
type Mode = 'encode' | 'decode';

function parseColor(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]); const g = Number(rgbMatch[2]); const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function encode565({ r, g, b }: RGB): number {
  const r5 = r >> 3, g6 = g >> 2, b5 = b >> 3;
  return ((r5 << 11) | (g6 << 5) | b5) & 0xffff;
}

// bit-replication expansion back to 8-bit
function decode565(v: number): RGB {
  const r5 = (v >> 11) & 0x1f;
  const g6 = (v >> 5) & 0x3f;
  const b5 = v & 0x1f;
  return {
    r: (r5 << 3) | (r5 >> 2),
    g: (g6 << 2) | (g6 >> 4),
    b: (b5 << 3) | (b5 >> 2),
  };
}

function parse565(input: string): number | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  let v: number;
  if (t.startsWith('0x')) v = parseInt(t.slice(2), 16);
  else if (/^[0-9a-f]{3,4}$/.test(t) && /[a-f]/.test(t)) v = parseInt(t, 16);
  else if (/^\d+$/.test(t)) v = parseInt(t, 10);
  else v = parseInt(t, 16);
  if (!Number.isFinite(v) || v < 0 || v > 0xffff) return null;
  return v;
}

export default function Rgb565Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [rgbInput, setRgbInput] = useState('#3b82f6');
  const [v565, setV565] = useState('0x3D7E');

  const result = useMemo(() => {
    if (mode === 'encode') {
      const c = parseColor(rgbInput);
      if (!c) return { error: 'Enter a valid 24-bit color (#hex or rgb()).' };
      const packed = encode565(c);
      const approx = decode565(packed);
      return {
        kind: 'encode' as const,
        src: c,
        packed,
        approx,
        errR: Math.abs(c.r - approx.r),
        errG: Math.abs(c.g - approx.g),
        errB: Math.abs(c.b - approx.b),
      };
    }
    const v = parse565(v565);
    if (v === null) return { error: 'Enter a valid 16-bit RGB565 value (0–65535, hex like 0x3D7E or decimal).' };
    const decoded = decode565(v);
    return { kind: 'decode' as const, packed: v, approx: decoded };
  }, [mode, rgbInput, v565]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">RGB888 → 565</TabsTrigger>
                <TabsTrigger value="decode">565 → RGB888</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' ? (
            <Field label="24-bit color" className="min-w-[200px]">
              <div className="flex items-center gap-2">
                <input type="color" value={parseColor(rgbInput) ? toHex(parseColor(rgbInput) as RGB) : '#3b82f6'} onChange={(e) => setRgbInput(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color" />
                <Input value={rgbInput} onChange={(e) => setRgbInput(e.target.value)} className="font-mono" />
              </div>
            </Field>
          ) : (
            <Field label="RGB565 value" className="min-w-[200px]">
              <Input value={v565} onChange={(e) => setV565(e.target.value)} className="font-mono" placeholder="0x3D7E or 15742" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="RGB565 packed value">
              <CopyButton value={`0x${result.packed.toString(16).toUpperCase().padStart(4, '0')}`} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {([
                ['Hex', `0x${result.packed.toString(16).toUpperCase().padStart(4, '0')}`],
                ['Decimal', result.packed.toString(10)],
                ['Binary', result.packed.toString(2).padStart(16, '0')],
              ] as const).map(([label, val]) => (
                <div key={label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-2xs text-muted-foreground">{label}</span>
                  <span className="flex items-center justify-between font-mono text-sm">{val}<CopyButton value={val} size="icon-sm" /></span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.kind === 'encode' && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Original (888)</span>
                <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(result.src) }} />
                <span className="font-mono text-sm">{toHex(result.src)} · rgb({result.src.r}, {result.src.g}, {result.src.b})</span>
              </div>
            )}
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Decoded approximation</span>
              <div className="h-16 w-full rounded border" style={{ backgroundColor: toHex(result.approx) }} />
              <span className="flex items-center justify-between font-mono text-sm">
                {toHex(result.approx)} · rgb({result.approx.r}, {result.approx.g}, {result.approx.b})
                <CopyButton value={toHex(result.approx)} size="icon-sm" />
              </span>
            </div>
          </div>

          <StatBar
            items={[
              `5-6-5 bits R${(result.packed >> 11) & 0x1f} G${(result.packed >> 5) & 0x3f} B${result.packed & 0x1f}`,
              result.kind === 'encode' ? `rounding err ΔR ${result.errR} ΔG ${result.errG} ΔB ${result.errB}` : false,
            ]}
          />
        </>
      )}
    </div>
  );
}
