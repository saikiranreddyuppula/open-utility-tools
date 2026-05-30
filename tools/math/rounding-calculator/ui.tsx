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

type Target = 'decimals' | 'sigfigs' | 'multiple';
type Mode = 'half-up' | 'half-even' | 'ceil' | 'floor' | 'truncate';

const TARGET_LABELS: Record<Target, string> = {
  decimals: 'Decimal places',
  sigfigs: 'Significant figures',
  multiple: 'Nearest multiple',
};

const MODE_LABELS: Record<Mode, string> = {
  'half-up': 'Half up (round-half-away)',
  'half-even': "Half to even (banker's)",
  ceil: 'Ceiling (up)',
  floor: 'Floor (down)',
  truncate: 'Truncate (toward zero)',
};

// Round a value to the nearest integer using the selected tie-breaking mode.
function roundInt(x: number, mode: Mode): number {
  switch (mode) {
    case 'ceil':
      return Math.ceil(x);
    case 'floor':
      return Math.floor(x);
    case 'truncate':
      return Math.trunc(x);
    case 'half-up': {
      // Round half away from zero.
      return Math.sign(x) * Math.round(Math.abs(x));
    }
    case 'half-even': {
      const floor = Math.floor(x);
      const diff = x - floor;
      if (diff < 0.5) return floor;
      if (diff > 0.5) return floor + 1;
      // Exactly .5 → round to even neighbour.
      return floor % 2 === 0 ? floor : floor + 1;
    }
    default:
      return Math.round(x);
  }
}

function roundDecimals(x: number, places: number, mode: Mode): number {
  const factor = Math.pow(10, places);
  return roundInt(x * factor, mode) / factor;
}

function roundSigFigs(x: number, figs: number, mode: Mode): number {
  if (x === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(x)));
  const power = figs - d;
  const factor = Math.pow(10, power);
  return roundInt(x * factor, mode) / factor;
}

function roundMultiple(x: number, m: number, mode: Mode): number {
  return roundInt(x / m, mode) * m;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  // Keep precision but avoid noisy floating artefacts.
  return Number(n.toPrecision(15)).toLocaleString(undefined, { maximumFractionDigits: 12 });
}

export default function RoundingCalculatorTool() {
  const [value, setValue] = useState('3.14159265');
  const [target, setTarget] = useState<Target>('decimals');
  const [n, setN] = useState('2');
  const [mode, setMode] = useState<Mode>('half-up');

  const result = useMemo(() => {
    const x = Number(value);
    const k = Number(n);

    if (!Number.isFinite(x)) return { error: 'Enter a valid number to round.' };
    if (!Number.isFinite(k)) return { error: 'Enter a valid target value.' };

    if (target === 'decimals' && (!Number.isInteger(k) || k < 0 || k > 100)) {
      return { error: 'Decimal places must be a whole number from 0 to 100.' };
    }
    if (target === 'sigfigs' && (!Number.isInteger(k) || k < 1 || k > 100)) {
      return { error: 'Significant figures must be a whole number from 1 to 100.' };
    }
    if (target === 'multiple' && k <= 0) {
      return { error: 'The multiple must be greater than zero.' };
    }

    const applyMode = (m: Mode): number => {
      switch (target) {
        case 'decimals':
          return roundDecimals(x, k, m);
        case 'sigfigs':
          return roundSigFigs(x, k, m);
        case 'multiple':
          return roundMultiple(x, k, m);
        default:
          return x;
      }
    };

    const chosen = applyMode(mode);
    const error = chosen - x;

    const allModes = (Object.keys(MODE_LABELS) as Mode[]).map((m) => ({
      label: MODE_LABELS[m],
      value: fmt(applyMode(m)),
      active: m === mode,
    }));

    return {
      rows: [
        { label: 'Rounded value', value: fmt(chosen) },
        { label: 'Rounding error', value: fmt(error) },
        { label: 'Original', value: fmt(x) },
      ],
      allModes,
    };
  }, [value, target, n, mode]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              className="w-40 font-mono"
            />
          </Field>
          <Field label="Round to">
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TARGET_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={target === 'multiple' ? 'Multiple' : 'Count'}>
            <Input
              value={n}
              onChange={(e) => setN(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton
                value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`${TARGET_LABELS[target]}: ${n}`, MODE_LABELS[mode]]} />
          </Panel>

          <Panel>
            <PanelHeader title="All rounding modes" />
            <div className="divide-y">
              {result.allModes.map((m) => (
                <div
                  key={m.label}
                  className={
                    m.active
                      ? 'flex items-center justify-between gap-3 bg-muted/40 px-3 py-2'
                      : 'flex items-center justify-between gap-3 px-3 py-2'
                  }
                >
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{m.value}</span>
                    <CopyButton value={m.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
