'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Shape = 'round' | 'square' | 'rect' | 'loaf';
type Mode = 'single' | 'swap';

const SHAPES: { id: Shape; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'rect', label: 'Rectangular' },
  { id: 'loaf', label: 'Loaf' },
];

interface PanInput {
  shape: Shape;
  d1: string; // diameter (round) / side (square) / length (rect, loaf)
  d2: string; // width (rect, loaf)
  depth: string;
}

interface RefRow {
  name: string;
  inch: string;
  area: string;
}

const REFERENCE: RefRow[] = [
  { name: '8-inch round', inch: '8 in dia', area: '50.3 in²' },
  { name: '9-inch round', inch: '9 in dia', area: '63.6 in²' },
  { name: '8-inch square', inch: '8 × 8 in', area: '64 in²' },
  { name: '9-inch square', inch: '9 × 9 in', area: '81 in²' },
  { name: '9×13 rectangle', inch: '9 × 13 in', area: '117 in²' },
  { name: '8.5×4.5 loaf', inch: '8.5 × 4.5 in', area: '38.25 in²' },
];

function n(s: string): number {
  const v = Number(s.trim());
  return Number.isFinite(v) ? v : NaN;
}

// Returns base area in the chosen length-unit squared, or NaN if invalid.
function area(p: PanInput): number {
  const a = n(p.d1);
  if (!Number.isFinite(a) || a <= 0) return NaN;
  if (p.shape === 'round') return Math.PI * (a / 2) ** 2;
  const b = n(p.d2);
  if (p.shape === 'square') return a * a;
  // rect & loaf both need a second dimension
  if (!Number.isFinite(b) || b <= 0) return NaN;
  return a * b;
}

function fmt(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return (Math.round(x * 100) / 100).toString();
}

export default function CookingPanSizeConverterTool() {
  const [mode, setMode] = useState<Mode>('single');
  const [metric, setMetric] = useState(false); // false = inch, true = cm

  const unit = metric ? 'cm' : 'in';
  const areaUnit = metric ? 'cm²' : 'in²';
  const volUnit = metric ? 'cm³' : 'in³';

  const [pan, setPan] = useState<PanInput>({ shape: 'round', d1: '9', d2: '', depth: '2' });
  const [oldPan, setOldPan] = useState<PanInput>({ shape: 'round', d1: '9', d2: '', depth: '2' });
  const [newPan, setNewPan] = useState<PanInput>({ shape: 'square', d1: '8', d2: '', depth: '2' });

  const single = useMemo(() => {
    const a = area(pan);
    if (!Number.isFinite(a)) return { error: 'Enter valid positive dimensions for the selected shape.' };
    const depth = n(pan.depth);
    const vol = Number.isFinite(depth) && depth > 0 ? a * depth : null;
    return { area: a, vol };
  }, [pan]);

  const swap = useMemo(() => {
    const oa = area(oldPan);
    const na = area(newPan);
    if (!Number.isFinite(oa) || !Number.isFinite(na)) {
      return { error: 'Enter valid positive dimensions for both pans.' };
    }
    return { oldArea: oa, newArea: na, factor: na / oa };
  }, [oldPan, newPan]);

  const needsTwo = (s: Shape) => s === 'rect' || s === 'loaf';

  const renderInputs = (
    p: PanInput,
    set: (u: PanInput) => void,
    keyPrefix: string,
  ) => (
    <>
      <Field label="Shape" className="min-w-[10rem]">
        <Select value={p.shape} onValueChange={(v) => set({ ...p, shape: v as Shape })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHAPES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label={p.shape === 'round' ? `Diameter (${unit})` : p.shape === 'square' ? `Side (${unit})` : `Length (${unit})`}
        className="min-w-[8rem]"
      >
        <Input
          key={`${keyPrefix}-d1`}
          type="text"
          inputMode="decimal"
          value={p.d1}
          onChange={(e) => set({ ...p, d1: e.target.value })}
        />
      </Field>
      {needsTwo(p.shape) ? (
        <Field label={`Width (${unit})`} className="min-w-[8rem]">
          <Input
            key={`${keyPrefix}-d2`}
            type="text"
            inputMode="decimal"
            value={p.d2}
            onChange={(e) => set({ ...p, d2: e.target.value })}
          />
        </Field>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="single">Pan area &amp; volume</TabsTrigger>
          <TabsTrigger value="swap">Swap pan (scale recipe)</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Panel>
            <OptionsBar>
              {renderInputs(pan, setPan, 'single')}
              <Field label={`Depth (${unit})`} hint="For capacity" className="min-w-[8rem]">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pan.depth}
                  onChange={(e) => setPan({ ...pan, depth: e.target.value })}
                />
              </Field>
              <Field label={`Unit: ${unit}`} hint="Toggle inch / cm">
                <Switch checked={metric} onCheckedChange={setMetric} />
              </Field>
            </OptionsBar>
          </Panel>

          {'error' in single ? (
            <ErrorBanner error={single.error} />
          ) : (
            <Panel>
              <PanelHeader title="Pan capacity">
                <CopyButton
                  value={() =>
                    `Base area: ${fmt(single.area)} ${areaUnit}` +
                    (single.vol !== null ? `\nVolume: ${fmt(single.vol)} ${volUnit}` : '')
                  }
                />
              </PanelHeader>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Base area</span>
                  <span className="font-mono text-sm">{fmt(single.area)} {areaUnit}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Capacity (area × depth)</span>
                  <span className="font-mono text-sm">
                    {single.vol !== null ? `${fmt(single.vol)} ${volUnit}` : 'add depth'}
                  </span>
                </div>
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="swap" className="space-y-4">
          <Panel>
            <PanelHeader title="Original pan" />
            <OptionsBar className="rounded-none border-0">
              {renderInputs(oldPan, setOldPan, 'old')}
              <Field label={`Unit: ${unit}`} hint="Toggle inch / cm">
                <Switch checked={metric} onCheckedChange={setMetric} />
              </Field>
            </OptionsBar>
            <PanelHeader title="New pan" />
            <OptionsBar className="rounded-none border-0">
              {renderInputs(newPan, setNewPan, 'new')}
            </OptionsBar>
          </Panel>

          {'error' in swap ? (
            <ErrorBanner error={swap.error} />
          ) : (
            <Panel>
              <PanelHeader title="Recipe scale factor">
                <CopyButton value={`Scale factor: ${swap.factor.toFixed(3)}×`} />
              </PanelHeader>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Old area</span>
                  <span className="font-mono text-sm">{fmt(swap.oldArea)} {areaUnit}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">New area</span>
                  <span className="font-mono text-sm">{fmt(swap.newArea)} {areaUnit}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Scale factor</span>
                  <span className="font-mono text-sm font-semibold">{swap.factor.toFixed(3)}×</span>
                </div>
              </div>
              <StatBar
                items={[
                  `Multiply recipe quantities by ${swap.factor.toFixed(2)}`,
                  swap.factor > 1 ? 'New pan is larger — scale up' : swap.factor < 1 ? 'New pan is smaller — scale down' : 'Same area',
                ]}
              />
            </Panel>
          )}
        </TabsContent>
      </Tabs>

      <Panel>
        <PanelHeader title="Common pan equivalents (by base area)" />
        <div className="divide-y">
          {REFERENCE.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-3 py-2">
              <span className="w-40 shrink-0 text-sm">{r.name}</span>
              <code className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{r.inch}</code>
              <span className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">{r.area}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
