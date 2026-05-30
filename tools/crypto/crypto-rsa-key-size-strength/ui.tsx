'use client';

import { useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { cn } from '@/lib/utils';

interface LevelRow {
  symmetric: number;
  rsa: number;
  ffc: string;
  ecc: number;
  curve: string;
  status: string;
}

// NIST SP 800-57 Part 1 Rev 5 equivalent-strength rows.
const ROWS: LevelRow[] = [
  {
    symmetric: 80,
    rsa: 1024,
    ffc: 'L=1024, N=160',
    ecc: 160,
    curve: 'secp160r1',
    status: 'Disallowed (legacy only)',
  },
  {
    symmetric: 112,
    rsa: 2048,
    ffc: 'L=2048, N=224',
    ecc: 224,
    curve: 'secp224r1',
    status: 'Acceptable through 2030',
  },
  {
    symmetric: 128,
    rsa: 3072,
    ffc: 'L=3072, N=256',
    ecc: 256,
    curve: 'secp256r1 (P-256)',
    status: 'Recommended (general use)',
  },
  {
    symmetric: 192,
    rsa: 7680,
    ffc: 'L=7680, N=384',
    ecc: 384,
    curve: 'secp384r1 (P-384)',
    status: 'High security / long-term',
  },
  {
    symmetric: 256,
    rsa: 15360,
    ffc: 'L=15360, N=512',
    ecc: 521,
    curve: 'secp521r1 (P-521)',
    status: 'Top secret / very long-term',
  },
];

export default function KeyStrengthComparatorTool() {
  const [selected, setSelected] = useState<number>(128);

  const active = ROWS.find((r) => r.symmetric === selected) ?? ROWS[2];

  const allText = ROWS.map(
    (r) =>
      `${r.symmetric}-bit | RSA/DH ${r.rsa} | ECC ${r.ecc} (${r.curve}) | ${r.status}`
  ).join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Equivalent security strength (NIST SP 800-57)">
          <CopyButton value={() => allText} label="Copy table" />
        </PanelHeader>

        <div className="flex flex-wrap gap-2 border-b p-3">
          {ROWS.map((r) => (
            <button
              key={r.symmetric}
              type="button"
              onClick={() => setSelected(r.symmetric)}
              className={cn(
                'rounded-md border px-3 py-1.5 font-mono text-xs transition-colors',
                r.symmetric === selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-muted/30 hover:bg-muted'
              )}
            >
              {r.symmetric}-bit
            </button>
          ))}
        </div>

        {active && (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Symmetric security', value: `${active.symmetric} bits` },
              { label: 'RSA / DSA / DH modulus', value: `${active.rsa} bits` },
              { label: 'Finite-field (FFC)', value: active.ffc },
              { label: 'ECC field size', value: `${active.ecc} bits` },
              { label: 'Named curve', value: active.curve },
              { label: 'Status', value: active.status },
            ].map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-right">{c.value}</span>
                  <CopyButton value={c.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Full comparison" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-2xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Symmetric</th>
                <th className="px-3 py-2 font-semibold">RSA/DH</th>
                <th className="px-3 py-2 font-semibold">ECC</th>
                <th className="px-3 py-2 font-semibold">Curve</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr
                  key={r.symmetric}
                  className={cn(
                    'border-b last:border-0',
                    r.symmetric === selected && 'bg-primary/5'
                  )}
                >
                  <td className="px-3 py-2 font-mono">{r.symmetric}</td>
                  <td className="px-3 py-2 font-mono">{r.rsa}</td>
                  <td className="px-3 py-2 font-mono">{r.ecc}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.curve}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StatBar items={['Source: NIST SP 800-57 Part 1 Rev 5', '1024-bit RSA is deprecated']} />
      </Panel>
    </div>
  );
}
