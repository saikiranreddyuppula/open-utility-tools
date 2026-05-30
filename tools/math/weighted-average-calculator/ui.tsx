'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface Row {
  id: number;
  label: string;
  value: string;
  weight: string;
}

interface Contribution {
  id: number;
  label: string;
  value: number;
  weight: number;
  pctOfWeight: number;
  contribution: number; // value * (weight / totalWeight)
}

let nextId = 5;

export default function WeightedAverageTool() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, label: 'Exam', value: '85', weight: '40' },
    { id: 2, label: 'Coursework', value: '92', weight: '35' },
    { id: 3, label: 'Quizzes', value: '78', weight: '15' },
    { id: 4, label: 'Participation', value: '95', weight: '10' },
  ]);
  const [normalize, setNormalize] = useState(false);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: nextId++, label: `Item ${prev.length + 1}`, value: '', weight: '' },
    ]);

  const removeRow = (id: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const result = useMemo(() => {
    const parsed: { id: number; label: string; value: number; weight: number }[] = [];
    for (const r of rows) {
      if (r.value.trim() === '' && r.weight.trim() === '') continue;
      const v = Number(r.value);
      const w = Number(r.weight);
      if (!Number.isFinite(v)) return { error: `"${r.label || 'Item'}" has an invalid value.` as string };
      if (!Number.isFinite(w)) return { error: `"${r.label || 'Item'}" has an invalid weight.` };
      if (w < 0) return { error: `Weights must be non-negative ("${r.label || 'Item'}").` };
      parsed.push({ id: r.id, label: r.label.trim() || `Item ${r.id}`, value: v, weight: w });
    }
    if (parsed.length === 0) return { error: 'Add at least one value-weight pair.' };
    const totalWeight = parsed.reduce((s, p) => s + p.weight, 0);
    if (totalWeight <= 0) return { error: 'Total weight must be greater than zero.' };

    const weightedSum = parsed.reduce((s, p) => s + p.value * p.weight, 0);
    const weightedAvg = weightedSum / totalWeight;
    const simpleAvg = parsed.reduce((s, p) => s + p.value, 0) / parsed.length;

    const contributions: Contribution[] = parsed.map((p) => ({
      id: p.id,
      label: p.label,
      value: p.value,
      weight: p.weight,
      pctOfWeight: (p.weight / totalWeight) * 100,
      contribution: p.value * (p.weight / totalWeight),
    }));

    return { weightedAvg, simpleAvg, totalWeight, contributions, count: parsed.length };
  }, [rows]);

  const fmt = (n: number) => (Math.round(n * 1e4) / 1e4).toString();

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Value & weight pairs">
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus className="size-3.5" /> Add row
          </Button>
        </PanelHeader>
        <div className="space-y-2 p-3">
          {rows.map((r) => (
            <OptionsBar key={r.id}>
              <Field label="Label" className="min-w-[120px] flex-1">
                <Input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} placeholder="Item" />
              </Field>
              <Field label="Value">
                <Input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} inputMode="decimal" className="w-24 font-mono" placeholder="0" />
              </Field>
              <Field label="Weight">
                <Input value={r.weight} onChange={(e) => update(r.id, { weight: e.target.value })} inputMode="decimal" className="w-24 font-mono" placeholder="0" />
              </Field>
              <Button variant="ghost" size="icon-sm" onClick={() => removeRow(r.id)} aria-label="Remove row" disabled={rows.length <= 1}>
                <Trash2 className="size-3.5" />
              </Button>
            </OptionsBar>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={normalize} onCheckedChange={setNormalize} id="normalize" />
            <label htmlFor="normalize" className="text-sm text-muted-foreground">
              Show weights normalized to 100%
            </label>
          </div>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Weighted average">
            <CopyButton value={() => fmt(result.weightedAvg)} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">Weighted average</span>
              <span className="font-mono text-lg">{fmt(result.weightedAvg)}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">Simple average</span>
              <span className="font-mono text-lg">{fmt(result.simpleAvg)}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">Total weight</span>
              <span className="font-mono text-lg">{fmt(result.totalWeight)}</span>
            </div>
          </div>
          <div className="border-t">
            <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="min-w-0 flex-1">Item</span>
              <span className="w-20 text-right">Value</span>
              <span className="w-20 text-right">{normalize ? 'Weight %' : 'Weight'}</span>
              <span className="w-24 text-right">Contribution</span>
            </div>
            <div className="max-h-[320px] divide-y overflow-auto">
              {result.contributions.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
                  <span className="min-w-0 flex-1 truncate font-sans">{c.label}</span>
                  <span className="w-20 text-right">{fmt(c.value)}</span>
                  <span className="w-20 text-right text-muted-foreground">
                    {normalize ? `${fmt(c.pctOfWeight)}%` : fmt(c.weight)}
                  </span>
                  <span className="w-24 text-right">{fmt(c.contribution)}</span>
                </div>
              ))}
            </div>
          </div>
          <StatBar
            items={[
              `${result.count} items`,
              `Weighted = ${fmt(result.weightedAvg)}`,
              `Simple = ${fmt(result.simpleAvg)}`,
              `ΣWeight = ${fmt(result.totalWeight)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
