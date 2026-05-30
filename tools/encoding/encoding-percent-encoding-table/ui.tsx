'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Klass = 'unreserved' | 'gen-delim' | 'sub-delim' | 'control' | 'space' | 'other';
type Filter = 'all' | Klass;

interface AsciiRow {
  code: number;
  display: string;
  name: string;
  hex: string;
  pct: string;
  klass: Klass;
}

// RFC 3986 character classes.
const GEN_DELIMS = new Set([':', '/', '?', '#', '[', ']', '@']);
const SUB_DELIMS = new Set(['!', '$', '&', "'", '(', ')', '*', '+', ',', ';', '=']);

const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
  8: 'BS', 9: 'TAB', 10: 'LF', 11: 'VT', 12: 'FF', 13: 'CR', 14: 'SO', 15: 'SI',
  16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4', 21: 'NAK', 22: 'SYN', 23: 'ETB',
  24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC', 28: 'FS', 29: 'GS', 30: 'RS', 31: 'US',
  127: 'DEL',
};

function isUnreserved(ch: string): boolean {
  return /^[A-Za-z0-9\-._~]$/.test(ch);
}

function classify(code: number, ch: string): Klass {
  if (code < 32 || code === 127) return 'control';
  if (code === 32) return 'space';
  if (isUnreserved(ch)) return 'unreserved';
  if (GEN_DELIMS.has(ch)) return 'gen-delim';
  if (SUB_DELIMS.has(ch)) return 'sub-delim';
  return 'other';
}

const KLASS_LABEL: Record<Klass, string> = {
  unreserved: 'Unreserved',
  'gen-delim': 'Reserved (gen-delim)',
  'sub-delim': 'Reserved (sub-delim)',
  control: 'Control',
  space: 'Space',
  other: 'Other',
};

const ASCII: AsciiRow[] = Array.from({ length: 128 }, (_, code) => {
  const ch = String.fromCharCode(code);
  const klass = classify(code, ch);
  const control = CONTROL_NAMES[code];
  const display = code === 32 ? '(space)' : control !== undefined ? control : ch;
  const name =
    control !== undefined
      ? `Control ${control}`
      : code === 32
        ? 'Space'
        : `"${ch}"`;
  return {
    code,
    display,
    name,
    hex: code.toString(16).toUpperCase().padStart(2, '0'),
    pct: `%${code.toString(16).toUpperCase().padStart(2, '0')}`,
    klass,
  };
});

// A few UTF-8 multi-byte examples (percent sequence of each byte).
const UTF8_EXAMPLES: { ch: string; name: string; pct: string }[] = (() => {
  const items = [
    { ch: '€', name: 'Euro sign (U+20AC)' },
    { ch: '£', name: 'Pound sign (U+00A3)' },
    { ch: 'é', name: 'e acute (U+00E9)' },
    { ch: '©', name: 'Copyright (U+00A9)' },
    { ch: '中', name: 'CJK "middle" (U+4E2D)' },
    { ch: '😀', name: 'Grinning face (U+1F600)' },
  ];
  const enc = new TextEncoder();
  return items.map((it) => ({
    ch: it.ch,
    name: it.name,
    pct: Array.from(enc.encode(it.ch), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join(''),
  }));
})();

export default function PercentEncodingTable() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ASCII.filter((r) => {
      if (filter !== 'all' && r.klass !== filter) return false;
      if (!s) return true;
      return (
        r.display.toLowerCase().includes(s) ||
        r.name.toLowerCase().includes(s) ||
        String(r.code).includes(s) ||
        r.hex.toLowerCase().includes(s) ||
        r.pct.toLowerCase().includes(s)
      );
    });
  }, [q, filter]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Percent-Encoding (RFC 3986)">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-7 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              <SelectItem value="unreserved">Unreserved</SelectItem>
              <SelectItem value="gen-delim">Reserved (gen-delim)</SelectItem>
              <SelectItem value="sub-delim">Reserved (sub-delim)</SelectItem>
              <SelectItem value="control">Control</SelectItem>
              <SelectItem value="space">Space</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter char, name, code…"
            className="h-7 w-44"
          />
        </PanelHeader>
        <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="w-16 shrink-0">Char</span>
          <span className="w-12 shrink-0 text-right">Dec</span>
          <span className="w-12 shrink-0 text-right">Hex</span>
          <span className="w-16 shrink-0 text-right">%XX</span>
          <span className="min-w-0 flex-1">Class</span>
        </div>
        <div className="max-h-[460px] divide-y overflow-auto">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center gap-3 px-3 py-1.5">
              <code className="w-16 shrink-0 truncate font-mono text-xs">{r.display}</code>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular">{r.code}</span>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular">{r.hex}</span>
              <code className="w-16 shrink-0 text-right font-mono text-xs">{r.pct}</code>
              <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                {KLASS_LABEL[r.klass]}
              </span>
              <CopyButton value={r.pct} size="icon-sm" />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
          )}
        </div>
        <StatBar items={[`${rows.length} of ${ASCII.length} ASCII chars`]} />
      </Panel>

      <Panel>
        <PanelHeader title="UTF-8 Multi-Byte Examples" />
        <div className="max-h-[260px] divide-y overflow-auto">
          {UTF8_EXAMPLES.map((e) => (
            <div key={e.ch} className="flex items-center gap-3 px-3 py-2">
              <code className="w-12 shrink-0 text-center font-mono text-base">{e.ch}</code>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{e.name}</span>
              <code className="shrink-0 font-mono text-xs">{e.pct}</code>
              <CopyButton value={e.pct} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
