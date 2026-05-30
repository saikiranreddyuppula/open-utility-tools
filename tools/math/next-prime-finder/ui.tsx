'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const SMALL_PRIMES: bigint[] = [
  2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n,
];

// Witnesses deterministic for n < 3.3e24, with extra rounds beyond.
const WITNESSES: bigint[] = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  // write n-1 = d * 2^r
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r += 1n;
  }
  for (const a of WITNESSES) {
    if (a % n === 0n) continue;
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let j = 0n; j < r - 1n; j += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

function nextPrime(n: bigint): bigint | null {
  let c = n + 1n;
  if (c <= 2n) return 2n;
  if ((c & 1n) === 0n) c += 1n;
  let guard = 0;
  while (guard < 1000000) {
    if (isProbablePrime(c)) return c;
    c += 2n;
    guard += 1;
  }
  return null;
}

function prevPrime(n: bigint): bigint | null {
  if (n <= 2n) return null;
  if (n === 3n) return 2n;
  let c = n - 1n;
  if (c === 2n) return 2n;
  if ((c & 1n) === 0n) c -= 1n;
  let guard = 0;
  while (c >= 2n && guard < 1000000) {
    if (isProbablePrime(c)) return c;
    c -= 2n;
    guard += 1;
  }
  return null;
}

function parseBigInt(raw: string): bigint | null {
  const s = raw.trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

interface Ok {
  ok: true;
  start: bigint;
  isPrime: boolean;
  next: bigint | null;
  prev: bigint | null;
  list: bigint[];
}

interface Err {
  ok: false;
  error: string;
}

export default function NextPrimeFinderTool() {
  const [startRaw, setStartRaw] = useState('1000000');
  const [kRaw, setKRaw] = useState('5');

  const result = useMemo<Ok | Err>(() => {
    const start = parseBigInt(startRaw);
    if (start === null) return { ok: false, error: 'Enter a valid integer.' };
    if (start < 0n) return { ok: false, error: 'Enter a non-negative integer.' };

    const k = Number(kRaw);
    if (!Number.isFinite(k) || k < 0 || k > 50) {
      return { ok: false, error: 'List count K must be between 0 and 50.' };
    }

    const next = nextPrime(start);
    const prev = prevPrime(start);

    const list: bigint[] = [];
    let cur = start;
    const count = Math.floor(k);
    for (let idx = 0; idx < count; idx += 1) {
      const np = nextPrime(cur);
      if (np === null) break;
      list.push(np);
      cur = np;
    }

    return { ok: true, start, isPrime: isProbablePrime(start), next, prev, list };
  }, [startRaw, kRaw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start number">
            <Input value={startRaw} onChange={(e) => setStartRaw(e.target.value)} inputMode="numeric" className="w-48 font-mono" />
          </Field>
          <Field label="List next K primes">
            <Input value={kRaw} onChange={(e) => setKRaw(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Results">
              <CopyButton
                value={() =>
                  [
                    `Start: ${result.start.toString()} (${result.isPrime ? 'prime' : 'composite'})`,
                    `Next prime: ${result.next?.toString() ?? '—'}`,
                    `Previous prime: ${result.prev?.toString() ?? '—'}`,
                  ].join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
                <span className="text-sm text-muted-foreground">Is start prime?</span>
                <span className="font-mono text-sm">{result.isPrime ? 'Yes — it is prime' : 'No — composite'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Next prime</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{result.next?.toString() ?? '—'}</span>
                  <CopyButton value={result.next?.toString() ?? ''} size="icon-sm" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Gap up</span>
                <span className="font-mono text-sm">{result.next !== null ? `+${(result.next - result.start).toString()}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Previous prime</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{result.prev?.toString() ?? '—'}</span>
                  <CopyButton value={result.prev?.toString() ?? ''} size="icon-sm" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Gap down</span>
                <span className="font-mono text-sm">{result.prev !== null ? `-${(result.start - result.prev).toString()}` : '—'}</span>
              </div>
            </div>
            <StatBar items={['Primality via deterministic Miller-Rabin with 13 witnesses']} />
          </Panel>

          {result.list.length > 0 && (
            <Panel>
              <PanelHeader title={`Next ${result.list.length} primes`}>
                <CopyButton value={() => result.list.map((p) => p.toString()).join('\n')} />
              </PanelHeader>
              <div className="flex flex-wrap gap-2 p-3 font-mono text-sm">
                {result.list.map((p, idx) => (
                  <span key={`${p.toString()}-${idx}`} className="rounded border bg-muted/30 px-2 py-1">
                    {p.toString()}
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
