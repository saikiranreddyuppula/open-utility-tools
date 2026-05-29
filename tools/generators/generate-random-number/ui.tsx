'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Mode = 'integer' | 'decimal';

/** Returns an unbiased random float in [0, 1) using 53 bits of entropy. */
function randomFloat01(): number {
  const buf = new Uint32Array(2);
  webcrypto.getRandomValues(buf);
  const high = (buf[0] ?? 0) >>> 5; // 27 bits
  const low = (buf[1] ?? 0) >>> 6; // 26 bits
  return (high * 67108864 + low) / 9007199254740992;
}

/** Unbiased integer in [0, range) via rejection sampling (range up to 2^32). */
function randomIntBelow(range: number): number {
  if (range <= 0) return 0;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % range;
}

export default function RandomNumberTool() {
  const [mode, setMode] = useState<Mode>('integer');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [count, setCount] = useState('5');
  const [decimals, setDecimals] = useState('2');
  const [unique, setUnique] = useState(false);
  const [nonce, setNonce] = useState(0);

  const result = useMemo<{ value: string; error: string | null; produced: number }>(() => {
    void nonce; // re-roll trigger
    const lo = Number(min);
    const hi = Number(max);
    const n = Number(count);
    const dp = Number(decimals);

    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return { value: '', error: 'Min and max must be valid numbers.', produced: 0 };
    }
    if (hi < lo) {
      return { value: '', error: 'Max must be greater than or equal to min.', produced: 0 };
    }
    if (!Number.isFinite(n) || n < 1) {
      return { value: '', error: 'Quantity must be at least 1.', produced: 0 };
    }
    const qty = Math.min(100000, Math.floor(n));

    if (mode === 'integer') {
      const loI = Math.ceil(lo);
      const hiI = Math.floor(hi);
      if (hiI < loI) {
        return { value: '', error: 'No integers exist in the given range.', produced: 0 };
      }
      const span = hiI - loI + 1; // inclusive
      if (unique && qty > span) {
        return {
          value: '',
          error: `Cannot produce ${qty} unique integers; only ${span} exist in the range.`,
          produced: 0,
        };
      }
      const out: number[] = [];
      const seen = new Set<number>();
      let guard = 0;
      const maxGuard = qty * 50 + 1000;
      while (out.length < qty && guard < maxGuard) {
        guard += 1;
        const v = loI + randomIntBelow(span);
        if (unique) {
          if (seen.has(v)) continue;
          seen.add(v);
        }
        out.push(v);
      }
      return { value: out.join('\n'), error: null, produced: out.length };
    }

    // decimal mode
    const places = !Number.isFinite(dp) || dp < 0 ? 0 : Math.min(15, Math.floor(dp));
    const out: number[] = [];
    const seen = new Set<string>();
    let guard = 0;
    const maxGuard = qty * 50 + 1000;
    while (out.length < qty && guard < maxGuard) {
      guard += 1;
      const raw = lo + randomFloat01() * (hi - lo);
      const rounded = Number(raw.toFixed(places));
      if (unique) {
        const key = rounded.toFixed(places);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(rounded);
    }
    return {
      value: out.map((v) => v.toFixed(places)).join('\n'),
      error: null,
      produced: out.length,
    };
  }, [mode, min, max, count, decimals, unique, nonce]);

  return (
    <Panel>
      <PanelHeader title="Random Number Generator">
        <Button variant="outline" size="sm" onClick={() => setNonce((x) => x + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Generate
        </Button>
        <CopyButton value={() => result.value} />
        <DownloadButton data={() => result.value} filename="random-numbers.txt" />
      </PanelHeader>

      <OptionsBar>
        <Field label="Type">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="integer">Integer</TabsTrigger>
              <TabsTrigger value="decimal">Decimal</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Min">
          <Input value={min} onChange={(e) => setMin(e.target.value)} className="w-28" inputMode="decimal" />
        </Field>
        <Field label="Max">
          <Input value={max} onChange={(e) => setMax(e.target.value)} className="w-28" inputMode="decimal" />
        </Field>
        <Field label="Quantity">
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-28"
          />
        </Field>
        {mode === 'decimal' ? (
          <Field label="Decimal places">
            <Input
              type="number"
              min={0}
              max={15}
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              className="w-28"
            />
          </Field>
        ) : null}
        <Field label="Unique">
          <Switch checked={unique} onCheckedChange={setUnique} />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {!result.error ? (
        <>
          <textarea
            readOnly
            value={result.value}
            className="bg-muted/30 min-h-[240px] w-full resize-y rounded-md border p-3 font-mono text-sm"
            spellCheck={false}
          />
          <StatBar items={[`${result.produced} number${result.produced === 1 ? '' : 's'}`, unique && 'unique']} />
        </>
      ) : null}
    </Panel>
  );
}
