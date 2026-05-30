'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE_OPTIONS = Array.from({ length: 35 }, (_, i) => i + 2); // 2..36

type Op = 'add' | 'sub' | 'mul' | 'div';

function parseBase(raw: string, base: number): { value: bigint } | { error: string } {
  const s = raw.trim();
  if (!s) return { error: 'Enter both operands.' };
  const neg = s.startsWith('-');
  const digits = (neg ? s.slice(1) : s).replace(/\s+/g, '');
  if (!digits) return { error: 'Enter both operands.' };
  let acc = 0n;
  const big = BigInt(base);
  for (const ch of digits) {
    const d = DIGITS.indexOf(ch.toLowerCase());
    if (d < 0 || d >= base) {
      return { error: `Digit "${ch}" is not valid in base ${base}.` };
    }
    acc = acc * big + BigInt(d);
  }
  return { value: neg ? -acc : acc };
}

function encode(value: bigint, base: number): string {
  if (value === 0n) return '0';
  const neg = value < 0n;
  let v = neg ? -value : value;
  const big = BigInt(base);
  let out = '';
  while (v > 0n) {
    const rem = Number(v % big);
    out = (DIGITS[rem] ?? '?') + out;
    v = v / big;
  }
  return (neg ? '-' : '') + out;
}

export default function BaseNArithmeticTool() {
  const [aRaw, setARaw] = useState('1010');
  const [aBase, setABase] = useState(2);
  const [bRaw, setBRaw] = useState('FF');
  const [bBase, setBBase] = useState(16);
  const [op, setOp] = useState<Op>('add');
  const [outBase, setOutBase] = useState(10);

  const result = useMemo(() => {
    const a = parseBase(aRaw, aBase);
    if ('error' in a) return { error: `Operand A: ${a.error}` };
    const b = parseBase(bRaw, bBase);
    if ('error' in b) return { error: `Operand B: ${b.error}` };

    let value: bigint;
    let remainderNote = '';
    switch (op) {
      case 'add':
        value = a.value + b.value;
        break;
      case 'sub':
        value = a.value - b.value;
        break;
      case 'mul':
        value = a.value * b.value;
        break;
      case 'div': {
        if (b.value === 0n) return { error: 'Division by zero is undefined.' };
        value = a.value / b.value; // truncated toward zero
        const rem = a.value % b.value;
        if (rem !== 0n) {
          remainderNote = `Integer quotient; remainder = ${rem.toString()} (decimal)`;
        }
        break;
      }
      default:
        return { error: 'Unknown operation.' };
    }

    return {
      result: encode(value, outBase),
      remainderNote,
      bases: [
        { label: 'Decimal', value: value.toString(10) },
        { label: 'Binary', value: encode(value, 2) },
        { label: 'Octal', value: encode(value, 8) },
        { label: 'Hex', value: encode(value, 16).toUpperCase() },
      ],
    };
  }, [aRaw, aBase, bRaw, bBase, op, outBase]);

  const opSymbol: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Operand A">
            <Input
              value={aRaw}
              onChange={(e) => setARaw(e.target.value)}
              spellCheck={false}
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Base A">
            <Select value={String(aBase)} onValueChange={(v) => setABase(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_OPTIONS.map((x) => (
                  <SelectItem key={x} value={String(x)}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Operation">
            <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
              <TabsList>
                <TabsTrigger value="add">+</TabsTrigger>
                <TabsTrigger value="sub">−</TabsTrigger>
                <TabsTrigger value="mul">×</TabsTrigger>
                <TabsTrigger value="div">÷</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Operand B">
            <Input
              value={bRaw}
              onChange={(e) => setBRaw(e.target.value)}
              spellCheck={false}
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Base B">
            <Select value={String(bBase)} onValueChange={(v) => setBBase(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_OPTIONS.map((x) => (
                  <SelectItem key={x} value={String(x)}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Output base">
            <Select value={String(outBase)} onValueChange={(v) => setOutBase(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_OPTIONS.map((x) => (
                  <SelectItem key={x} value={String(x)}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title={`Result (base ${outBase})`}>
              <CopyButton value={result.result} />
            </PanelHeader>
            <div className="space-y-1 p-3">
              <div className="break-all font-mono text-lg">
                {aRaw}
                <sub className="text-muted-foreground">{aBase}</sub> {opSymbol[op]} {bRaw}
                <sub className="text-muted-foreground">{bBase}</sub> ={' '}
                <span className="font-semibold">{result.result}</span>
                <sub className="text-muted-foreground">{outBase}</sub>
              </div>
              {result.remainderNote && (
                <p className="text-2xs text-muted-foreground">{result.remainderNote}</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Common bases" />
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {result.bases.map((bb) => (
                <div
                  key={bb.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">{bb.label}</span>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                    <span className="truncate">{bb.value}</span>
                    <CopyButton value={bb.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={['Exact BigInt arithmetic', `Output base ${outBase}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
