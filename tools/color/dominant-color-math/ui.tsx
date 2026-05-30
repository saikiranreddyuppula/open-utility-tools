'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';

interface RGB { r: number; g: number; b: number }

const NAMED: Record<string, RGB> = {
  black: { r: 0, g: 0, b: 0 }, white: { r: 255, g: 255, b: 255 }, red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 }, blue: { r: 0, g: 0, b: 255 }, yellow: { r: 255, g: 255, b: 0 },
  cyan: { r: 0, g: 255, b: 255 }, magenta: { r: 255, g: 0, b: 255 }, orange: { r: 255, g: 165, b: 0 },
  purple: { r: 128, g: 0, b: 128 }, gray: { r: 128, g: 128, b: 128 }, grey: { r: 128, g: 128, b: 128 },
  pink: { r: 255, g: 192, b: 203 }, brown: { r: 165, g: 42, b: 42 }, navy: { r: 0, g: 0, b: 128 },
  teal: { r: 0, g: 128, b: 128 }, lime: { r: 0, g: 255, b: 0 }, maroon: { r: 128, g: 0, b: 0 },
};

function parseOne(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (NAMED[s]) return NAMED[s] ?? null;
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
    const r = Number(rgb[1]); const g = Number(rgb[2]); const b = Number(rgb[3]);
    if ([r, g, b].every((v) => Number.isFinite(v))) {
      return { r: Math.max(0, Math.min(255, Math.round(r))), g: Math.max(0, Math.min(255, Math.round(g))), b: Math.max(0, Math.min(255, Math.round(b))) };
    }
  }
  return null;
}

