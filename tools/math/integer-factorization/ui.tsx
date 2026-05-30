'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function bigAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

// Modular exponentiation.
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
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

// Deterministic Miller-Rabin for the BigInt range we support.
function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r += 1n;
  }
  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  for (const a of witnesses) {
    if (a % n === 0n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 0n; i < r - 1n; i++) {
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

// Pollard's rho.
function pollardRho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n;
  let c = 1n;
  while (true) {
    let x = 2n;
    let y = 2n;
    let d = 1n;
    const f = (v: bigint) => (v * v + c) % n;
    while (d === 1n) {
      x = f(x);
      y = f(f(y));
      d = gcd(x > y ? x - y : y - x, n);
    }
    if (d !== n) return d;
    c += 1n;
  }
}

function factorize(n: bigint): Map<string, number> {
  const factors = new Map<string, number>();
  let m = n;

  // Trial division for small primes.
  for (let p = 2n; p <= 100000n && p * p <= m; p++) {
    while (m % p === 0n) {
      factors.set(p.toString(), (factors.get(p.toString()) ?? 0) + 1);
      m /= p;
    }
  }

  // Remaining m may be 1, prime, or a product of large primes — recurse with rho.
  const stack: bigint[] = [];
  if (m > 1n) stack.push(m);
  while (stack.length) {
    const cur = stack.pop();
    if (cur === undefined || cur === 1n) continue;
    if (isProbablePrime(cur)) {
      factors.set(cur.toString(), (factors.get(cur.toString()) ?? 0) + 1);
      continue;
    }
    const d = pollardRho(cur);
    stack.push(d);
    stack.push(cur / d);
  }
  return factors;
}

export default function IntegerFactorization() {
  const [nStr, setNStr] = useState('360360');

  const result = useMemo(() => {
    const s = nStr.trim();
    if (!/^\d+$/.test(s)) return { error: 'Enter a positive integer.' };
    const n = BigInt(s);
    if (n < 1n) return { error: 'Enter a positive integer (n ≥ 1).' };
    if (s.length > 20) return { error: 'Keep n to 20 digits or fewer for reliable factoring.' };

    if (n === 1n) {
      return {
        factorStr: '1 (unit, no prime factors)',
        rows: [
          { label: 'Distinct primes ω(n)', value: '0' },
          { label: 'Prime factors Ω(n)', value: '0' },
          { label: "Euler totient φ(n)", value: '1' },
          { label: 'Divisor count d(n)', value: '1' },
          { label: 'Divisor sum σ(n)', value: '1' },
          { label: 'Radical rad(n)', value: '1' },
        ],
        copy: '1',
      };
    }

    const factors = factorize(n);
    const entries = Array.from(factors.entries())
      .map(([p, e]) => ({ p: BigInt(p), e }))
      .sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));

    const factorStr = entries
      .map(({ p, e }) => (e > 1 ? `${p}^${e}` : `${p}`))
      .join(' · ');

    const omega = entries.length;
    let bigOmega = 0;
    let phi = 1n;
    let dCount = 1n;
    let sigma = 1n;
    let radical = 1n;

    for (const { p, e } of entries) {
      bigOmega += e;
      // φ: ∏ p^(e-1) (p-1)
      phi *= p ** BigInt(e - 1) * (p - 1n);
      // d(n): ∏ (e+1)
      dCount *= BigInt(e + 1);
      // σ(n): ∏ (p^(e+1) - 1)/(p - 1)
      sigma *= (p ** BigInt(e + 1) - 1n) / (p - 1n);
      radical *= p;
    }

    const isPrime = omega === 1 && bigOmega === 1;

    return {
      factorStr: isPrime ? `${n} is prime` : factorStr,
      rows: [
        { label: 'Distinct primes ω(n)', value: omega.toString() },
        { label: 'Prime factors Ω(n)', value: bigOmega.toString() },
        { label: "Euler totient φ(n)", value: phi.toString() },
        { label: 'Divisor count d(n)', value: dCount.toString() },
        { label: 'Divisor sum σ(n)', value: sigma.toString() },
        { label: 'Radical rad(n)', value: radical.toString() },
      ],
      copy: factorStr,
    };
  }, [nStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Integer n">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" className="font-mono w-56" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Prime factorization">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="border-b p-3">
            <code className="block break-all font-mono text-base">{result.factorStr}</code>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Trial division + Pollard’s rho + Miller–Rabin']} />
        </Panel>
      )}
    </div>
  );
}
