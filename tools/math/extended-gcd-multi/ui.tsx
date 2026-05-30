'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

function bAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = bAbs(a);
  let y = bAbs(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return bAbs(a / gcd(a, b) * b);
}

// Extended Euclid on absolute values: returns g, x, y with |a|·x + |b|·y = g.
function extGcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
  let oldR = bAbs(a);
  let r = bAbs(b);
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { g: oldR, x: oldS, y: oldT };
}

type Result =
  | { error: string }
  | {
      nums: bigint[];
      overallGcd: bigint;
      overallLcm: bigint;
      bezout: { a: bigint; b: bigint; x: bigint; y: bigint; g: bigint } | null;
      pairwiseCoprime: boolean;
      matrix: bigint[][];
    };

export default function ExtendedGcdMulti() {
  const [input, setInput] = useState('12, 18, 30');

  const result = useMemo<Result>(() => {
    const tokens = input.split(/[\s,]+/).filter((s) => s.length > 0);
    if (tokens.length === 0) return { error: 'Enter at least one integer.' };

    const nums: bigint[] = [];
    for (const tok of tokens) {
      if (!/^[+-]?\d+$/.test(tok)) return { error: `"${tok}" is not a valid integer.` };
      try {
        nums.push(BigInt(tok));
      } catch {
        return { error: `Could not parse "${tok}".` };
      }
    }
    if (nums.some((n) => n === 0n)) {
      // GCD with 0 is the other value; LCM with 0 is 0. Keep simple by disallowing 0.
      return { error: 'Zero is not allowed (LCM/GCD become degenerate).' };
    }
    if (nums.length > 50) return { error: 'Limit to 50 numbers.' };

    const first = nums[0];
    if (first === undefined) return { error: 'Enter at least one integer.' };

    let overallGcd = bAbs(first);
    let overallLcm = bAbs(first);
    for (let i = 1; i < nums.length; i++) {
      const cur = nums[i];
      if (cur === undefined) continue;
      overallGcd = gcd(overallGcd, cur);
      overallLcm = lcm(overallLcm, cur);
    }

    // Pairwise gcd matrix + pairwise-coprime test.
    const matrix: bigint[][] = [];
    let pairwiseCoprime = true;
    for (let i = 0; i < nums.length; i++) {
      const row: bigint[] = [];
      const ni = nums[i];
      for (let j = 0; j < nums.length; j++) {
        const nj = nums[j];
        if (ni === undefined || nj === undefined) {
          row.push(0n);
          continue;
        }
        const g = gcd(ni, nj);
        row.push(g);
        if (i < j && g !== 1n) pairwiseCoprime = false;
      }
      matrix.push(row);
    }

    let bezout: { a: bigint; b: bigint; x: bigint; y: bigint; g: bigint } | null = null;
    if (nums.length === 2) {
      const a = nums[0];
      const b = nums[1];
      if (a !== undefined && b !== undefined) {
        const e = extGcd(a, b);
        // Adjust signs back to the original (signed) inputs: a·x' + b·y' = g.
        const xAdj = a < 0n ? -e.x : e.x;
        const yAdj = b < 0n ? -e.y : e.y;
        bezout = { a, b, x: xAdj, y: yAdj, g: e.g };
      }
    }

    return { nums, overallGcd, overallLcm, bezout, pairwiseCoprime, matrix };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Integers (comma, space, or newline separated)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="12, 18, 30"
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => `GCD: ${result.overallGcd}\nLCM: ${result.overallLcm}`} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <Stat label="Overall GCD" value={result.overallGcd.toString()} />
              <Stat label="Overall LCM" value={result.overallLcm.toString()} />
            </div>
            <StatBar
              items={[
                `${result.nums.length} number(s)`,
                result.pairwiseCoprime ? 'Pairwise coprime' : 'Not pairwise coprime',
              ]}
            />
          </Panel>

          {result.bezout && (
            <Panel>
              <PanelHeader title="Bézout identity (extended Euclid)">
                <CopyButton
                  value={() => {
                    const z = result.bezout;
                    if (!z) return '';
                    return `${z.a}·(${z.x}) + ${z.b}·(${z.y}) = ${z.g}`;
                  }}
                />
              </PanelHeader>
              <div className="p-3 font-mono text-sm">
                {result.bezout.a}·({result.bezout.x.toString()}) + {result.bezout.b}·(
                {result.bezout.y.toString()}) = {result.bezout.g.toString()}
              </div>
            </Panel>
          )}

          {result.nums.length > 1 && result.nums.length <= 12 && (
            <Panel>
              <PanelHeader title="Pairwise GCD matrix" />
              <div className="overflow-auto p-3">
                <table className="font-mono text-xs">
                  <tbody>
                    <tr>
                      <td className="px-2 py-1" />
                      {result.nums.map((n, j) => (
                        <td key={`h-${j}`} className="px-2 py-1 font-semibold text-muted-foreground">
                          {n.toString()}
                        </td>
                      ))}
                    </tr>
                    {result.matrix.map((row, i) => (
                      <tr key={`r-${i}`}>
                        <td className="px-2 py-1 font-semibold text-muted-foreground">
                          {(result.nums[i] ?? 0n).toString()}
                        </td>
                        {row.map((g, j) => (
                          <td
                            key={`c-${i}-${j}`}
                            className={
                              i !== j && g === 1n
                                ? 'px-2 py-1 text-emerald-600 dark:text-emerald-400'
                                : 'px-2 py-1'
                            }
                          >
                            {g.toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <StatBar items={['1 in a cell off the diagonal means that pair is coprime']} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono text-lg font-semibold">
        <span className="break-all">{value}</span>
        <CopyButton value={value} size="icon-sm" />
      </span>
    </div>
  );
}
