'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'random' | 'expand';
type Version = 'ipv4' | 'ipv6';
type Range = 'public' | 'private' | 'doc';
type Format = 'lines' | 'csv' | 'json';

const MAX_OUTPUT = 5000;

/** Deterministic 32-bit PRNG (mulberry32) seeded from a string. */
function makePrng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randByte(rng: () => number): number {
  return Math.floor(rng() * 256) & 0xff;
}

function ipv4FromInt(n: bigint): string {
  const v = Number(n & 0xffffffffn);
  return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;
}

function randomIpv4(rng: () => number, range: Range): string {
  if (range === 'private') {
    const block = Math.floor(rng() * 3);
    if (block === 0) return `10.${randByte(rng)}.${randByte(rng)}.${randByte(rng)}`;
    if (block === 1) return `172.${16 + Math.floor(rng() * 16)}.${randByte(rng)}.${randByte(rng)}`;
    return `192.168.${randByte(rng)}.${randByte(rng)}`;
  }
  if (range === 'doc') {
    // 192.0.2.0/24 documentation range (RFC 5737).
    return `192.0.2.${randByte(rng)}`;
  }
  // public-looking: avoid obvious reserved first octets.
  for (let attempt = 0; attempt < 32; attempt++) {
    const a = randByte(rng);
    const b = randByte(rng);
    const c = randByte(rng);
    const d = randByte(rng);
    if (a === 0 || a === 10 || a === 127 || a >= 224) continue;
    if (a === 172 && b >= 16 && b <= 31) continue;
    if (a === 192 && b === 168) continue;
    if (a === 169 && b === 254) continue;
    return `${a}.${b}.${c}.${d}`;
  }
  return `203.0.113.${randByte(rng)}`;
}

function compressIpv6(groups: string[]): string {
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

function randomIpv6(rng: () => number, range: Range): string {
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) {
    const hi = randByte(rng);
    const lo = randByte(rng);
    groups.push(((hi << 8) | lo).toString(16));
  }
  if (range === 'private') {
    // Unique local fd00::/8.
    groups[0] = 'fd' + randByte(rng).toString(16).padStart(2, '0');
  } else if (range === 'doc') {
    // 2001:db8::/32 documentation range.
    groups[0] = '2001';
    groups[1] = 'db8';
  }
  return compressIpv6(groups);
}

interface CidrV4 {
  base: bigint;
  prefix: number;
}
interface CidrV6 {
  base: bigint;
  prefix: number;
}

function parseCidrV4(cidr: string): CidrV4 | null {
  const parts = cidr.trim().split('/');
  const ipPart = parts[0] ?? '';
  const octets = ipPart.split('.');
  if (octets.length !== 4) return null;
  let base = 0n;
  for (const o of octets) {
    const n = Number(o);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    base = (base << 8n) | BigInt(n);
  }
  const prefix = parts[1] === undefined ? 32 : Number(parts[1]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return { base, prefix };
}

function expandIpv6(addr: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = (addr >> BigInt(i * 16)) & 0xffffn;
    groups.push(g.toString(16));
  }
  return compressIpv6(groups);
}

function parseIpv6ToBigInt(s: string): bigint | null {
  const str = s.trim();
  if (!/^[0-9a-fA-F:]+$/.test(str)) return null;
  const dbl = str.split('::');
  if (dbl.length > 2) return null;
  const head = (dbl[0] ?? '').split(':').filter((x) => x.length > 0);
  const tail = dbl.length === 2 ? (dbl[1] ?? '').split(':').filter((x) => x.length > 0) : [];
  const total = head.length + tail.length;
  if (dbl.length === 1 && total !== 8) return null;
  if (dbl.length === 2 && total > 7) return null;
  const middle = dbl.length === 2 ? new Array<string>(8 - total).fill('0') : [];
  const all = [...head, ...middle, ...tail];
  if (all.length !== 8) return null;
  let acc = 0n;
  for (const g of all) {
    const v = parseInt(g, 16);
    if (!Number.isInteger(v) || v < 0 || v > 0xffff) return null;
    acc = (acc << 16n) | BigInt(v);
  }
  return acc;
}

