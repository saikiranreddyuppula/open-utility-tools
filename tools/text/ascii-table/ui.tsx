'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';

const CONTROL: Record<number, string> = {
  0: 'NUL', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
  8: 'BS', 9: 'TAB', 10: 'LF', 11: 'VT', 12: 'FF', 13: 'CR', 14: 'SO', 15: 'SI',
  16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4', 21: 'NAK', 22: 'SYN', 23: 'ETB',
  24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC', 28: 'FS', 29: 'GS', 30: 'RS', 31: 'US', 127: 'DEL',
};

export default function AsciiTableTool() {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const all = Array.from({ length: 128 }, (_, i) => {
      const char = CONTROL[i] ?? (i === 32 ? 'SP' : String.fromCharCode(i));
      return {
        dec: i,
        hex: i.toString(16).padStart(2, '0').toUpperCase(),
        oct: i.toString(8).padStart(3, '0'),
        bin: i.toString(2).padStart(8, '0'),
        char,
      };
    });
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(
      (r) =>
        String(r.dec) === s ||
        r.hex.toLowerCase() === s ||
        r.char.toLowerCase() === s ||
        r.char.toLowerCase().includes(s)
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by char, decimal or hex…" className="h-9 font-mono" />
      <Panel>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-2xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {['Char', 'Dec', 'Hex', 'Oct', 'Bin'].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.dec} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-1 font-semibold">{r.char}</td>
                  <td className="px-3 py-1 tabular">{r.dec}</td>
                  <td className="px-3 py-1 text-muted-foreground">{r.hex}</td>
                  <td className="px-3 py-1 text-muted-foreground">{r.oct}</td>
                  <td className="px-3 py-1 text-muted-foreground">{r.bin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
