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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

type Target = '3' | '4.5' | '7';
type AdjustWhich = 'fg' | 'bg';

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
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

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
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
  const m = ln - c / 2;
  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Walk lightness in one direction (sign) until target contrast is met against `other`. */
function findPassing(
  start: HSL,
  other: RGB,
  target: number,
  dir: 1 | -1
): { rgb: RGB; ratio: number } | null {
  for (let l = start.l + dir; l >= 0 && l <= 100; l += dir) {
    const candidate = hslToRgb({ h: start.h, s: start.s, l });
    const ratio = contrast(candidate, other);
    if (ratio >= target) return { rgb: candidate, ratio };
  }
  // Try the extreme endpoint.
  const endL = dir === 1 ? 100 : 0;
  const candidate = hslToRgb({ h: start.h, s: start.s, l: endL });
  const ratio = contrast(candidate, other);
  if (ratio >= target) return { rgb: candidate, ratio };
  return null;
}

export default function WcagPairFinder() {
  const [fg, setFg] = useState('#7a7a7a');
  const [bg, setBg] = useState('#ffffff');
  const [target, setTarget] = useState<Target>('4.5');
  const [adjust, setAdjust] = useState<AdjustWhich>('fg');

  const result = useMemo(() => {
    const fgRgb = parseColor(fg);
    const bgRgb = parseColor(bg);
    if (!fgRgb) return { error: 'Enter a valid foreground color.' };
    if (!bgRgb) return { error: 'Enter a valid background color.' };

    const targetNum = Number(target);
    const current = contrast(fgRgb, bgRgb);

    // Which color we move; the other stays fixed.
    const moving = adjust === 'fg' ? fgRgb : bgRgb;
    const fixed = adjust === 'fg' ? bgRgb : fgRgb;
    const movingHsl = rgbToHsl(moving);

    const lighter = findPassing(movingHsl, fixed, targetNum, 1);
    const darker = findPassing(movingHsl, fixed, targetNum, -1);

    return {
      fgRgb,
      bgRgb,
      current,
      targetNum,
      passes: current >= targetNum,
      lighter,
      darker,
      moving,
      fixed,
    };
  }, [fg, bg, target, adjust]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Foreground">
            <Input value={fg} onChange={(e) => setFg(e.target.value)} className="w-36 font-mono" />
          </Field>
          <Field label="Background">
            <Input value={bg} onChange={(e) => setBg(e.target.value)} className="w-36 font-mono" />
          </Field>
          <Field label="Target ratio">
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3.0 (AA Large)</SelectItem>
                <SelectItem value="4.5">4.5 (AA)</SelectItem>
                <SelectItem value="7">7.0 (AAA)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Adjust">
            <Tabs value={adjust} onValueChange={(v) => setAdjust(v as AdjustWhich)}>
              <TabsList>
                <TabsTrigger value="fg">Foreground</TabsTrigger>
                <TabsTrigger value="bg">Background</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() => {
                const lines = [
                  `Current contrast: ${result.current.toFixed(2)}:1 (${result.passes ? 'PASS' : 'FAIL'} at ${result.targetNum}:1)`,
                ];
                if (result.lighter)
                  lines.push(`Lighter ${adjust}: ${toHex(result.lighter.rgb)} -> ${result.lighter.ratio.toFixed(2)}:1`);
                if (result.darker)
                  lines.push(`Darker ${adjust}: ${toHex(result.darker.rgb)} -> ${result.darker.ratio.toFixed(2)}:1`);
                return lines.join('\n');
              }}
            />
          </PanelHeader>

          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-3">
              <div
                className="flex h-16 flex-1 items-center justify-center rounded-md border text-base font-medium"
                style={{ backgroundColor: toHex(result.bgRgb), color: toHex(result.fgRgb) }}
              >
                Sample text
              </div>
              <div className="ml-4 text-right">
                <div className="font-mono text-lg">{result.current.toFixed(2)}:1</div>
                <div
                  className={
                    result.passes
                      ? 'text-2xs font-semibold uppercase text-success'
                      : 'text-2xs font-semibold uppercase text-destructive'
                  }
                >
                  {result.passes ? 'Passes' : 'Fails'} target {result.targetNum}:1
                </div>
              </div>
            </div>

            {!result.passes && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  { key: 'lighter', label: `Nearest passing (lighter ${adjust})`, data: result.lighter },
                  { key: 'darker', label: `Nearest passing (darker ${adjust})`, data: result.darker },
                ] as const).map((dir) => {
                  if (!dir.data) {
                    return (
                      <div
                        key={dir.key}
                        className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {dir.label}: no solution in this direction.
                      </div>
                    );
                  }
                  const newFg = adjust === 'fg' ? dir.data.rgb : result.fgRgb;
                  const newBg = adjust === 'bg' ? dir.data.rgb : result.bgRgb;
                  const hex = toHex(dir.data.rgb);
                  return (
                    <div key={dir.key} className="rounded-md border bg-muted/30 p-3">
                      <div className="mb-2 text-2xs uppercase tracking-wide text-muted-foreground">
                        {dir.label}
                      </div>
                      <div
                        className="mb-2 flex h-14 items-center justify-center rounded border text-sm"
                        style={{ backgroundColor: toHex(newBg), color: toHex(newFg) }}
                      >
                        Sample text
                      </div>
                      <div className="flex items-center justify-between">
                        <code className="font-mono text-sm">{hex}</code>
                        <span className="flex items-center gap-2 font-mono text-sm">
                          <span>{dir.data.ratio.toFixed(2)}:1</span>
                          <CopyButton value={hex} size="icon-sm" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {result.passes && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                This pair already meets the {result.targetNum}:1 target. No adjustment needed.
              </div>
            )}
          </div>
          <StatBar
            items={[
              `fg ${toHex(result.fgRgb)}`,
              `bg ${toHex(result.bgRgb)}`,
              `now ${result.current.toFixed(2)}:1`,
              `target ${result.targetNum}:1`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
