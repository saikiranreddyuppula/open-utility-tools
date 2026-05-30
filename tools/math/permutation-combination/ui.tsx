'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const MAX_N = 100_000;

function factorial(n: bigint): bigint {
  let acc = 1n;
  for (let i = 2n; i <= n; i++) acc *= i;
  return acc;
}

// nPr = n! / (n-r)! via the falling-product to keep intermediates small.
function permutation(n: bigint, r: bigint): bigint {
  if (r < 0n || r > n) return 0n;
  let result = 1n;
  for (let i = n - r + 1n; i <= n; i++) result *= i;
  return result;
}

// nCr via multiplicative cancellation.
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

function power(base: bigint, exp: bigint): bigint {
  let result = 1n;
  let b = base;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result *= b;
    b *= b;
    e >>= 1n;
  }
  return result;
}

function sci(value: bigint): string {
  const s = value.toString();
  if (s.length <= 21) return value.toLocaleString();
  const exp = s.length - 1;
  const first = s[0] ?? '0';
  const rest = s.slice(1, 5);
  return `${first}.${rest}e+${exp}`;
}

export default function PermutationCombinationCalculator() {
  const [nStr, setNStr] = useState('10');
  const [rStr, setRStr] = useState('3');

  const result = useMemo(() => {
    const nNum = Number(nStr.trim());
    const rNum = Number(rStr.trim());
    if (nStr.trim() === '' || !Number.isInteger(nNum) || nNum < 0) {
      return { error: 'Enter a non-negative integer for n.' };
    }
    if (rStr.trim() === '' || !Number.isInteger(rNum) || rNum < 0) {
      return { error: 'Enter a non-negative integer for r.' };
    }
    if (nNum > MAX_N) {
      return { error: `Keep n at or below ${MAX_N.toLocaleString()} for performance.` };
    }
    if (rNum > MAX_N) {
      return { error: `Keep r at or below ${MAX_N.toLocaleString()} for performance.` };
    }

    const n = BigInt(nNum);
    const r = BigInt(rNum);
    const noRepValid = rNum <= nNum;

    const rows: { label: string; value: string; note?: string }[] = [];

    if (noRepValid) {
      const nPr = permutation(n, r);
      const nCr = combination(n, r);
      rows.push({
        label: `Permutations nPr (no repetition)`,
        value: sci(nPr),
        note: 'n! / (n−r)! — ordered selections',
      });
      rows.push({
        label: `Combinations nCr (no repetition)`,
        value: sci(nCr),
        note: 'n! / (r!(n−r)!) — unordered selections',
      });
    } else {
      rows.push({
        label: 'Permutations / Combinations (no repetition)',
        value: 'undefined (r > n)',
        note: 'Cannot choose more distinct items than available.',
      });
    }

    // With repetition.
    const permRep = power(n, r);
    const combRep = combination(n + r - 1n, r);
    rows.push({
      label: 'Permutations (with repetition)',
      value: sci(permRep),
      note: 'n^r — ordered, items may repeat',
    });
    rows.push({
      label: 'Combinations (with repetition)',
      value: sci(combRep),
      note: 'C(n+r−1, r) — multiset coefficient',
    });

    const fact = factorial(n);
    rows.push({ label: 'n!', value: sci(fact), note: `factorial of ${nNum}` });

    const copy = rows.map((x) => `${x.label}: ${x.value}`).join('\n');

    return { rows, copy, n: nNum, r: rNum, noRepValid };
  }, [nStr, rStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Total items (n)">
            <Input
              value={nStr}
              onChange={(e) => setNStr(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Chosen (r)">
            <Input
              value={rStr}
              onChange={(e) => setRStr(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3">
            {result.rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="flex min-w-0 items-start gap-2 font-mono text-sm">
                    <span className="break-all text-right">{row.value}</span>
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
                {row.note && <span className="text-2xs text-muted-foreground">{row.note}</span>}
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `n = ${result.n}`,
              `r = ${result.r}`,
              result.noRepValid ? 'r ≤ n' : 'r > n (no-repetition undefined)',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
