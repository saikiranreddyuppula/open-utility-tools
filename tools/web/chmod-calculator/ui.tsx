'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

const GROUPS = ['Owner', 'Group', 'Others'] as const;
const PERMS = [
  ['Read', 4],
  ['Write', 2],
  ['Execute', 1],
] as const;

export default function ChmodCalculatorTool() {
  // bits[group] = octal digit 0-7
  const [bits, setBits] = useState<[number, number, number]>([7, 5, 5]);

  const octal = bits.join('');
  const symbolic = useMemo(
    () =>
      bits
        .map((b) => ['r', 'w', 'x'].map((c, i) => (b & (4 >> i) ? c : '-')).join(''))
        .join(''),
    [bits]
  );

  const toggle = (g: number, val: number) =>
    setBits((prev) => {
      const next = [...prev] as [number, number, number];
      next[g] = (next[g] ?? 0) ^ val;
      return next;
    });

  const setOctal = (v: string) => {
    if (/^[0-7]{0,3}$/.test(v)) {
      const padded = v.padStart(3, '0');
      setBits([Number(padded[0] ?? 0), Number(padded[1] ?? 0), Number(padded[2] ?? 0)]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Permissions" />
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-2xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Permission</th>
              {GROUPS.map((g) => (
                <th key={g} className="px-3 py-2 text-center font-medium">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map(([label, val]) => (
              <tr key={label} className="border-t">
                <td className="px-3 py-2">{label}</td>
                {GROUPS.map((g, gi) => (
                  <td key={g} className="px-3 py-2 text-center">
                    <Checkbox
                      checked={(bits[gi] & val) !== 0}
                      onCheckedChange={() => toggle(gi, val)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">Octal</span>
          <Input value={octal} onChange={(e) => setOctal(e.target.value)} className="w-24 font-mono text-lg" maxLength={3} />
          <CopyButton value={octal} size="icon-sm" className="ml-auto" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">Symbolic</span>
          <code className="font-mono text-lg">{symbolic}</code>
          <CopyButton value={symbolic} size="icon-sm" className="ml-auto" />
        </div>
      </div>
      <p className="px-1 font-mono text-2xs text-muted-foreground">chmod {octal} file</p>
    </div>
  );
}
