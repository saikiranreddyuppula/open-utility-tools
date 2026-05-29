'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';
import { cn } from '@/lib/utils';
import { isPrime, primeFactors } from '@/lib/math/numbers';

export default function PrimeCheckerTool() {
  const [value, setValue] = useState('600851475143');

  const { n, prime, factors, valid } = useMemo(() => {
    const num = Number(value);
    const valid = Number.isInteger(num) && num >= 2 && num <= Number.MAX_SAFE_INTEGER;
    if (!valid) return { n: num, prime: false, factors: [] as number[], valid: false };
    const factors = isPrime(num) ? [num] : primeFactors(num);
    return { n: num, prime: isPrime(num), factors, valid: true };
  }, [value]);

  // Group factors into powers, e.g. 2^3 × 3 × 5
  const grouped = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of factors) counts.set(f, (counts.get(f) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`))
      .join(' × ');
  }, [factors]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="number"
        min={2}
        placeholder="Enter an integer ≥ 2"
        className="h-9 font-mono"
      />

      {valid && (
        <>
          <div
            className={cn(
              'rounded-lg border p-4 text-center',
              prime
                ? 'border-success/30 bg-[color-mix(in_oklch,var(--success)_10%,transparent)]'
                : 'border-border bg-card'
            )}
          >
            <span className="font-mono text-lg font-semibold">
              {n.toLocaleString()} is {prime ? 'PRIME' : 'composite'}
            </span>
          </div>
          {!prime && (
            <Panel>
              <div className="p-3">
                <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Prime factorization
                </p>
                <code className="font-mono text-sm">{grouped}</code>
              </div>
            </Panel>
          )}
        </>
      )}
      {!valid && value.trim() && (
        <p className="px-1 text-2xs text-muted-foreground">
          Enter an integer between 2 and {Number.MAX_SAFE_INTEGER.toLocaleString()}.
        </p>
      )}
    </div>
  );
}
