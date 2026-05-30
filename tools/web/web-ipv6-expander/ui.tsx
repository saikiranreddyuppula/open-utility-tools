'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'expand' | 'compress';

const SAMPLE = [
  '2001:db8::1',
  '2001:0db8:0000:0000:0000:0000:0000:0001',
  '::ffff:192.0.2.1',
  'fe80::',
  '::1',
  '0:0:0:0:0:0:0:0',
].join('\n');

/** Parse an IPv6 string into exactly 8 16-bit groups, or throw. */
function parseGroups(addrRaw: string): number[] {
  let addr = addrRaw.trim();
  if (!addr) throw new Error('Empty address');

  // Strip a zone index (fe80::1%eth0).
  const pct = addr.indexOf('%');
  if (pct !== -1) addr = addr.slice(0, pct);

  // Handle embedded IPv4 in the last 32 bits.
  let v4Groups: number[] = [];
  const lastColon = addr.lastIndexOf(':');
  const tail = lastColon === -1 ? addr : addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.');
    if (octets.length !== 4) throw new Error('Invalid embedded IPv4');
    const nums = octets.map((o) => {
      if (!/^\d{1,3}$/.test(o)) throw new Error('Invalid IPv4 octet');
      const n = Number(o);
      if (n > 255) throw new Error('IPv4 octet out of range');
      return n;
    });
    const o0 = nums[0] ?? 0;
    const o1 = nums[1] ?? 0;
    const o2 = nums[2] ?? 0;
    const o3 = nums[3] ?? 0;
    v4Groups = [(o0 << 8) | o1, (o2 << 8) | o3];
    addr = addr.slice(0, lastColon + 1) + '0:0';
  }

  const doubleColon = addr.indexOf('::');
  if (doubleColon !== -1 && addr.indexOf('::', doubleColon + 1) !== -1) {
    throw new Error('Only one "::" allowed');
  }

  const toGroups = (part: string): number[] => {
    if (part === '') return [];
    return part.split(':').map((h) => {
      if (!/^[0-9a-fA-F]{1,4}$/.test(h)) throw new Error(`Invalid group "${h}"`);
      return parseInt(h, 16);
    });
  };

  let groups: number[];
  if (doubleColon === -1) {
    groups = toGroups(addr);
    if (groups.length !== 8) throw new Error(`Expected 8 groups, got ${groups.length}`);
  } else {
    const left = toGroups(addr.slice(0, doubleColon));
    const right = toGroups(addr.slice(doubleColon + 2));
    const fill = 8 - left.length - right.length;
    if (fill < 0) throw new Error('Too many groups');
    groups = [...left, ...new Array<number>(fill).fill(0), ...right];
  }

  // Reattach IPv4-derived groups if present (they replaced the trailing 0:0).
  if (v4Groups.length === 2) {
    groups[6] = v4Groups[0] ?? 0;
    groups[7] = v4Groups[1] ?? 0;
  }

  if (groups.length !== 8) throw new Error('Could not resolve to 8 groups');
  return groups;
}

function expand(groups: number[]): string {
  return groups.map((g) => g.toString(16).padStart(4, '0')).join(':');
}

function compress(groups: number[]): string {
  const hex = groups.map((g) => g.toString(16)); // lowercase, no leading zeros

  // Find the longest run of consecutive zero groups (length >= 2).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) return hex.join(':');

  const before = hex.slice(0, bestStart);
  const after = hex.slice(bestStart + bestLen);
  const left = before.join(':');
  const right = after.join(':');
  return `${left}::${right}`;
}

function process(input: string, mode: Mode): string {
  const lines = input.split('\n');
  const out: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      out.push('');
      continue;
    }
    try {
      const groups = parseGroups(line);
      out.push(mode === 'expand' ? expand(groups) : compress(groups));
    } catch (e) {
      out.push(`# error: ${line} — ${e instanceof Error ? e.message : 'invalid'}`);
    }
  }
  return out.join('\n');
}

export default function Ipv6ExpanderTool() {
  const [mode, setMode] = useState<Mode>('compress');
  const transform = useCallback((input: string) => process(input, mode), [mode]);

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="IPv6 addresses (one per line)"
      outputLabel={mode === 'expand' ? 'Expanded' : 'Compressed (RFC 5952)'}
      inputPlaceholder="2001:db8::1"
      sample={SAMPLE}
      downloadName="ipv6.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="compress">Compress</TabsTrigger>
              <TabsTrigger value="expand">Expand</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
