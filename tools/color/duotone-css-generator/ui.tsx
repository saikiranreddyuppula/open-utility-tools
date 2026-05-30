'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type RGB = { r: number; g: number; b: number };

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) {
    const r = hex[0] ?? '0';
    const g = hex[1] ?? '0';
    const b = hex[2] ?? '0';
    const num = parseInt(r + r + g + g + b + b, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map((p) => parseFloat(p));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    if (
      r !== undefined &&
      g !== undefined &&
      b !== undefined &&
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b)
    ) {
      const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
      return { r: clamp(r), g: clamp(g), b: clamp(b) };
    }
  }
  return null;
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ColorRow({
  label,
  value,
  onChange,
  parsed,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  parsed: RGB | null;
}) {
  return (
    <Field label={label} className="min-w-[200px]">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={parsed ? rgbToHex(parsed) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
          aria-label={`${label} picker`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

export default function DuotoneCssGeneratorTool() {
  const [shadow, setShadow] = useState('#1e1b4b');
  const [highlight, setHighlight] = useState('#f0abfc');
  const [useMid, setUseMid] = useState(false);
  const [mid, setMid] = useState('#7c3aed');
  const filterId = 'duotone';

  const shadowRgb = useMemo(() => parseColor(shadow), [shadow]);
  const highlightRgb = useMemo(() => parseColor(highlight), [highlight]);
  const midRgb = useMemo(() => parseColor(mid), [mid]);

  const error =
    (shadow.trim() && !shadowRgb) ||
    (highlight.trim() && !highlightRgb) ||
    (useMid && mid.trim() && !midRgb)
      ? 'Enter valid HEX or rgb() colors.'
      : null;

  // Sample a duotone/tritone color at luminance fraction t (0..1).
  const sampleAt = useMemo(() => {
    return (t: number): RGB | null => {
      if (!shadowRgb || !highlightRgb) return null;
      if (useMid && midRgb) {
        if (t < 0.5) {
          const k = t / 0.5;
          return {
            r: lerp(shadowRgb.r, midRgb.r, k),
            g: lerp(shadowRgb.g, midRgb.g, k),
            b: lerp(shadowRgb.b, midRgb.b, k),
          };
        }
        const k = (t - 0.5) / 0.5;
        return {
          r: lerp(midRgb.r, highlightRgb.r, k),
          g: lerp(midRgb.g, highlightRgb.g, k),
          b: lerp(midRgb.b, highlightRgb.b, k),
        };
      }
      return {
        r: lerp(shadowRgb.r, highlightRgb.r, t),
        g: lerp(shadowRgb.g, highlightRgb.g, t),
        b: lerp(shadowRgb.b, highlightRgb.b, t),
      };
    };
  }, [shadowRgb, highlightRgb, midRgb, useMid]);

  const rampStops = useMemo(() => {
    const out: { hex: string; t: number }[] = [];
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = sampleAt(t);
      if (!c) return [];
      out.push({ hex: rgbToHex(c), t });
    }
    return out;
  }, [sampleAt]);

  const previewGradient = useMemo(() => {
    if (rampStops.length === 0) return undefined;
    return `linear-gradient(90deg, ${rampStops
      .map((s) => `${s.hex} ${Math.round(s.t * 100)}%`)
      .join(', ')})`;
  }, [rampStops]);

  // tableValues for feComponentTransfer: endpoints (and optional midpoint) per channel, normalized 0..1.
  const tableValues = useMemo(() => {
    if (!shadowRgb || !highlightRgb) return null;
    const fmt = (v: number) => (v / 255).toFixed(4);
    const mk = (lo: number, m: number | null, hi: number) =>
      m === null ? `${fmt(lo)} ${fmt(hi)}` : `${fmt(lo)} ${fmt(m)} ${fmt(hi)}`;
    const useM = useMid && midRgb ? midRgb : null;
    return {
      r: mk(shadowRgb.r, useM ? useM.r : null, highlightRgb.r),
      g: mk(shadowRgb.g, useM ? useM.g : null, highlightRgb.g),
      b: mk(shadowRgb.b, useM ? useM.b : null, highlightRgb.b),
    };
  }, [shadowRgb, highlightRgb, midRgb, useMid]);

  const svgFilter = useMemo(() => {
    if (!tableValues) return '';
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="${filterId}" color-interpolation-filters="sRGB">
    <!-- 1. Desaturate the source to luminance -->
    <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0
                                          0.2126 0.7152 0.0722 0 0
                                          0.2126 0.7152 0.0722 0 0
                                          0 0 0 1 0" />
    <!-- 2. Map the grayscale ramp onto the duotone colors -->
    <feComponentTransfer>
      <feFuncR type="table" tableValues="${tableValues.r}" />
      <feFuncG type="table" tableValues="${tableValues.g}" />
      <feFuncB type="table" tableValues="${tableValues.b}" />
    </feComponentTransfer>
  </filter>
</svg>`;
  }, [tableValues]);

  const cssSnippet = useMemo(() => {
    return `.duotone {
  filter: url(#${filterId});
}`;
  }, []);

  return (
    <Panel>
      <PanelHeader title="Duotone CSS Generator" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <ColorRow label="Shadow color" value={shadow} onChange={setShadow} parsed={shadowRgb} />
          {useMid ? (
            <ColorRow label="Midtone color" value={mid} onChange={setMid} parsed={midRgb} />
          ) : null}
          <ColorRow
            label="Highlight color"
            value={highlight}
            onChange={setHighlight}
            parsed={highlightRgb}
          />
          <Field label="Tritone">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={useMid} onCheckedChange={setUseMid} id="tritone-toggle" />
              <Label htmlFor="tritone-toggle" className="text-xs text-muted-foreground">
                Add midtone
              </Label>
            </div>
          </Field>
        </OptionsBar>

        <ErrorBanner error={error} />

        {rampStops.length > 0 ? (
          <>
            <Field label="Grayscale ramp mapped to duotone">
              <div
                className="h-16 w-full rounded-md border"
                style={previewGradient ? { backgroundImage: previewGradient } : undefined}
              />
            </Field>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-9">
              {rampStops.map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-9 w-full rounded border" style={{ backgroundColor: s.hex }} />
                  <span className="font-mono text-2xs text-muted-foreground">{s.hex}</span>
                </div>
              ))}
            </div>

            <StatBar
              items={[useMid ? 'tritone (3-color)' : 'duotone (2-color)', '9 ramp stops']}
            />

            <Panel>
              <PanelHeader title="SVG filter (paste once in your HTML)">
                <CopyButton value={svgFilter} label="Copy" />
              </PanelHeader>
              <pre className="max-h-60 overflow-auto p-3 font-mono text-xs whitespace-pre">
                {svgFilter}
              </pre>
            </Panel>

            <Panel>
              <PanelHeader title="CSS (apply to an image)">
                <CopyButton value={cssSnippet} label="Copy" />
              </PanelHeader>
              <pre className="overflow-auto p-3 font-mono text-xs whitespace-pre">{cssSnippet}</pre>
            </Panel>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
