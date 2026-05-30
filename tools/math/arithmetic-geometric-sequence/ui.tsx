'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'arithmetic' | 'geometric';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  return n.toPrecision(10).replace(/\.?0+$/, '');
}

export default function ArithGeoSequenceTool() {
  const [mode, setMode] = useState<Mode>('arithmetic');
  const [a1, setA1] = useState('2');
  const [dr, setDr] = useState('3');
  const [n, setN] = useState('10');

  const result = useMemo(() => {
    const first = Number(a1);
    const step = Number(dr);
    const nVal = Number(n);

    if (!Number.isFinite(first) || !Number.isFinite(step)) {
      return { error: 'Enter valid numbers for the first term and difference/ratio.' };
    }
    if (!Number.isFinite(nVal) || nVal < 1 || !Number.isInteger(nVal)) {
      return { error: 'Term index n must be a positive integer.' };
    }
    if (nVal > 10000) {
      return { error: 'Keep n at 10000 or below.' };
    }

    const listCount = Math.min(nVal, 100);
    const rows: { label: string; value: string }[] = [];
    const terms: number[] = [];

    if (mode === 'arithmetic') {
      const nth = first + (nVal - 1) * step;
      const sum = (nVal / 2) * (2 * first + (nVal - 1) * step);
      for (let i = 1; i <= listCount; i++) terms.push(first + (i - 1) * step);
      rows.push({ label: `nth term (a${nVal})`, value: fmt(nth) });
      rows.push({ label: `Partial sum (S${nVal})`, value: fmt(sum) });
      rows.push({ label: 'Common difference d', value: fmt(step) });
      return { rows, terms, listCount, hasInfinite: false as const, infinite: '' };
    }

    // geometric
    const r = step;
    const nth = first * Math.pow(r, nVal - 1);
    const sum = r === 1 ? first * nVal : (first * (Math.pow(r, nVal) - 1)) / (r - 1);
    for (let i = 1; i <= listCount; i++) terms.push(first * Math.pow(r, i - 1));
    rows.push({ label: `nth term (a${nVal})`, value: fmt(nth) });
    rows.push({ label: `Partial sum (S${nVal})`, value: fmt(sum) });
    rows.push({ label: 'Common ratio r', value: fmt(r) });

    let infinite = '';
    const hasInfinite = Math.abs(r) < 1;
    if (hasInfinite) {
      infinite = fmt(first / (1 - r));
      rows.push({ label: 'Infinite sum (|r|<1)', value: infinite });
    }
    return { rows, terms, listCount, hasInfinite, infinite };
  }, [mode, a1, dr, n]);

  const stepLabel = mode === 'arithmetic' ? 'Common difference d' : 'Common ratio r';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Type">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="arithmetic">Arithmetic</TabsTrigger>
                <TabsTrigger value="geometric">Geometric</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="First term a₁">
            <Input
              value={a1}
              onChange={(e) => setA1(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
          <Field label={stepLabel}>
            <Input
              value={dr}
              onChange={(e) => setDr(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Term index n">
            <Input
              value={n}
              onChange={(e) => setN(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Results">
              <CopyButton
                value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
              />
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
            <StatBar
              items={[
                mode === 'arithmetic' ? 'Arithmetic' : 'Geometric',
                `a₁ = ${a1}`,
                `n = ${n}`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title={`First ${result.listCount} terms`}>
              <CopyButton value={() => result.terms.map(fmt).join(', ')} />
            </PanelHeader>
            <div className="p-3 font-mono text-sm leading-relaxed">
              {result.terms.map(fmt).join(', ')}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
