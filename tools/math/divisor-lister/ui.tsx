'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const MAX_N = 100_000_000; // sqrt loop stays fast (≤10k iterations)

type Result =
  | { error: string }
  | {
      n: number;
      divisors: number[];
      pairs: { a: number; b: number }[];
      count: number;
      sigma: number;
      aliquot: number;
      classification: string;
    };

export default function DivisorLister() {
  const [input, setInput] = useState('360');
  const [proper, setProper] = useState(false);
  const [pairsOnly, setPairsOnly] = useState(false);

  const result = useMemo<Result>(() => {
    const t = input.trim();
    if (t === '') return { error: 'Enter a positive integer.' };
    if (!/^\d+$/.test(t)) return { error: 'Enter a positive whole number (digits only).' };
    const n = Number(t);
    if (!Number.isSafeInteger(n) || n < 1) return { error: 'Enter a valid positive integer.' };
    if (n > MAX_N) return { error: `Keep the number at or below ${MAX_N.toLocaleString()}.` };

    const small: number[] = [];
    const large: number[] = [];
    const pairs: { a: number; b: number }[] = [];
    for (let i = 1; i * i <= n; i++) {
      if (n % i === 0) {
        const j = n / i;
        small.push(i);
        pairs.push({ a: i, b: j });
        if (j !== i) large.push(j);
      }
    }
    large.reverse();
    const divisors = [...small, ...large];
    const sigma = divisors.reduce((a, b) => a + b, 0);
    const aliquot = sigma - n;
    const count = divisors.length;

    let classification: string;
    if (n === 1) classification = 'unit (1)';
    else if (aliquot === n) classification = 'perfect number';
    else if (aliquot > n) classification = 'abundant number';
    else classification = 'deficient number';

    return { n, divisors, pairs, count, sigma, aliquot, classification };
  }, [input]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="Number">
              <Input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" className="font-mono" />
            </Field>
          </OptionsBar>
        </Panel>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const shown = proper ? result.divisors.filter((d) => d !== result.n) : result.divisors;
  // product of all divisors = n^(d/2), shown as a check
  const productCheck = `${result.n}^(${result.count}/2) = ${result.n}^${result.count / 2}`;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number">
            <Input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" className="font-mono" />
          </Field>
          <Field label="Proper divisors only">
            <Switch checked={proper} onCheckedChange={setProper} />
          </Field>
          <Field label="Show pairs only">
            <Switch checked={pairsOnly} onCheckedChange={setPairsOnly} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Summary">
          <CopyButton value={() => result.divisors.join(', ')} />
        </PanelHeader>
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat label="Divisor count d(n)" value={result.count.toString()} />
          <Stat label="Divisor sum σ(n)" value={result.sigma.toString()} />
          <Stat label="Aliquot sum σ(n)−n" value={result.aliquot.toString()} />
          <Stat label="Classification" value={result.classification} />
        </div>
        <StatBar items={[`Product of divisors = ${productCheck}`]} />
      </Panel>

      {pairsOnly ? (
        <Panel>
          <PanelHeader title="Divisor pairs (i × n/i)">
            <CopyButton value={() => result.pairs.map((p) => `${p.a} × ${p.b}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-2 gap-2 p-3 font-mono text-sm sm:grid-cols-3">
            {result.pairs.map((p) => (
              <div key={p.a} className="rounded-md border bg-muted/30 px-3 py-1.5 text-center">
                {p.a} × {p.b}
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title={proper ? 'Proper divisors' : 'All divisors'}>
            <CopyButton value={() => shown.join(', ')} />
          </PanelHeader>
          <div className="flex flex-wrap gap-2 p-3">
            {shown.map((d) => (
              <code key={d} className="rounded-md border bg-muted/30 px-2 py-1 font-mono text-sm">
                {d}
              </code>
            ))}
          </div>
          <StatBar items={[`${shown.length} divisors shown`]} />
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-semibold">{value}</span>
    </div>
  );
}
