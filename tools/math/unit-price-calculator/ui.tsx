'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UnitKind = 'g' | 'kg' | 'mg' | 'ml' | 'l' | 'count';

interface Item {
  id: number;
  name: string;
  price: string;
  qty: string;
  unit: UnitKind;
}

// Conversion factor to a common base for each unit family.
// Mass -> grams, Volume -> millilitres, count -> each.
const UNIT_INFO: Record<UnitKind, { family: string; toBase: number; base: string }> = {
  mg: { family: 'mass', toBase: 0.001, base: 'g' },
  g: { family: 'mass', toBase: 1, base: 'g' },
  kg: { family: 'mass', toBase: 1000, base: 'g' },
  ml: { family: 'volume', toBase: 1, base: 'ml' },
  l: { family: 'volume', toBase: 1000, base: 'ml' },
  count: { family: 'count', toBase: 1, base: 'unit' },
};

interface Ranked {
  id: number;
  name: string;
  family: string;
  base: string;
  unitPrice: number; // price per base unit
}

let nextId = 4;

export default function UnitPriceCalculatorTool() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: 'Brand A', price: '3.99', qty: '500', unit: 'g' },
    { id: 2, name: 'Brand B', price: '6.49', qty: '1', unit: 'kg' },
    { id: 3, name: 'Brand C', price: '2.49', qty: '250', unit: 'g' },
  ]);

  const update = (id: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { id: nextId++, name: `Item ${prev.length + 1}`, price: '', qty: '', unit: 'g' },
    ]);

  const removeItem = (id: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const result = useMemo(() => {
    const ranked: Ranked[] = [];
    for (const it of items) {
      const price = Number(it.price);
      const qty = Number(it.qty);
      if (it.price.trim() === '' || it.qty.trim() === '') continue;
      if (!Number.isFinite(price) || price < 0) {
        return { error: `"${it.name || 'Item'}" has an invalid price.` as string };
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return { error: `"${it.name || 'Item'}" needs a positive quantity.` };
      }
      const info = UNIT_INFO[it.unit];
      const baseQty = qty * info.toBase;
      ranked.push({
        id: it.id,
        name: it.name.trim() || `Item ${it.id}`,
        family: info.family,
        base: info.base,
        unitPrice: price / baseQty,
      });
    }
    if (ranked.length < 2) {
      return { error: 'Enter price and quantity for at least two items to compare.' };
    }
    const families = new Set(ranked.map((r) => r.family));
    const mixedFamilies = families.size > 1;
    ranked.sort((a, b) => a.unitPrice - b.unitPrice);
    const cheapest = ranked[0];
    const dearest = ranked[ranked.length - 1];
    if (!cheapest || !dearest) return { error: 'Nothing to compare.' };
    const overpay =
      cheapest.unitPrice > 0
        ? ((dearest.unitPrice - cheapest.unitPrice) / cheapest.unitPrice) * 100
        : 0;
    return { ranked, cheapest, dearest, overpay, mixedFamilies };
  }, [items]);

  const fmt = (n: number) => {
    if (n === 0) return '0';
    if (n < 0.01) return n.toPrecision(3);
    if (n < 1) return n.toFixed(4);
    return n.toFixed(4);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Items">
          <Button variant="secondary" size="sm" onClick={addItem}>
            <Plus className="size-3.5" /> Add item
          </Button>
        </PanelHeader>
        <div className="space-y-2 p-3">
          {items.map((it) => (
            <OptionsBar key={it.id}>
              <Field label="Name" className="min-w-[120px] flex-1">
                <Input
                  value={it.name}
                  onChange={(e) => update(it.id, { name: e.target.value })}
                  placeholder="Product"
                />
              </Field>
              <Field label="Price">
                <Input
                  value={it.price}
                  onChange={(e) => update(it.id, { price: e.target.value })}
                  inputMode="decimal"
                  className="w-24 font-mono"
                  placeholder="0.00"
                />
              </Field>
              <Field label="Quantity">
                <Input
                  value={it.qty}
                  onChange={(e) => update(it.id, { qty: e.target.value })}
                  inputMode="decimal"
                  className="w-24 font-mono"
                  placeholder="0"
                />
              </Field>
              <Field label="Unit">
                <Select
                  value={it.unit}
                  onValueChange={(v) => update(it.id, { unit: v as UnitKind })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg">mg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="l">L</SelectItem>
                    <SelectItem value="count">count</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeItem(it.id)}
                aria-label="Remove item"
                disabled={items.length <= 1}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </OptionsBar>
          ))}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Ranked by value (cheapest first)">
            <CopyButton
              value={() =>
                result.ranked
                  .map(
                    (r, i) =>
                      `${i + 1}. ${r.name}: ${fmt(r.unitPrice)} per ${r.base}`,
                  )
                  .join('\n')
              }
            />
          </PanelHeader>
          {result.mixedFamilies && (
            <div className="px-3 pt-2 text-2xs text-amber-600 dark:text-amber-500">
              Note: items use different unit families (mass vs volume vs count); compare with care.
            </div>
          )}
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.ranked.map((r, i) => {
              const isBest = r.id === result.cheapest.id;
              const vsBest =
                result.cheapest.unitPrice > 0
                  ? ((r.unitPrice - result.cheapest.unitPrice) /
                      result.cheapest.unitPrice) *
                    100
                  : 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.name}
                    {isBest && (
                      <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-2xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                        Best
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {isBest ? '—' : `+${vsBest.toFixed(1)}%`}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-sm">
                    <span>
                      {fmt(r.unitPrice)} / {r.base}
                    </span>
                    <CopyButton value={`${fmt(r.unitPrice)} / ${r.base}`} size="icon-sm" />
                  </span>
                </div>
              );
            })}
          </div>
          <StatBar
            items={[
              `Cheapest: ${result.cheapest.name}`,
              `Dearest: ${result.dearest.name}`,
              `Most expensive costs +${result.overpay.toFixed(1)}% over cheapest`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
