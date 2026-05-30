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

type Mode = 'half-up' | 'half-even' | 'truncate';

const MODE_LABELS: Record<Mode, string> = {
  'half-up': 'Round half up',
  'half-even': "Banker's (half to even)",
  truncate: 'Truncate (toward zero)',
};

/** Count significant figures in a raw numeric string using standard rules. */
function countSigFigs(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  // Strip a leading sign.
  let body = s.replace(/^[+-]/, '');
  // Handle scientific notation: mantissa carries the sig figs.
  const expMatch = body.match(/^([0-9.]+)[eE][+-]?[0-9]+$/);
  if (expMatch && expMatch[1] !== undefined) {
    body = expMatch[1];
  } else if (/[eE]/.test(body)) {
    return null;
  }
  if (!/^[0-9]*\.?[0-9]*$/.test(body) || !/[0-9]/.test(body)) return null;

  const hasDecimal = body.includes('.');
  if (hasDecimal) {
    // Remove the decimal point, then strip leading zeros only.
    const digits = body.replace('.', '');
    const trimmed = digits.replace(/^0+/, '');
    // If everything was zeros (e.g. 0.000), there is effectively 1 sig fig
    // counting trailing zeros after a decimal as significant.
    if (trimmed === '') {
      // e.g. 0.00 -> the trailing zeros after the decimal are significant.
      const afterDot = body.split('.')[1] ?? '';
      return Math.max(1, afterDot.length);
    }
    return trimmed.length;
  }
  // Integer with no decimal point: trailing zeros are ambiguous; by the common
  // convention they are NOT counted as significant.
  const noLeading = body.replace(/^0+/, '');
  if (noLeading === '') return 1; // the number is zero
  const noTrailing = noLeading.replace(/0+$/, '');
  return noTrailing.length === 0 ? 1 : noTrailing.length;
}

/** Round `value` to `sig` significant figures using the chosen mode. */
function roundSig(value: number, sig: number, mode: Mode): number {
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - d; // number of digits to the right of the rounding place
  const factor = Math.pow(10, power);
  const scaled = value * factor;

  let rounded: number;
  switch (mode) {
    case 'truncate':
      rounded = Math.trunc(scaled);
      break;
    case 'half-up': {
      // Round half away from zero.
      rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
      break;
    }
    case 'half-even': {
      const floor = Math.floor(scaled);
      const diff = scaled - floor;
      if (diff < 0.5) rounded = floor;
      else if (diff > 0.5) rounded = floor + 1;
      else rounded = floor % 2 === 0 ? floor : floor + 1;
      break;
    }
    default:
      rounded = Math.round(scaled);
      break;
  }
  return rounded / factor;
}

function toPlain(n: number, sig: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  // Use toPrecision then strip artefacts, but keep it readable.
  const p = n.toPrecision(Math.min(Math.max(sig, 1), 100));
  // toPrecision may use exponential for very large/small; convert back if reasonable.
  const num = Number(p);
  if (Math.abs(num) >= 1e-6 && Math.abs(num) < 1e21) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 20, useGrouping: false });
  }
  return p;
}

function toScientific(n: number, sig: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  return n.toExponential(Math.max(sig - 1, 0));
}

export default function SignificantFiguresRounderTool() {
  const [input, setInput] = useState('0.0045678');
  const [sig, setSig] = useState('3');
  const [mode, setMode] = useState<Mode>('half-up');

  const result = useMemo(() => {
    const value = Number(input.trim());
    if (input.trim() === '' || !Number.isFinite(value)) {
      return { error: 'Enter a valid number.' };
    }
    const sigN = Math.trunc(Number(sig));
    if (!Number.isFinite(sigN) || sigN < 1 || sigN > 15) {
      return { error: 'Significant figures must be a whole number between 1 and 15.' };
    }

    const rounded = roundSig(value, sigN, mode);
    const original = countSigFigs(input);

    const absErr = Math.abs(rounded - value);
    const relErr = value === 0 ? 0 : (absErr / Math.abs(value)) * 100;

    const rows: { label: string; value: string }[] = [
      { label: `Rounded (${sigN} sig figs)`, value: toPlain(rounded, sigN) },
      { label: 'Scientific notation', value: toScientific(rounded, sigN) },
      {
        label: 'Sig figs in original',
        value: original === null ? 'ambiguous / N/A' : String(original),
      },
      { label: 'Absolute error', value: absErr === 0 ? '0' : absErr.toExponential(4) },
      { label: 'Relative error', value: `${relErr.toExponential(4)} %` },
    ];

    return { rows, value, original, sigN };
  }, [input, sig, mode]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode="decimal"
              className="w-44 font-mono"
              placeholder="e.g. 0.0045678"
            />
          </Field>
          <Field label="Significant figures">
            <Input
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Rounding mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-56">
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
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Input = ${result.value}`,
              `Target = ${result.sigN} sig figs`,
              `Mode: ${MODE_LABELS[mode]}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
