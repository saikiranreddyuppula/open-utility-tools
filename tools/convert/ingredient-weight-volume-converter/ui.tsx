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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Densities in g/mL.
const INGREDIENTS: { id: string; name: string; density: number }[] = [
  { id: 'water', name: 'Water', density: 1.0 },
  { id: 'flour', name: 'All-purpose flour', density: 0.53 },
  { id: 'sugar', name: 'Granulated sugar', density: 0.85 },
  { id: 'brown-sugar', name: 'Brown sugar (packed)', density: 0.93 },
  { id: 'butter', name: 'Butter', density: 0.911 },
  { id: 'honey', name: 'Honey', density: 1.42 },
  { id: 'salt', name: 'Table salt', density: 1.22 },
  { id: 'cocoa', name: 'Cocoa powder', density: 0.41 },
  { id: 'oats', name: 'Rolled oats', density: 0.41 },
  { id: 'rice', name: 'Rice (uncooked)', density: 0.85 },
];

type CupSystem = 'us' | 'metric';

// Volume units in mL; mass units in grams. `kind` selects the conversion path.
type Unit = { id: string; name: string; kind: 'mass' | 'volume'; factor: number };

function units(cup: CupSystem): Unit[] {
  const cupMl = cup === 'us' ? 236.588 : 250;
  return [
    { id: 'g', name: 'Grams (g)', kind: 'mass', factor: 1 },
    { id: 'oz', name: 'Ounces (oz)', kind: 'mass', factor: 28.349523125 },
    { id: 'cup', name: 'Cups', kind: 'volume', factor: cupMl },
    { id: 'tbsp', name: 'Tablespoons', kind: 'volume', factor: 14.7867648 },
    { id: 'tsp', name: 'Teaspoons', kind: 'volume', factor: 4.92892159 },
    { id: 'ml', name: 'Milliliters (mL)', kind: 'volume', factor: 1 },
  ];
}

export default function IngredientWeightVolumeConverter() {
  const [amount, setAmount] = useState('1');
  const [from, setFrom] = useState('cup');
  const [to, setTo] = useState('g');
  const [ingredient, setIngredient] = useState('flour');
  const [cup, setCup] = useState<CupSystem>('us');
  const [precision, setPrecision] = useState('2');

  const result = useMemo(() => {
    const amt = Number(amount);
    if (!Number.isFinite(amt)) return { error: 'Enter a valid amount.' };
    const list = units(cup);
    const fromU = list.find((u) => u.id === from);
    const toU = list.find((u) => u.id === to);
    const ing = INGREDIENTS.find((i) => i.id === ingredient);
    if (!fromU || !toU || !ing) return { error: 'Pick valid units and an ingredient.' };

    // Everything goes through grams.
    const grams = fromU.kind === 'mass' ? amt * fromU.factor : amt * fromU.factor * ing.density;
    const out =
      toU.kind === 'mass' ? grams / toU.factor : grams / ing.density / toU.factor;

    const p = Math.max(0, Math.min(6, Math.round(Number(precision)) || 0));
    return {
      value: out.toFixed(p),
      grams: grams.toFixed(p),
      density: ing.density,
      ingredient: ing.name,
      fromName: fromU.name,
      toName: toU.name,
    };
  }, [amount, from, to, ingredient, cup, precision]);

  const list = units(cup);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Amount" className="min-w-[8rem]">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="From" className="min-w-[10rem]">
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To" className="min-w-[10rem]">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ingredient" className="min-w-[12rem]">
            <Select value={ingredient} onValueChange={setIngredient}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INGREDIENTS.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({i.density} g/mL)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cup size">
            <Tabs value={cup} onValueChange={(v) => setCup(v as CupSystem)}>
              <TabsList>
                <TabsTrigger value="us">US (236.6 mL)</TabsTrigger>
                <TabsTrigger value="metric">Metric (250 mL)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Decimals" className="min-w-[6rem]">
            <Input value={precision} onChange={(e) => setPrecision(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.value} />
          </PanelHeader>
          <div className="flex items-baseline justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {amount} {result.fromName} of {result.ingredient}
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {result.value} <span className="text-base text-muted-foreground">{result.toName}</span>
              </p>
            </div>
            <CopyButton value={result.value} />
          </div>
          <StatBar
            items={[
              `Density: ${result.density} g/mL`,
              `≈ ${result.grams} g`,
              `Cup: ${cup === 'us' ? '236.588' : '250'} mL`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
