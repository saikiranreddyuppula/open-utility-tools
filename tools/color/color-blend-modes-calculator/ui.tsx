'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RGB {
  r: number;
  g: number;
  b: number;
}

type BlendMode =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

const MODES: { value: BlendMode; label: string }[] = [
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const named = NAMED[s];
  if (named) return parseColor(named);
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
  return null;
}

function toHex(c: RGB): string {
  const hx = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
}

/** Blend a single normalized channel (b = base, s = blend, both 0..1). */
function blendChannel(mode: BlendMode, b: number, s: number): number {
  switch (mode) {
    case 'multiply':
      return b * s;
    case 'screen':
      return b + s - b * s;
    case 'overlay':
      return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'darken':
      return Math.min(b, s);
    case 'lighten':
      return Math.max(b, s);
    case 'color-dodge':
      return s >= 1 ? 1 : Math.min(1, b / (1 - s));
    case 'color-burn':
      return s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
    case 'hard-light':
      return s < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'soft-light': {
      // W3C soft-light formula
      if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
      const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
      return b + (2 * s - 1) * (d - b);
    }
    case 'difference':
      return Math.abs(b - s);
    case 'exclusion':
      return b + s - 2 * b * s;
    default:
      return b;
  }
}

function blend(mode: BlendMode, base: RGB, top: RGB): RGB {
  const ch = (bv: number, sv: number): number =>
    Math.round(clamp(blendChannel(mode, bv / 255, sv / 255), 0, 1) * 255);
  return { r: ch(base.r, top.r), g: ch(base.g, top.g), b: ch(base.b, top.b) };
}

export default function BlendModeTool() {
  const [base, setBase] = useState('#3498db');
  const [top, setTop] = useState('#e67e22');
  const [mode, setMode] = useState<BlendMode>('multiply');

  const result = useMemo(() => {
    const bc = parseColor(base);
    const tc = parseColor(top);
    if (!bc) return { error: 'Invalid base color.' };
    if (!tc) return { error: 'Invalid blend color.' };
    const out = blend(mode, bc, tc);
    return {
      baseHex: toHex(bc),
      topHex: toHex(tc),
      outHex: toHex(out),
      outRgb: `rgb(${out.r}, ${out.g}, ${out.b})`,
    };
  }, [base, top, mode]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={base.startsWith('#') && base.length === 7 ? base : '#3498db'}
              onChange={(e) => setBase(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border p-1"
              aria-label="Base"
            />
            <Field label="Base color">
              <Input value={base} onChange={(e) => setBase(e.target.value)} className="w-32 font-mono" />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={top.startsWith('#') && top.length === 7 ? top : '#e67e22'}
              onChange={(e) => setTop(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border p-1"
              aria-label="Blend"
            />
            <Field label="Blend color">
              <Input value={top} onChange={(e) => setTop(e.target.value)} className="w-32 font-mono" />
            </Field>
          </div>
          <Field label="Blend mode">
            <Select value={mode} onValueChange={(v) => setMode(v as BlendMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Blended result">
            <CopyButton value={() => `${result.outHex} / ${result.outRgb}`} />
          </PanelHeader>
          <div className="grid gap-3 p-3 sm:grid-cols-3">
            <div className="overflow-hidden rounded-md border">
              <div className="h-20" style={{ backgroundColor: result.baseHex }} />
              <div className="text-2xs px-2 py-1 font-mono text-muted-foreground">base {result.baseHex}</div>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="h-20" style={{ backgroundColor: result.topHex }} />
              <div className="text-2xs px-2 py-1 font-mono text-muted-foreground">blend {result.topHex}</div>
            </div>
            <div className="overflow-hidden rounded-md border ring-2 ring-ring">
              <div className="h-20" style={{ backgroundColor: result.outHex }} />
              <div className="text-2xs px-2 py-1 font-mono text-muted-foreground">result {result.outHex}</div>
            </div>
          </div>
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">HEX</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                {result.outHex}
                <CopyButton value={result.outHex} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">RGB</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                {result.outRgb}
                <CopyButton value={result.outRgb} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar items={[`${mode} of ${result.baseHex} × ${result.topHex} = ${result.outHex}`]} />
        </Panel>
      )}
    </div>
  );
}
