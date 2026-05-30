'use client';

import { useState } from 'react';

import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Version = 'ipv4' | 'ipv6';
type V4Range = 'any' | 'private' | 'public' | 'cidr';

function randByte(): number {
  const b = new Uint8Array(1);
  wc.getRandomValues(b);
  return b[0] ?? 0;
}

function randInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return randByte() % maxExclusive;
}

function randHextet(): string {
  const b = new Uint8Array(2);
  wc.getRandomValues(b);
  const hi = b[0] ?? 0;
  const lo = b[1] ?? 0;
  return ((hi << 8) | lo).toString(16);
}

/** Parse a `a.b.c.d/n` CIDR into a base 32-bit int + prefix length. */
function parseCidr(cidr: string): { base: number; prefix: number } | null {
  const parts = cidr.trim().split('/');
  const ipPart = parts[0] ?? '';
  const prefPart = parts[1];
  const octets = ipPart.split('.');
  if (octets.length !== 4) return null;
  let base = 0;
  for (const o of octets) {
    const n = Number(o);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    base = (base << 8) | n;
  }
  const prefix = prefPart === undefined ? 32 : Number(prefPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return { base: base >>> 0, prefix };
}

function intToIpv4(n: number): string {
  const u = n >>> 0;
  return `${(u >>> 24) & 255}.${(u >>> 16) & 255}.${(u >>> 8) & 255}.${u & 255}`;
}

function genPrivate(): string {
  // Pick one of the three RFC1918 blocks.
  const block = randInt(3);
  if (block === 0) return `10.${randByte()}.${randByte()}.${randByte()}`;
  if (block === 1) return `172.${16 + randInt(16)}.${randByte()}.${randByte()}`;
  return `192.168.${randByte()}.${randByte()}`;
}

function genPublic(): string {
  // Reject reserved/loopback/multicast/private first octets; retry a bounded number of times.
  for (let attempt = 0; attempt < 64; attempt++) {
    const a = randByte();
    const b = randByte();
    const c = randByte();
    const d = randByte();
    if (a === 0 || a === 10 || a === 127 || a >= 224) continue; // 0, 10/8, loopback, multicast+reserved
    if (a === 172 && b >= 16 && b <= 31) continue; // 172.16/12
    if (a === 192 && b === 168) continue; // 192.168/16
    if (a === 169 && b === 254) continue; // link-local
    if (a === 100 && b >= 64 && b <= 127) continue; // CGNAT 100.64/10
    return `${a}.${b}.${c}.${d}`;
  }
  return `203.0.113.${randByte()}`; // documentation range fallback
}

function genCidr(parsed: { base: number; prefix: number }): string {
  const hostBits = 32 - parsed.prefix;
  if (hostBits <= 0) return intToIpv4(parsed.base);
  // Random host portion within the mask.
  const r = new Uint32Array(1);
  wc.getRandomValues(r);
  const rand = r[0] ?? 0;
  const hostMask = hostBits >= 32 ? 0xffffffff : (1 << hostBits) - 1;
  const netMask = (~hostMask) >>> 0;
  const addr = ((parsed.base & netMask) | (rand & hostMask)) >>> 0;
  return intToIpv4(addr);
}

function genIpv6(compressed: boolean, linkLocal: boolean): string {
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) groups.push(randHextet());
  if (linkLocal) {
    groups[0] = 'fe80';
    groups[1] = '0';
    groups[2] = '0';
    groups[3] = '0';
  }
  if (!compressed) {
    return groups.map((g) => g.padStart(4, '0')).join(':');
  }
  // Compress the longest run of zero groups into "::".
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if ((groups[i] ?? '') === '0') {
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
  if (bestLen < 2) return groups.join(':');
  const head = groups.slice(0, bestStart).join(':');
  const tail = groups.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}

export default function FakeIpAddressGenerator() {
  const [version, setVersion] = useState<Version>('ipv4');
  const [range, setRange] = useState<V4Range>('any');
  const [cidr, setCidr] = useState('10.0.0.0/8');
  const [compressed, setCompressed] = useState(true);
  const [linkLocal, setLinkLocal] = useState(false);

  const gen = (): string => {
    if (version === 'ipv6') return genIpv6(compressed, linkLocal);
    if (range === 'private') return genPrivate();
    if (range === 'public') return genPublic();
    if (range === 'cidr') {
      const parsed = parseCidr(cidr);
      if (!parsed) return 'invalid CIDR';
      return genCidr(parsed);
    }
    return `${randByte()}.${randByte()}.${randByte()}.${randByte()}`;
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[version, range, cidr, compressed, linkLocal]}
      defaultCount={10}
      maxCount={500}
      downloadName="ip-addresses.txt"
      label="IP addresses"
      options={
        <>
          <Field label="Version">
            <Select value={version} onValueChange={(v) => setVersion(v as Version)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {version === 'ipv4' && (
            <Field label="Range">
              <Select value={range} onValueChange={(v) => setRange(v as V4Range)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="private">Private (RFC1918)</SelectItem>
                  <SelectItem value="public">Public only</SelectItem>
                  <SelectItem value="cidr">Custom CIDR</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {version === 'ipv4' && range === 'cidr' && (
            <Field label="CIDR" className="min-w-[180px]">
              <Input
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                className="font-mono"
                placeholder="192.168.0.0/16"
              />
            </Field>
          )}

          {version === 'ipv6' && (
            <>
              <Field label="Form">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={compressed} onCheckedChange={setCompressed} id="ip-compressed" />
                  <Label htmlFor="ip-compressed" className="text-xs text-muted-foreground">
                    {compressed ? 'Compressed (::)' : 'Full'}
                  </Label>
                </div>
              </Field>
              <Field label="Scope">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={linkLocal} onCheckedChange={setLinkLocal} id="ip-linklocal" />
                  <Label htmlFor="ip-linklocal" className="text-xs text-muted-foreground">
                    {linkLocal ? 'Link-local fe80::' : 'Global'}
                  </Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
