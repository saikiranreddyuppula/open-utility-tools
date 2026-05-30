'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface Convergent {
  term: number;
  num: bigint;
  den: bigint;
  decimal: number;
  error: number;
}

interface CFResult {
  terms: number[];
  convergents: Convergent[];
  targetValue: number;
}

// Parse "p/q" or a decimal into a numeric value (and exact ratio when possible).
function parseInput(raw: string): { value: number; ok: true } | { ok: false; msg: string } {
  const s = raw.trim();
  if (!s) return { ok: false, msg: 'Enter a decimal or a p/q fraction.' };
  const frac = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (frac) {
    const pStr = frac[1];
    const qStr = frac[2];
    if (pStr === undefined || qStr === undefined) return { ok: false, msg: 'Invalid fraction.' };
    const p = Number(pStr);
    const q = Number(qStr);
    if (!Number.isFinite(p) || !Number.isFinite(q)) return { ok: false, msg: 'Invalid fraction.' };
    if (q === 0) return { ok: false, msg: 'Denominator cannot be zero.' };
    return { value: p / q, ok: true };
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, msg: 'Enter a valid decimal or p/q fraction.' };
  return { value: v, ok: true };
}

function continuedFraction(value: number, maxTerms: number): CFResult {
  const terms: number[] = [];
  let x = value;
  const EPS = 1e-12;
  for (let i = 0; i < maxTerms; i++) {
    const a = Math.floor(x);
    terms.push(a);
    const frac = x - a;
    if (frac < EPS) break;
    x = 1 / frac;
    if (!Number.isFinite(x)) break;
  }

  // Convergents via the standard recurrence.
  const convergents: Convergent[] = [];
  let hPrev = 1n;
  let hPrev2 = 0n;
  let kPrev = 0n;
  let kPrev2 = 1n;
  for (let i = 0; i < terms.length; i++) {
    const aNum = terms[i];
    if (aNum === undefined) continue;
    const a = BigInt(aNum);
    const h = a * hPrev + hPrev2;
    const k = a * kPrev + kPrev2;
    hPrev2 = hPrev;
    hPrev = h;
    kPrev2 = kPrev;
    kPrev = k;
    const dec = Number(h) / Number(k);
    convergents.push({
      term: i,
      num: h,
      den: k,
      decimal: dec,
      error: Math.abs(dec - value),
    });
  }

  return { terms, convergents, targetValue: value };
}

function fmtTerms(terms: number[]): string {
  if (terms.length === 0) return '[]';
  const head = terms[0] ?? 0;
  const tail = terms.slice(1);
  if (tail.length === 0) return `[${head}]`;
  return `[${head}; ${tail.join(', ')}]`;
}

export default function ContinuedFractionConverterTool() {
  const [input, setInput] = useState('3.14159265');
  const [maxTerms, setMaxTerms] = useState(15);
  const [tolExp, setTolExp] = useState(4); // tolerance = 10^-tolExp

  const result = useMemo(() => {
    const parsed = parseInput(input);
    if (!parsed.ok) return { error: parsed.msg };
    const r = continuedFraction(parsed.value, maxTerms);
    if (r.terms.length === 0) return { error: 'No terms could be computed.' };
    return { r };
  }, [input, maxTerms]);

  const tolerance = Math.pow(10, -tolExp);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Decimal or fraction (p/q)" className="min-w-[200px] flex-1">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="3.14159265 or 355/113" />
          </Field>
          <Field label={`Max terms: ${maxTerms}`} className="min-w-[200px]">
            <Slider value={[maxTerms]} min={1} max={30} step={1} onValueChange={(v) => setMaxTerms(v[0] ?? 15)} />
          </Field>
          <Field label={`Tolerance: 1e-${tolExp}`} className="min-w-[200px]">
            <Slider value={[tolExp]} min={1} max={10} step={1} onValueChange={(v) => setTolExp(v[0] ?? 4)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Continued fraction">
              <CopyButton value={() => fmtTerms(result.r.terms)} />
            </PanelHeader>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <code className="break-all font-mono text-base">{fmtTerms(result.r.terms)}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                Read as a0 + 1/(a1 + 1/(a2 + …)). Target value ≈ {result.r.targetValue}
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Convergents (best rational approximations)" />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Fraction</th>
                    <th className="px-3 py-2 text-left">Decimal</th>
                    <th className="px-3 py-2 text-left">Abs error</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.r.convergents.map((c) => (
                    <tr key={c.term}>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{c.term}</td>
                      <td className="px-3 py-1.5 font-mono">
                        {c.num.toString()}/{c.den.toString()}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{c.decimal.toPrecision(10)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {c.error === 0 ? '0' : c.error.toExponential(3)}
                      </td>
                      <td className="px-3 py-1.5">
                        <CopyButton value={`${c.num.toString()}/${c.den.toString()}`} size="icon-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar
              items={(() => {
                const best = result.r.convergents.find((c) => c.error <= tolerance);
                const last = result.r.convergents[result.r.convergents.length - 1];
                return [
                  best
                    ? `Simplest within 1e-${tolExp}: ${best.num.toString()}/${best.den.toString()}`
                    : `No convergent within 1e-${tolExp}`,
                  last ? `Best shown: ${last.num.toString()}/${last.den.toString()}` : '',
                ].filter(Boolean);
              })()}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
