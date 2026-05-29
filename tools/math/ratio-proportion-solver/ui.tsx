'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function parseNum(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
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

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

// Simplify a/b. Works for integers exactly; for non-integers we scale to
// integers when possible, otherwise fall back to a decimal ratio.
function simplifyRatio(a: number, b: number): { text: string; note: string | null } {
  if (b === 0) return { text: '—', note: 'Second term is zero.' };
  if (Number.isInteger(a) && Number.isInteger(b)) {
    const g = gcd(a, b) || 1;
    let sa = a / g;
    let sb = b / g;
    if (sb < 0) {
      sa = -sa;
      sb = -sb;
    }
    return { text: `${sa} : ${sb}`, note: null };
  }
  // Non-integer: express as 1 : (b/a) style decimal ratio.
  const ratio = b / a;
  return { text: `1 : ${fmt(ratio)}`, note: 'Decimal ratio (non-integer input).' };
}

export default function RatioProportionSolverTool() {
  // Proportion: a : b = c : d  (one field may be left blank to solve for it)
  const [aText, setAText] = useState('2');
  const [bText, setBText] = useState('3');
  const [cText, setCText] = useState('10');
  const [dText, setDText] = useState('');

  const result = useMemo(() => {
    const fields = [
      { key: 'a', val: parseNum(aText), raw: aText },
      { key: 'b', val: parseNum(bText), raw: bText },
      { key: 'c', val: parseNum(cText), raw: cText },
      { key: 'd', val: parseNum(dText), raw: dText },
    ];

    const blanks = fields.filter((f) => f.raw.trim() === '');
    const invalid = fields.filter((f) => f.raw.trim() !== '' && f.val === null);

    if (invalid.length > 0) {
      return { error: 'All filled terms must be valid numbers.', data: null };
    }
    if (blanks.length > 1) {
      return { error: 'Leave exactly one term blank to solve for it.', data: null };
    }

    const a = fields[0] as { val: number | null };
    const b = fields[1] as { val: number | null };
    const c = fields[2] as { val: number | null };
    const d = fields[3] as { val: number | null };

    if (blanks.length === 0) {
      // All four present: check whether the proportion holds and simplify a:b.
      const av = a.val as number;
      const bv = b.val as number;
      const cv = c.val as number;
      const dv = d.val as number;
      const holds = Math.abs(av * dv - bv * cv) < 1e-9;
      const sim = simplifyRatio(av, bv);
      return {
        error: null,
        data: {
          mode: 'check' as const,
          a: av, b: bv, c: cv, d: dv,
          solvedKey: null as string | null,
          solvedValue: null as number | null,
          holds,
          simplified: sim.text,
          note: sim.note,
        },
      };
    }

    // Solve for the single blank via cross-multiplication: a*d = b*c.
    const blank = blanks[0]!.key;
    let solvedValue: number | null = null;
    let denomZero = false;

    if (blank === 'a') {
      // a = b*c / d
      const dv = d.val as number;
      if (dv === 0) denomZero = true;
      else solvedValue = ((b.val as number) * (c.val as number)) / dv;
    } else if (blank === 'b') {
      // b = a*d / c
      const cv = c.val as number;
      if (cv === 0) denomZero = true;
      else solvedValue = ((a.val as number) * (d.val as number)) / cv;
    } else if (blank === 'c') {
      // c = a*d / b
      const bv = b.val as number;
      if (bv === 0) denomZero = true;
      else solvedValue = ((a.val as number) * (d.val as number)) / bv;
    } else {
      // d = b*c / a
      const av = a.val as number;
      if (av === 0) denomZero = true;
      else solvedValue = ((b.val as number) * (c.val as number)) / av;
    }

    if (denomZero || solvedValue === null) {
      return { error: 'Cannot solve: division by zero in cross-multiplication.', data: null };
    }

    const finalA = blank === 'a' ? solvedValue : (a.val as number);
    const finalB = blank === 'b' ? solvedValue : (b.val as number);
    const sim = simplifyRatio(finalA, finalB);

    return {
      error: null,
      data: {
        mode: 'solve' as const,
        a: finalA,
        b: finalB,
        c: blank === 'c' ? solvedValue : (c.val as number),
        d: blank === 'd' ? solvedValue : (d.val as number),
        solvedKey: blank,
        solvedValue,
        holds: true,
        simplified: sim.text,
        note: sim.note,
      },
    };
  }, [aText, bText, cText, dText]);

  const data = result.data;

  const copyText = useMemo(() => {
    if (!data) return '';
    const lines: string[] = [
      `Proportion: ${fmt(data.a)} : ${fmt(data.b)} = ${fmt(data.c)} : ${fmt(data.d)}`,
    ];
    if (data.mode === 'solve' && data.solvedKey && data.solvedValue !== null) {
      lines.push(`${data.solvedKey} = ${fmt(data.solvedValue)}`);
    }
    if (data.mode === 'check') {
      lines.push(data.holds ? 'Proportion holds (true).' : 'Proportion does NOT hold (false).');
    }
    lines.push(`Simplified ratio: ${data.simplified}`);
    return lines.join('\n');
  }, [data]);

  return (
    <Panel>
      <PanelHeader title="Ratio & Proportion Solver">
        {copyText !== '' && <CopyButton value={copyText} />}
      </PanelHeader>

      <p className="text-sm text-muted-foreground">
        Enter a proportion <span className="font-mono">a : b = c : d</span>. Leave one term blank to
        solve for it, or fill all four to verify and simplify.
      </p>

      <div className="grid items-end gap-3 sm:grid-cols-9">
        <div className="sm:col-span-2">
          <Field label="a">
            <Input inputMode="decimal" value={aText} onChange={(e) => setAText(e.target.value)} placeholder="?" />
          </Field>
        </div>
        <div className="hidden items-center justify-center pb-2 text-lg sm:flex">:</div>
        <div className="sm:col-span-2">
          <Field label="b">
            <Input inputMode="decimal" value={bText} onChange={(e) => setBText(e.target.value)} placeholder="?" />
          </Field>
        </div>
        <div className="hidden items-center justify-center pb-2 text-lg sm:flex">=</div>
        <div className="sm:col-span-2">
          <Field label="c">
            <Input inputMode="decimal" value={cText} onChange={(e) => setCText(e.target.value)} placeholder="?" />
          </Field>
        </div>
        <div className="hidden items-center justify-center pb-2 text-lg sm:flex">:</div>
        <div className="sm:col-span-2 sm:col-start-1">
          <Field label="d">
            <Input inputMode="decimal" value={dText} onChange={(e) => setDText(e.target.value)} placeholder="?" />
          </Field>
        </div>
      </div>

      <ErrorBanner error={result.error} />

      {data && (
        <div className="mt-2 rounded-md border p-4">
          <div className="font-mono text-lg">
            {fmt(data.a)} : {fmt(data.b)} = {fmt(data.c)} : {fmt(data.d)}
          </div>
          {data.mode === 'solve' && data.solvedKey && data.solvedValue !== null && (
            <div className="mt-2 text-sm">
              Solved <span className="font-mono">{data.solvedKey}</span> ={' '}
              <span className="font-mono font-semibold">{fmt(data.solvedValue)}</span>
            </div>
          )}
          {data.mode === 'check' && (
            <div className={`mt-2 text-sm font-medium ${data.holds ? 'text-green-600' : 'text-destructive'}`}>
              {data.holds ? 'Proportion holds (true).' : 'Proportion does NOT hold (false).'}
            </div>
          )}
        </div>
      )}

      <StatBar
        items={[
          data && `Simplified a : b = ${data.simplified}`,
          data?.note,
        ]}
      />
    </Panel>
  );
}
