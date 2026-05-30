'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

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

export default function PercentChangeTool() {
  const [oldRaw, setOldRaw] = useState('120');
  const [newRaw, setNewRaw] = useState('150');
  const [arePercents, setArePercents] = useState(false);

  const result = useMemo<Ok | Err>(() => {
    const oldV = Number(oldRaw);
    const newV = Number(newRaw);
    if (!Number.isFinite(oldV) || !Number.isFinite(newV)) {
      return { ok: false, error: 'Enter valid numbers for both values.' };
    }
    const absChange = newV - oldV;

    if (oldV === 0) {
      const summary =
        newV === 0
          ? 'No change — both values are zero.'
          : 'Percent change is undefined when the old value is zero (division by zero).';
      return {
        ok: true,
        summary,
        rows: [
          { label: 'Percent change', value: newV === 0 ? '0%' : 'undefined (old value is 0)' },
          { label: 'Absolute change', value: fmt(absChange) },
          { label: 'Growth factor', value: newV === 0 ? '—' : '∞' },
        ],
      };
    }

    const pct = (absChange / Math.abs(oldV)) * 100;
    const factor = newV / oldV;

    const rows: { label: string; value: string }[] = [
      { label: 'Percent change', value: `${pct >= 0 ? '+' : ''}${fmt(pct)}%` },
      { label: 'Absolute change', value: `${absChange >= 0 ? '+' : ''}${fmt(absChange)}` },
      { label: 'Growth factor (new / old)', value: `${fmt(factor)}×` },
    ];

    if (arePercents) {
      rows.push({ label: 'Percentage points', value: `${absChange >= 0 ? '+' : ''}${fmt(absChange)} pp` });
    }

    let direction: string;
    if (absChange > 0) direction = `increased by ${fmt(Math.abs(pct))}%`;
    else if (absChange < 0) direction = `decreased by ${fmt(Math.abs(pct))}%`;
    else direction = 'did not change';

    const summary = `The value ${direction} (from ${fmt(oldV)} to ${fmt(newV)}).`;

    return { ok: true, rows, summary };
  }, [oldRaw, newRaw, arePercents]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Old value">
            <Input value={oldRaw} onChange={(e) => setOldRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
          </Field>
          <Field label="New value">
            <Input value={newRaw} onChange={(e) => setNewRaw(e.target.value)} inputMode="decimal" className="w-36 font-mono" />
          </Field>
          <Field label="Values are percentages">
            <Switch checked={arePercents} onCheckedChange={setArePercents} />
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
