'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { OptionsBar, Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const webcrypto = (
  globalThis as unknown as {
    crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T; randomUUID(): string };
  }
).crypto;

/** Uniform integer in [min, max] inclusive, rejection-sampled to avoid modulo bias. */
function secureInt(min: number, max: number): number {
  const range = max - min + 1;
  if (range <= 0) return min;
  const maxUint = 0xffffffff;
  const limit = maxUint - (maxUint % range);
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    webcrypto.getRandomValues(buf);
    x = buf[0] ?? 0;
  } while (x >= limit);
  return min + (x % range);
}

export default function RandomNumberGeneratorTool() {
  const [minStr, setMinStr] = useState('1');
  const [maxStr, setMaxStr] = useState('100');
  const [unique, setUnique] = useState(false);

  const bounds = useMemo(() => {
    const lo = Math.floor(Number(minStr));
    const hi = Math.floor(Number(maxStr));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    if (hi < lo) return null;
    return { lo, hi };
  }, [minStr, maxStr]);

  // Pool used when uniqueness is enabled: a partial Fisher–Yates over the range.
  const poolRef = useRef<{ key: string; values: number[]; idx: number } | null>(null);

  const generate = useCallback((): string => {
    if (!bounds) return '0';
    const { lo, hi } = bounds;

    if (!unique) {
      return String(secureInt(lo, hi));
    }

    const rangeSize = hi - lo + 1;
    const key = `${lo}:${hi}`;
    let pool = poolRef.current;
    if (!pool || pool.key !== key || pool.idx >= pool.values.length) {
      // (Re)build the pool. For very large ranges, cap to a working window so we
      // never allocate an unbounded array; uniqueness still holds within a batch.
      const cap = Math.min(rangeSize, 100000);
      const values = Array.from({ length: cap }, (_, i) => lo + i);
      pool = { key, values, idx: 0 };
      poolRef.current = pool;
    }
    // Fisher–Yates step: pick a random index in the remaining tail and swap forward.
    const remaining = pool.values.length - pool.idx;
    const j = pool.idx + secureInt(0, remaining - 1);
    const picked = pool.values[j] ?? lo;
    const cur = pool.values[pool.idx] ?? lo;
    pool.values[pool.idx] = picked;
    pool.values[j] = cur;
    pool.idx += 1;
    return String(picked);
  }, [bounds, unique]);

  const invalid = !bounds;

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Minimum">
          <Input value={minStr} onChange={(e) => setMinStr(e.target.value)} inputMode="numeric" placeholder="1" />
        </Field>
        <Field label="Maximum">
          <Input value={maxStr} onChange={(e) => setMaxStr(e.target.value)} inputMode="numeric" placeholder="100" />
        </Field>
        <Field label="Unique" hint="no repeats within a batch">
          <div className="flex h-9 items-center gap-2">
            <Switch id="rng-unique" checked={unique} onCheckedChange={setUnique} />
            <Label htmlFor="rng-unique" className="text-sm">
              {unique ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
      </OptionsBar>

      {invalid ? (
        <p className="text-sm text-destructive">Maximum must be a whole number greater than or equal to the minimum.</p>
      ) : null}

      <GeneratorList
        generate={generate}
        deps={[bounds?.lo, bounds?.hi, unique]}
        downloadName="random-numbers.txt"
        label="Random numbers"
      />
    </div>
  );
}
