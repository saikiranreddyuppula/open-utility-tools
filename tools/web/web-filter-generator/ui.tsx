'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface FilterDef {
  key: string;
  label: string;
  fn: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Value at which the function is the identity and should be omitted. */
  identity: number;
}

// Canonical order matches the typical order used in tooling output.
const FILTERS: FilterDef[] = [
  { key: 'blur', label: 'Blur', fn: 'blur', unit: 'px', min: 0, max: 30, step: 0.5, identity: 0 },
  { key: 'brightness', label: 'Brightness', fn: 'brightness', unit: '%', min: 0, max: 300, step: 1, identity: 100 },
  { key: 'contrast', label: 'Contrast', fn: 'contrast', unit: '%', min: 0, max: 300, step: 1, identity: 100 },
  { key: 'grayscale', label: 'Grayscale', fn: 'grayscale', unit: '%', min: 0, max: 100, step: 1, identity: 0 },
  { key: 'hueRotate', label: 'Hue rotate', fn: 'hue-rotate', unit: 'deg', min: 0, max: 360, step: 1, identity: 0 },
  { key: 'invert', label: 'Invert', fn: 'invert', unit: '%', min: 0, max: 100, step: 1, identity: 0 },
  { key: 'opacity', label: 'Opacity', fn: 'opacity', unit: '%', min: 0, max: 100, step: 1, identity: 100 },
  { key: 'saturate', label: 'Saturate', fn: 'saturate', unit: '%', min: 0, max: 300, step: 1, identity: 100 },
  { key: 'sepia', label: 'Sepia', fn: 'sepia', unit: '%', min: 0, max: 100, step: 1, identity: 0 },
];

type Values = Record<string, number>;

const INITIAL: Values = {
  blur: 0,
  brightness: 110,
  contrast: 120,
  grayscale: 0,
  hueRotate: 0,
  invert: 0,
  opacity: 100,
  saturate: 130,
  sepia: 0,
};

// Inline SVG placeholder so a preview always renders without any network request.
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3b82f6"/><stop offset="0.5" stop-color="#a855f7"/>
        <stop offset="1" stop-color="#ef4444"/></linearGradient></defs>
      <rect width="320" height="220" fill="url(#g)"/>
      <circle cx="90" cy="80" r="44" fill="#fde047" opacity="0.9"/>
      <rect x="150" y="120" width="130" height="70" rx="10" fill="#ffffff" opacity="0.85"/>
      <text x="160" y="40" font-family="sans-serif" font-size="20" fill="#ffffff">Preview</text>
    </svg>`,
  );

export default function CssFilterGeneratorTool() {
  const [values, setValues] = useState<Values>(INITIAL);
  const [shadowOn, setShadowOn] = useState(false);
  const [sx, setSx] = useState(4);
  const [sy, setSy] = useState(4);
  const [sblur, setSblur] = useState(6);
  const [scolor, setScolor] = useState('#000000');
  const [src, setSrc] = useState<string>(PLACEHOLDER);
  const fileRef = useRef<HTMLInputElement>(null);

  const setVal = useCallback((key: string, v: number) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setSrc(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const filterValue = useMemo(() => {
    const parts: string[] = [];
    for (const f of FILTERS) {
      const raw = values[f.key];
      const v = raw ?? f.identity;
      if (v === f.identity) continue;
      const num = f.unit === 'px' && !Number.isInteger(v) ? v : Math.round(v);
      parts.push(`${f.fn}(${num}${f.unit})`);
    }
    if (shadowOn) {
      const color = /^#[0-9a-fA-F]{6}$/.test(scolor) ? scolor : '#000000';
      parts.push(`drop-shadow(${sx}px ${sy}px ${sblur}px ${color})`);
    }
    return parts.length > 0 ? parts.join(' ') : 'none';
  }, [values, shadowOn, sx, sy, sblur, scolor]);

  const css = `filter: ${filterValue};`;
  const webkitCss = `-webkit-filter: ${filterValue};\nfilter: ${filterValue};`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Filters" />
        <div className="flex flex-col gap-4 p-3">
          {FILTERS.map((f) => {
            const v = values[f.key] ?? f.identity;
            return (
              <Field key={f.key} label={`${f.label}: ${v}${f.unit}`}>
                <Slider
                  value={[v]}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  onValueChange={(vals) => setVal(f.key, vals[0] ?? f.identity)}
                />
              </Field>
            );
          })}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shadow-on"
              checked={shadowOn}
              onChange={(e) => setShadowOn(e.target.checked)}
              className="size-4"
            />
            <label htmlFor="shadow-on" className="text-sm">
              drop-shadow
            </label>
            {shadowOn && (
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(scolor) ? scolor : '#000000'}
                onChange={(e) => setScolor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border bg-transparent"
                aria-label="Shadow color"
              />
            )}
          </div>
          {shadowOn && (
            <div className="flex flex-col gap-3">
              <Field label={`Shadow X: ${sx}px`}>
                <Slider value={[sx]} min={-40} max={40} step={1} onValueChange={(v) => setSx(v[0] ?? 0)} />
              </Field>
              <Field label={`Shadow Y: ${sy}px`}>
                <Slider value={[sy]} min={-40} max={40} step={1} onValueChange={(v) => setSy(v[0] ?? 0)} />
              </Field>
              <Field label={`Shadow blur: ${sblur}px`}>
                <Slider value={[sblur]} min={0} max={40} step={1} onValueChange={(v) => setSblur(v[0] ?? 0)} />
              </Field>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </PanelHeader>
        <div className="flex items-center justify-center rounded-md border bg-muted/40 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="filtered preview"
            className="max-h-[260px] rounded"
            style={{ filter: filterValue === 'none' ? undefined : filterValue }}
          />
        </div>
        <div className="mt-3 space-y-2 p-3">
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {css}
            </code>
            <CopyButton value={css} />
          </div>
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto whitespace-pre rounded bg-muted px-3 py-2 font-mono text-xs">
              {webkitCss}
            </code>
            <CopyButton value={webkitCss} />
          </div>
          <p className="text-2xs text-muted-foreground">
            Images are processed entirely in your browser and never uploaded.
          </p>
        </div>
        <StatBar items={[`${filterValue === 'none' ? 0 : filterValue.split(' ').length} active`]} />
      </Panel>
    </div>
  );
}
