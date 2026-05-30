'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Category = 'mens-tops' | 'womens-tops' | 'womens-dresses';

interface SizeRow {
  alpha: string;
  us: string;
  uk: string;
  eu: string;
  // Chest (men) or bust (women) circumference, in inches.
  measureIn: number;
}

// Standard retail size charts (approximate, harmonized across common brands).
const CHARTS: Record<Category, { label: string; measureName: string; rows: SizeRow[] }> = {
  'mens-tops': {
    label: "Men's tops (chest)",
    measureName: 'Chest',
    rows: [
      { alpha: 'XS', us: '32-34', uk: '32-34', eu: '42-44', measureIn: 33 },
      { alpha: 'S', us: '35-37', uk: '35-37', eu: '46-48', measureIn: 36 },
      { alpha: 'M', us: '38-40', uk: '38-40', eu: '50-52', measureIn: 39 },
      { alpha: 'L', us: '41-43', uk: '41-43', eu: '54-56', measureIn: 42 },
      { alpha: 'XL', us: '44-46', uk: '44-46', eu: '58-60', measureIn: 45 },
      { alpha: 'XXL', us: '47-49', uk: '47-49', eu: '62-64', measureIn: 48 },
    ],
  },
  'womens-tops': {
    label: "Women's tops (bust)",
    measureName: 'Bust',
    rows: [
      { alpha: 'XS', us: '0-2', uk: '4-6', eu: '32-34', measureIn: 32 },
      { alpha: 'S', us: '4-6', uk: '8-10', eu: '36-38', measureIn: 34.5 },
      { alpha: 'M', us: '8-10', uk: '12-14', eu: '40-42', measureIn: 37 },
      { alpha: 'L', us: '12-14', uk: '16-18', eu: '44-46', measureIn: 40 },
      { alpha: 'XL', us: '16-18', uk: '20-22', eu: '48-50', measureIn: 43.5 },
      { alpha: 'XXL', us: '20-22', uk: '24-26', eu: '52-54', measureIn: 47 },
    ],
  },
  'womens-dresses': {
    label: "Women's dresses (bust)",
    measureName: 'Bust',
    rows: [
      { alpha: 'XS', us: '2', uk: '6', eu: '34', measureIn: 32.5 },
      { alpha: 'S', us: '4-6', uk: '8-10', eu: '36-38', measureIn: 34.5 },
      { alpha: 'M', us: '8-10', uk: '12-14', eu: '40-42', measureIn: 37 },
      { alpha: 'L', us: '12-14', uk: '16-18', eu: '44-46', measureIn: 40 },
      { alpha: 'XL', us: '16', uk: '20', eu: '48', measureIn: 43 },
      { alpha: 'XXL', us: '18-20', uk: '22-24', eu: '50-52', measureIn: 46 },
    ],
  },
};

const CATEGORY_OPTIONS: { id: Category; label: string }[] = [
  { id: 'mens-tops', label: "Men's tops" },
  { id: 'womens-tops', label: "Women's tops" },
  { id: 'womens-dresses', label: "Women's dresses" },
];

function inchToCm(inch: number): number {
  return Math.round(inch * 2.54 * 10) / 10;
}

export default function ClothingSizeConverterTool() {
  const [category, setCategory] = useState<Category>('mens-tops');
  const [selected, setSelected] = useState<string>('M');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  const chart = CHARTS[category];

  // Keep the selected alpha valid when the chart changes.
  const activeAlpha = useMemo(() => {
    const found = chart.rows.find((r) => r.alpha === selected);
    return found ? selected : chart.rows[0]?.alpha ?? 'M';
  }, [chart, selected]);

  const selectedRow = chart.rows.find((r) => r.alpha === activeAlpha) ?? null;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Category" className="min-w-[12rem]">
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Your size (alpha)" className="min-w-[10rem]">
            <Select value={activeAlpha} onValueChange={(v) => setSelected(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chart.rows.map((r) => (
                  <SelectItem key={r.alpha} value={r.alpha}>
                    {r.alpha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Measurement unit" className="min-w-[12rem]">
            <Tabs value={unit} onValueChange={(v) => setUnit(v as 'in' | 'cm')}>
              <TabsList>
                <TabsTrigger value="in">Inches</TabsTrigger>
                <TabsTrigger value="cm">Centimeters</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title={chart.label}>
          {selectedRow && (
            <CopyButton
              value={`${chart.label} — ${selectedRow.alpha}: US ${selectedRow.us}, UK ${selectedRow.uk}, EU ${selectedRow.eu}, ${chart.measureName} ${
                unit === 'in' ? `${selectedRow.measureIn} in` : `${inchToCm(selectedRow.measureIn)} cm`
              }`}
            />
          )}
        </PanelHeader>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1.4fr] gap-x-3 border-b bg-muted/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Alpha</span>
            <span>US</span>
            <span>UK</span>
            <span>EU</span>
            <span>{chart.measureName} ({unit})</span>
          </div>
          <div className="divide-y">
            {chart.rows.map((r) => {
              const measure = unit === 'in' ? `${r.measureIn}` : `${inchToCm(r.measureIn)}`;
              const isActive = r.alpha === activeAlpha;
              return (
                <button
                  key={r.alpha}
                  type="button"
                  onClick={() => setSelected(r.alpha)}
                  className={cn(
                    'grid w-full grid-cols-[3rem_1fr_1fr_1fr_1.4fr] gap-x-3 px-3 py-2 text-left text-sm transition-colors',
                    isActive ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'
                  )}
                >
                  <code className="font-mono text-xs">{r.alpha}</code>
                  <span>{r.us}</span>
                  <span>{r.uk}</span>
                  <span>{r.eu}</span>
                  <span className="font-mono text-xs">{measure}</span>
                </button>
              );
            })}
          </div>
        </div>
        <StatBar
          items={[
            `Selected: ${activeAlpha}`,
            selectedRow && `US ${selectedRow.us} · UK ${selectedRow.uk} · EU ${selectedRow.eu}`,
            'Approximate retail charts — verify with brand size guide',
          ]}
        />
      </Panel>
    </div>
  );
}
