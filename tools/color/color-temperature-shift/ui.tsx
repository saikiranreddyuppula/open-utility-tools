'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RGB {
  r: number;
  g: number;
  b: number;
}

type ShiftMode = 'amount' | 'kelvin';

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

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Rec. 601 luma weights, used to renormalize after channel gains.
function luma({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export default function ColorTemperatureShiftTool() {
  const [color, setColor] = useState('#7ea6c4');
  const [amount, setAmount] = useState(40);
  const [mode, setMode] = useState<ShiftMode>('amount');
  const [kelvinDelta, setKelvinDelta] = useState('-1500');

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return { error: 'Enter a valid HEX (#7ea6c4) or RGB color.' };

    // Resolve the effective shift amount (-100..100). Positive = warmer.
    let amt = amount;
    if (mode === 'kelvin') {
      const dk = Number(kelvinDelta);
      if (!Number.isFinite(dk)) return { error: 'Enter a valid Kelvin delta (e.g. -1500 to cool, +1500 to warm).' };
      // Lowering color temperature makes a source warmer. Map ~ +/-3000K to +/-100.
      amt = Math.max(-100, Math.min(100, (-dk / 3000) * 100));
    }

    const k = amt / 100; // -1..1
    const maxGain = 0.3; // up to +/-30% per channel
    const rGain = 1 + maxGain * k;
    const bGain = 1 - maxGain * k;
    const gGain = 1; // green held steady

    const lin: RGB = { r: rgb.r * rGain, g: rgb.g * gGain, b: rgb.b * bGain };

    // Renormalize to preserve original luma.
    const origL = luma(rgb);
    const newL = luma(lin);
    const scale = newL > 0 ? origL / newL : 1;
    const out: RGB = {
      r: Math.max(0, Math.min(255, lin.r * scale)),
      g: Math.max(0, Math.min(255, lin.g * scale)),
      b: Math.max(0, Math.min(255, lin.b * scale)),
    };

    return {
      beforeSwatch: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      afterSwatch: toHex(out),
      amt,
      rows: [
        { label: 'Adjusted HEX', value: toHex(out) },
        { label: 'Adjusted RGB', value: `rgb(${Math.round(out.r)}, ${Math.round(out.g)}, ${Math.round(out.b)})` },
        { label: 'R multiplier', value: (rGain * scale).toFixed(4) },
        { label: 'G multiplier', value: (gGain * scale).toFixed(4) },
        { label: 'B multiplier', value: (bGain * scale).toFixed(4) },
      ],
    };
  }, [color, amount, mode, kelvinDelta]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color (HEX or RGB)" className="min-w-[220px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color.startsWith('#') && color.length === 7 ? color : '#7ea6c4'}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color picker"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" placeholder="#7ea6c4" />
            </div>
          </Field>
          <Field label="Shift mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as ShiftMode)}>
              <TabsList>
                <TabsTrigger value="amount">Amount</TabsTrigger>
                <TabsTrigger value="kelvin">Kelvin Δ</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'amount' ? (
            <Field label={`Temperature: ${amount > 0 ? '+' : ''}${amount} (${amount >= 0 ? 'warm' : 'cool'})`} className="min-w-[220px] flex-1">
              <Slider value={[amount]} min={-100} max={100} step={1} onValueChange={(v) => setAmount(v[0] ?? 0)} />
            </Field>
          ) : (
            <Field label="Kelvin delta (negative = warmer)" className="min-w-[160px]">
              <Input value={kelvinDelta} onChange={(e) => setKelvinDelta(e.target.value)} inputMode="numeric" className="font-mono" placeholder="-1500" />
            </Field>
          )}
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
          <StatBar items={[`Effective shift = ${result.amt.toFixed(0)}`, 'Luminance preserved (Rec. 601)']} />
        </Panel>
      )}
    </div>
  );
}
