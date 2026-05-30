'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Unit = 'auto' | 's' | 'ms' | 'us' | 'ns';

// Multiplier (in nanoseconds) for each precision unit.
const NS_PER: Record<Exclude<Unit, 'auto'>, bigint> = {
  s: 1_000_000_000n,
  ms: 1_000_000n,
  us: 1_000n,
  ns: 1n,
};

const UNIT_LABEL: Record<Exclude<Unit, 'auto'>, string> = {
  s: 'Seconds',
  ms: 'Milliseconds',
  us: 'Microseconds',
  ns: 'Nanoseconds',
};

function detectUnit(digits: number): Exclude<Unit, 'auto'> {
  // Heuristic by digit count for modern timestamps.
  if (digits <= 11) return 's';
  if (digits <= 14) return 'ms';
  if (digits <= 17) return 'us';
  return 'ns';
}

type Result =
  | { error: string }
  | {
      detected: Exclude<Unit, 'auto'>;
      seconds: string;
      ms: string;
      us: string;
      ns: string;
      utc: string;
      local: string;
    };

function compute(raw: string, unit: Unit): Result {
  const text = raw.trim().replace(/[_,\s]/g, '');
  if (!text) return { error: 'Enter a Unix timestamp integer.' };
  if (!/^-?\d+$/.test(text)) return { error: 'Timestamp must be an integer (digits only).' };

  let value: bigint;
  try {
    value = BigInt(text);
  } catch {
    return { error: 'Could not parse the integer value.' };
  }

  const digitCount = text.replace('-', '').length;
  const resolved: Exclude<Unit, 'auto'> = unit === 'auto' ? detectUnit(digitCount) : unit;

  // Convert to a canonical nanosecond count, then derive every unit.
  const totalNs = value * NS_PER[resolved];

  const seconds = totalNs / 1_000_000_000n;
  const ms = totalNs / 1_000_000n;
  const us = totalNs / 1_000n;
  const ns = totalNs;

  // For the human date, JS Date works in ms (Number is safe for any realistic ms epoch).
  const msNumber = Number(ms);
  let utc = 'Out of representable range';
  let local = 'Out of representable range';
  if (Number.isFinite(msNumber) && Math.abs(msNumber) < 8.64e15) {
    const d = new Date(msNumber);
    if (!Number.isNaN(d.getTime())) {
      utc = d.toISOString();
      local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  }

  return {
    detected: resolved,
    seconds: seconds.toString(),
    ms: ms.toString(),
    us: us.toString(),
    ns: ns.toString(),
    utc,
    local,
  };
}

export default function EpochPrecisionConverterTool() {
  const [input, setInput] = useState('1700000000');
  const [unit, setUnit] = useState<Unit>('auto');

  const result = useMemo(() => compute(input, unit), [input, unit]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Timestamp" className="min-w-[220px] flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 1700000000"
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
          <Field label="Source unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="s">Seconds</SelectItem>
                <SelectItem value="ms">Milliseconds</SelectItem>
                <SelectItem value="us">Microseconds</SelectItem>
                <SelectItem value="ns">Nanoseconds</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="All precisions">
            <CopyButton
              value={() =>
                [
                  `Seconds: ${result.seconds}`,
                  `Milliseconds: ${result.ms}`,
                  `Microseconds: ${result.us}`,
                  `Nanoseconds: ${result.ns}`,
                  `UTC: ${result.utc}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Seconds', value: result.seconds },
              { label: 'Milliseconds', value: result.ms },
              { label: 'Microseconds', value: result.us },
              { label: 'Nanoseconds', value: result.ns },
              { label: 'UTC (ISO 8601)', value: result.utc },
              { label: 'Local datetime', value: result.local },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="truncate">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`Interpreted as ${UNIT_LABEL[result.detected]}`, `Epoch base: Unix 1970`]} />
        </Panel>
      )}
    </div>
  );
}
