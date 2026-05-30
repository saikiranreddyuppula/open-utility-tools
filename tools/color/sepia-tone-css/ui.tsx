'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface RGB {
  r: number;
  g: number;
  b: number;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  const hex = s.startsWith('#') ? s.slice(1) : /^[0-9a-f]{3,8}$/.test(s) ? s : '';
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  // rgb(...) / rgba(...)
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

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function sepiaFull({ r, g, b }: RGB): RGB {
  return {
    r: clamp255(0.393 * r + 0.769 * g + 0.189 * b),
    g: clamp255(0.349 * r + 0.686 * g + 0.168 * b),
    b: clamp255(0.272 * r + 0.534 * g + 0.131 * b),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function SepiaToneCalc() {
  const [color, setColor] = useState('#4a90d9');
  const [amount, setAmount] = useState(100);

  const result = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) {
      return { error: 'Enter a valid color (e.g. #4a90d9 or rgb(74,144,217)).' };
    }
    const full = sepiaFull(rgb);
    const t = amount / 100;
    const out: RGB = {
      r: clamp255(lerp(rgb.r, full.r, t)),
      g: clamp255(lerp(rgb.g, full.g, t)),
      b: clamp255(lerp(rgb.b, full.b, t)),
    };
    return {
      original: rgb,
      out,
      filter: `sepia(${(amount / 100).toFixed(2)})`,
    };
  }, [color, amount]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="Color">
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-44 font-mono"
              />
            </Field>
            <Field label={`Amount: ${amount}%`} className="min-w-[220px] flex-1">
              <Slider
                value={[amount]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setAmount(v[0] ?? 100)}
              />
            </Field>
          </OptionsBar>
        </Panel>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const origHex = toHex(result.original);
  const outHex = toHex(result.out);
  const outRgb = `rgb(${result.out.r}, ${result.out.g}, ${result.out.b})`;
  const copyAll = [
    `Original: ${origHex}`,
    `Sepia: ${outHex} / ${outRgb}`,
    `CSS filter: ${result.filter}`,
  ].join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color">
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-44 font-mono"
            />
          </Field>
          <Field label={`Amount: ${amount}%`} className="min-w-[220px] flex-1">
            <Slider
              value={[amount]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setAmount(v[0] ?? 100)}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Result">
          <CopyButton value={() => copyAll} />
        </PanelHeader>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-24 w-full rounded-md border"
              style={{ backgroundColor: origHex }}
            />
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              Original
            </span>
            <code className="font-mono text-sm">{origHex}</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-24 w-full rounded-md border"
              style={{ backgroundColor: outHex }}
            />
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              Sepia {amount}%
            </span>
            <code className="font-mono text-sm">{outHex}</code>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-2">
          {[
            { label: 'HEX', value: outHex },
            { label: 'RGB', value: outRgb },
            { label: 'CSS filter', value: `filter: ${result.filter};` },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span className="truncate">{row.value}</span>
                <CopyButton value={row.value} size="icon-sm" />
              </span>
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `in ${origHex}`,
            `out ${outHex}`,
            `amount ${amount}%`,
          ]}
        />
      </Panel>
    </div>
  );
}
