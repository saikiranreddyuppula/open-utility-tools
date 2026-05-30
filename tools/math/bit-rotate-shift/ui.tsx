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

type Op = 'shl' | 'lsr' | 'asr' | 'rol' | 'ror';
const WIDTHS = [8, 16, 32, 64];
const OPS: { id: Op; label: string }[] = [
  { id: 'shl', label: 'Shift left (SHL)' },
  { id: 'lsr', label: 'Logical shift right (LSR)' },
  { id: 'asr', label: 'Arithmetic shift right (ASR)' },
  { id: 'rol', label: 'Rotate left (ROL)' },
  { id: 'ror', label: 'Rotate right (ROR)' },
];

function parseInput(raw: string): bigint | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  try {
    if (s.startsWith('0x')) return BigInt(s);
    if (s.startsWith('0b')) return BigInt(s);
    if (/^-?\d+$/.test(s)) return BigInt(s);
    if (/^[01]+$/.test(s)) return BigInt('0b' + s);
    return null;
  } catch {
    return null;
  }
}

function toBits(value: bigint, width: number): number[] {
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) {
    out.push(Number((value >> BigInt(i)) & 1n));
  }
  return out;
}

export default function BitRotateShiftTool() {
  const [raw, setRaw] = useState('0b10110100');
  const [width, setWidth] = useState(8);
  const [op, setOp] = useState<Op>('shl');
  const [kStr, setKStr] = useState('2');

  const result = useMemo(() => {
    const parsed = parseInput(raw);
    if (parsed === null) {
      return { error: 'Enter an integer (decimal, 0x… hex, 0b… binary, or a bit string).' };
    }
    const k = Number(kStr);
    if (!Number.isFinite(k) || k < 0 || !Number.isInteger(k)) {
      return { error: 'Shift amount k must be a non-negative integer.' };
    }
    if (k > width) {
      return { error: `Shift amount cannot exceed the width (${width}).` };
    }

    const W = BigInt(width);
    const mask = (1n << W) - 1n;
    const x = ((parsed % (1n << W)) + (1n << W)) % (1n << W); // normalize into [0, 2^W) two's-complement form
    const kb = BigInt(k);

    let out: bigint;
    let note = '';
    switch (op) {
      case 'shl': {
        out = (x << kb) & mask;
        note = `Low ${k} bit(s) filled with 0; high ${k} bit(s) dropped.`;
        break;
      }
      case 'lsr': {
        out = (x >> kb) & mask;
        note = `High ${k} bit(s) filled with 0; low ${k} bit(s) dropped.`;
        break;
      }
      case 'asr': {
        const signBit = (x >> (W - 1n)) & 1n;
        let v = x >> kb;
        if (signBit === 1n && kb > 0n) {
          // Top k bits set to 1: shift the mask up by (width - k), keep in range.
          const fill = (mask << (W - kb)) & mask;
          v = (v | fill) & mask;
        }
        out = v & mask;
        note = `Sign bit (${Number(signBit)}) replicated into the top ${k} bit(s).`;
        break;
      }
      case 'rol': {
        const kk = kb % W;
        out = kk === 0n ? x : ((x << kk) | (x >> (W - kk))) & mask;
        note = `Bits wrap around; nothing is lost.`;
        break;
      }
      case 'ror': {
        const kk = kb % W;
        out = kk === 0n ? x : ((x >> kk) | (x << (W - kk))) & mask;
        note = `Bits wrap around; nothing is lost.`;
        break;
      }
      default:
        return { error: 'Unknown operation.' };
    }

    const beforeBits = toBits(x, width);
    const afterBits = toBits(out, width);
    const hexW = Math.ceil(width / 4);

    return {
      beforeBits,
      afterBits,
      note,
      rows: [
        { label: 'Binary', value: afterBits.join('') },
        { label: 'Hex', value: '0x' + out.toString(16).toUpperCase().padStart(hexW, '0') },
        { label: 'Decimal (unsigned)', value: out.toString(10) },
      ],
    };
  }, [raw, width, op, kStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value" className="min-w-[180px] flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              className="font-mono"
              placeholder="0b1011, 0xFF, 42"
            />
          </Field>
          <Field label="Width">
            <Select value={String(width)} onValueChange={(v) => setWidth(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDTHS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w}-bit
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Operation">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Shift by k">
            <Input
              value={kStr}
              onChange={(e) => setKStr(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton
                value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                    <span className="truncate">{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <p className="px-3 pb-2 text-2xs text-muted-foreground">{result.note}</p>
          </Panel>

          <Panel>
            <PanelHeader title="Bit movement" />
            <div className="overflow-auto p-3">
              <table className="w-full border-collapse font-mono text-sm">
                <thead>
                  <tr className="text-2xs uppercase text-muted-foreground">
                    <th className="px-2 py-1 text-left">Bit</th>
                    {result.beforeBits.map((_, i) => (
                      <th key={i} className="px-1 py-1 text-center">
                        {result.beforeBits.length - 1 - i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">Before</td>
                    {result.beforeBits.map((b, i) => (
                      <td key={i} className="px-1 py-1 text-center">
                        {b}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">After</td>
                    {result.afterBits.map((b, i) => {
                      const before = result.beforeBits[i] ?? 0;
                      const changed = b !== before;
                      return (
                        <td
                          key={i}
                          className={
                            'px-1 py-1 text-center ' +
                            (changed ? 'font-bold text-primary' : '')
                          }
                        >
                          {b}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <StatBar items={[`${width}-bit`, OPS.find((o) => o.id === op)?.label ?? '', `k = ${kStr}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
