'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

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

export default function PercentErrorTool() {
  const [measuredRaw, setMeasuredRaw] = useState('9.8');
  const [trueRaw, setTrueRaw] = useState('9.81');

  const result = useMemo<Ok | Err>(() => {
    const measured = Number(measuredRaw);
    const trueVal = Number(trueRaw);
    if (!Number.isFinite(measured) || !Number.isFinite(trueVal)) {
      return { ok: false, error: 'Enter valid numbers for both values.' };
    }
    if (trueVal === 0) {
      return { ok: false, error: 'The true (theoretical) value cannot be zero — percent error is undefined.' };
    }

    const absError = Math.abs(measured - trueVal);
    const signedError = measured - trueVal;
    const percentError = (absError / Math.abs(trueVal)) * 100;
    const signedRelative = (signedError / Math.abs(trueVal)) * 100;
    const accuracy = 100 - percentError;

    const rows: { label: string; value: string }[] = [
      { label: 'Percent error', value: `${fmt(percentError)}%` },
      { label: 'Absolute error', value: fmt(absError) },
      { label: 'Signed relative error', value: `${signedRelative >= 0 ? '+' : ''}${fmt(signedRelative)}%` },
      { label: 'Percent accuracy', value: `${fmt(accuracy)}%` },
    ];

    const dir = signedError > 0 ? 'overestimate' : signedError < 0 ? 'underestimate' : 'exact match';
    const summary = `Measured ${fmt(measured)} vs true ${fmt(trueVal)}: ${fmt(percentError)}% error (${dir}).`;

    return { ok: true, rows, summary };
  }, [measuredRaw, trueRaw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Measured value">
            <Input value={measuredRaw} onChange={(e) => setMeasuredRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
          </Field>
          <Field label="True value">
            <Input value={trueRaw} onChange={(e) => setTrueRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
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
