'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

type FieldKey = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

interface FieldDef {
  key: FieldKey;
  label: string;
  min: number;
  max: number;
  options?: { value: number; label: string }[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FIELDS: FieldDef[] = [
  { key: 'minute', label: 'Minute', min: 0, max: 59 },
  { key: 'hour', label: 'Hour', min: 0, max: 23 },
  { key: 'dom', label: 'Day of month', min: 1, max: 31 },
  {
    key: 'month',
    label: 'Month',
    min: 1,
    max: 12,
    options: MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name })),
  },
  {
    key: 'dow',
    label: 'Day of week',
    min: 0,
    max: 6,
    options: DOW_NAMES.map((name, i) => ({ value: i, label: name })),
  },
];

type Mode = 'every' | 'value' | 'step';

interface FieldState {
  mode: Mode;
  value: number;
  step: number;
}

const DEFAULT_STATE: Record<FieldKey, FieldState> = {
  minute: { mode: 'every', value: 0, step: 5 },
  hour: { mode: 'every', value: 0, step: 1 },
  dom: { mode: 'every', value: 1, step: 1 },
  month: { mode: 'every', value: 1, step: 1 },
  dow: { mode: 'every', value: 0, step: 1 },
};

function rangeOptions(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i += 1) out.push(i);
  return out;
}

function fieldToken(state: FieldState): string {
  switch (state.mode) {
    case 'every':
      return '*';
    case 'value':
      return String(state.value);
    case 'step':
      return `*/${state.step}`;
  }
}

function describeField(def: FieldDef, state: FieldState): string {
  const labelFor = (v: number): string => {
    const opt = def.options?.find((o) => o.value === v);
    return opt ? opt.label : String(v);
  };
  switch (state.mode) {
    case 'every':
      return `every ${def.label.toLowerCase()}`;
    case 'value':
      return `at ${def.label.toLowerCase()} ${labelFor(state.value)}`;
    case 'step':
      return `every ${state.step} ${def.label.toLowerCase()}${state.step === 1 ? '' : 's'}`;
  }
}

export default function CronBuilderTool() {
  const [state, setState] = useState<Record<FieldKey, FieldState>>(DEFAULT_STATE);

  const update = (key: FieldKey, patch: Partial<FieldState>) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const expression = useMemo(() => {
    return FIELDS.map((f) => fieldToken(state[f.key])).join(' ');
  }, [state]);

  const description = useMemo(() => {
    const parts = FIELDS.map((f) => describeField(f, state[f.key]));
    return `Runs ${parts.join(', ')}.`;
  }, [state]);

  return (
    <div className="space-y-4">
      <Panel title="Schedule fields">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => {
            const fs = state[f.key];
            return (
              <Field key={f.key} label={f.label}>
                <div className="space-y-2">
                  <Select
                    value={fs.mode}
                    onValueChange={(v) => update(f.key, { mode: v as Mode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every">Every</SelectItem>
                      <SelectItem value="value">Specific</SelectItem>
                      <SelectItem value="step">Every N</SelectItem>
                    </SelectContent>
                  </Select>

                  {fs.mode === 'value' ? (
                    <Select
                      value={String(fs.value)}
                      onValueChange={(v) => update(f.key, { value: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rangeOptions(f.min, f.max).map((n) => {
                          const opt = f.options?.find((o) => o.value === n);
                          return (
                            <SelectItem key={n} value={String(n)}>
                              {opt ? opt.label : String(n)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {fs.mode === 'step' ? (
                    <Select
                      value={String(fs.step)}
                      onValueChange={(v) => update(f.key, { step: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rangeOptions(Math.max(1, f.min), f.max).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </Field>
            );
          })}
        </div>
      </Panel>

      <Panel title="Cron expression">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <code className="rounded bg-muted px-3 py-2 font-mono text-lg">{expression}</code>
            <CopyButton value={expression} />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">
            Field order: minute, hour, day-of-month, month, day-of-week.
          </p>
        </div>
      </Panel>
    </div>
  );
}
