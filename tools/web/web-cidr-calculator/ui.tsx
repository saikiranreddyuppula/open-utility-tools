'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Row { label: string; value: string }

const SAMPLE = '192.168.1.0/24';

// --- IPv4 helpers (32-bit math via BigInt to stay sign-safe) ---

function parseIpv4(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0n;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    acc = (acc << 8n) | BigInt(n);
  }
  return acc;
}

function ipv4ToString(n: bigint): string {
  const a = (n >> 24n) & 0xffn;
  const b = (n >> 16n) & 0xffn;
  const c = (n >> 8n) & 0xffn;
  const d = n & 0xffn;
  return `${a}.${b}.${c}.${d}`;
}

function ipv4Hex(n: bigint): string {
  return '0x' + n.toString(16).padStart(8, '0').toUpperCase();
}

// --- IPv6 helpers (128-bit) ---

function parseIpv6(ip: string): bigint | null {
  if (!ip.includes(':')) return null;
  if (ip.includes('::')) {
    const halves = ip.split('::');
    if (halves.length !== 2) return null;
    const left = halves[0] ?? '';
    const right = halves[1] ?? '';
    const leftGroups = left === '' ? [] : left.split(':');
    const rightGroups = right === '' ? [] : right.split(':');
    const missing = 8 - (leftGroups.length + rightGroups.length);
    if (missing < 0) return null;
    const filled = leftGroups.concat(Array.from({ length: missing }, () => '0'), rightGroups);
    return groupsToBig(filled);
  }
  const groups = ip.split(':');
  if (groups.length !== 8) return null;
  return groupsToBig(groups);
}

function groupsToBig(groups: string[]): bigint | null {
  if (groups.length !== 8) return null;
  let acc = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    acc = (acc << 16n) | BigInt(parseInt(g, 16));
  }
  return acc;
}

function ipv6Expanded(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = (n >> BigInt(i * 16)) & 0xffffn;
    groups.push(g.toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

function ipv6Compressed(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = (n >> BigInt(i * 16)) & 0xffffn;
    groups.push(g.toString(16));
  }
  // Find the longest run of zero groups to collapse.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen < 2) return groups.join(':');
  const before = groups.slice(0, bestStart);
  const after = groups.slice(bestStart + bestLen);
  return `${before.join(':')}::${after.join(':')}`;
}

export default function CidrCalculatorTool() {
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    const text = input.trim();
    if (!text) return { error: '' };
    const slash = text.indexOf('/');
    if (slash < 0) return { error: 'Enter a CIDR block like 192.168.1.0/24 or 2001:db8::/48.' };
    const addr = text.slice(0, slash).trim();
    const prefixStr = text.slice(slash + 1).trim();
    if (!/^\d+$/.test(prefixStr)) return { error: 'Prefix length must be a number.' };
    const prefix = Number(prefixStr);

    if (addr.includes(':')) {
      const ip = parseIpv6(addr);
      if (ip === null) return { error: 'Invalid IPv6 address.' };
      if (prefix < 0 || prefix > 128) return { error: 'IPv6 prefix must be 0–128.' };
      const hostBits = 128n - BigInt(prefix);
      const mask = hostBits === 128n ? 0n : (((1n << BigInt(prefix)) - 1n) << hostBits) & ((1n << 128n) - 1n);
      const network = ip & mask;
      const last = network | ((1n << hostBits) - 1n);
      const count = 1n << hostBits;
      const rows: Row[] = [
        { label: 'Type', value: 'IPv6' },
        { label: 'Network prefix', value: `${ipv6Compressed(network)}/${prefix}` },
        { label: 'First address', value: ipv6Compressed(network) },
        { label: 'Last address', value: ipv6Compressed(last) },
        { label: 'First (expanded)', value: ipv6Expanded(network) },
        { label: 'Last (expanded)', value: ipv6Expanded(last) },
        { label: 'Total addresses', value: count.toString() },
      ];
      return { rows };
    }

    // IPv4
    const ip = parseIpv4(addr);
    if (ip === null) return { error: 'Invalid IPv4 address.' };
    if (prefix < 0 || prefix > 32) return { error: 'IPv4 prefix must be 0–32.' };
    const full = (1n << 32n) - 1n;
    const hostBits = 32n - BigInt(prefix);
    const mask = hostBits === 32n ? 0n : (full << hostBits) & full;
    const wildcard = full ^ mask;
    const network = ip & mask;
    const broadcast = network | wildcard;
    const total = 1n << hostBits;
    const usable = total > 2n ? total - 2n : prefix >= 31 ? total : 0n;
    const firstHost = prefix >= 31 ? network : network + 1n;
    const lastHost = prefix >= 31 ? broadcast : broadcast - 1n;

    const rows: Row[] = [
      { label: 'Type', value: 'IPv4' },
      { label: 'Network address', value: `${ipv4ToString(network)}/${prefix}` },
      { label: 'Broadcast address', value: ipv4ToString(broadcast) },
      { label: 'Netmask', value: `${ipv4ToString(mask)} (${ipv4Hex(mask)})` },
      { label: 'Wildcard mask', value: ipv4ToString(wildcard) },
      { label: 'First host', value: ipv4ToString(firstHost) },
      { label: 'Last host', value: ipv4ToString(lastHost) },
      { label: 'Total addresses', value: total.toString() },
      { label: 'Usable hosts', value: usable.toString() },
    ];
    return { rows };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="CIDR block" className="min-w-[260px] flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="192.168.1.0/24"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error || null} />
      ) : (
        <Panel>
          <PanelHeader title="Range details">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-40 shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-sm">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`Input: ${input.trim()}`]} />
        </Panel>
      )}
    </div>
  );
}
