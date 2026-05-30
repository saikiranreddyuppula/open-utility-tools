'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Panel,
  PanelHeader,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Timing =
  | 'ease'
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'step-start'
  | 'step-end'
  | 'custom';

const TIMINGS: Timing[] = [
  'ease',
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'custom',
];

const PROPERTY_PRESETS = [
  'all',
  'transform',
  'opacity',
  'background-color',
  'color',
  'box-shadow',
  'width',
  'height',
  'custom',
];

interface Row {
  id: number;
  property: string; // preset key or 'custom'
  customProperty: string;
  duration: string; // e.g. 300ms / 0.3s
  timing: Timing;
  customBezier: string;
  delay: string;
}

let rowId = 0;
const mkRow = (property: string, duration: string, timing: Timing): Row => ({
  id: rowId++,
  property,
  customProperty: '',
  duration,
  timing,
  customBezier: 'cubic-bezier(0.4, 0, 0.2, 1)',
  delay: '0ms',
});

function resolveProperty(r: Row): string {
  return r.property === 'custom' ? r.customProperty.trim() || 'all' : r.property;
}

function resolveTiming(r: Row): string {
  return r.timing === 'custom' ? r.customBezier.trim() || 'ease' : r.timing;
}

function normalizeTime(raw: string): string {
  const t = raw.trim();
  if (!t) return '0s';
  if (/^(ms|s)$/i.test(t)) return '0s';
  if (/(ms|s)$/i.test(t)) return t;
  // bare number → treat as ms
  const n = Number(t);
  if (Number.isFinite(n)) return `${n}ms`;
  return t;
}

export default function TransitionGeneratorTool() {
  const [rows, setRows] = useState<Row[]>(() => [
    mkRow('transform', '300ms', 'ease-out'),
    mkRow('opacity', '200ms', 'ease-in'),
  ]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const add = () => setRows((rs) => [...rs, mkRow('all', '250ms', 'ease')]);

  const built = useMemo(() => {
    const entries = rows.map((r) => {
      const prop = resolveProperty(r);
      const dur = normalizeTime(r.duration);
      const tf = resolveTiming(r);
      const delay = normalizeTime(r.delay);
      return { prop, dur, tf, delay };
    });
    const shorthandValue = entries
      .map((e) => `${e.prop} ${e.dur} ${e.tf} ${e.delay}`)
      .join(', ');
    const longhand =
      `transition-property: ${entries.map((e) => e.prop).join(', ')};\n` +
      `transition-duration: ${entries.map((e) => e.dur).join(', ')};\n` +
      `transition-timing-function: ${entries.map((e) => e.tf).join(', ')};\n` +
      `transition-delay: ${entries.map((e) => e.delay).join(', ')};`;
    const shorthand = `transition: ${shorthandValue || 'none'};`;
    return { shorthand, shorthandValue, longhand };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Transition rows">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {rows.map((r, i) => (
            <div key={r.id} className="flex flex-wrap items-end gap-3 px-3 py-3">
              <span className="w-5 shrink-0 font-mono text-2xs text-muted-foreground">
                {i + 1}
              </span>
              <Field label="Property">
                <Select value={r.property} onValueChange={(v) => update(r.id, { property: v })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_PRESETS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {r.property === 'custom' && (
                <Field label="Custom property">
                  <Input
                    value={r.customProperty}
                    onChange={(e) => update(r.id, { customProperty: e.target.value })}
                    placeholder="margin-top"
                    className="w-40 font-mono"
                  />
                </Field>
              )}
              <Field label="Duration">
                <Input
                  value={r.duration}
                  onChange={(e) => update(r.id, { duration: e.target.value })}
                  placeholder="300ms"
                  className="w-24 font-mono"
                />
              </Field>
              <Field label="Timing">
                <Select
                  value={r.timing}
                  onValueChange={(v) => update(r.id, { timing: v as Timing })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMINGS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {r.timing === 'custom' && (
                <Field label="cubic-bezier">
                  <Input
                    value={r.customBezier}
                    onChange={(e) => update(r.id, { customBezier: e.target.value })}
                    className="w-52 font-mono"
                  />
                </Field>
              )}
              <Field label="Delay">
                <Input
                  value={r.delay}
                  onChange={(e) => update(r.id, { delay: e.target.value })}
                  placeholder="0ms"
                  className="w-24 font-mono"
                />
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(r.id)}
                aria-label="Remove row"
                className="ml-auto"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No rows — add at least one transition.
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Live preview (hover the box)" />
        <div className="flex min-h-[160px] items-center justify-center p-8">
          <div
            className="flex h-24 w-40 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:scale-110 hover:rotate-3 hover:opacity-70"
            style={{ transition: built.shorthandValue || 'none' }}
          >
            Hover me
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Shorthand">
          <CopyButton value={built.shorthand} />
        </PanelHeader>
        <div className="flex items-center gap-2 p-3">
          <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
            {built.shorthand}
          </code>
          <CopyButton value={built.shorthand} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Longhand">
          <CopyButton value={built.longhand} />
        </PanelHeader>
        <pre className="overflow-x-auto p-3 font-mono text-sm leading-relaxed">
          {built.longhand}
        </pre>
        <StatBar items={[`${rows.length} transitions`]} />
      </Panel>
    </div>
  );
}
