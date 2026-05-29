'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

function parseInt2(s: string): bigint | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  try {
    if (t.startsWith('0x')) return BigInt(t);
    if (t.startsWith('0b')) return BigInt(t);
    if (t.startsWith('0o')) return BigInt(t);
    return BigInt(t);
  } catch {
    return null;
  }
}

function row(label: string, value: bigint) {
  return { label, dec: value.toString(10), hex: '0x' + value.toString(16), bin: '0b' + value.toString(2) };
}

export default function BitwiseCalculatorTool() {
  const [a, setA] = useState('12');
  const [b, setB] = useState('10');

  const results = useMemo(() => {
    const x = parseInt2(a);
    const y = parseInt2(b);
    if (x == null || y == null) return null;
    return [
      row('A AND B', x & y),
      row('A OR B', x | y),
      row('A XOR B', x ^ y),
      row('NOT A', ~x),
      row('A << 1', x << 1n),
      row('A >> 1', x >> 1n),
    ];
  }, [a, b]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">A</label>
          <Input value={a} onChange={(e) => setA(e.target.value)} className="font-mono" placeholder="12, 0xc, 0b1100" />
        </div>
        <div className="space-y-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">B</label>
          <Input value={b} onChange={(e) => setB(e.target.value)} className="font-mono" placeholder="10, 0xa, 0b1010" />
        </div>
      </div>

      {results && (
        <Panel>
          <PanelHeader title="Results" />
          <div className="divide-y">
            {results.map((r) => (
              <div key={r.label} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="w-20 shrink-0 font-mono text-2xs font-medium text-muted-foreground">{r.label}</span>
                <code className="font-mono text-xs">{r.dec}</code>
                <code className="font-mono text-xs text-muted-foreground">{r.hex}</code>
                <code className="hidden font-mono text-xs text-muted-foreground sm:inline">{r.bin}</code>
                <CopyButton value={r.dec} size="icon-sm" className="ml-auto" />
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">Accepts decimal, 0x hex, 0b binary, 0o octal. Uses BigInt (arbitrary precision).</p>
    </div>
  );
}
