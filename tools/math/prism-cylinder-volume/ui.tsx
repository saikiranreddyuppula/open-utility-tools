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

type Shape = 'cube' | 'box' | 'cylinder';

const SHAPE_LABELS: Record<Shape, string> = {
  cube: 'Cube',
  box: 'Rectangular box',
  cylinder: 'Cylinder',
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function posNum(s: string): number | null {
  const v = Number(s.trim());
  if (s.trim() === '' || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export default function PrismCylinderVolume() {
  const [shape, setShape] = useState<Shape>('cylinder');
  const [a, setA] = useState('3'); // cube side OR box length OR cylinder radius
  const [w, setW] = useState('4'); // box width
  const [h, setH] = useState('5'); // box height OR cylinder height

  const result = useMemo(() => {
    if (shape === 'cube') {
      const side = posNum(a);
      if (side === null) return { error: 'Enter a positive edge length.' };
      const volume = side ** 3;
      const surface = 6 * side * side;
      return {
        rows: [
          { label: 'Volume', value: `${fmt(volume)} units³` },
          { label: 'Surface area', value: `${fmt(surface)} units²` },
          { label: 'Face area', value: `${fmt(side * side)} units²` },
        ],
      };
    }
    if (shape === 'box') {
      const l = posNum(a);
      const wid = posNum(w);
      const hgt = posNum(h);
      if (l === null || wid === null || hgt === null) {
        return { error: 'Enter positive length, width, and height.' };
      }
      const volume = l * wid * hgt;
      const surface = 2 * (l * wid + l * hgt + wid * hgt);
      const lateral = 2 * hgt * (l + wid);
      return {
        rows: [
          { label: 'Volume', value: `${fmt(volume)} units³` },
          { label: 'Total surface area', value: `${fmt(surface)} units²` },
          { label: 'Lateral surface area', value: `${fmt(lateral)} units²` },
        ],
      };
    }
    // cylinder
    const r = posNum(a);
    const hgt = posNum(h);
    if (r === null || hgt === null) {
      return { error: 'Enter a positive radius and height.' };
    }
    const volume = Math.PI * r * r * hgt;
    const lateral = 2 * Math.PI * r * hgt;
    const surface = 2 * Math.PI * r * r + lateral;
    return {
      rows: [
        { label: 'Volume', value: `${fmt(volume)} units³` },
        { label: 'Total surface area', value: `${fmt(surface)} units²` },
        { label: 'Lateral surface area', value: `${fmt(lateral)} units²` },
        { label: 'Base area', value: `${fmt(Math.PI * r * r)} units²` },
      ],
    };
  }, [shape, a, w, h]);

  const labelA = shape === 'cube' ? 'Edge (a)' : shape === 'box' ? 'Length (l)' : 'Radius (r)';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Shape">
            <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHAPE_LABELS) as Shape[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={labelA}>
            <Input
              value={a}
              onChange={(e) => setA(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
          {shape === 'box' && (
            <Field label="Width (w)">
              <Input
                value={w}
                onChange={(e) => setW(e.target.value)}
                inputMode="decimal"
                className="w-28 font-mono"
              />
            </Field>
          )}
          {(shape === 'box' || shape === 'cylinder') && (
            <Field label="Height (h)">
              <Input
                value={h}
                onChange={(e) => setH(e.target.value)}
                inputMode="decimal"
                className="w-28 font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${SHAPE_LABELS[shape]} measurements`}>
            <CopyButton
              value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`Shape: ${SHAPE_LABELS[shape]}`, 'π = Math.PI']} />
        </Panel>
      )}
    </div>
  );
}
