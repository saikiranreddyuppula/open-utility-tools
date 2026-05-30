'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

// Return the digits of |n| in the given base (most-significant first).
function digitsInBase(n: bigint, base: bigint): bigint[] {
  let v = n < 0n ? -n : n;
  if (v === 0n) return [0n];
  const out: bigint[] = [];
  while (v > 0n) {
    out.push(v % base);
    v = v / base;
  }
  return out.reverse();
}

function digitSum(digits: bigint[]): bigint {
  return digits.reduce((a, d) => a + d, 0n);
}

// Iterated additive digital root in the given base.
function digitalRoot(digits: bigint[], base: bigint): { value: bigint; steps: bigint[] } {
  const steps: bigint[] = [];
  let cur = digitSum(digits);
  steps.push(cur);
  while (cur >= base) {
    cur = digitSum(digitsInBase(cur, base));
    steps.push(cur);
  }
  return { value: cur, steps };
}

function alternatingSum(digits: bigint[]): bigint {
  // From the least-significant digit, alternate + - + - ...
  const rev = [...digits].reverse();
  let sum = 0n;
  for (let i = 0; i < rev.length; i++) {
    const d = rev[i];
    if (d === undefined) continue;
    sum += i % 2 === 0 ? d : -d;
  }
  return sum;
}

// Multiplicative persistence: repeatedly multiply digits until single digit; count steps.
function multiplicativeRoot(n: bigint, base: bigint): { root: bigint; persistence: number } {
  let cur = n < 0n ? -n : n;
  let persistence = 0;
  while (cur >= base) {
    const digits = digitsInBase(cur, base);
    let product = 1n;
    for (const d of digits) product *= d;
    cur = product;
    persistence += 1;
    if (persistence > 1000) break;
  }
  return { root: cur, persistence };
}

export default function DigitSumRootTool() {
  const [input, setInput] = useState('493193');
  const [base, setBase] = useState(10);

  const result = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return { error: 'Enter an integer.' as string };
    const b = BigInt(base);
    // Validate digits against base. Accept optional leading sign.
    const body = trimmed.replace(/^[-+]/, '');
    if (!/^[0-9a-zA-Z]+$/.test(body)) return { error: 'Only alphanumeric digits are allowed.' };
    // Parse manually to support bases up to 36.
    let value = 0n;
    for (const ch of body.toLowerCase()) {
      let d: number;
      if (ch >= '0' && ch <= '9') d = ch.charCodeAt(0) - 48;
      else d = ch.charCodeAt(0) - 97 + 10;
      if (d >= base) return { error: `Digit "${ch}" is not valid in base ${base}.` };
      value = value * b + BigInt(d);
    }
    if (trimmed.startsWith('-')) value = -value;

    const absVal = value < 0n ? -value : value;
    const digits = digitsInBase(absVal, b);
    const ds = digitSum(digits);
    const dr = digitalRoot(digits, b);
    const altSum = alternatingSum(digits);
    const mult = multiplicativeRoot(absVal, b);
    // Casting-out-nines residue generalizes to mod (base - 1).
    const modBase = b - 1n;
    const residue = modBase > 0n ? ((value % modBase) + modBase) % modBase : 0n;

    return {
      value,
      digits,
      digitSum: ds,
      digitalRoot: dr.value,
      drSteps: dr.steps,
      altSum,
      multRoot: mult.root,
      multPersistence: mult.persistence,
      residue,
      modBase,
    };
  }, [input, base]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Integer" className="min-w-[220px] flex-1">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="493193" />
          </Field>
          <Field label={`Base: ${base}`} className="min-w-[220px]">
            <Slider value={[base]} min={2} max={36} step={1} onValueChange={(v) => setBase(v[0] ?? 10)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton
              value={() =>
                [
                  `Digit sum: ${result.digitSum.toString()}`,
                  `Digital root: ${result.digitalRoot.toString()}`,
                  `Alternating digit sum: ${result.altSum.toString()}`,
                  `Multiplicative root: ${result.multRoot.toString()} (persistence ${result.multPersistence})`,
                  `Casting-out-${result.modBase.toString()} residue: ${result.residue.toString()}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Digit sum', value: result.digitSum.toString() },
              {
                label: 'Additive digital root',
                value: `${result.digitalRoot.toString()} (${result.drSteps.map((s) => s.toString()).join(' → ')})`,
              },
              { label: 'Alternating digit sum (÷11 test)', value: result.altSum.toString() },
              { label: 'Multiplicative digital root', value: result.multRoot.toString() },
              { label: 'Multiplicative persistence', value: result.multPersistence.toString() },
              {
                label: `Casting-out-${result.modBase.toString()} residue`,
                value: result.residue.toString(),
              },
            ].map((row) => (
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
          <StatBar
            items={[
              `${result.digits.length} digit${result.digits.length === 1 ? '' : 's'} in base ${base}`,
              `digits: ${result.digits.map((d) => d.toString(36)).join(' ')}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
