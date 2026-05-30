'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RGB {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  teal: '#008080',
  navy: '#000080',
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

function luminance(c: RGB): number {
  const lin = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function toRgbString(c: RGB): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function Check({ pass, label }: { pass: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-mono',
        pass
          ? 'border-green-500/40 text-green-600 dark:text-green-400'
          : 'border-destructive/40 text-destructive'
      )}
    >
      {label} {pass ? 'PASS' : 'FAIL'}
    </Badge>
  );
}

export default function AccessibleTextColorTool() {
  const [bg, setBg] = useState('#3498db');

  const result = useMemo(() => {
    const c = parseColor(bg);
    if (!c) return { error: 'Enter a valid color (HEX, rgb(), or a basic name).' };
    const lbg = luminance(c);
    const lBlack = 0;
    const lWhite = 1;
    const cBlack = contrast(lbg, lBlack);
    const cWhite = contrast(lbg, lWhite);
    const recommend = cBlack >= cWhite ? 'black' : 'white';
    const best = Math.max(cBlack, cWhite);
    return {
      rgb: c,
      bgStr: toRgbString(c),
      lum: lbg,
      cBlack,
      cWhite,
      recommend,
      best,
    };
  }, [bg]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={parseColor(bg) ? (bg.startsWith('#') ? bg : '#3498db') : '#3498db'}
              onChange={(e) => setBg(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border p-1"
              aria-label="Background color"
            />
            <Field label="Background color">
              <Input
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="w-40 font-mono"
                placeholder="#3498db"
              />
            </Field>
          </div>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div
            className="rounded-lg border p-8 text-center"
            style={{ backgroundColor: result.bgStr, color: result.recommend }}
          >
            <p className="text-2xl font-semibold">
              Recommended text color: {result.recommend}
            </p>
            <p className="mt-1 text-sm">The quick brown fox jumps over the lazy dog.</p>
          </div>

          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.recommend} />
            </PanelHeader>
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div
                className={cn(
                  'rounded-md border p-4',
                  result.recommend === 'black' && 'ring-2 ring-ring'
                )}
                style={{ backgroundColor: result.bgStr, color: '#000' }}
              >
                <div className="text-lg font-medium">Black text</div>
                <div className="font-mono text-sm">{result.cBlack.toFixed(2)} : 1</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Check pass={result.cBlack >= 4.5} label="AA" />
                  <Check pass={result.cBlack >= 3} label="AA-Lg" />
                  <Check pass={result.cBlack >= 7} label="AAA" />
                </div>
              </div>
              <div
                className={cn(
                  'rounded-md border p-4',
                  result.recommend === 'white' && 'ring-2 ring-ring'
                )}
                style={{ backgroundColor: result.bgStr, color: '#fff' }}
              >
                <div className="text-lg font-medium">White text</div>
                <div className="font-mono text-sm">{result.cWhite.toFixed(2)} : 1</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Check pass={result.cWhite >= 4.5} label="AA" />
                  <Check pass={result.cWhite >= 3} label="AA-Lg" />
                  <Check pass={result.cWhite >= 7} label="AAA" />
                </div>
              </div>
            </div>
            <StatBar
              items={[
                `Relative luminance = ${result.lum.toFixed(4)}`,
                `Best ratio = ${result.best.toFixed(2)}:1 (${result.recommend})`,
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
