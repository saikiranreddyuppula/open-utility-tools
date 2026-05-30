'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Mode = 'increase' | 'decrease' | 'reverse-increase' | 'reverse-decrease';

interface Ok {
  ok: true;
  rows: { label: string; value: string }[];
  summary: string;
}

interface Err {
  ok: false;
  error: string;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function PercentIncreaseDecreaseTool() {
  const [valueRaw, setValueRaw] = useState('200');
  const [pctRaw, setPctRaw] = useState('25');
  const [mode, setMode] = useState<Mode>('increase');

  const result = useMemo<Ok | Err>(() => {
    const v = Number(valueRaw);
    const p = Number(pctRaw);
    if (!Number.isFinite(v) || !Number.isFinite(p)) {
      return { ok: false, error: 'Enter valid numbers for the value and percentage.' };
    }

    const frac = p / 100;

    if (mode === 'increase') {
      const out = v * (1 + frac);
      const change = out - v;
      return {
        ok: true,
        rows: [
          { label: 'Result', value: fmt(out) },
          { label: 'Change amount', value: `+${fmt(change)}` },
          { label: 'Multiplier', value: `×${fmt(1 + frac)}` },
        ],
        summary: `${fmt(v)} increased by ${fmt(p)}% = ${fmt(out)}.`,
      };
    }
    if (mode === 'decrease') {
      const out = v * (1 - frac);
      const change = out - v;
      return {
        ok: true,
        rows: [
          { label: 'Result', value: fmt(out) },
          { label: 'Change amount', value: `${change >= 0 ? '+' : ''}${fmt(change)}` },
          { label: 'Multiplier', value: `×${fmt(1 - frac)}` },
        ],
        summary: `${fmt(v)} decreased by ${fmt(p)}% = ${fmt(out)}.`,
      };
    }
    if (mode === 'reverse-increase') {
      const denom = 1 + frac;
      if (denom === 0) return { ok: false, error: 'Cannot reverse a -100% increase (division by zero).' };
      const original = v / denom;
      return {
        ok: true,
        rows: [
          { label: 'Original (pre-increase)', value: fmt(original) },
          { label: 'Amount added', value: `+${fmt(v - original)}` },
          { label: 'Divisor', value: `÷${fmt(denom)}` },
        ],
        summary: `${fmt(v)} is the result after a ${fmt(p)}% increase from ${fmt(original)}.`,
      };
    }
    // reverse-decrease
    const denom = 1 - frac;
    if (denom === 0) return { ok: false, error: 'Cannot reverse a 100% decrease (division by zero).' };
    const original = v / denom;
    return {
      ok: true,
      rows: [
        { label: 'Original (pre-decrease)', value: fmt(original) },
        { label: 'Amount removed', value: `${fmt(original - v)}` },
        { label: 'Divisor', value: `÷${fmt(denom)}` },
      ],
      summary: `${fmt(v)} is the result after a ${fmt(p)}% decrease from ${fmt(original)}.`,
    };
  }, [valueRaw, pctRaw, mode]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value">
            <Input value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
          </Field>
          <Field label="Percentage %">
            <Input value={pctRaw} onChange={(e) => setPctRaw(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
          </Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase by %</SelectItem>
                <SelectItem value="decrease">Decrease by %</SelectItem>
                <SelectItem value="reverse-increase">Reverse: undo a % increase</SelectItem>
                <SelectItem value="reverse-decrease">Reverse: undo a % decrease</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[result.summary]} />
        </Panel>
      )}
    </div>
  );
}
