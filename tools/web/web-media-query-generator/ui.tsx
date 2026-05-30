'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type MediaType = 'all' | 'screen' | 'print';
type Orientation = 'portrait' | 'landscape';
type ColorScheme = 'light' | 'dark';
type ResUnit = 'dppx' | 'dpi';

const BREAKPOINTS: { label: string; value: number }[] = [
  { label: 'sm 640', value: 640 },
  { label: 'md 768', value: 768 },
  { label: 'lg 1024', value: 1024 },
  { label: 'xl 1280', value: 1280 },
  { label: '2xl 1536', value: 1536 },
];

function num(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function MediaQueryGenerator() {
  const [mediaType, setMediaType] = useState<MediaType>('screen');

  const [useMin, setUseMin] = useState(true);
  const [minW, setMinW] = useState('768');
  const [useMax, setUseMax] = useState(false);
  const [maxW, setMaxW] = useState('1023');

  const [useOrientation, setUseOrientation] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  const [useScheme, setUseScheme] = useState(false);
  const [scheme, setScheme] = useState<ColorScheme>('dark');

  const [useReducedMotion, setUseReducedMotion] = useState(false);

  const [useRes, setUseRes] = useState(false);
  const [res, setRes] = useState('2');
  const [resUnit, setResUnit] = useState<ResUnit>('dppx');

  const [useAspect, setUseAspect] = useState(false);
  const [aspect, setAspect] = useState('16/9');

  const result = useMemo(() => {
    const conditions: string[] = [];
    const warnings: string[] = [];

    if (useMin) {
      const v = num(minW);
      if (v === null || v < 0) warnings.push('min-width must be a number ≥ 0.');
      else conditions.push(`(min-width: ${v}px)`);
    }
    if (useMax) {
      const v = num(maxW);
      if (v === null || v < 0) warnings.push('max-width must be a number ≥ 0.');
      else conditions.push(`(max-width: ${v}px)`);
    }
    if (useMin && useMax) {
      const a = num(minW);
      const b = num(maxW);
      if (a !== null && b !== null && a > b)
        warnings.push('min-width is larger than max-width — query never matches.');
    }
    if (useOrientation) conditions.push(`(orientation: ${orientation})`);
    if (useScheme) conditions.push(`(prefers-color-scheme: ${scheme})`);
    if (useReducedMotion) conditions.push('(prefers-reduced-motion: reduce)');
    if (useRes) {
      const v = num(res);
      if (v === null || v <= 0) warnings.push('resolution must be a positive number.');
      else conditions.push(`(min-resolution: ${v}${resUnit})`);
    }
    if (useAspect) {
      const m = aspect.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
      const w = m?.[1];
      const h = m?.[2];
      if (!w || !h) warnings.push('aspect-ratio must look like 16/9.');
      else conditions.push(`(aspect-ratio: ${w}/${h})`);
    }

    const prefix = mediaType === 'all' && conditions.length > 0 ? '' : `${mediaType} `;
    const joined = conditions.join(' and ');
    const query =
      conditions.length > 0 ? `${prefix}${joined}`.trim() : mediaType;

    const css = `@media ${query} {\n  .responsive {\n    /* your styles here */\n    display: block;\n  }\n}`;

    return { css, query, warnings, count: conditions.length };
  }, [
    mediaType,
    useMin,
    minW,
    useMax,
    maxW,
    useOrientation,
    orientation,
    useScheme,
    scheme,
    useReducedMotion,
    useRes,
    res,
    resUnit,
    useAspect,
    aspect,
  ]);

  const note = useMin
    ? 'min-width → mobile-first (styles apply above the breakpoint).'
    : useMax
      ? 'max-width → desktop-first (styles apply below the breakpoint).'
      : 'Add a width condition to choose mobile-first vs desktop-first.';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Conditions" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Media type">
              <Select
                value={mediaType}
                onValueChange={(v) => setMediaType(v as MediaType)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all</SelectItem>
                  <SelectItem value="screen">screen</SelectItem>
                  <SelectItem value="print">print</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <Field label="min-width">
            <div className="flex items-center gap-2">
              <Switch checked={useMin} onCheckedChange={setUseMin} />
              <Input
                value={minW}
                onChange={(e) => setMinW(e.target.value)}
                inputMode="numeric"
                className="w-24 font-mono"
                disabled={!useMin}
              />
              <span className="text-sm text-muted-foreground">px</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {BREAKPOINTS.map((b) => (
                <Button
                  key={b.value}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-2xs"
                  onClick={() => {
                    setUseMin(true);
                    setMinW(String(b.value));
                  }}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="max-width">
            <div className="flex items-center gap-2">
              <Switch checked={useMax} onCheckedChange={setUseMax} />
              <Input
                value={maxW}
                onChange={(e) => setMaxW(e.target.value)}
                inputMode="numeric"
                className="w-24 font-mono"
                disabled={!useMax}
              />
              <span className="text-sm text-muted-foreground">px</span>
            </div>
          </Field>

          <Field label="orientation">
            <div className="flex items-center gap-2">
              <Switch
                checked={useOrientation}
                onCheckedChange={setUseOrientation}
              />
              <Select
                value={orientation}
                onValueChange={(v) => setOrientation(v as Orientation)}
              >
                <SelectTrigger className="w-36" disabled={!useOrientation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">portrait</SelectItem>
                  <SelectItem value="landscape">landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field label="prefers-color-scheme">
            <div className="flex items-center gap-2">
              <Switch checked={useScheme} onCheckedChange={setUseScheme} />
              <Select
                value={scheme}
                onValueChange={(v) => setScheme(v as ColorScheme)}
              >
                <SelectTrigger className="w-36" disabled={!useScheme}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">light</SelectItem>
                  <SelectItem value="dark">dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field label="prefers-reduced-motion: reduce">
            <Switch
              checked={useReducedMotion}
              onCheckedChange={setUseReducedMotion}
            />
          </Field>

          <Field label="min-resolution">
            <div className="flex items-center gap-2">
              <Switch checked={useRes} onCheckedChange={setUseRes} />
              <Input
                value={res}
                onChange={(e) => setRes(e.target.value)}
                inputMode="decimal"
                className="w-20 font-mono"
                disabled={!useRes}
              />
              <Select
                value={resUnit}
                onValueChange={(v) => setResUnit(v as ResUnit)}
              >
                <SelectTrigger className="w-24" disabled={!useRes}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dppx">dppx</SelectItem>
                  <SelectItem value="dpi">dpi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field label="aspect-ratio">
            <div className="flex items-center gap-2">
              <Switch checked={useAspect} onCheckedChange={setUseAspect} />
              <Input
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
                placeholder="16/9"
                className="w-24 font-mono"
                disabled={!useAspect}
              />
            </div>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Generated CSS">
          <CopyButton value={() => result.css} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <pre className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
            {result.css}
          </pre>
          {result.warnings.length > 0 && (
            <ul className="space-y-1 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <p className="rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {note}
          </p>
        </div>
        <StatBar
          items={[
            `media: ${mediaType}`,
            `${result.count} condition${result.count === 1 ? '' : 's'}`,
            result.warnings.length > 0 ? `${result.warnings.length} warning` : 'valid',
          ]}
        />
      </Panel>
    </div>
  );
}
