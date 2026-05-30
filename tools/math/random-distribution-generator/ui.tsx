'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Dist = 'uniform' | 'normal' | 'exponential' | 'poisson';

const MAX_N = 100_000;

// A crypto-seeded uniform in [0, 1). Uses 32 random bits.
function unif(): number {
  const buf = new Uint32Array(1);
  wc.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
}

// Avoid exactly 0 for log-based transforms.
function unifOpen(): number {
  let u = unif();
  while (u <= 0) u = unif();
  return u;
}

function poissonKnuth(lambda: number): number {
  // Knuth's multiplicative algorithm; fine for moderate lambda.
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= unif();
  } while (p > L);
  return k - 1;
}

interface Result {
  values: number[];
  min: number;
  max: number;
  mean: number;
  stddev: number;
  isInteger: boolean;
}

function summarize(values: number[], isInteger: boolean): Result {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const n = values.length;
  const mean = n > 0 ? sum / n : 0;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) * (v - mean);
  const stddev = n > 0 ? Math.sqrt(varSum / n) : 0;
  return { values, min: n ? min : 0, max: n ? max : 0, mean, stddev, isInteger };
}

function histogram(r: Result, width = 24): string[] {
  if (r.values.length === 0) return [];
  const bins = r.isInteger
    ? Math.min(20, Math.max(1, Math.round(r.max - r.min) + 1))
    : 12;
  const span = r.max - r.min || 1;
  const counts = new Array<number>(bins).fill(0);
  for (const v of r.values) {
    let idx = Math.floor(((v - r.min) / span) * bins);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const maxCount = Math.max(...counts, 1);
  const lines: string[] = [];
  for (let i = 0; i < bins; i++) {
    const c = counts[i] ?? 0;
    const lo = r.min + (span * i) / bins;
    const barLen = Math.round((c / maxCount) * width);
    const range = r.isInteger
      ? `${Math.round(lo)}`.padStart(6)
      : `${lo.toFixed(2)}`.padStart(8);
    lines.push(`${range} | ${'█'.repeat(barLen)}${' '.repeat(width - barLen)} ${c}`);
  }
  return lines;
}

export default function RandomDistributionTool() {
  const [dist, setDist] = useState<Dist>('normal');
  const [nStr, setNStr] = useState('1000');
  const [p1, setP1] = useState('0'); // uniform min / normal mean / exp rate / poisson lambda
  const [p2, setP2] = useState('1'); // uniform max / normal stddev
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);
    const n = Number(nStr.trim());
    if (!Number.isInteger(n) || n < 1) {
      setError('Sample count must be a positive integer.');
      setResult(null);
      return;
    }
    if (n > MAX_N) {
      setError(`Keep the sample count at or below ${MAX_N.toLocaleString()}.`);
      setResult(null);
      return;
    }
    const a = Number(p1.trim());
    const b = Number(p2.trim());

    const values = new Array<number>(n);
    let isInteger = false;

    switch (dist) {
      case 'uniform': {
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          setError('Enter valid min and max.');
          setResult(null);
          return;
        }
        if (b <= a) {
          setError('Max must be greater than min.');
          setResult(null);
          return;
        }
        for (let i = 0; i < n; i++) values[i] = a + unif() * (b - a);
        break;
      }
      case 'normal': {
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          setError('Enter valid mean and standard deviation.');
          setResult(null);
          return;
        }
        if (b <= 0) {
          setError('Standard deviation must be positive.');
          setResult(null);
          return;
        }
        // Box-Muller transform.
        for (let i = 0; i < n; i++) {
          const u1 = unifOpen();
          const u2 = unif();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          values[i] = a + z * b;
        }
        break;
      }
      case 'exponential': {
        if (!Number.isFinite(a) || a <= 0) {
          setError('Rate λ must be positive.');
          setResult(null);
          return;
        }
        for (let i = 0; i < n; i++) values[i] = -Math.log(unifOpen()) / a;
        break;
      }
      case 'poisson': {
        if (!Number.isFinite(a) || a <= 0) {
          setError('Mean λ must be positive.');
          setResult(null);
          return;
        }
        if (a > 700) {
          setError('Keep Poisson λ at or below 700.');
          setResult(null);
          return;
        }
        isInteger = true;
        for (let i = 0; i < n; i++) values[i] = poissonKnuth(a);
        break;
      }
      default: {
        setError('Unknown distribution.');
        setResult(null);
        return;
      }
    }

    setResult(summarize(values, isInteger));
  }, [dist, nStr, p1, p2]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = (n: number) => (Math.round(n * 1e4) / 1e4).toString();
  const valuesText = result
    ? result.values.map((v) => (result.isInteger ? String(v) : f(v))).join('\n')
    : '';
  const csvText = result
    ? result.values.map((v) => (result.isInteger ? String(v) : f(v))).join(',')
    : '';
  const histLines = result ? histogram(result) : [];

  const labels: Record<Dist, [string, string | null]> = {
    uniform: ['Min', 'Max'],
    normal: ['Mean (μ)', 'Std dev (σ)'],
    exponential: ['Rate (λ)', null],
    poisson: ['Mean (λ)', null],
  };
  const labelPair = labels[dist];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Distribution" className="min-w-[160px]">
            <Select value={dist} onValueChange={(v) => setDist(v as Dist)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniform</SelectItem>
                <SelectItem value="normal">Normal (Gaussian)</SelectItem>
                <SelectItem value="exponential">Exponential</SelectItem>
                <SelectItem value="poisson">Poisson</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Samples (N)">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" className="w-28 font-mono" />
          </Field>
          <Field label={labelPair[0]}>
            <Input value={p1} onChange={(e) => setP1(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          {labelPair[1] !== null && (
            <Field label={labelPair[1]}>
              <Input value={p2} onChange={(e) => setP2(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
            </Field>
          )}
          <div className="ml-auto flex items-end">
            <Button variant="secondary" size="sm" onClick={generate}>
              <RefreshCw className="size-3.5" /> Generate
            </Button>
          </div>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {result && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Count', value: result.values.length.toLocaleString() },
              { label: 'Mean', value: f(result.mean) },
              { label: 'Std dev', value: f(result.stddev) },
              { label: 'Min / Max', value: `${f(result.min)} / ${f(result.max)}` },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <span className="font-mono text-sm">{s.value}</span>
              </div>
            ))}
          </div>

          <Panel>
            <PanelHeader title="Histogram (shape)">
              <CopyButton value={() => histLines.join('\n')} />
            </PanelHeader>
            <pre className="max-h-[280px] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
              {histLines.join('\n')}
            </pre>
          </Panel>

          <Panel>
            <PanelHeader title="Samples">
              <CopyButton value={() => valuesText} label="Copy" />
              <CopyButton value={() => csvText} label="Copy CSV" />
              <DownloadButton data={() => valuesText} filename="samples.txt" />
            </PanelHeader>
            <pre className="max-h-[300px] overflow-auto px-3 py-2 font-mono text-xs">
              {result.values.length > 2000
                ? `${result.values
                    .slice(0, 2000)
                    .map((v) => (result.isInteger ? String(v) : f(v)))
                    .join('\n')}\n… ${(result.values.length - 2000).toLocaleString()} more (Copy/Download for all)`
                : valuesText}
            </pre>
            <StatBar
              items={[
                `${result.values.length.toLocaleString()} samples`,
                `crypto-seeded RNG`,
                `μ̂ = ${f(result.mean)}`,
                `σ̂ = ${f(result.stddev)}`,
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
