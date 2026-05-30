'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Step {
  i: number;
  quotient: string;
  remainder: string;
  s: string;
  t: string;
}

interface Ok {
  ok: true;
  gcd: bigint;
  inverse: bigint | null;
  x: bigint;
  y: bigint;
  steps: Step[];
  a: bigint;
  m: bigint;
}

interface Err {
  ok: false;
  error: string;
}

function parseBigInt(raw: string): bigint | null {
  const s = raw.trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

export default function ModularInverseTool() {
  const [aRaw, setARaw] = useState('17');
  const [mRaw, setMRaw] = useState('3120');

  const result = useMemo<Ok | Err>(() => {
    const a = parseBigInt(aRaw);
    const m = parseBigInt(mRaw);
    if (a === null || m === null) return { ok: false, error: 'Enter valid integers for both a and m.' };
    if (m <= 1n) return { ok: false, error: 'Modulus m must be greater than 1.' };

    // Extended Euclidean algorithm tracking Bezout coefficients of a and m.
    // We work with a reduced into [0, m) but keep coefficients relative to the
    // original a and m for the Bezout identity.
    let oldR = mod(a, m);
    let r = m;
    let oldS = 1n;
    let s = 0n;
    let oldT = 0n;
    let t = 1n;

    const steps: Step[] = [];
    let i = 0;
    // Record the initial state row.
    steps.push({ i, quotient: '—', remainder: oldR.toString(), s: oldS.toString(), t: oldT.toString() });
    i += 1;
    steps.push({ i, quotient: '—', remainder: r.toString(), s: s.toString(), t: t.toString() });

    let guard = 0;
    while (r !== 0n && guard < 100000) {
      guard += 1;
      const q = oldR / r;
      const nr = oldR - q * r;
      const ns = oldS - q * s;
      const nt = oldT - q * t;
      oldR = r;
      oldS = s;
      oldT = t;
      r = nr;
      s = ns;
      t = nt;
      i += 1;
      steps.push({ i, quotient: q.toString(), remainder: r.toString(), s: s.toString(), t: t.toString() });
    }

    // oldR = gcd(a mod m, m) = gcd(a, m); oldS is the coefficient on (a mod m).
    const g = oldR;
    // Bezout coefficient on the original a equals oldS (since a mod m differs
    // from a only by a multiple of m, which gets absorbed into the y coefficient).
    const x = oldS;
    const y = oldT;

    if (g !== 1n) {
      return { ok: false, error: `No inverse exists: gcd(a, m) = ${g.toString()} ≠ 1, so a and m are not coprime.` };
    }

    const inv = mod(x, m);
    return { ok: true, gcd: g, inverse: inv, x, y, steps, a, m };
  }, [aRaw, mRaw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="a (value)">
            <Input
              value={aRaw}
              onChange={(e) => setARaw(e.target.value)}
              inputMode="numeric"
              className="w-40 font-mono"
            />
          </Field>
          <Field label="m (modulus)">
            <Input
              value={mRaw}
              onChange={(e) => setMRaw(e.target.value)}
              inputMode="numeric"
              className="w-40 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Results">
              <CopyButton
                value={() =>
                  [
                    `a = ${result.a.toString()}, m = ${result.m.toString()}`,
                    `inverse = ${result.inverse?.toString() ?? '—'}`,
                    `gcd = ${result.gcd.toString()}`,
                    `Bezout: ${result.a.toString()}*${result.x.toString()} + ${result.m.toString()}*${result.y.toString()} = ${result.gcd.toString()}`,
                  ].join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Inverse (a⁻¹ mod m)</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{result.inverse?.toString() ?? '—'}</span>
                  <CopyButton value={result.inverse?.toString() ?? ''} size="icon-sm" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">gcd(a, m)</span>
                <span className="font-mono text-sm">{result.gcd.toString()}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
                <span className="text-sm text-muted-foreground">Bezout identity</span>
                <span className="font-mono text-xs sm:text-sm">
                  {result.a.toString()}·({result.x.toString()}) + {result.m.toString()}·({result.y.toString()}) = {result.gcd.toString()}
                </span>
              </div>
            </div>
            <StatBar
              items={[
                `Verify: (${result.a.toString()} × ${result.inverse?.toString() ?? '?'}) mod ${result.m.toString()} = ${
                  result.inverse !== null ? mod(result.a * result.inverse, result.m).toString() : '?'
                }`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title={`Extended Euclidean steps (${result.steps.length} rows)`} />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">quotient</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">remainder</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">s</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">t</th>
                  </tr>
                </thead>
                <tbody>
                  {result.steps.map((st) => (
                    <tr key={st.i} className="border-t font-mono">
                      <td className="px-3 py-1.5 text-muted-foreground">{st.i}</td>
                      <td className="px-3 py-1.5">{st.quotient}</td>
                      <td className="px-3 py-1.5">{st.remainder}</td>
                      <td className="px-3 py-1.5">{st.s}</td>
                      <td className="px-3 py-1.5">{st.t}</td>
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
