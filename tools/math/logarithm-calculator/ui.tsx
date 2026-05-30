'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

type Mode = 'log' | 'antilog';

type Result =
  | { error: string }
  | {
      rows: { label: string; value: string }[];
      step: string;
      mode: Mode;
    };

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(8).replace(/\.?0+$/, '');
}

export default function LogarithmCalculator() {
  const [mode, setMode] = useState<Mode>('log');
  const [value, setValue] = useState('1000');
  const [base, setBase] = useState('10');

  const result = useMemo<Result>(() => {
    const x = Number(value);
    const b = Number(base);
    if (!Number.isFinite(x)) return { error: 'Enter a valid value for x.' };
    if (!Number.isFinite(b)) return { error: 'Enter a valid base.' };
    if (b <= 0 || b === 1) return { error: 'Base must be positive and not equal to 1.' };

    if (mode === 'log') {
      if (x <= 0) return { error: 'Logarithms are only defined for x > 0.' };
      const logB = Math.log(x) / Math.log(b);
      const ln = Math.log(x);
      const l10 = Math.log10(x);
      const l2 = Math.log2(x);
      return {
        mode,
        step: `log_${fmt(b)}(${fmt(x)}) = ln(${fmt(x)}) / ln(${fmt(b)}) = ${fmt(ln)} / ${fmt(
          Math.log(b)
        )} = ${fmt(logB)}`,
        rows: [
          { label: `log base ${fmt(b)} of x`, value: fmt(logB) },
          { label: 'ln(x) — natural log', value: fmt(ln) },
          { label: 'log10(x) — common log', value: fmt(l10) },
          { label: 'log2(x) — binary log', value: fmt(l2) },
        ],
      };
    }

    // antilog: b^x
    const anti = Math.pow(b, x);
    if (!Number.isFinite(anti)) return { error: 'Result overflowed — use a smaller exponent.' };
    return {
      mode,
      step: `antilog: ${fmt(b)}^${fmt(x)} = ${fmt(anti)}`,
      rows: [
        { label: `${fmt(b)} raised to x (antilog)`, value: fmt(anti) },
        { label: 'e^x (natural antilog)', value: fmt(Math.exp(x)) },
        { label: '10^x (common antilog)', value: fmt(Math.pow(10, x)) },
        { label: '2^x (binary antilog)', value: fmt(Math.pow(2, x)) },
      ],
    };
  }, [mode, value, base]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="log">Logarithm</TabsTrigger>
                <TabsTrigger value="antilog">Antilog</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={mode === 'log' ? 'Value x' : 'Exponent x'}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Base b" hint="presets:">
            <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Base presets">
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setBase('10')}>
                10
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBase(String(Math.E))}>
                e
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBase('2')}>
                2
              </Button>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-2xs text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                    <span>{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`Mode: ${result.mode}`, `x = ${value}`, `b = ${base}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Change-of-base formula" />
            <div className="p-3 font-mono text-xs text-muted-foreground">{result.step}</div>
          </Panel>
        </>
      )}
    </div>
  );
}
