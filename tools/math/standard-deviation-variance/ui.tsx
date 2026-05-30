'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'population' | 'sample';

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function StandardDeviationVarianceTool() {
  const [text, setText] = useState('4, 8, 15, 16, 23, 42');
  const [mode, setMode] = useState<Mode>('sample');

  const result = useMemo(() => {
    const tokens = text
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter((t) => t !== '');
    if (tokens.length === 0) return { error: 'Enter at least one number.' };

    const values: number[] = [];
    for (const tok of tokens) {
      const v = Number(tok);
      if (!Number.isFinite(v)) return { error: `"${tok}" is not a valid number.` };
      values.push(v);
    }

    const n = values.length;
    if (mode === 'sample' && n < 2) {
      return { error: 'Sample standard deviation needs at least 2 values.' };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const deviations = values.map((v) => {
      const dev = v - mean;
      return { value: v, dev, sq: dev * dev };
    });

    const ssd = deviations.reduce((a, d) => a + d.sq, 0); // sum of squared deviations
    const divisor = mode === 'population' ? n : n - 1;
    const variance = ssd / divisor;
    const stdev = Math.sqrt(variance);
    const cv = mean === 0 ? null : (stdev / Math.abs(mean)) * 100;

    const rows: { label: string; value: string }[] = [
      { label: 'Count (n)', value: String(n) },
      { label: 'Sum', value: num(sum) },
      { label: 'Mean (μ)', value: num(mean) },
      { label: 'Sum of squared deviations', value: num(ssd) },
      { label: `Variance (${mode}, ÷${divisor})`, value: num(variance) },
      { label: `Std deviation (${mode})`, value: num(stdev) },
      { label: 'Coefficient of variation', value: cv === null ? 'undefined (mean = 0)' : `${num(cv)} %` },
    ];

    return { rows, deviations, mean, n };
  }, [text, mode]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="population">Population</TabsTrigger>
                <TabsTrigger value="sample">Sample</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Values (comma, space or newline separated)" className="min-w-[260px] flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="min-h-[72px] font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Statistics">
              <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`n = ${result.n}`, `μ = ${num(result.mean)}`, `mode: ${mode}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Deviation breakdown" />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/40">
                  <tr className="text-left text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">x</th>
                    <th className="px-3 py-2 font-medium">x − μ</th>
                    <th className="px-3 py-2 font-medium">(x − μ)²</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {result.deviations.map((d, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{num(d.value)}</td>
                      <td className="px-3 py-1.5">{num(d.dev)}</td>
                      <td className="px-3 py-1.5">{num(d.sq)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
