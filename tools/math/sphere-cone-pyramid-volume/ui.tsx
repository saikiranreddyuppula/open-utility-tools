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

type Shape = 'sphere' | 'cone' | 'pyramid';

const SHAPE_LABELS: Record<Shape, string> = {
  sphere: 'Sphere',
  cone: 'Cone',
  pyramid: 'Square pyramid',
};

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function SphereConePyramidVolumeTool() {
  const [shape, setShape] = useState<Shape>('sphere');
  const [radius, setRadius] = useState('5');
  const [height, setHeight] = useState('10');
  const [base, setBase] = useState('6');

  const result = useMemo(() => {
    const r = Number(radius);
    const h = Number(height);
    const b = Number(base);

    let rows: { label: string; value: string }[] = [];
    let formula = '';

    switch (shape) {
      case 'sphere': {
        if (!Number.isFinite(r) || r <= 0) return { error: 'Enter a positive radius.' };
        const v = (4 / 3) * Math.PI * r ** 3;
        const sa = 4 * Math.PI * r ** 2;
        rows = [
          { label: 'Volume', value: num(v) },
          { label: 'Surface area', value: num(sa) },
          { label: 'Diameter', value: num(2 * r) },
          { label: 'Great-circle circumference', value: num(2 * Math.PI * r) },
        ];
        formula = 'V = 4/3·π·r³,  SA = 4·π·r²';
        break;
      }
      case 'cone': {
        if (!Number.isFinite(r) || r <= 0) return { error: 'Enter a positive radius.' };
        if (!Number.isFinite(h) || h <= 0) return { error: 'Enter a positive height.' };
        const slant = Math.sqrt(r * r + h * h);
        const v = (1 / 3) * Math.PI * r * r * h;
        const lateral = Math.PI * r * slant;
        const sa = Math.PI * r * r + lateral;
        rows = [
          { label: 'Volume', value: num(v) },
          { label: 'Slant height (l)', value: num(slant) },
          { label: 'Lateral surface area', value: num(lateral) },
          { label: 'Base area', value: num(Math.PI * r * r) },
          { label: 'Total surface area', value: num(sa) },
        ];
        formula = 'V = 1/3·π·r²·h,  l = √(r²+h²),  SA = π·r² + π·r·l';
        break;
      }
      case 'pyramid': {
        if (!Number.isFinite(b) || b <= 0) return { error: 'Enter a positive base edge.' };
        if (!Number.isFinite(h) || h <= 0) return { error: 'Enter a positive height.' };
        const slant = Math.sqrt((b / 2) ** 2 + h * h);
        const v = (1 / 3) * b * b * h;
        const baseArea = b * b;
        const lateral = 2 * b * slant;
        const sa = baseArea + lateral;
        rows = [
          { label: 'Volume', value: num(v) },
          { label: 'Slant height (l)', value: num(slant) },
          { label: 'Base area', value: num(baseArea) },
          { label: 'Lateral surface area', value: num(lateral) },
          { label: 'Total surface area', value: num(sa) },
        ];
        formula = 'V = 1/3·b²·h,  l = √((b/2)²+h²),  SA = b² + 2·b·l';
        break;
      }
      default:
        return { error: 'Unknown shape.' };
    }

    return { rows, formula };
  }, [shape, radius, height, base]);

  const showRadius = shape === 'sphere' || shape === 'cone';
  const showHeight = shape === 'cone' || shape === 'pyramid';
  const showBase = shape === 'pyramid';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Shape">
            <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <SelectTrigger className="w-40">
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
          {showRadius && (
            <Field label="Radius (r)">
              <Input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
            </Field>
          )}
          {showBase && (
            <Field label="Base edge (b)">
              <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
            </Field>
          )}
          {showHeight && (
            <Field label="Height (h)">
              <Input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${SHAPE_LABELS[shape]} — results`}>
            <CopyButton value={() => result.rows.map((row) => `${row.label}: ${row.value}`).join('\n')} />
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
          <StatBar items={[result.formula]} />
        </Panel>
      )}
    </div>
  );
}
