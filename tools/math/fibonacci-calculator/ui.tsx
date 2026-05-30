'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SeqType = 'fibonacci' | 'lucas';

const MAX_N = 50000;
const MAX_LIST = 200;

// Fast-doubling: returns [F(n), F(n+1)].
function fibPair(n: bigint): [bigint, bigint] {
  if (n === 0n) return [0n, 1n];
  const [a, b] = fibPair(n >> 1n);
  const c = a * (2n * b - a);
  const d = a * a + b * b;
  if ((n & 1n) === 0n) return [c, d];
  return [d, c + d];
}

function fib(n: bigint): bigint {
  return fibPair(n)[0];
}

// L(n) = F(n-1) + F(n+1).
function lucas(n: bigint): bigint {
  if (n === 0n) return 2n;
  const [fn, fn1] = fibPair(n); // F(n), F(n+1)
  const fnm1 = fn1 - fn; // F(n-1)
  return fnm1 + fn1;
}

function sci(value: bigint): string {
  const s = value.toString();
  if (s.length <= 1) return s;
  const exp = s.length - 1;
  const first = s[0] ?? '0';
  const rest = s.slice(1, 5);
  return `${first}.${rest}e+${exp}`;
}

export default function FibonacciCalculator() {
  const [seq, setSeq] = useState<SeqType>('fibonacci');
  const [nStr, setNStr] = useState('100');
  const [countStr, setCountStr] = useState('15');

  const result = useMemo(() => {
    const nNum = Number(nStr);
    if (!Number.isInteger(nNum) || nNum < 0) return { error: 'Enter a non-negative integer index n.' };
    if (nNum > MAX_N) return { error: `Keep n at or below ${MAX_N.toLocaleString()} for performance.` };

    const countNum = Number(countStr);
    if (!Number.isInteger(countNum) || countNum < 1) return { error: 'Count must be a positive integer.' };
    const count = Math.min(countNum, MAX_LIST);

    const n = BigInt(nNum);
    const term = seq === 'fibonacci' ? fib(n) : lucas(n);
    const termStr = term.toString();

    // Build the listed sequence iteratively from index 0.
    const list: string[] = [];
    if (seq === 'fibonacci') {
      let x = 0n;
      let y = 1n;
      for (let i = 0; i < count; i++) {
        list.push(x.toString());
        const next = x + y;
        x = y;
        y = next;
      }
    } else {
      let x = 2n;
      let y = 1n;
      for (let i = 0; i < count; i++) {
        list.push(x.toString());
        const next = x + y;
        x = y;
        y = next;
      }
    }

    // Ratio approaching golden ratio.
    let ratio = '—';
    if (nNum >= 2) {
      const prev = seq === 'fibonacci' ? fib(n - 1n) : lucas(n - 1n);
      if (prev !== 0n) {
        // Use Number for the float ratio (terms may be huge; scale by digit length).
        const tStr = termStr;
        const pStr = prev.toString();
        const tf = Number(tStr.slice(0, 17));
        const pf = Number(pStr.slice(0, 17));
        const diff = tStr.length - pStr.length;
        if (pf !== 0) ratio = ((tf / pf) * Math.pow(10, diff)).toFixed(15);
      }
    }

    return {
      rows: [
        { label: `${seq === 'fibonacci' ? 'F' : 'L'}(${nNum})`, value: termStr },
        { label: 'Digit count', value: termStr.length.toString() },
        { label: 'Scientific approx.', value: sci(term) },
        { label: 'Ratio to previous term (→ φ)', value: ratio },
      ],
      copy: termStr,
      list,
      listCount: count,
    };
  }, [seq, nStr, countStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Sequence">
            <Tabs value={seq} onValueChange={(v) => setSeq(v as SeqType)}>
              <TabsList>
                <TabsTrigger value="fibonacci">Fibonacci</TabsTrigger>
                <TabsTrigger value="lucas">Lucas</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Index n">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="List count">
            <Input value={countStr} onChange={(e) => setCountStr(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="nth term">
              <CopyButton value={() => result.copy} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                  <span className="flex min-w-0 items-start gap-2 font-mono text-sm">
                    <span className="break-all text-right">{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title={`Sequence (first ${result.listCount})`}>
              <CopyButton value={() => result.list.join(', ')} />
            </PanelHeader>
            <code className="block break-all p-3 font-mono text-xs leading-relaxed">
              {result.list.join(', ')}
            </code>
            <StatBar items={[`Type: ${seq}`, `${result.listCount} terms listed`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
