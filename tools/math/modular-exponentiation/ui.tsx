'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function parseBig(v: string): bigint | null {
  const s = v.trim();
  if (s === '') return null;
  if (!/^[+-]?\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

interface Step {
  bit: number;
  bitValue: number;
  result: string;
  base: string;
}

export default function ModularExponentiationTool() {
  const [baseStr, setBaseStr] = useState('7');
  const [expStr, setExpStr] = useState('644');
  const [modStr, setModStr] = useState('645');
  const [showSteps, setShowSteps] = useState(true);

  const result = useMemo(() => {
    const base = parseBig(baseStr);
    const exp = parseBig(expStr);
    const mod = parseBig(modStr);

    if (base == null) return { error: 'Base must be an integer.' };
    if (exp == null) return { error: 'Exponent must be an integer.' };
    if (mod == null) return { error: 'Modulus must be an integer.' };
    if (mod <= 0n) return { error: 'Modulus must be a positive integer.' };
    if (exp < 0n) return { error: 'Exponent must be non-negative (modular inverse not supported here).' };

    // Cap iteration count to keep the UI responsive; the exponent's bit length
    // equals the number of loop iterations.
    const bitLen = exp === 0n ? 0 : exp.toString(2).length;
    if (bitLen > 4096) {
      return { error: 'Exponent too large for step tracing (over 4096 bits).' };
    }

    // Normalize negative base modulo m.
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    let acc = 1n % mod;
    let multiplications = 0;
    const steps: Step[] = [];
    let bitIndex = 0;

    while (e > 0n) {
      const bit = e & 1n;
      if (bit === 1n) {
        acc = (acc * b) % mod;
        multiplications++;
      }
      steps.push({
        bit: bitIndex,
        bitValue: Number(bit),
        result: acc.toString(),
        base: b.toString(),
      });
      // square for next bit (skip the squaring counter on the final iteration)
      b = (b * b) % mod;
      if (e > 1n) multiplications++;
      e >>= 1n;
      bitIndex++;
    }

    // Naive comparison count: exp - 1 multiplications (when exp > 0).
    const naive = exp > 0n ? exp - 1n : 0n;

    return {
      value: acc.toString(),
      multiplications,
      naive: naive.toString(),
      bitLen,
      steps,
    };
  }, [baseStr, expStr, modStr]);

  const stepsText = useMemo(() => {
    if ('error' in result) return '';
    return result.steps
      .map((s) => `bit ${s.bit}=${s.bitValue}  acc=${s.result}`)
      .join('\n');
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Base" htmlFor="me-base">
          <Input
            id="me-base"
            value={baseStr}
            onChange={(e) => setBaseStr(e.target.value)}
            className="h-8 w-40 font-mono"
          />
        </Field>
        <Field label="Exponent" htmlFor="me-exp">
          <Input
            id="me-exp"
            value={expStr}
            onChange={(e) => setExpStr(e.target.value)}
            className="h-8 w-40 font-mono"
          />
        </Field>
        <Field label="Modulus" htmlFor="me-mod">
          <Input
            id="me-mod"
            value={modStr}
            onChange={(e) => setModStr(e.target.value)}
            className="h-8 w-40 font-mono"
          />
        </Field>
        <Field label="Show steps">
          <Switch checked={showSteps} onCheckedChange={setShowSteps} />
        </Field>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.value} />
            </PanelHeader>
            <div className="break-all px-3 py-4 font-mono text-2xl font-semibold text-primary">
              {result.value}
            </div>
            <StatBar
              items={[
                `${result.multiplications} multiplications (fast)`,
                `vs ${result.naive} naive`,
                `exponent ${result.bitLen} bits`,
              ]}
            />
          </Panel>

          {showSteps && result.steps.length > 0 && (
            <Panel>
              <PanelHeader title="Square-and-multiply trace (right-to-left)">
                <CopyButton value={() => stepsText} label="Copy" size="sm" />
              </PanelHeader>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm tabular">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">Bit</th>
                      <th className="px-3 py-2 text-left">Value</th>
                      <th className="px-3 py-2 text-left">Accumulator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.steps.map((s) => (
                      <tr key={s.bit} className={s.bitValue === 1 ? 'bg-primary/5' : ''}>
                        <td className="px-3 py-1.5 font-mono">{s.bit}</td>
                        <td className="px-3 py-1.5 font-mono">{s.bitValue}</td>
                        <td className="break-all px-3 py-1.5 font-mono">{s.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <StatBar items={[`${result.steps.length} bit step${result.steps.length === 1 ? '' : 's'}`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
