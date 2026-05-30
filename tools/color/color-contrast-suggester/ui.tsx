'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type TargetKey = 'aa' | 'aaLarge' | 'aaa';

const TARGETS: Record<TargetKey, { label: string; ratio: number }> = {
  aaLarge: { label: 'AA Large (3.0)', ratio: 3.0 },
  aa: { label: 'AA Normal (4.5)', ratio: 4.5 },
  aaa: { label: 'AAA Normal (7.0)', ratio: 7.0 },
};

function parseHex(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith('#')) s = s.slice(1);
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return { r, g, b };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = h / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Search lightness for an HSL color (keeping hue+sat) to meet target.
function findPassingFg(fg: RGB, bg: RGB, target: number): { rgb: RGB; ratio: number } | null {
  if (contrast(fg, bg) >= target) return { rgb: fg, ratio: contrast(fg, bg) };
  const baseHsl = rgbToHsl(fg);
  const bgLum = relLuminance(bg);
  // Decide direction: if background is dark, lighten fg; if light, darken.
  const directions: number[] = bgLum < 0.5 ? [1, -1] : [-1, 1];
  let best: { rgb: RGB; ratio: number; delta: number } | null = null;
  for (const dir of directions) {
    for (let step = 1; step <= 100; step++) {
      const l = Math.max(0, Math.min(100, baseHsl.l + dir * step));
      const candidate = hslToRgb({ h: baseHsl.h, s: baseHsl.s, l });
      const ratio = contrast(candidate, bg);
      if (ratio >= target) {
        const delta = Math.abs(l - baseHsl.l);
        if (!best || delta < best.delta) best = { rgb: candidate, ratio, delta };
        break;
      }
      if (l === 0 || l === 100) break;
    }
  }
  return best ? { rgb: best.rgb, ratio: best.ratio } : null;
}

export default function ContrastSuggesterTool() {
  const [fg, setFg] = useState('#777777');
  const [bg, setBg] = useState('#ffffff');
  const [target, setTarget] = useState<TargetKey>('aa');

  const result = useMemo(() => {
    const fgc = parseHex(fg);
    const bgc = parseHex(bg);
    if (!fgc) return { error: 'Foreground is not a valid color (try #rrggbb or rgb()).' };
    if (!bgc) return { error: 'Background is not a valid color (try #rrggbb or rgb()).' };
    const tgt = TARGETS[target].ratio;
    const current = contrast(fgc, bgc);
    const meets = current >= tgt;
    const suggestion = meets ? null : findPassingFg(fgc, bgc, tgt);
    return { fgc, bgc, tgt, current, meets, suggestion };
  }, [fg, bg, target]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Foreground" className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseHex(fg) ? toHex(parseHex(fg) as RGB) : '#777777'}
                onChange={(e) => setFg(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Foreground color"
              />
              <Input value={fg} onChange={(e) => setFg(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Background" className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseHex(bg) ? toHex(parseHex(bg) as RGB) : '#ffffff'}
                onChange={(e) => setBg(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Background color"
              />
              <Input value={bg} onChange={(e) => setBg(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Target" className="min-w-[160px]">
            <Select value={target} onValueChange={(v) => setTarget(v as TargetKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aaLarge">{TARGETS.aaLarge.label}</SelectItem>
                <SelectItem value="aa">{TARGETS.aa.label}</SelectItem>
                <SelectItem value="aaa">{TARGETS.aaa.label}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Current">
              <span className={result.meets ? 'text-success font-mono text-xs font-semibold' : 'text-destructive font-mono text-xs font-semibold'}>
                {result.meets ? 'PASSES' : 'FAILS'}
              </span>
            </PanelHeader>
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div
                className="flex h-24 flex-1 items-center justify-center rounded-md border text-lg font-semibold"
                style={{ color: toHex(result.fgc), backgroundColor: toHex(result.bgc) }}
              >
                Sample text Ag
              </div>
              <div className="flex flex-col justify-center gap-1 sm:w-40">
                <span className="font-mono text-2xl font-semibold tabular">{result.current.toFixed(2)}:1</span>
                <span className="text-xs text-muted-foreground">target {result.tgt.toFixed(1)}:1</span>
              </div>
            </div>
          </Panel>

          {!result.meets && (
            <Panel>
              <PanelHeader title="Suggested foreground">
                {result.suggestion && <CopyButton value={toHex(result.suggestion.rgb)} />}
              </PanelHeader>
              {result.suggestion ? (
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div
                    className="flex h-24 flex-1 items-center justify-center rounded-md border text-lg font-semibold"
                    style={{ color: toHex(result.suggestion.rgb), backgroundColor: toHex(result.bgc) }}
                  >
                    Sample text Ag
                  </div>
                  <div className="flex flex-col justify-center gap-1 sm:w-48">
                    <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                      {toHex(result.suggestion.rgb)}
                      <CopyButton value={toHex(result.suggestion.rgb)} size="icon-sm" />
                    </span>
                    <span className="text-xs text-success">new ratio {result.suggestion.ratio.toFixed(2)}:1</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      rgb({result.suggestion.rgb.r}, {result.suggestion.rgb.g}, {result.suggestion.rgb.b})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">
                  No lightness adjustment with this hue can reach the target against this background.
                  Try changing the background or hue.
                </div>
              )}
            </Panel>
          )}

          <StatBar
            items={[
              `current ${result.current.toFixed(2)}:1`,
              `target ${result.tgt.toFixed(1)}:1`,
              result.suggestion ? `fixed ${result.suggestion.ratio.toFixed(2)}:1` : false,
            ]}
          />
        </>
      )}
    </div>
  );
}