function parseList(text: string): RGB[] {
  return text
    .split(/[\n,;]+|\s{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseOne)
    .filter((c): c is RGB => c !== null);
}

function srgbToLin(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function linToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbStr({ r, g, b }: RGB): string { return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`; }

// sRGB -> Lab (D65)
function rgbToLab({ r, g, b }: RGB): [number, number, number] {
  const rl = srgbToLin(r); const gl = srgbToLin(g); const bl = srgbToLin(b);
  const x = (0.4123908 * rl + 0.3575843 * gl + 0.1804808 * bl) / 0.9504559;
  const y = 0.2126390 * rl + 0.7151687 * gl + 0.0721923 * bl;
  const z = (0.0193308 * rl + 0.1191948 * gl + 0.9505322 * bl) / 1.0890578;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x); const fy = f(y); const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

interface Cluster { centroid: RGB; share: number }

function kmeans(colors: RGB[], k: number): Cluster[] {
  const n = colors.length;
  const kk = Math.min(k, n);
  const labs = colors.map(rgbToLab);
  // Deterministic seeding: spread initial centroids across the list.
  const centers: [number, number, number][] = [];
  for (let i = 0; i < kk; i++) {
    const idx = Math.floor((i * n) / kk);
    const lab = labs[idx] ?? [0, 0, 0];
    centers.push([lab[0], lab[1], lab[2]]);
  }
  const assign = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const p = labs[i] ?? [0, 0, 0];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        const ctr = centers[c] ?? [0, 0, 0];
        const d = (p[0] - ctr[0]) ** 2 + (p[1] - ctr[1]) ** 2 + (p[2] - ctr[2]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    const sums: [number, number, number][] = Array.from({ length: kk }, () => [0, 0, 0]);
    const counts = new Array<number>(kk).fill(0);
    for (let i = 0; i < n; i++) {
      const a = assign[i] ?? 0;
      const p = labs[i] ?? [0, 0, 0];
      const s = sums[a] ?? [0, 0, 0];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2];
      counts[a] = (counts[a] ?? 0) + 1;
    }
    for (let c = 0; c < kk; c++) {
      const cnt = counts[c] ?? 0;
      if (cnt > 0) {
        const s = sums[c] ?? [0, 0, 0];
        centers[c] = [s[0] / cnt, s[1] / cnt, s[2] / cnt];
      }
    }
    if (!changed) break;
  }
  // Build clusters with centroid as the mean sRGB of members (clean swatch) and share.
  const memberSums: RGB[] = Array.from({ length: kk }, () => ({ r: 0, g: 0, b: 0 }));
  const counts = new Array<number>(kk).fill(0);
  for (let i = 0; i < n; i++) {
    const a = assign[i] ?? 0;
    const col = colors[i] ?? { r: 0, g: 0, b: 0 };
    const m = memberSums[a] ?? { r: 0, g: 0, b: 0 };
    m.r += col.r; m.g += col.g; m.b += col.b;
    counts[a] = (counts[a] ?? 0) + 1;
  }
  const clusters: Cluster[] = [];
  for (let c = 0; c < kk; c++) {
    const cnt = counts[c] ?? 0;
    if (cnt === 0) continue;
    const m = memberSums[c] ?? { r: 0, g: 0, b: 0 };
    clusters.push({ centroid: { r: m.r / cnt, g: m.g / cnt, b: m.b / cnt }, share: cnt / n });
  }
  clusters.sort((a, b) => b.share - a.share);
  return clusters;
}

function ResultRow({ label, rgb, extra }: { label: string; rgb: RGB; extra?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="size-10 shrink-0 rounded border" style={{ backgroundColor: rgbStr(rgb) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}{extra ? ` · ${extra}` : ''}</div>
        <div className="font-mono text-xs text-muted-foreground">{toHex(rgb)} · {rgbStr(rgb)}</div>
      </div>
      <CopyButton value={toHex(rgb)} size="icon-sm" />
    </div>
  );
}

export default function DominantColorMathTool() {
  const [text, setText] = useState('#e63946\n#f1faee\n#a8dadc\n#457b9d\n#1d3557\n#e63946\n#457b9d');
  const [k, setK] = useState(3);

  const result = useMemo(() => {
    const colors = parseList(text);
    if (colors.length === 0) return { error: 'Enter at least one valid color (HEX, RGB, or a basic name like "red"), one per line.' };

    const n = colors.length;
    const mean: RGB = {
      r: colors.reduce((a, c) => a + c.r, 0) / n,
      g: colors.reduce((a, c) => a + c.g, 0) / n,
      b: colors.reduce((a, c) => a + c.b, 0) / n,
    };
    const gamma: RGB = {
      r: linToSrgb(colors.reduce((a, c) => a + srgbToLin(c.r), 0) / n),
      g: linToSrgb(colors.reduce((a, c) => a + srgbToLin(c.g), 0) / n),
      b: linToSrgb(colors.reduce((a, c) => a + srgbToLin(c.b), 0) / n),
    };
    const clusters = kmeans(colors, k);
    return { count: n, mean, gamma, clusters };
  }, [text, k]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label={`k-means clusters: ${k}`} className="min-w-[220px]">
            <Slider value={[k]} min={1} max={5} step={1} onValueChange={(v) => setK(v[0] ?? 3)} />
          </Field>
        </OptionsBar>
        <div className="p-3">
          <Field label="Colors (one per line or comma-separated)">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-32 font-mono text-sm" />
          </Field>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Averages" />
            <div className="grid grid-cols-1 gap-3 p-3">
              <ResultRow label="Simple per-channel mean" rgb={result.mean} />
              <ResultRow label="Gamma-correct average (linearized)" rgb={result.gamma} />
            </div>
          </Panel>
          <Panel>
            <PanelHeader title={`Dominant colors (k-means, Lab space)`}>
              <CopyButton value={() => result.clusters.map((c) => `${toHex(c.centroid)} ${(c.share * 100).toFixed(1)}%`).join('\n')} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3">
              {result.clusters.map((c, i) => (
                <ResultRow key={i} label={`Cluster ${i + 1}`} rgb={c.centroid} extra={`${(c.share * 100).toFixed(1)}%`} />
              ))}
            </div>
            <StatBar items={[`${result.count} colors`, 'Operates on a color list, not an image']} />
          </Panel>
        </>
      )}
    </div>
  );
}
