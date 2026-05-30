'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

type Row = { label: string; value: string };

const V4_MAX = 0xffffffffn;
const V6_MAX = (1n << 128n) - 1n;

function parseIPv4(s: string): bigint | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    if (p.length > 1 && p.startsWith('0')) return null; // no leading zeros
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

function v4ToDotted(n: bigint): string {
  return [
    (n >> 24n) & 0xffn,
    (n >> 16n) & 0xffn,
    (n >> 8n) & 0xffn,
    n & 0xffn,
  ].map((x) => x.toString()).join('.');
}

// Parse IPv6 (compressed or full), optionally with embedded IPv4 tail. Returns 128-bit BigInt or null.
function parseIPv6(s: string): bigint | null {
  let str = s.trim();
  if (str.includes('.')) {
    // embedded IPv4 in last group(s) — convert tail to two hex groups
    const lastColon = str.lastIndexOf(':');
    if (lastColon < 0) return null;
    const tail = str.slice(lastColon + 1);
    const v4 = parseIPv4(tail);
    if (v4 === null) return null;
    const hi = (v4 >> 16n) & 0xffffn;
    const lo = v4 & 0xffffn;
    str = `${str.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }
  if (!/^[0-9a-fA-F:]+$/.test(str)) return null;
  const doubleColon = str.split('::').length - 1;
  if (doubleColon > 1) return null;

  let groups: string[];
  if (str.includes('::')) {
    const [headRaw, tailRaw] = str.split('::') as [string, string];
    const head = headRaw === '' ? [] : headRaw.split(':');
    const tail = tailRaw === '' ? [] : tailRaw.split(':');
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  } else {
    groups = str.split(':');
  }
  if (groups.length !== 8) return null;

  let n = 0n;
  for (const g of groups) {
    if (g === '' || g.length > 4 || !/^[0-9a-fA-F]+$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

function v6Groups(n: bigint): number[] {
  const out: number[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    out.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  }
  return out;
}

function v6Expanded(n: bigint): string {
  return v6Groups(n).map((g) => g.toString(16).padStart(4, '0')).join(':');
}

// RFC 5952 canonical compression.
function v6Canonical(n: bigint): string {
  const groups = v6Groups(n).map((g) => g.toString(16));
  // find longest run of zero groups (>=2) to replace with ::
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i += 1) {
    if (groups[i] === '0') {
      if (curStart < 0) { curStart = i; curLen = 1; } else { curLen += 1; }
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen < 2) return groups.join(':');
  const head = groups.slice(0, bestStart).join(':');
  const tail = groups.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}

function detectAndParse(input: string): { kind: 'v4'; n: bigint } | { kind: 'v6'; n: bigint } | null {
  const s = input.trim();
  if (!s) return null;

  // hex like 0x...
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    const n = BigInt(s);
    if (n <= V4_MAX) return { kind: 'v4', n };
    if (n <= V6_MAX) return { kind: 'v6', n };
    return null;
  }
  // plain integer
  if (/^\d+$/.test(s)) {
    const n = BigInt(s);
    if (n <= V4_MAX) return { kind: 'v4', n };
    if (n <= V6_MAX) return { kind: 'v6', n };
    return null;
  }
  // dotted IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
    const n = parseIPv4(s);
    return n === null ? null : { kind: 'v4', n };
  }
  // IPv6
  if (s.includes(':')) {
    const n = parseIPv6(s);
    return n === null ? null : { kind: 'v6', n };
  }
  return null;
}

export default function IpAddressConverterTool() {
  const [input, setInput] = useState('192.168.1.42');

  const result = useMemo((): { error: string } | { rows: Row[]; kind: 'v4' | 'v6' } => {
    const s = input.trim();
    if (!s) return { error: 'Enter an IPv4, IPv6, integer, or 0x-hex address.' };
    const parsed = detectAndParse(s);
    if (!parsed) return { error: 'Could not parse — check octet/group ranges and format.' };

    if (parsed.kind === 'v4') {
      const n = parsed.n;
      const dotted = v4ToDotted(n);
      const bin = [
        (n >> 24n) & 0xffn, (n >> 16n) & 0xffn, (n >> 8n) & 0xffn, n & 0xffn,
      ].map((x) => x.toString(2).padStart(8, '0')).join('.');
      const mappedHi = (n >> 16n) & 0xffffn;
      const mappedLo = n & 0xffffn;
      return {
        kind: 'v4',
        rows: [
          { label: 'Dotted decimal', value: dotted },
          { label: '32-bit integer', value: n.toString() },
          { label: 'Hex', value: `0x${n.toString(16).padStart(8, '0')}` },
          { label: 'Binary (octets)', value: bin },
          { label: 'IPv4-mapped IPv6', value: `::ffff:${dotted}` },
          { label: 'IPv4-mapped (hex)', value: `::ffff:${mappedHi.toString(16)}:${mappedLo.toString(16)}` },
        ],
      };
    }

    const n = parsed.n;
    const expanded = v6Expanded(n);
    const canonical = v6Canonical(n);
    // if IPv4-mapped (::ffff:a.b.c.d), show dotted tail
    const isMapped = (n >> 32n) === 0xffffn && (n >> 48n) === 0n;
    const mappedV4 = isMapped ? v4ToDotted(n & V4_MAX) : null;
    const rows: Row[] = [
      { label: 'Canonical (RFC 5952)', value: canonical },
      { label: 'Fully expanded', value: expanded },
      { label: '128-bit integer', value: n.toString() },
      { label: 'Hex', value: `0x${n.toString(16).padStart(32, '0')}` },
    ];
    if (mappedV4) rows.push({ label: 'Embedded IPv4', value: mappedV4 });
    return { kind: 'v6', rows };
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="192.168.1.42  /  2001:db8::1  /  3232235818  /  0xc0a8012a"
        className="h-10 font-mono text-base"
        spellCheck={false}
      />
      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={result.kind === 'v4' ? 'IPv4 conversions' : 'IPv6 conversions'}>
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-40 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-sm">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[result.kind === 'v4' ? 'IPv4 (32-bit)' : 'IPv6 (128-bit)', 'BigInt math, offline']} />
        </Panel>
      )}
    </div>
  );
}
