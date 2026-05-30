'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface RGB {
  r: number;
  g: number;
  b: number;
}

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

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// CIE L* from relative luminance Y (0..1).
function lStar(y: number): number {
  return y <= 216 / 24389 ? y * (24389 / 27) : 116 * Math.cbrt(y) - 16;
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function toRgbString({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function Pass({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
        ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-destructive/30 bg-destructive/10 text-destructive'
      )}
    >
      <span>{label}</span>
      <span className="font-mono font-semibold">{ok ? 'PASS' : 'FAIL'}</span>
    </div>
  );
}

export default function LightnessContrastPairTool() {
  const [c1, setC1] = useState('#1a1a2e');
  const [c2, setC2] = useState('#f5f5f5');
  const [largeText, setLargeText] = useState(false);

  const result = useMemo(() => {
    const a = parseColor(c1);
    const b = parseColor(c2);
    if (!a) return { error: 'Color 1 is not a valid HEX or RGB color.' };
    if (!b) return { error: 'Color 2 is not a valid HEX or RGB color.' };

    const ya = relativeLuminance(a);
    const yb = relativeLuminance(b);
    const ratio = contrastRatio(a, b);

    // Suggest lightness shift: how far the darker color's L* must move to reach AA.
    const aaTarget = largeText ? 3 : 4.5;
    const lighter = Math.max(ya, yb);
    const darker = Math.min(ya, yb);
    let suggestion = 'Already meets AA';
    if (ratio < aaTarget) {
      // Try to darken the darker side enough; compute required darker luminance.
      const requiredDarkerY = (lighter + 0.05) / aaTarget - 0.05;
      if (requiredDarkerY >= 0) {
        const curL = lStar(darker);
        const tgtL = lStar(Math.max(0, requiredDarkerY));
        suggestion = `Lower the darker color's L* from ${curL.toFixed(1)} to ≤ ${tgtL.toFixed(1)} (Δ ${(curL - tgtL).toFixed(1)})`;
      } else {
        // Lightening the lighter side instead.
        const requiredLighterY = aaTarget * (darker + 0.05) - 0.05;
        const curL = lStar(lighter);
        const tgtL = lStar(Math.min(1, requiredLighterY));
        suggestion = `Raise the lighter color's L* from ${curL.toFixed(1)} to ≥ ${tgtL.toFixed(1)} (Δ ${(tgtL - curL).toFixed(1)})`;
      }
    }

    return {
      a,
      b,
      ratioStr: ratio.toFixed(2),
      ratio,
      suggestion,
      table: [
        { label: 'Relative luminance', v1: ya.toFixed(4), v2: yb.toFixed(4) },
        { label: 'Perceived L*', v1: lStar(ya).toFixed(2), v2: lStar(yb).toFixed(2) },
      ],
    };
  }, [c1, c2, largeText]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color 1" className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <input type="color" value={c1.startsWith('#') && c1.length === 7 ? c1 : '#1a1a2e'} onChange={(e) => setC1(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color 1" />
              <Input value={c1} onChange={(e) => setC1(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Color 2" className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <input type="color" value={c2.startsWith('#') && c2.length === 7 ? c2 : '#f5f5f5'} onChange={(e) => setC2(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border p-1" aria-label="Color 2" />
              <Input value={c2} onChange={(e) => setC2(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Large text mode">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={largeText} onCheckedChange={setLargeText} />
              <span className="text-sm text-muted-foreground">{largeText ? 'On (≥18.66px bold / 24px)' : 'Off'}</span>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Contrast ratio">
              <CopyButton value={() => `${result.ratioStr}:1`} />
            </PanelHeader>
            <div className="rounded-md border-b p-6 text-center" style={{ color: toRgbString(result.a), backgroundColor: toRgbString(result.b) }}>
              <p className="text-2xl font-semibold">Sample text on color 2</p>
              <p className="text-sm">The quick brown fox jumps over the lazy dog.</p>
            </div>
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="font-mono text-3xl font-semibold tabular">{result.ratioStr}</span>
              <span className="text-sm text-muted-foreground">: 1</span>
            </div>
            <div className="grid gap-2 p-3 pt-0 sm:grid-cols-2">
              <Pass ok={result.ratio >= 4.5} label="AA · normal (≥ 4.5)" />
              <Pass ok={result.ratio >= 3} label="AA · large (≥ 3)" />
              <Pass ok={result.ratio >= 7} label="AAA · normal (≥ 7)" />
              <Pass ok={result.ratio >= 4.5} label="AAA · large (≥ 4.5)" />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Per-color values" />
            <div className="divide-y">
              <div className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="min-w-0 flex-1">Metric</span>
                <span className="w-28 text-right">Color 1</span>
                <span className="w-28 text-right">Color 2</span>
              </div>
              {result.table.map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-muted-foreground">{row.label}</span>
                  <span className="w-28 text-right font-mono">{row.v1}</span>
                  <span className="w-28 text-right font-mono">{row.v2}</span>
                </div>
              ))}
            </div>
            <StatBar items={[`Suggestion: ${result.suggestion}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
