'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'print' | 'screen';
type LenUnit = 'in' | 'cm' | 'mm';
type SolveFor = 'pixels' | 'size' | 'dpi';

const PER_INCH: Record<LenUnit, number> = { in: 1, cm: 2.54, mm: 25.4 };

function fmt(n: number, p: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Number(n.toFixed(p));
  return (Object.is(r, -0) ? 0 : r).toString();
}

export default function DpiPpiSizeConverter() {
  const [mode, setMode] = useState<Mode>('print');
  const [unit, setUnit] = useState<LenUnit>('in');
  const [precision, setPrecision] = useState('2');

  // Print mode
  const [solveFor, setSolveFor] = useState<SolveFor>('pixels');
  const [size, setSize] = useState('6');
  const [pixels, setPixels] = useState('1800');
  const [dpi, setDpi] = useState('300');

  // Screen mode
  const [pxW, setPxW] = useState('1920');
  const [pxH, setPxH] = useState('1080');
  const [diag, setDiag] = useState('15.6');

  const p = Math.max(0, Math.min(6, Math.round(Number(precision)) || 0));

  const print = useMemo(() => {
    if (mode !== 'print') return null;
    const perInch = PER_INCH[unit];
    const px = Number(pixels);
    const d = Number(dpi);
    const s = Number(size); // in the chosen unit
    const sizeInches = s / perInch;

    if (solveFor === 'pixels') {
      if (!Number.isFinite(sizeInches) || !Number.isFinite(d) || d <= 0 || sizeInches <= 0)
        return { error: 'Enter a positive physical size and DPI.' };
      const value = sizeInches * d;
      return { rows: [{ label: `Pixels`, value: `${fmt(value, 0)} px` }] };
    }
    if (solveFor === 'size') {
      if (!Number.isFinite(px) || !Number.isFinite(d) || d <= 0 || px <= 0)
        return { error: 'Enter positive pixels and DPI.' };
      const inches = px / d;
      return {
        rows: [
          { label: 'Inches', value: `${fmt(inches, p)} in` },
          { label: 'Centimeters', value: `${fmt(inches * 2.54, p)} cm` },
          { label: 'Millimeters', value: `${fmt(inches * 25.4, p)} mm` },
        ],
      };
    }
    // solve dpi
    if (!Number.isFinite(px) || !Number.isFinite(sizeInches) || sizeInches <= 0 || px <= 0)
      return { error: 'Enter positive pixels and physical size.' };
    const value = px / sizeInches;
    return { rows: [{ label: 'DPI', value: `${fmt(value, p)} dpi` }] };
  }, [mode, unit, solveFor, size, pixels, dpi, p]);

  const screen = useMemo(() => {
    if (mode !== 'screen') return null;
    const w = Number(pxW);
    const h = Number(pxH);
    const dg = Number(diag);
    if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(dg) || w <= 0 || h <= 0 || dg <= 0)
      return { error: 'Enter positive resolution and diagonal size.' };
    const ppi = Math.sqrt(w * w + h * h) / dg;
    const dotPitch = 25.4 / ppi;
    const megapixels = (w * h) / 1_000_000;
    return {
      rows: [
        { label: 'PPI', value: `${fmt(ppi, p)} ppi` },
        { label: 'Dot pitch', value: `${fmt(dotPitch, Math.max(3, p))} mm` },
        { label: 'Megapixels', value: `${fmt(megapixels, 2)} MP` },
      ],
    };
  }, [mode, pxW, pxH, diag, p]);

  const active = mode === 'print' ? print : screen;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="print">Print size</TabsTrigger>
                <TabsTrigger value="screen">Screen PPI</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Decimals" className="min-w-[6rem]">
            <Input value={precision} onChange={(e) => setPrecision(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        {mode === 'print' ? (
          <OptionsBar>
            <Field label="Solve for" className="min-w-[10rem]">
              <Select value={solveFor} onValueChange={(v) => setSolveFor(v as SolveFor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pixels">Pixels</SelectItem>
                  <SelectItem value="size">Physical size</SelectItem>
                  <SelectItem value="dpi">DPI</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {solveFor !== 'size' && (
              <Field label={`Physical size (${unit})`} className="min-w-[9rem]">
                <Input value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {solveFor !== 'pixels' && (
              <Field label="Pixels" className="min-w-[9rem]">
                <Input value={pixels} onChange={(e) => setPixels(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {solveFor !== 'dpi' && (
              <Field label="DPI" className="min-w-[8rem]">
                <Input value={dpi} onChange={(e) => setDpi(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            <Field label="Size unit">
              <Tabs value={unit} onValueChange={(v) => setUnit(v as LenUnit)}>
                <TabsList>
                  <TabsTrigger value="in">in</TabsTrigger>
                  <TabsTrigger value="cm">cm</TabsTrigger>
                  <TabsTrigger value="mm">mm</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar>
            <Field label="Width (px)" className="min-w-[8rem]">
              <Input value={pxW} onChange={(e) => setPxW(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Height (px)" className="min-w-[8rem]">
              <Input value={pxH} onChange={(e) => setPxH(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Diagonal (in)" className="min-w-[8rem]">
              <Input value={diag} onChange={(e) => setDiag(e.target.value)} inputMode="decimal" />
            </Field>
          </OptionsBar>
        )}
      </Panel>

      {active && 'error' in active ? (
        <ErrorBanner error={active.error} />
      ) : active ? (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => active.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {active.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['pixels = inches × DPI', 'PPI = √(w² + h²) ÷ diagonal″']} />
        </Panel>
      ) : null}
    </div>
  );
}
