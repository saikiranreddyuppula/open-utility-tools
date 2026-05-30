'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'factorial' | 'permutation' | 'combination';

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

// C(n, r) via multiplicative formula to keep intermediates small.
function combination(n: bigint, r: bigint): bigint {
  if (r < 0n || r > n) return 0n;
  let k = r;
  if (k > n - k) k = n - k;
  let result = 1n;
  for (let i = 1n; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function permutation(n: bigint, r: bigint): bigint {
  if (r < 0n || r > n) return 0n;
  let result = 1n;
  for (let i = n - r + 1n; i <= n; i++) result *= i;
  return result;
}

// Trailing zeros of n! via Legendre's formula.
function trailingZeros(n: bigint): bigint {
  let count = 0n;
  let p = 5n;
  while (p <= n) {
    count += n / p;
    p *= 5n;
  }
  return count;
}

function sci(value: bigint): string {
  const s = value.toString();
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  if (digits.length <= 1) return value.toString();
  const exp = digits.length - 1;
  const first = digits[0] ?? '0';
  const rest = digits.slice(1, 5);
  return `${neg ? '-' : ''}${first}.${rest}e+${exp}`;
}

export default function FactorialBinomialCalculator() {
  const [mode, setMode] = useState<Mode>('combination');
  const [nStr, setNStr] = useState('52');
  const [rStr, setRStr] = useState('5');

  const result = useMemo(() => {
    const nNum = Number(nStr);
    if (!Number.isInteger(nNum) || nNum < 0) return { error: 'Enter a non-negative integer for n.' };
    if (nNum > MAX_N) return { error: `Keep n at or below ${MAX_N.toLocaleString()} for performance.` };
    const n = BigInt(nNum);

    if (mode === 'factorial') {
      const fact = factorial(n);
      const dfact = doubleFactorial(n);
      const tz = trailingZeros(n);
      const str = fact.toString();
      return {
        rows: [
          { label: `${nNum}!`, value: str },
          { label: 'Double factorial n!!', value: dfact.toString() },
          { label: 'Digit count', value: str.length.toString() },
          { label: 'Scientific approx.', value: sci(fact) },
          { label: 'Trailing zeros of n!', value: tz.toString() },
        ],
        copy: str,
        pascal: null as string | null,
      };
    }

    const rNum = Number(rStr);
    if (!Number.isInteger(rNum) || rNum < 0) return { error: 'Enter a non-negative integer for r.' };
    if (rNum > nNum) return { error: 'r must not exceed n.' };
    const r = BigInt(rNum);

    if (mode === 'permutation') {
      const p = permutation(n, r);
      const str = p.toString();
      return {
        rows: [
          { label: `P(${nNum}, ${rNum})`, value: str },
          { label: 'Digit count', value: str.length.toString() },
          { label: 'Scientific approx.', value: sci(p) },
        ],
        copy: str,
        pascal: null as string | null,
      };
    }

    // combination
    const c = combination(n, r);
    const str = c.toString();
    // Full Pascal row for n (cap row width).
    let pascal: string | null = null;
    if (nNum <= 40) {
      const row: string[] = [];
      for (let i = 0n; i <= n; i++) row.push(combination(n, i).toString());
      pascal = row.join(' ');
    }
    return {
      rows: [
        { label: `C(${nNum}, ${rNum})`, value: str },
        { label: 'Digit count', value: str.length.toString() },
        { label: 'Scientific approx.', value: sci(c) },
      ],
      copy: str,
      pascal,
    };
  }, [mode, nStr, rStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="factorial">n!</TabsTrigger>
                <TabsTrigger value="permutation">P(n,r)</TabsTrigger>
                <TabsTrigger value="combination">C(n,r)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="n">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" />
          </Field>
          {mode !== 'factorial' && (
            <Field label="r">
              <Input value={rStr} onChange={(e) => setRStr(e.target.value)} inputMode="numeric" />
            </Field>
          )}
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
          {result.pascal && (
            <div className="border-t p-3">
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Pascal&apos;s triangle row n
              </p>
              <code className="block break-all font-mono text-xs">{result.pascal}</code>
            </div>
          )}
          <StatBar items={[`Mode: ${mode}`]} />
        </Panel>
      )}
    </div>
  );
}
