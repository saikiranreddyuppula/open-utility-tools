'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'every' | 'specific' | 'interval' | 'range';

interface FieldState {
  mode: Mode;
  specific: string;
  intervalStep: string;
  rangeFrom: string;
  rangeTo: string;
}

interface FieldDef {
  key: 'minute' | 'hour' | 'day' | 'month' | 'weekday';
  label: string;
  min: number;
  max: number;
  names?: string[];
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FIELD_DEFS: FieldDef[] = [
  { key: 'minute', label: 'Minute', min: 0, max: 59 },
  { key: 'hour', label: 'Hour', min: 0, max: 23 },
  { key: 'day', label: 'Day of month', min: 1, max: 31 },
  { key: 'month', label: 'Month', min: 1, max: 12, names: MONTH_NAMES },
  { key: 'weekday', label: 'Day of week', min: 0, max: 6, names: WEEKDAY_NAMES },
];

const DEFAULTS: Record<FieldDef['key'], FieldState> = {
  minute: { mode: 'specific', specific: '0', intervalStep: '5', rangeFrom: '0', rangeTo: '30' },
  hour: { mode: 'every', specific: '0', intervalStep: '2', rangeFrom: '9', rangeTo: '17' },
  day: { mode: 'every', specific: '1', intervalStep: '2', rangeFrom: '1', rangeTo: '15' },
  month: { mode: 'every', specific: '1', intervalStep: '2', rangeFrom: '1', rangeTo: '6' },
  weekday: { mode: 'every', specific: '1', intervalStep: '2', rangeFrom: '1', rangeTo: '5' },
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function fieldToken(def: FieldDef, state: FieldState): string {
  switch (state.mode) {
    case 'every':
      return '*';
    case 'specific':
      return String(clampInt(state.specific, def.min, def.max, def.min));
    case 'interval': {
      const step = clampInt(state.intervalStep, 1, def.max - def.min || 1, 1);
      return `*/${step}`;
    }
    case 'range': {
      const from = clampInt(state.rangeFrom, def.min, def.max, def.min);
      const to = clampInt(state.rangeTo, def.min, def.max, def.max);
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      return `${lo}-${hi}`;
    }
    default:
      return '*';
  }
}

function nameFor(def: FieldDef, value: number): string {
  if (def.names) {
    const idx = def.key === 'weekday' ? value : value - def.min;
    return def.names[idx] ?? String(value);
  }
  return String(value);
}

function describeField(def: FieldDef, state: FieldState): string {
  switch (state.mode) {
    case 'every':
      return `every ${def.label.toLowerCase()}`;
    case 'specific': {
      const v = clampInt(state.specific, def.min, def.max, def.min);
      return `${def.label.toLowerCase()} ${nameFor(def, v)}`;
    }
    case 'interval': {
      const step = clampInt(state.intervalStep, 1, def.max - def.min || 1, 1);
      return `every ${step} ${def.label.toLowerCase()}${step === 1 ? '' : 's'}`;
    }
    case 'range': {
      const from = clampInt(state.rangeFrom, def.min, def.max, def.min);
      const to = clampInt(state.rangeTo, def.min, def.max, def.max);
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      return `${def.label.toLowerCase()} ${nameFor(def, lo)} through ${nameFor(def, hi)}`;
    }
    default:
      return '';
  }
}

export default function CronExpressionBuilder() {
  const [states, setStates] = useState<Record<FieldDef['key'], FieldState>>(DEFAULTS);

  const update = (key: FieldDef['key'], patch: Partial<FieldState>) => {
    setStates((prev) => {
      const current = prev[key];
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const expression = useMemo(() => {
    return FIELD_DEFS.map((def) => fieldToken(def, states[def.key])).join(' ');
  }, [states]);

  const summary = useMemo(() => {
    const parts = FIELD_DEFS.map((def) => describeField(def, states[def.key]));
    return `Runs at ${parts.join(', ')}.`;
  }, [states]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Schedule fields" />
        <div className="flex flex-col gap-4">
          {FIELD_DEFS.map((def) => {
            const state = states[def.key];
            return (
              <div
                key={def.key}
                className="grid grid-cols-1 gap-3 border-b border-border pb-4 last:border-0 last:pb-0 sm:grid-cols-[160px_1fr]"
              >
                <Field label={def.label} hint={`${def.min}-${def.max}`}>
                  <Select
                    value={state.mode}
                    onValueChange={(v) => update(def.key, { mode: v as Mode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every">Every</SelectItem>
                      <SelectItem value="specific">Specific</SelectItem>
                      <SelectItem value="interval">Every N</SelectItem>
                      <SelectItem value="range">Range</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="flex items-end gap-2">
                  {state.mode === 'specific' && (
                    <Field label="Value" className="w-full">
                      <Input
                        type="number"
                        min={def.min}
                        max={def.max}
                        value={state.specific}
                        onChange={(e) => update(def.key, { specific: e.target.value })}
                      />
                    </Field>
                  )}
                  {state.mode === 'interval' && (
                    <Field label="Step" className="w-full">
                      <Input
                        type="number"
                        min={1}
                        max={def.max}
                        value={state.intervalStep}
                        onChange={(e) => update(def.key, { intervalStep: e.target.value })}
                      />
                    </Field>
                  )}
                  {state.mode === 'range' && (
                    <>
                      <Field label="From" className="w-full">
                        <Input
                          type="number"
                          min={def.min}
                          max={def.max}
                          value={state.rangeFrom}
                          onChange={(e) => update(def.key, { rangeFrom: e.target.value })}
                        />
                      </Field>
                      <Field label="To" className="w-full">
                        <Input
                          type="number"
                          min={def.min}
                          max={def.max}
                          value={state.rangeTo}
                          onChange={(e) => update(def.key, { rangeTo: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  {state.mode === 'every' && (
                    <p className="text-sm text-muted-foreground">No extra options.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Cron expression">
          <CopyButton value={expression} />
        </PanelHeader>
        <OptionsBar>
          <code className="block w-full break-all rounded-md bg-muted px-3 py-2 font-mono text-base">
            {expression}
          </code>
        </OptionsBar>
        <p className="mt-3 text-sm text-muted-foreground">{summary}</p>
        <StatBar items={['minute hour day month weekday', `${expression.split(' ').length} fields`]} />
      </Panel>
    </div>
  );
}
