'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'factorial' | 'double' | 'subfactorial';

const MAX_N = 100000;

function factorial(n: bigint): bigint {
  let acc = 1n;
  for (let i = 2n; i <= n; i++) acc *= i;
  return acc;
}

function doubleFactorial(n: bigint): bigint {
  if (n <= 0n) return 1n;
  let acc = 1n;
  for (let i = n; i > 1n; i -= 2n) acc *= i;
  return acc;
}

// Subfactorial (derangements) via integer recurrence: !n = n*!(n-1) + (-1)^n.
function subfactorial(n: bigint): bigint {
  if (n === 0n) return 1n;
  if (n === 1n) return 0n;
  let prev = 1n; // !0
  let cur = 0n; // !1
  for (let k = 2n; k <= n; k++) {
    const sign = k % 2n === 0n ? 1n : -1n;
    const next = k * cur + sign;
    prev = cur;
    cur = next;
  }
  return cur;
}

function sci(value: bigint): string {
  const s = value.toString();
  if (s.length <= 1) return s;
  const exp = s.length - 1;
  const first = s[0] ?? '0';
  const rest = s.slice(1, 5);
  return `${first}.${rest}e+${exp}`;
}

export default function FactorialCalculator() {
  const [mode, setMode] = useState<Mode>('factorial');
  const [nStr, setNStr] = useState('20');

  const result = useMemo(() => {
    const nNum = Number(nStr);
    if (!Number.isInteger(nNum) || nNum < 0) return { error: 'Enter a non-negative integer.' };
    if (nNum > MAX_N) return { error: `Keep n at or below ${MAX_N.toLocaleString()} for performance.` };
    const n = BigInt(nNum);

    let value: bigint;
    let label: string;
    if (mode === 'factorial') {
      value = factorial(n);
      label = `${nNum}!`;
    } else if (mode === 'double') {
      value = doubleFactorial(n);
      label = `${nNum}!!`;
    } else {
      value = subfactorial(n);
      label = `!${nNum}`;
    }

    const str = value.toString();
    return {
      rows: [
        { label, value: str },
        { label: 'Digit count', value: str.length.toString() },
        { label: 'Scientific approx.', value: sci(value) },
      ],
      copy: str,
    };
  }, [mode, nStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="factorial">n!</TabsTrigger>
                <TabsTrigger value="double">n!!</TabsTrigger>
                <TabsTrigger value="subfactorial">!n</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="n">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-start gap-2 font-mono text-sm">
                  <span className="break-all text-right">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              'factorial: n! = 1·2·…·n',
              'double: n!! same-parity descending',
              'subfactorial: derangements !n',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
