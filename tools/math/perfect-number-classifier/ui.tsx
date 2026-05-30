'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const MAX_N = 100_000_000;

// Sum of proper divisors (aliquot sum) for 1 <= n <= MAX_N.
function aliquotSum(n: number): number {
  if (n <= 1) return 0;
  let sum = 1; // 1 is always a proper divisor for n > 1
  const root = Math.floor(Math.sqrt(n));
  for (let d = 2; d <= root; d++) {
    if (n % d === 0) {
      sum += d;
      const pair = n / d;
      if (pair !== d) sum += pair;
    }
  }
  return sum;
}

// List proper divisors (capped to avoid huge UI lists).
function properDivisors(n: number, cap: number): { list: number[]; truncated: boolean } {
  const list: number[] = [];
  if (n <= 1) return { list, truncated: false };
  const small: number[] = [];
  const large: number[] = [];
  const root = Math.floor(Math.sqrt(n));
  for (let d = 1; d <= root; d++) {
    if (n % d === 0) {
      small.push(d);
      const pair = n / d;
      if (pair !== d && pair !== n) large.push(pair);
    }
  }
  large.reverse();
  const all = small.concat(large);
  const truncated = all.length > cap;
  return { list: truncated ? all.slice(0, cap) : all, truncated };
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// Smallest prime factor (or n itself if prime). n >= 2.
function smallestFactor(n: number): number {
  if (n % 2 === 0) return 2;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return i;
  }
  return n;
}

function isSemiprime(n: number): boolean {
  if (n < 4) return false;
  const p = smallestFactor(n);
  if (p === n) return false; // prime
  const q = n / p;
  return isPrime(q);
}

function isTriangular(n: number): boolean {
  if (n < 1) return false;
  // n = k(k+1)/2  =>  8n+1 is a perfect square
  const x = 8 * n + 1;
  const r = Math.round(Math.sqrt(x));
  return r * r === x;
}

function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

function isFibonacci(n: number): boolean {
  // n is Fibonacci iff 5n²+4 or 5n²-4 is a perfect square.
  return isPerfectSquare(5 * n * n + 4) || isPerfectSquare(5 * n * n - 4);
}

function isPalindrome(n: number): boolean {
  const s = n.toString();
  return s === s.split('').reverse().join('');
}

function digitSum(n: number): number {
  let s = 0;
  let x = n;
  while (x > 0) {
    s += x % 10;
    x = Math.floor(x / 10);
  }
  return s;
}

interface Flag {
  label: string;
  desc: string;
}

export default function PerfectNumberClassifier() {
  const [input, setInput] = useState('28');

  const result = useMemo(() => {
    const nNum = Number(input.trim());
    if (input.trim() === '' || !Number.isInteger(nNum)) {
      return { error: 'Enter a positive integer.' };
    }
    if (nNum < 1) return { error: 'Enter a positive integer (1 or greater).' };
    if (nNum > MAX_N) {
      return { error: `Keep the number at or below ${MAX_N.toLocaleString()} for performance.` };
    }

    const n = nNum;
    const s = aliquotSum(n);

    let classification: string;
    let classDesc: string;
    if (s === n) {
      classification = 'Perfect';
      classDesc = `Its proper divisors sum exactly to ${n}.`;
    } else if (s > n) {
      classification = 'Abundant';
      classDesc = `Divisor sum exceeds the number by ${s - n}.`;
    } else {
      classification = 'Deficient';
      classDesc = `Divisor sum falls short of the number by ${n - s}.`;
    }

    const { list, truncated } = properDivisors(n, 200);

    // Special-number flags.
    const flags: Flag[] = [];
    if (isPrime(n)) flags.push({ label: 'Prime', desc: 'Divisible only by 1 and itself.' });
    if (isSemiprime(n)) {
      flags.push({ label: 'Semiprime', desc: 'Product of exactly two primes.' });
    }
    if (isPerfectSquare(n)) {
      flags.push({ label: 'Perfect square', desc: `${Math.round(Math.sqrt(n))}² = ${n}.` });
    }
    if (isTriangular(n)) {
      const k = (Math.sqrt(8 * n + 1) - 1) / 2;
      flags.push({ label: 'Triangular', desc: `Equals 1+2+…+${Math.round(k)}.` });
    }
    if (isFibonacci(n)) {
      flags.push({ label: 'Fibonacci', desc: 'Appears in the Fibonacci sequence.' });
    }
    if (isPalindrome(n)) {
      flags.push({ label: 'Palindrome', desc: 'Reads the same forwards and backwards.' });
    }
    const ds = digitSum(n);
    if (ds > 0 && n % ds === 0) {
      flags.push({ label: 'Harshad (Niven)', desc: `Divisible by its digit sum (${ds}).` });
    }

    // Amicable partner: s(s(n)) = n and s(n) != n.
    let amicable: string | null = null;
    if (s !== n && s >= 1 && s <= MAX_N) {
      const s2 = aliquotSum(s);
      if (s2 === n) {
        amicable = `${n} and ${s} are amicable: each is the aliquot sum of the other.`;
      }
    }

    return {
      n,
      s,
      classification,
      classDesc,
      divisors: list,
      divisorsTruncated: truncated,
      flags,
      amicable,
    };
  }, [input]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="Integer (n)">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                inputMode="numeric"
                className="w-40 font-mono"
              />
            </Field>
          </OptionsBar>
        </Panel>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const summary = [
    `n = ${result.n}`,
    `Aliquot sum s(n) = ${result.s}`,
    `Classification: ${result.classification}`,
    `Proper divisors: ${result.divisors.join(', ')}${result.divisorsTruncated ? ' …' : ''}`,
    result.amicable ?? '',
    ...result.flags.map((f) => `${f.label}: ${f.desc}`),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Integer (n)">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode="numeric"
              className="w-40 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Classification">
          <CopyButton value={() => summary} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-3">
            <Badge className="text-sm">{result.classification}</Badge>
            <span className="text-sm text-muted-foreground">{result.classDesc}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Aliquot sum s(n)</span>
              <span className="font-mono text-sm">{result.s.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">s(n) − n</span>
              <span className="font-mono text-sm">{(result.s - result.n).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground"># proper divisors</span>
              <span className="font-mono text-sm">
                {result.divisors.length}
                {result.divisorsTruncated ? '+' : ''}
              </span>
            </div>
          </div>
        </div>
        <StatBar items={[`n = ${result.n}`, `s(n) = ${result.s}`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Proper divisors">
          <CopyButton value={result.divisors.join(', ')} size="icon-sm" />
        </PanelHeader>
        <div className="p-3">
          <code className="block break-all font-mono text-xs">
            {result.divisors.length > 0 ? result.divisors.join(', ') : '(none)'}
            {result.divisorsTruncated ? ' …' : ''}
          </code>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Special-number flags" />
        <div className="p-3">
          {result.amicable && (
            <div className="mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              {result.amicable}
            </div>
          )}
          {result.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No special types matched for this number.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.flags.map((f) => (
                <div
                  key={f.label}
                  className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <Badge variant="secondary" className="shrink-0">
                    {f.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{f.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
