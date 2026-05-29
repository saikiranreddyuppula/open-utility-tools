'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UnitKind = 'volume' | 'mass';

interface Unit {
  id: string;
  label: string;
  kind: UnitKind;
  /** volume units: mL per unit; mass units: grams per unit */
  base: number;
}

// US customary cooking measures.
const UNITS: Unit[] = [
  // Volume (base = milliliters)
  { id: 'cup', label: 'Cup (US)', kind: 'volume', base: 236.588 },
  { id: 'tbsp', label: 'Tablespoon (US)', kind: 'volume', base: 14.7868 },
  { id: 'tsp', label: 'Teaspoon (US)', kind: 'volume', base: 4.92892 },
  { id: 'floz', label: 'Fluid ounce (US)', kind: 'volume', base: 29.5735 },
  { id: 'ml', label: 'Milliliter (mL)', kind: 'volume', base: 1 },
  { id: 'l', label: 'Liter (L)', kind: 'volume', base: 1000 },
  // Mass (base = grams)
  { id: 'g', label: 'Gram (g)', kind: 'mass', base: 1 },
  { id: 'kg', label: 'Kilogram (kg)', kind: 'mass', base: 1000 },
  { id: 'oz', label: 'Ounce (oz, weight)', kind: 'mass', base: 28.3495 },
  { id: 'lb', label: 'Pound (lb)', kind: 'mass', base: 453.592 },
];

// Ingredient densities in grams per milliliter.
interface Ingredient {
  id: string;
  label: string;
  gPerMl: number;
}

const INGREDIENTS: Ingredient[] = [
  { id: 'water', label: 'Water', gPerMl: 1.0 },
  { id: 'milk', label: 'Milk', gPerMl: 1.03 },
  { id: 'flour', label: 'Flour (all-purpose)', gPerMl: 0.529 },
  { id: 'sugar', label: 'Sugar (granulated)', gPerMl: 0.845 },
  { id: 'brownsugar', label: 'Brown sugar (packed)', gPerMl: 0.93 },
  { id: 'butter', label: 'Butter', gPerMl: 0.911 },
  { id: 'oil', label: 'Oil (vegetable)', gPerMl: 0.92 },
  { id: 'honey', label: 'Honey', gPerMl: 1.42 },
  { id: 'salt', label: 'Salt (table)', gPerMl: 1.217 },
  { id: 'rice', label: 'Rice (uncooked)', gPerMl: 0.85 },
];

function unitById(id: string): Unit {
  return UNITS.find((u) => u.id === id) ?? (UNITS[0] as Unit);
}

function ingredientById(id: string): Ingredient {
  return INGREDIENTS.find((i) => i.id === id) ?? (INGREDIENTS[0] as Ingredient);
}

function parseNum(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
  return Number(n.toFixed(decimals)).toString();
}

export default function CookingConverterTool() {
  const [valueText, setValueText] = useState('1');
  const [from, setFrom] = useState('cup');
  const [to, setTo] = useState('ml');
  const [ingredient, setIngredient] = useState('flour');

  const fromUnit = unitById(from);
  const toUnit = unitById(to);
  const ing = ingredientById(ingredient);
  const crossesKind = fromUnit.kind !== toUnit.kind;

  const result = useMemo(() => {
    const value = parseNum(valueText);
    if (value === null) return { error: 'Enter a numeric amount.' as string | null, output: null as number | null };
    if (value < 0) return { error: 'Amount cannot be negative.', output: null };

    if (fromUnit.kind === toUnit.kind) {
      // Same kind: convert via shared base.
      const inBase = value * fromUnit.base; // mL or g
      return { error: null, output: inBase / toUnit.base };
    }

    // Cross volume <-> mass using ingredient density (g per mL).
    if (fromUnit.kind === 'volume') {
      const ml = value * fromUnit.base;
      const grams = ml * ing.gPerMl;
      return { error: null, output: grams / toUnit.base };
    }
    // from mass -> volume
    const grams = value * fromUnit.base;
    const ml = grams / ing.gPerMl;
    return { error: null, output: ml / toUnit.base };
  }, [valueText, fromUnit, toUnit, ing]);

  const value = parseNum(valueText);

  const copyText = useMemo(() => {
    if (result.output === null || value === null) return '';
    return `${fmt(value)} ${fromUnit.label} = ${fmt(result.output)} ${toUnit.label}`;
  }, [result.output, value, fromUnit.label, toUnit.label]);

  return (
    <Panel>
      <PanelHeader title="Cooking Measurement Converter">
        {copyText !== '' && <CopyButton value={copyText} />}
      </PanelHeader>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <Field label="Amount">
          <Input inputMode="decimal" value={valueText} onChange={(e) => setValueText(e.target.value)} placeholder="1" />
        </Field>
        <Field label="From">
          <Select value={from} onValueChange={(v) => setFrom(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="To">
          <Select value={to} onValueChange={(v) => setTo(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {crossesKind && (
        <OptionsBar>
          <Field label="Ingredient" hint={`Density ${ing.gPerMl} g/mL (needed for volume ↔ weight)`}>
            <Select value={ingredient} onValueChange={(v) => setIngredient(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INGREDIENTS.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      )}

      <ErrorBanner error={result.error} />

      {result.output !== null && value !== null && (
        <div className="mt-2 rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Result</div>
          <div className="mt-1 font-mono text-2xl font-semibold">
            {fmt(result.output)} <span className="text-base font-normal text-muted-foreground">{toUnit.label}</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {fmt(value)} {fromUnit.label} = {fmt(result.output)} {toUnit.label}
          </div>
        </div>
      )}

      <StatBar
        items={[
          crossesKind && `Using ${ing.label} (${ing.gPerMl} g/mL)`,
          !crossesKind && `${fromUnit.kind === 'volume' ? 'Volume' : 'Weight'} conversion`,
        ]}
      />
    </Panel>
  );
}
