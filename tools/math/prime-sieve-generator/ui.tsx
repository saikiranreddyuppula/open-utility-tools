'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ModeKind = 'upto' | 'firstK';
type Format = 'comma' | 'space' | 'newline' | 'array';

const MAX_N = 5_000_000;
const MAX_K = 200_000;

// Sieve of Eratosthenes up to n inclusive. Returns the prime list.
function sieveUpTo(n: number): number[] {
  if (n < 2) return [];
  const composite = new Uint8Array(n + 1);
  const limit = Math.floor(Math.sqrt(n));
  for (let p = 2; p <= limit; p++) {
    if (composite[p] === 0) {
      for (let m = p * p; m <= n; m += p) composite[m] = 1;
    }
  }
  const primes: number[] = [];
  for (let i = 2; i <= n; i++) if (composite[i] === 0) primes.push(i);
  return primes;
}

// Estimate an upper bound for the k-th prime, then sieve and trim.
function firstKPrimes(k: number): number[] {
  if (k < 1) return [];
  if (k < 6) {
    return [2, 3, 5, 7, 11].slice(0, k);
  }
  // p_k < k(ln k + ln ln k) for k >= 6
  const lnk = Math.log(k);
  const bound = Math.ceil(k * (lnk + Math.log(lnk))) + 10;
  const primes = sieveUpTo(bound);
  return primes.slice(0, k);
}

function formatPrimes(primes: number[], fmt: Format): string {
  switch (fmt) {
    case 'comma':
      return primes.join(', ');
    case 'space':
      return primes.join(' ');
    case 'newline':
      return primes.join('\n');
    case 'array':
      return `[${primes.join(', ')}]`;
    default:
      return primes.join(', ');
  }
}

export default function PrimeSieveTool() {
  const [mode, setMode] = useState<ModeKind>('upto');
  const [nStr, setNStr] = useState('100');
  const [kStr, setKStr] = useState('25');
  const [fmt, setFmt] = useState<Format>('comma');

  const result = useMemo(() => {
    let primes: number[];
    if (mode === 'upto') {
      const n = Number(nStr.trim());
      if (!Number.isInteger(n) || n < 0) return { error: 'Enter a non-negative integer for N.' as string };
      if (n > MAX_N) return { error: `Keep N at or below ${MAX_N.toLocaleString()} to stay responsive.` };
      primes = sieveUpTo(n);
    } else {
      const k = Number(kStr.trim());
      if (!Number.isInteger(k) || k < 1) return { error: 'Enter a positive integer for K.' };
      if (k > MAX_K) return { error: `Keep K at or below ${MAX_K.toLocaleString()}.` };
      primes = firstKPrimes(k);
    }

    let sum = 0;
    let largestGap = 0;
    let gapPair: [number, number] | null = null;
    const twins: [number, number][] = [];
    for (let i = 0; i < primes.length; i++) {
      const p = primes[i];
      if (p === undefined) continue;
      sum += p;
      if (i > 0) {
        const prev = primes[i - 1];
        if (prev !== undefined) {
          const gap = p - prev;
          if (gap > largestGap) {
            largestGap = gap;
            gapPair = [prev, p];
          }
          if (gap === 2) twins.push([prev, p]);
        }
      }
    }

    const largest = primes.length > 0 ? primes[primes.length - 1] ?? 0 : 0;
    return { primes, sum, largestGap, gapPair, twins, count: primes.length, largest };
  }, [mode, nStr, kStr]);

  const text = useMemo(
    () => ('error' in result ? '' : formatPrimes(result.primes, fmt)),
    [result, fmt],
  );

  // Cap rendered chips to keep DOM light; full list is still copyable/downloadable.
  const preview = useMemo(() => {
    if ('error' in result) return [];
    return result.primes.slice(0, 2000);
  }, [result]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode" className="min-w-[220px]">
            <Tabs value={mode} onValueChange={(v) => setMode(v as ModeKind)}>
              <TabsList>
                <TabsTrigger value="upto">Primes up to N</TabsTrigger>
                <TabsTrigger value="firstK">First K primes</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'upto' ? (
            <Field label="Upper bound N">
              <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" className="w-32 font-mono" />
            </Field>
          ) : (
            <Field label="Count K">
              <Input value={kStr} onChange={(e) => setKStr(e.target.value)} inputMode="numeric" className="w-32 font-mono" />
            </Field>
          )}
          <Field label="Format">
            <Select value={fmt} onValueChange={(v) => setFmt(v as Format)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="space">Space</SelectItem>
                <SelectItem value="newline">Newline</SelectItem>
                <SelectItem value="array">JS array</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'π(N) / count', value: result.count.toLocaleString() },
              { label: 'Largest prime', value: result.largest.toLocaleString() },
              { label: 'Sum of primes', value: result.sum.toLocaleString() },
              {
                label: 'Largest gap',
                value: result.gapPair
                  ? `${result.largestGap} (${result.gapPair[0]}→${result.gapPair[1]})`
                  : '—',
              },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <span className="font-mono text-sm">{s.value}</span>
              </div>
            ))}
          </div>

          <Panel>
            <PanelHeader title={`Primes (${result.count.toLocaleString()})`}>
              <CopyButton value={() => text} disabled={!text} />
              <DownloadButton data={() => text} filename="primes.txt" disabled={!text} />
            </PanelHeader>
            <div className="max-h-[360px] overflow-auto p-3">
              {result.count === 0 ? (
                <span className="text-sm text-muted-foreground">No primes in this range.</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {preview.map((p) => (
                    <code key={p} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                      {p}
                    </code>
                  ))}
                  {result.count > preview.length && (
                    <span className="self-center px-1 text-2xs text-muted-foreground">
                      …and {(result.count - preview.length).toLocaleString()} more (use Copy/Download for all)
                    </span>
                  )}
                </div>
              )}
            </div>
            <StatBar
              items={[
                `${result.count.toLocaleString()} primes`,
                `${result.twins.length.toLocaleString()} twin pairs`,
                `largest gap ${result.largestGap}`,
              ]}
            />
          </Panel>

          {result.twins.length > 0 && (
            <Panel>
              <PanelHeader title={`Twin primes (${result.twins.length.toLocaleString()})`}>
                <CopyButton value={() => result.twins.map((t) => `(${t[0]}, ${t[1]})`).join(', ')} />
              </PanelHeader>
              <div className="max-h-[200px] overflow-auto p-3">
                <div className="flex flex-wrap gap-1">
                  {result.twins.slice(0, 1000).map((t) => (
                    <code key={`${t[0]}-${t[1]}`} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                      ({t[0]}, {t[1]})
                    </code>
                  ))}
                  {result.twins.length > 1000 && (
                    <span className="self-center px-1 text-2xs text-muted-foreground">
                      …and {(result.twins.length - 1000).toLocaleString()} more
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