function parseCidrV6(cidr: string): CidrV6 | null {
  const parts = cidr.trim().split('/');
  const base = parseIpv6ToBigInt(parts[0] ?? '');
  if (base === null) return null;
  const prefix = parts[1] === undefined ? 128 : Number(parts[1]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return null;
  return { base, prefix };
}

interface BuildResult {
  list: string[];
  error: string | null;
  truncated: boolean;
}

function formatOutput(list: string[], format: Format): string {
  if (format === 'json') return JSON.stringify(list, null, 2);
  if (format === 'csv') return list.join(',');
  return list.join('\n');
}

function buildRandom(opts: {
  version: Version;
  range: Range;
  count: number;
  seed: string;
}): BuildResult {
  const n = Math.max(1, Math.min(opts.count, MAX_OUTPUT));
  const rng = makePrng(opts.seed || 'seed');
  const list: string[] = [];
  for (let i = 0; i < n; i++) {
    list.push(opts.version === 'ipv6' ? randomIpv6(rng, opts.range) : randomIpv4(rng, opts.range));
  }
  return { list, error: null, truncated: opts.count > MAX_OUTPUT };
}

function buildExpand(opts: {
  version: Version;
  cidr: string;
  includeEdges: boolean;
}): BuildResult {
  if (opts.version === 'ipv4') {
    const parsed = parseCidrV4(opts.cidr);
    if (!parsed) return { list: [], error: 'Invalid IPv4 CIDR (e.g. 10.0.0.0/28).', truncated: false };
    const hostBits = 32 - parsed.prefix;
    const total = 1n << BigInt(hostBits);
    const netBase = (parsed.base >> BigInt(hostBits)) << BigInt(hostBits);
    const list: string[] = [];
    let truncated = false;
    // Determine the inclusive range of addresses to emit.
    let start = 0n;
    let end = total - 1n;
    if (!opts.includeEdges && hostBits >= 2) {
      start = 1n; // skip network
      end = total - 2n; // skip broadcast
    }
    for (let i = start; i <= end; i++) {
      if (list.length >= MAX_OUTPUT) {
        truncated = true;
        break;
      }
      list.push(ipv4FromInt(netBase + i));
    }
    return { list, error: null, truncated };
  }
  const parsed = parseCidrV6(opts.cidr);
  if (!parsed) return { list: [], error: 'Invalid IPv6 CIDR (e.g. 2001:db8::/124).', truncated: false };
  const hostBits = 128 - parsed.prefix;
  if (hostBits > 20) {
    return {
      list: [],
      error: `Prefix /${parsed.prefix} is too large to enumerate (use /108 or longer for IPv6).`,
      truncated: false,
    };
  }
  const total = 1n << BigInt(hostBits);
  const netBase = (parsed.base >> BigInt(hostBits)) << BigInt(hostBits);
  const list: string[] = [];
  let truncated = false;
  for (let i = 0n; i < total; i++) {
    if (list.length >= MAX_OUTPUT) {
      truncated = true;
      break;
    }
    list.push(expandIpv6(netBase + i));
  }
  return { list, error: null, truncated };
}

export default function IpCidrListGeneratorTool() {
  const [mode, setMode] = useState<Mode>('random');
  const [version, setVersion] = useState<Version>('ipv4');
  const [range, setRange] = useState<Range>('public');
  const [count, setCount] = useState('20');
  const [seed, setSeed] = useState('test-data');
  const [cidr, setCidr] = useState('10.0.0.0/28');
  const [includeEdges, setIncludeEdges] = useState(true);
  const [format, setFormat] = useState<Format>('lines');
  const [nonce, setNonce] = useState(0);

  const result = useMemo<BuildResult>(() => {
    if (mode === 'random') {
      const c = Number(count);
      if (!Number.isInteger(c) || c < 1) {
        return { list: [], error: 'Count must be a positive integer.', truncated: false };
      }
      // nonce participates so "Reshuffle" reseeds without changing the seed field.
      const effectiveSeed = nonce === 0 ? seed : `${seed}#${nonce}`;
      return buildRandom({ version, range, count: c, seed: effectiveSeed });
    }
    return buildExpand({ version, cidr, includeEdges });
  }, [mode, version, range, count, seed, cidr, includeEdges, nonce]);

  const output = useMemo(() => formatOutput(result.list, format), [result.list, format]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="random">Random</TabsTrigger>
              <TabsTrigger value="expand">Expand CIDR</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
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

        {mode === 'random' && (
          <>
            <Field label="Range">
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public-looking</SelectItem>
                  <SelectItem value="private">Private (RFC 1918 / ULA)</SelectItem>
                  <SelectItem value="doc">Documentation range</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Count">
              <Input
                value={count}
                onChange={(e) => setCount(e.target.value)}
                inputMode="numeric"
                className="w-24 font-mono"
              />
            </Field>
            <Field label="Seed" hint="Same seed → same list.">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="w-40 font-mono" />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => setNonce((n) => n + 1)}>
                <RefreshCw className="size-3.5" /> Reshuffle
              </Button>
            </div>
          </>
        )}

        {mode === 'expand' && (
          <>
            <Field label="CIDR" className="min-w-[200px]">
              <Input
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                className="font-mono"
                placeholder={version === 'ipv4' ? '10.0.0.0/28' : '2001:db8::/124'}
              />
            </Field>
            <Field label="Network + broadcast">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={includeEdges} onCheckedChange={setIncludeEdges} id="ip-edges" />
                <Label htmlFor="ip-edges" className="text-xs text-muted-foreground">
                  {includeEdges ? 'included' : 'usable hosts only'}
                </Label>
              </div>
            </Field>
          </>
        )}

        <Field label="Format">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">One per line</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {!result.error && (
        <Panel>
          <PanelHeader title="Addresses">
            <CopyButton value={() => output} label="Copy all" disabled={!output} />
            <DownloadButton
              data={() => output}
              filename={format === 'json' ? 'ip-addresses.json' : 'ip-addresses.txt'}
              disabled={!output}
            />
          </PanelHeader>
          <pre className="max-h-[440px] overflow-auto p-3 font-mono text-xs leading-relaxed">
            {output || '—'}
          </pre>
          <StatBar
            items={[
              `${result.list.length.toLocaleString()} addresses`,
              version,
              result.truncated && `truncated at ${MAX_OUTPUT.toLocaleString()}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
