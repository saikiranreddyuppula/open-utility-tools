'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface Row {
  label: string;
  value: string;
}

function poolSize(s: string): { size: number; pools: string[] } {
  const pools: string[] = [];
  let size = 0;
  if (/[a-z]/.test(s)) {
    size += 26;
    pools.push('lowercase (26)');
  }
  if (/[A-Z]/.test(s)) {
    size += 26;
    pools.push('uppercase (26)');
  }
  if (/[0-9]/.test(s)) {
    size += 10;
    pools.push('digits (10)');
  }
  if (/ /.test(s)) {
    size += 1;
    pools.push('space (1)');
  }
  if (/[!-/:-@[-`{-~]/.test(s)) {
    size += 32;
    pools.push('symbols (~32)');
  }
  // Anything beyond printable ASCII counts as a broad unicode pool.
  if (/[^\x20-\x7e]/.test(s)) {
    size += 100;
    pools.push('unicode (+100)');
  }
  return { size, pools };
}

/** Penalty heuristics: repeated chars and sequential runs reduce effective length. */
function effectiveLength(s: string): number {
  const chars = Array.from(s);
  if (chars.length === 0) return 0;
  let eff = 1; // first char always counts fully
  for (let i = 1; i < chars.length; i += 1) {
    const cur = chars[i] ?? '';
    const prev = chars[i - 1] ?? '';
    const curCode = cur.charCodeAt(0);
    const prevCode = prev.charCodeAt(0);
    if (cur === prev) {
      eff += 0.25; // repeated
    } else if (Math.abs(curCode - prevCode) === 1) {
      eff += 0.4; // sequential (abc, 123)
    } else {
      eff += 1;
    }
  }
  return eff;
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'effectively infinite';
  if (seconds < 1) return 'less than a second';
  const units: [string, number][] = [
    ['year', 31_557_600],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [name, secs] of units) {
    if (seconds >= secs) {
      const n = seconds / secs;
      if (n >= 1e12) return `${(n).toExponential(2)} ${name}s`;
      if (n >= 1000) return `${Math.round(n).toLocaleString()} ${name}s`;
      const v = Math.round(n * 10) / 10;
      return `${v} ${name}${v === 1 ? '' : 's'}`;
    }
  }
  return 'less than a second';
}

export default function PassphraseEntropyTool() {
  const [pass, setPass] = useState('correct horse battery staple');

  const result = useMemo(() => {
    const { size, pools } = poolSize(pass);
    const len = Array.from(pass).length;
    const log2R = size > 0 ? Math.log2(size) : 0;
    const naiveBits = len * log2R;
    const effLen = effectiveLength(pass);
    const correctedBits = effLen * log2R;

    // Guesses to exhaust = 2^bits (worst-case full space; on average half).
    const guesses = Math.pow(2, correctedBits);

    const rates: [string, number][] = [
      ['Online throttled (100/s)', 100],
      ['Online unthrottled (1e4/s)', 1e4],
      ['Offline fast hash (1e9/s)', 1e9],
      ['Offline GPU farm (1e12/s)', 1e12],
    ];

    const rows: Row[] = [
      { label: 'Length', value: `${len} chars` },
      { label: 'Character pool R', value: `${size} (${log2R.toFixed(2)} bits/char)` },
      { label: 'Naive entropy', value: `${naiveBits.toFixed(1)} bits` },
      { label: 'Corrected entropy', value: `${correctedBits.toFixed(1)} bits` },
      {
        label: 'Estimated guesses',
        value: guesses > 1e15 ? guesses.toExponential(2) : Math.round(guesses).toLocaleString(),
      },
    ];

    const crack: Row[] = rates.map(([label, r]) => ({
      label,
      // average-case = half the keyspace
      value: fmtTime(guesses / 2 / r),
    }));

    let verdict = 'Very weak';
    if (correctedBits >= 128) verdict = 'Excellent';
    else if (correctedBits >= 80) verdict = 'Strong';
    else if (correctedBits >= 60) verdict = 'Reasonable';
    else if (correctedBits >= 40) verdict = 'Weak';

    return { rows, crack, pools, verdict, correctedBits };
  }, [pass]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Passphrase" className="min-w-[300px] flex-1">
            <Input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Type a passphrase…"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title={`Strength: ${result.verdict}`}>
          <CopyButton
            value={() =>
              [...result.rows, ...result.crack].map((r) => `${r.label}: ${r.value}`).join('\n')
            }
          />
        </PanelHeader>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          {result.rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{r.value}</span>
                <CopyButton value={r.value} size="icon-sm" />
              </span>
            </div>
          ))}
        </div>
        <div className="border-t px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estimated offline crack time (average case)
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          {result.crack.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="font-mono text-sm">{r.value}</span>
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `Pools: ${result.pools.length ? result.pools.join(', ') : 'none'}`,
            `${result.correctedBits.toFixed(1)} bits`,
          ]}
        />
      </Panel>
    </div>
  );
}
