'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

// Parse a term: empty/blank/"x"/"?" => unknown (null), else a finite number.
function parseTerm(s: string): { unknown: boolean; value: number; bad: boolean } {
  const t = s.trim().toLowerCase();
  if (t === '' || t === 'x' || t === '?') return { unknown: true, value: NaN, bad: false };
  const v = Number(t);
  if (!Number.isFinite(v)) return { unknown: false, value: NaN, bad: true };
  return { unknown: false, value: v, bad: false };
}

export default function ProportionSolver() {
  const [a, setA] = useState('2');
  const [b, setB] = useState('3');
  const [c, setC] = useState('x');
  const [d, setD] = useState('9');

  const result = useMemo(() => {
    const terms = [parseTerm(a), parseTerm(b), parseTerm(c), parseTerm(d)];
    const names = ['a', 'b', 'c', 'd'];

    if (terms.some((t) => t.bad)) {
      return { error: 'Each term must be a number, or "x" / blank for the unknown.' };
    }
    const unknownIdxs = terms
      .map((t, i) => (t.unknown ? i : -1))
      .filter((i) => i >= 0);
    if (unknownIdxs.length === 0) {
      return { error: 'Leave exactly one term blank (or "x") to mark the unknown.' };
    }
    if (unknownIdxs.length > 1) {
      return { error: 'Mark only one unknown — leave exactly one term blank or "x".' };
    }
    const uIdx = unknownIdxs[0] ?? 0;

    const av = terms[0]?.value ?? NaN;
    const bv = terms[1]?.value ?? NaN;
    const cv = terms[2]?.value ?? NaN;
    const dv = terms[3]?.value ?? NaN;

    // a/b = c/d  =>  a*d = b*c.
    let x: number;
    let step: string;
    switch (uIdx) {
      case 0: {
        // a = b*c/d
        if (dv === 0) return { error: 'Cannot solve: it would require dividing by zero.' };
        x = (bv * cv) / dv;
        step = `a = (b × c) / d = (${fmt(bv)} × ${fmt(cv)}) / ${fmt(dv)}`;
        break;
      }
      case 1: {
        // b = a*d/c
        if (cv === 0) return { error: 'Cannot solve: it would require dividing by zero.' };
        x = (av * dv) / cv;
        step = `b = (a × d) / c = (${fmt(av)} × ${fmt(dv)}) / ${fmt(cv)}`;
        break;
      }
      case 2: {
        // c = a*d/b
        if (bv === 0) return { error: 'Cannot solve: it would require dividing by zero.' };
        x = (av * dv) / bv;
        step = `c = (a × d) / b = (${fmt(av)} × ${fmt(dv)}) / ${fmt(bv)}`;
        break;
      }
      case 3: {
        // d = b*c/a
        if (av === 0) return { error: 'Cannot solve: it would require dividing by zero.' };
        x = (bv * cv) / av;
        step = `d = (b × c) / a = (${fmt(bv)} × ${fmt(cv)}) / ${fmt(av)}`;
        break;
      }
      default:
        return { error: 'Unexpected term position.' };
    }

    if (!Number.isFinite(x)) return { error: 'The proportion has no finite solution.' };

    const vals = [av, bv, cv, dv];
    vals[uIdx] = x;
    const [fa, fb, fc, fd] = vals as [number, number, number, number];

    const completed = `${fmt(fa)} / ${fmt(fb)} = ${fmt(fc)} / ${fmt(fd)}`;
    const crossLeft = fa * fd;
    const crossRight = fb * fc;

    // Simplified ratio a:b (only meaningful for integer-ish values).
    let simplified = '';
    if (Number.isInteger(fa) && Number.isInteger(fb) && fb !== 0) {
      const g = gcd(fa, fb) || 1;
      simplified = `${fa / g} : ${fb / g}`;
    }

    return {
      x,
      unknownName: names[uIdx] ?? 'x',
      step,
      completed,
      crossLeft,
      crossRight,
      crossOk: Math.abs(crossLeft - crossRight) < 1e-9,
      simplified,
    };
  }, [a, b, c, d]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="a">
              <Input value={a} onChange={(e) => setA(e.target.value)} className="w-20 font-mono" />
            </Field>
            <Field label="b">
              <Input value={b} onChange={(e) => setB(e.target.value)} className="w-20 font-mono" />
            </Field>
            <Field label="c">
              <Input value={c} onChange={(e) => setC(e.target.value)} className="w-20 font-mono" />
            </Field>
            <Field label="d">
              <Input value={d} onChange={(e) => setD(e.target.value)} className="w-20 font-mono" />
            </Field>
          </OptionsBar>
        </Panel>
        <p className="px-1 text-xs text-muted-foreground">
          Form: a / b = c / d. Leave one term blank or type &quot;x&quot; for the unknown.
        </p>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const rows = [
    { label: `Unknown ${result.unknownName}`, value: fmt(result.x) },
    { label: 'Completed proportion', value: result.completed },
    {
      label: 'Cross-product check',
      value: `${fmt(result.crossLeft)} ${result.crossOk ? '=' : '≈'} ${fmt(result.crossRight)}`,
    },
  ];
  if (result.simplified) rows.push({ label: 'Simplified ratio a:b', value: result.simplified });

  const copy = rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="a">
            <Input value={a} onChange={(e) => setA(e.target.value)} className="w-20 font-mono" />
          </Field>
          <Field label="b">
            <Input value={b} onChange={(e) => setB(e.target.value)} className="w-20 font-mono" />
          </Field>
          <Field label="c">
            <Input value={c} onChange={(e) => setC(e.target.value)} className="w-20 font-mono" />
          </Field>
          <Field label="d">
            <Input value={d} onChange={(e) => setD(e.target.value)} className="w-20 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>
      <p className="px-1 text-xs text-muted-foreground">
        Form: a / b = c / d. Leave one term blank or type &quot;x&quot; for the unknown.
      </p>

      <Panel>
        <PanelHeader title="Solution">
          <CopyButton value={() => copy} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
            {result.step} = {fmt(result.x)}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <StatBar
          items={[`${result.unknownName} = ${fmt(result.x)}`, 'Cross-multiplication']}
        />
      </Panel>
    </div>
  );
}
