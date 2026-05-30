'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Breakpoint {
  // media: a max-width in px, or null for the default (no media condition)
  maxWidth: number | null;
  // layout width as a CSS length: a vw percentage or a fixed px
  layout: string;
  layoutPx: (viewportPx: number) => number;
  raw: string;
}

// Parse a layout line like "600: 100vw" or "default: 50vw" or ">=600: 720px"
function parseLine(line: string): Breakpoint | null {
  const m = line.split(':');
  if (m.length < 2) return null;
  const keyRaw = (m[0] ?? '').trim().toLowerCase();
  const valRaw = m.slice(1).join(':').trim();
  let maxWidth: number | null;
  if (keyRaw === 'default' || keyRaw === '*' || keyRaw === '') {
    maxWidth = null;
  } else {
    const num = Number(keyRaw.replace(/px$/, ''));
    if (!Number.isFinite(num) || num <= 0) return null;
    maxWidth = num;
  }
  // layout value: Nvw or Npx
  const vw = valRaw.match(/^(\d+(?:\.\d+)?)\s*vw$/i);
  const px = valRaw.match(/^(\d+(?:\.\d+)?)\s*px$/i);
  if (vw) {
    const pct = Number(vw[1]);
    return { maxWidth, layout: `${pct}vw`, layoutPx: (vp) => (pct / 100) * vp, raw: line };
  }
  if (px) {
    const fixed = Number(px[1]);
    return { maxWidth, layout: `${fixed}px`, layoutPx: () => fixed, raw: line };
  }
  return null;
}

export default function SrcsetWidthPlannerTool() {
  const [intrinsic, setIntrinsic] = useState('1600');
  const [layouts, setLayouts] = useState('600: 100vw\ndefault: 50vw');
  const [filename, setFilename] = useState('img');
  const [dpr1, setDpr1] = useState(true);
  const [dpr2, setDpr2] = useState(true);
  const [dpr3, setDpr3] = useState(false);

  const result = useMemo((): { error: string } | {
    widths: number[];
    srcset: string;
    sizes: string;
    detail: { vp: number; layout: string; cssPx: number; needed: number[] }[];
  } => {
    const intr = Number(intrinsic);
    if (!Number.isFinite(intr) || intr <= 0) return { error: 'Enter a positive intrinsic image width in px.' };

    const lines = layouts.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return { error: 'Add at least one layout line (e.g. "600: 100vw").' };

    const bps: Breakpoint[] = [];
    for (const l of lines) {
      const bp = parseLine(l);
      if (!bp) return { error: `Could not parse "${l}". Use "<maxpx>: <N>vw" or "default: <N>vw" (px allowed).` };
      bps.push(bp);
    }

    const dprs: number[] = [];
    if (dpr1) dprs.push(1);
    if (dpr2) dprs.push(2);
    if (dpr3) dprs.push(3);
    if (dprs.length === 0) return { error: 'Select at least one target DPR.' };

    // For each breakpoint, the representative viewport is its max-width (or a large value for default).
    const widthSet = new Set<number>();
    const detail: { vp: number; layout: string; cssPx: number; needed: number[] }[] = [];

    for (const bp of bps) {
      const vp = bp.maxWidth ?? 1920;
      const cssPx = bp.layoutPx(vp);
      const needed: number[] = [];
      for (const d of dprs) {
        // physical pixels needed, capped at the intrinsic source width
        const w = Math.min(intr, Math.ceil(cssPx * d));
        widthSet.add(w);
        needed.push(w);
      }
      detail.push({ vp, layout: bp.layout, cssPx: Math.round(cssPx), needed });
    }
    // always offer the full intrinsic too
    widthSet.add(intr);

    const widths = Array.from(widthSet).filter((w) => w > 0).sort((a, b) => a - b);
    const srcset = widths.map((w) => `${filename || 'img'}-${w}.jpg ${w}w`).join(',\n');

    // build sizes: sorted breakpoints ascending by maxWidth, default last
    const withMedia = bps.filter((b) => b.maxWidth !== null).sort((a, b) => (a.maxWidth ?? 0) - (b.maxWidth ?? 0));
    const defaults = bps.filter((b) => b.maxWidth === null);
    const sizesParts: string[] = [];
    for (const b of withMedia) {
      sizesParts.push(`(max-width: ${b.maxWidth}px) ${b.layout}`);
    }
    const last = defaults[defaults.length - 1] ?? withMedia[withMedia.length - 1];
    if (last) sizesParts.push(last.layout);
    const sizes = sizesParts.join(', ');

    return { widths, srcset, sizes, detail };
  }, [intrinsic, layouts, filename, dpr1, dpr2, dpr3]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Intrinsic source width (px)" className="min-w-[180px]">
            <Input value={intrinsic} onChange={(e) => setIntrinsic(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Filename stem" className="min-w-[140px]" hint="produces stem-{w}.jpg">
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Target DPRs">
            <div className="flex h-9 items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Checkbox id="dpr1" checked={dpr1} onCheckedChange={(c) => setDpr1(c === true)} />
                <Label htmlFor="dpr1" className="cursor-pointer">1x</Label>
              </span>
              <span className="flex items-center gap-1.5">
                <Checkbox id="dpr2" checked={dpr2} onCheckedChange={(c) => setDpr2(c === true)} />
                <Label htmlFor="dpr2" className="cursor-pointer">2x</Label>
              </span>
              <span className="flex items-center gap-1.5">
                <Checkbox id="dpr3" checked={dpr3} onCheckedChange={(c) => setDpr3(c === true)} />
                <Label htmlFor="dpr3" className="cursor-pointer">3x</Label>
              </span>
            </div>
          </Field>
        </OptionsBar>
        <div className="p-3 pt-0">
          <Field label="Layout per breakpoint (one per line)" hint='Format: "<maxpx>: <N>vw" then "default: <N>vw"'>
            <Textarea value={layouts} onChange={(e) => setLayouts(e.target.value)} spellCheck={false} className="min-h-[90px] font-mono text-xs" />
          </Field>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="srcset">
              <CopyButton value={() => result.srcset} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{result.srcset}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="sizes">
              <CopyButton value={() => result.sizes} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{result.sizes}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="Per-breakpoint plan" />
            <div className="divide-y">
              {result.detail.map((d, i) => (
                <div key={`${d.vp}-${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-32 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">≤{d.vp}px viewport</span>
                  <code className="font-mono">{d.layout}</code>
                  <span className="text-muted-foreground">= {d.cssPx} CSS px →</span>
                  <span className="font-mono">{d.needed.join(', ')} px</span>
                </div>
              ))}
            </div>
            <StatBar items={[`${result.widths.length} unique widths`, `widths: ${result.widths.join(', ')}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
