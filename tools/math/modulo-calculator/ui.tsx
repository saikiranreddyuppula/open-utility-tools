'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Op = 'mod' | 'add' | 'mul' | 'pow';

const OP_LABELS: Record<Op, string> = {
  mod: 'a mod m',
  add: '(a + b) mod m',
  mul: '(a × b) mod m',
  pow: '(a ^ b) mod m',
};

function parseBigInt(raw: string, name: string): bigint {
  const s = raw.trim();
  if (s === '') throw new Error(`${name} is required.`);
  if (!/^-?\d+$/.test(s)) throw new Error(`${name} must be a whole number (got "${raw}").`);
  return BigInt(s);
}

/** True modulo: always returns a value in [0, m). */
function mod(a: bigint, m: bigint): bigint {
  if (m === 0n) throw new Error('Modulus m must not be zero.');
  const r = a % m;
  return r < 0n ? r + (m < 0n ? -m : m) : r;
}

/** (base ^ exp) mod m using fast modular exponentiation. exp must be >= 0. */
function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 0n) throw new Error('Modulus m must not be zero.');
  if (exp < 0n) throw new Error('Exponent b must be non-negative for modular exponentiation.');
  const mm = m < 0n ? -m : m;
  if (mm === 1n) return 0n;
  let result = 1n;
  let b = mod(base, mm);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mm;
    e >>= 1n;
    b = (b * b) % mm;
  }
  return result;
}

export default function ModuloCalculatorTool() {
  const [op, setOp] = useState<Op>('mod');
  const [a, setA] = useState('17');
  const [b, setB] = useState('5');
  const [m, setM] = useState('7');

  const needsB = op !== 'mod';

  const computed = useMemo<{ value: string; error: string | null }>(() => {
    try {
      const av = parseBigInt(a, 'a');
      const mv = parseBigInt(m, 'm');
      if (mv === 0n) throw new Error('Modulus m must not be zero.');

      if (op === 'mod') {
        return { value: mod(av, mv).toString(), error: null };
      }

      const bv = parseBigInt(b, 'b');
      if (op === 'add') return { value: mod(av + bv, mv).toString(), error: null };
      if (op === 'mul') return { value: mod(av * bv, mv).toString(), error: null };
      // pow
      return { value: modPow(av, bv, mv).toString(), error: null };
    } catch (err) {
      return { value: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [op, a, b, m]);

  return (
    <Panel>
      <PanelHeader title="Modular Arithmetic Calculator" />

      <OptionsBar>
        <Field label="Operation">
          <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
            <TabsList>
              <TabsTrigger value="mod">mod</TabsTrigger>
              <TabsTrigger value="add">add</TabsTrigger>
              <TabsTrigger value="mul">multiply</TabsTrigger>
              <TabsTrigger value="pow">power</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="mod-a">a</Label>
          <Input
            id="mod-a"
            inputMode="numeric"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="e.g. 17"
          />
        </div>
        {needsB && (
          <div className="space-y-1.5">
            <Label htmlFor="mod-b">b</Label>
            <Input
              id="mod-b"
              inputMode="numeric"
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mod-m">m (modulus)</Label>
          <Input
            id="mod-m"
            inputMode="numeric"
            value={m}
            onChange={(e) => setM(e.target.value)}
            placeholder="e.g. 7"
          />
        </div>
      </div>

      <ErrorBanner error={computed.error} />

      {!computed.error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-4">
            <Calculator className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{OP_LABELS[op]}</div>
              <div className="break-all font-mono text-2xl font-semibold tabular-nums">
                {computed.value}
              </div>
            </div>
            <CopyButton value={computed.value} />
          </div>
          <StatBar
            items={[
              `result: ${computed.value}`,
              `digits: ${computed.value.replace('-', '').length}`,
              'range: 0 to |m|-1',
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
