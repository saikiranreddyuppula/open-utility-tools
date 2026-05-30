'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Feature =
  | 'min-width'
  | 'max-width'
  | 'orientation'
  | 'prefers-color-scheme'
  | 'prefers-reduced-motion'
  | 'hover'
  | 'pointer'
  | 'aspect-ratio'
  | 'resolution';

type Combiner = 'and' | 'or';
type Unit = 'px' | 'rem';

interface Row {
  id: number;
  feature: Feature;
  value: string;
}

const FEATURE_VALUES: Partial<Record<Feature, string[]>> = {
  orientation: ['portrait', 'landscape'],
  'prefers-color-scheme': ['light', 'dark'],
  'prefers-reduced-motion': ['reduce', 'no-preference'],
  hover: ['hover', 'none'],
  pointer: ['fine', 'coarse', 'none'],
};

const WIDTH_FEATURES: Feature[] = ['min-width', 'max-width'];

const PRESETS: { label: string; value: number }[] = [
  { label: 'sm', value: 640 },
  { label: 'md', value: 768 },
  { label: 'lg', value: 1024 },
  { label: 'xl', value: 1280 },
  { label: '2xl', value: 1536 },
];

let nextId = 10;

export default function MediaQueryBuilderTool() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, feature: 'min-width', value: '768' },
    { id: 2, feature: 'orientation', value: 'portrait' },
  ]);
  const [combiner, setCombiner] = useState<Combiner>('and');
  const [unit, setUnit] = useState<Unit>('px');
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeMin, setRangeMin] = useState('768');
  const [rangeMax, setRangeMax] = useState('1023');

  const addRow = () =>
    setRows((r) => [...r, { id: nextId++, feature: 'min-width', value: '' }]);

  const formatWidth = (raw: string): string => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw.trim();
    return unit === 'rem' ? `${n / 16}rem` : `${n}px`;
  };

  const conditions = useMemo<string[]>(() => {
    if (rangeMode) {
      const parts: string[] = [];
      if (rangeMin.trim()) parts.push(`(min-width: ${formatWidth(rangeMin)})`);
      if (rangeMax.trim()) parts.push(`(max-width: ${formatWidth(rangeMax)})`);
      return parts;
    }
    const out: string[] = [];
    for (const r of rows) {
      const v = r.value.trim();
      if (!v) continue;
      if (WIDTH_FEATURES.includes(r.feature)) {
        out.push(`(${r.feature}: ${formatWidth(v)})`);
      } else {
        out.push(`(${r.feature}: ${v})`);
      }
    }
    return out;
  }, [rows, rangeMode, rangeMin, rangeMax, unit]);

  const query = useMemo(() => {
    if (conditions.length === 0) {
      return '@media screen {\n  /* add at least one condition */\n}';
    }
    if (rangeMode || combiner === 'and') {
      return `@media ${conditions.join(' and ')} {\n  /* your styles */\n}`;
    }
    // comma = OR
    return `@media ${conditions.join(', ')} {\n  /* your styles */\n}`;
  }, [conditions, combiner, rangeMode]);

  const fillPresets = () => {
    setRangeMode(false);
    setRows(PRESETS.map((p, i) => ({ id: 100 + i, feature: 'min-width' as Feature, value: String(p.value) })));
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Conditions" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Unit">
              <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <TabsList>
                  <TabsTrigger value="px">px</TabsTrigger>
                  <TabsTrigger value="rem">rem</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Combine with">
              <Tabs value={combiner} onValueChange={(v) => setCombiner(v as Combiner)}>
                <TabsList>
                  <TabsTrigger value="and">and</TabsTrigger>
                  <TabsTrigger value="or">comma (or)</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Range mode (min+max)">
              <Switch checked={rangeMode} onCheckedChange={setRangeMode} />
            </Field>
            <div className="ml-auto flex items-end">
              <Button variant="secondary" size="sm" onClick={fillPresets}>
                Common breakpoints
              </Button>
            </div>
          </OptionsBar>

          {rangeMode ? (
            <OptionsBar>
              <Field label={`Min width (${unit})`}>
                <Input value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} className="w-32 font-mono" inputMode="numeric" />
              </Field>
              <Field label={`Max width (${unit})`}>
                <Input value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} className="w-32 font-mono" inputMode="numeric" />
              </Field>
              <div className="flex flex-wrap items-end gap-1">
                {PRESETS.map((p) => (
                  <Button key={p.label} variant="outline" size="sm" onClick={() => setRangeMin(String(p.value))}>
                    {p.label} ≥{p.value}
                  </Button>
                ))}
              </div>
            </OptionsBar>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((r) => {
                const choices = FEATURE_VALUES[r.feature];
                return (
                  <div key={r.id} className="flex items-center gap-2">
                    <Select
                      value={r.feature}
                      onValueChange={(v) =>
                        setRows((arr) =>
                          arr.map((x) => {
                            if (x.id !== r.id) return x;
                            const nf = v as Feature;
                            const defaults = FEATURE_VALUES[nf];
                            return { ...x, feature: nf, value: defaults?.[0] ?? '' };
                          }),
                        )
                      }
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            'min-width',
                            'max-width',
                            'orientation',
                            'prefers-color-scheme',
                            'prefers-reduced-motion',
                            'hover',
                            'pointer',
                            'aspect-ratio',
                            'resolution',
                          ] as Feature[]
                        ).map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {choices ? (
                      <Select
                        value={r.value || (choices[0] ?? '')}
                        onValueChange={(v) =>
                          setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, value: v } : x)))
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {choices.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={r.value}
                        onChange={(e) =>
                          setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))
                        }
                        placeholder={
                          WIDTH_FEATURES.includes(r.feature)
                            ? unit === 'rem'
                              ? '48 (number)'
                              : '768 (number)'
                            : r.feature === 'aspect-ratio'
                              ? '16/9'
                              : '2dppx'
                        }
                        className="w-48 font-mono"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRows((arr) => arr.filter((x) => x.id !== r.id))}
                      aria-label="Remove condition"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
              <div>
                <Button variant="secondary" size="sm" onClick={addRow}>
                  <Plus className="size-3.5" /> Add condition
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="@media query">
          <CopyButton value={() => query} label="Copy" />
          <DownloadButton data={() => query} filename="media-query.css" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {query}
        </pre>
        <StatBar
          items={[
            `${conditions.length} condition${conditions.length === 1 ? '' : 's'}`,
            rangeMode ? 'range' : combiner,
            `unit: ${unit}`,
          ]}
        />
      </Panel>
    </div>
  );
}
