'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'toDecimal' | 'toStandard';

const SECONDS_PER_DAY = 86400;
const DECIMAL_SECONDS_PER_DAY = 100000; // 10 h x 100 m x 100 s

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface Row { label: string; value: string }

// Standard "HH:MM:SS" -> fraction of day -> decimal time
function standardToDecimal(input: string): { rows: Row[] } | { error: string } {
  const parts = input.trim().split(':');
  if (parts.length < 2 || parts.length > 3) {
    return { error: 'Enter standard time as HH:MM or HH:MM:SS.' };
  }
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = parts.length === 3 ? Number(parts[2]) : 0;
  if (![h, m, s].every((x) => Number.isFinite(x))) return { error: 'Time parts must be numbers.' };
  if (h < 0 || h > 23) return { error: 'Hours must be 0-23.' };
  if (m < 0 || m > 59) return { error: 'Minutes must be 0-59.' };
  if (s < 0 || s > 59) return { error: 'Seconds must be 0-59.' };

  const secsSinceMidnight = h * 3600 + m * 60 + s;
  const fraction = secsSinceMidnight / SECONDS_PER_DAY;
  const decTotal = Math.floor(fraction * DECIMAL_SECONDS_PER_DAY);
  const dh = Math.floor(decTotal / 10000);
  const dm = Math.floor((decTotal % 10000) / 100);
  const ds = decTotal % 100;

  return {
    rows: [
      { label: 'Decimal time', value: `${dh}:${pad(dm)}:${pad(ds)}` },
      { label: 'Decimal hours', value: (fraction * 10).toFixed(5) },
      { label: 'Fraction of day', value: `${(fraction * 100).toFixed(5)}%` },
      { label: 'Standard time', value: `${pad(h)}:${pad(m)}:${pad(s)}` },
    ],
  };
}

// Decimal "H:MM:SS" -> fraction of day -> standard time
function decimalToStandard(input: string): { rows: Row[] } | { error: string } {
  const parts = input.trim().split(':');
  if (parts.length < 2 || parts.length > 3) {
    return { error: 'Enter decimal time as H:MM or H:MM:SS.' };
  }
  const dh = Number(parts[0]);
  const dm = Number(parts[1]);
  const ds = parts.length === 3 ? Number(parts[2]) : 0;
  if (![dh, dm, ds].every((x) => Number.isFinite(x))) return { error: 'Time parts must be numbers.' };
  if (dh < 0 || dh > 9) return { error: 'Decimal hours must be 0-9.' };
  if (dm < 0 || dm > 99) return { error: 'Decimal minutes must be 0-99.' };
  if (ds < 0 || ds > 99) return { error: 'Decimal seconds must be 0-99.' };

  const decTotal = dh * 10000 + dm * 100 + ds;
  const fraction = decTotal / DECIMAL_SECONDS_PER_DAY;
  const secsSinceMidnight = Math.round(fraction * SECONDS_PER_DAY);
  const h = Math.floor(secsSinceMidnight / 3600) % 24;
  const m = Math.floor((secsSinceMidnight % 3600) / 60);
  const s = secsSinceMidnight % 60;

  return {
    rows: [
      { label: 'Standard time', value: `${pad(h)}:${pad(m)}:${pad(s)}` },
      { label: 'Fraction of day', value: `${(fraction * 100).toFixed(5)}%` },
      { label: 'Seconds since midnight', value: secsSinceMidnight.toLocaleString() },
      { label: 'Decimal time', value: `${dh}:${pad(dm)}:${pad(ds)}` },
    ],
  };
}

export default function DecimalTimeConverter() {
  const [mode, setMode] = useState<Mode>('toDecimal');
  const [input, setInput] = useState('14:30:00');

  const result = useMemo(
    () => (mode === 'toDecimal' ? standardToDecimal(input) : decimalToStandard(input)),
    [mode, input],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                const next = v as Mode;
                setMode(next);
                setInput(next === 'toDecimal' ? '14:30:00' : '6:04:16');
              }}
            >
              <TabsList>
                <TabsTrigger value="toDecimal">Standard → Decimal</TabsTrigger>
                <TabsTrigger value="toStandard">Decimal → Standard</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field
            label={mode === 'toDecimal' ? 'Standard time (HH:MM:SS)' : 'Decimal time (H:MM:SS)'}
            className="min-w-[200px]"
          >
            <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" />
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
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm tabular">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['1 day = 10 h × 100 m × 100 s = 100000 decimal seconds']} />
        </Panel>
      )}
    </div>
  );
}
