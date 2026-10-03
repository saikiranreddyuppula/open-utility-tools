/**
 * IP list parsing + BigInt interval math for the CIDR Aggregator & Range Converter.
 * Pure, framework-free TypeScript (IPv4 + IPv6).
 */

export type Family = 4 | 6;

export interface Block {
  v: Family;
  start: bigint;
  end: bigint;
}

export interface Cidr {
  v: Family;
  start: bigint;
  prefix: number;
}

export type EntryKind = 'cidr' | 'ip' | 'range' | 'mask';

export interface Entry extends Block {
  /** 1-based source line. */
  line: number;
  /** Source text this entry was parsed from. */
  raw: string;
  kind: EntryKind;
  /** Original prefix length for cidr / mask entries. */
  prefix?: number;
  /** True when host bits were set and the CIDR was rounded down to its network address. */
  normalized?: boolean;
  /** Canonical text of the entry (CIDR for cidr/ip/mask, "a - b" for ranges). */
  text: string;
  note?: string;
}

export interface InvalidItem {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  entries: Entry[];
  invalid: InvalidItem[];
}

export interface ParseOptions {
  /** 'ipv4' (default): IPv4-mapped IPv6 (::ffff:a.b.c.d) is converted to plain IPv4. 'keep': stays IPv6. */
  mapped?: 'ipv4' | 'keep';
}

const BITS: Record<Family, number> = { 4: 32, 6: 128 };
const MAX: Record<Family, bigint> = { 4: (1n << 32n) - 1n, 6: (1n << 128n) - 1n };
const MAPPED_BASE = 0xffffn << 32n; // ::ffff:0:0/96

export function bitsOf(v: Family): number {
  return BITS[v];
}

export function maxOf(v: Family): bigint {
  return MAX[v];
}

// ---------------------------------------------------------------------------
// Address parsing / formatting
// ---------------------------------------------------------------------------

export function parseIPv4(s: string): bigint | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let acc = 0n;
  for (const p of parts) {
    if (!/^[0-9]{1,3}$/.test(p)) return null;
    if (p.length > 1 && p.startsWith('0')) return null; // ambiguous (octal?)
    const n = Number(p);
    if (n > 255) return null;
    acc = (acc << 8n) | BigInt(n);
  }
  return acc;
}

export function parseIPv6(input: string): bigint | null {
  let s = input;
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (s.length < 2 || !s.includes(':')) return null;
  if (s.includes('%')) return null;
  const dbl = s.indexOf('::');
  if (dbl !== s.lastIndexOf('::')) return null;
  if (s.includes(':::')) return null;

  const parseGroups = (part: string, allowV4Tail: boolean): number[] | null => {
    if (part === '') return [];
    const toks = part.split(':');
    const out: number[] = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i] ?? '';
      if (allowV4Tail && i === toks.length - 1 && t.includes('.')) {
        const v4 = parseIPv4(t);
        if (v4 === null) return null;
        out.push(Number(v4 >> 16n), Number(v4 & 0xffffn));
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(t)) return null;
      out.push(parseInt(t, 16));
    }
    return out;
  };

  let groups: number[];
  if (dbl >= 0) {
    const left = parseGroups(s.slice(0, dbl), false);
    const right = parseGroups(s.slice(dbl + 2), true);
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    groups = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    const all = parseGroups(s, true);
    if (!all || all.length !== 8) return null;
    groups = all;
  }
  if (groups.length !== 8) return null;
  let acc = 0n;
  for (const g of groups) acc = (acc << 16n) | BigInt(g);
  return acc;
}

export function formatIPv4(n: bigint): string {
  return [24n, 16n, 8n, 0n].map((sh) => String((n >> sh) & 0xffn)).join('.');
}

/** RFC 5952 compressed form: lowercase, no leading zeros, longest (first on tie) run of >=2 zero groups -> "::". */
export function formatIPv6(n: bigint, mixedMapped = false): string {
  if (mixedMapped && n >> 32n === 0xffffn) {
    return `::ffff:${formatIPv4(n & 0xffffffffn)}`;
  }
  const g: number[] = [];
  for (let i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < 8) {
    if (g[i] === 0) {
      let j = i;
      while (j < 8 && g[j] === 0) j++;
      if (j - i > bestLen) {
        bestLen = j - i;
        bestStart = i;
      }
      i = j;
    } else i++;
  }
  const hex = g.map((x) => x.toString(16));
  if (bestLen < 2) return hex.join(':');
  const left = hex.slice(0, bestStart).join(':');
  const right = hex.slice(bestStart + bestLen).join(':');
  return `${left}::${right}`;
}

export function formatIp(v: Family, n: bigint, mapped: 'ipv4' | 'keep' = 'ipv4'): string {
  return v === 4 ? formatIPv4(n) : formatIPv6(n, mapped === 'keep');
}

function parseAddr(s: string): { v: Family; n: bigint } | null {
  if (s.includes(':')) {
    const n = parseIPv6(s);
    return n === null ? null : { v: 6, n };
  }
  const n = parseIPv4(s);
  return n === null ? null : { v: 4, n };
}

// ---------------------------------------------------------------------------
// Bit helpers
// ---------------------------------------------------------------------------

function bitLength(n: bigint): number {
  return n === 0n ? 0 : n.toString(2).length;
}

function trailingZeros(n: bigint, cap: number): number {
  if (n === 0n) return cap;
  const low = n & -n;
  return Math.min(bitLength(low) - 1, cap);
}

function prefixMask(v: Family, prefix: number): bigint {
  const bits = BITS[v];
  if (prefix <= 0) return 0n;
  const host = BigInt(bits - prefix);
  return (MAX[v] >> host) << host;
}

export function netmaskToPrefix(mask: bigint): number | null {
  const inv = mask ^ MAX[4];
  if ((inv & (inv + 1n)) !== 0n) return null;
  return 32 - bitLength(inv);
}

export function hostmaskToPrefix(mask: bigint): number | null {
  if ((mask & (mask + 1n)) !== 0n) return null;
  return 32 - bitLength(mask);
}

// ---------------------------------------------------------------------------
// Blocks <-> CIDRs
// ---------------------------------------------------------------------------

/** Minimal CIDR cover of [start, end] (== Python summarize_address_range). */
export function blockToCidrs(b: Block): Cidr[] {
  const out: Cidr[] = [];
  const bits = BITS[b.v];
  let start = b.start;
  while (start <= b.end) {
    let k = trailingZeros(start, bits);
    while (k > 0 && start + (1n << BigInt(k)) - 1n > b.end) k--;
    out.push({ v: b.v, start, prefix: bits - k });
    const next = start + (1n << BigInt(k));
    if (next > MAX[b.v]) break;
    start = next;
  }
  return out;
}

export function cidrToBlock(c: Cidr): Block {
  const size = 1n << BigInt(BITS[c.v] - c.prefix);
  return { v: c.v, start: c.start, end: c.start + size - 1n };
}

export function formatCidr(c: Cidr, mapped: 'ipv4' | 'keep' = 'ipv4'): string {
  return `${formatIp(c.v, c.start, mapped)}/${c.prefix}`;
}

export function blocksToCidrs(blocks: Block[]): Cidr[] {
  const out: Cidr[] = [];
  for (const b of blocks) for (const c of blockToCidrs(b)) out.push(c);
  return out;
}

export function blockSize(b: Block): bigint {
  return b.end - b.start + 1n;
}

export function compareBlocks(a: Block, b: Block): number {
  if (a.v !== b.v) return a.v - b.v;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end < b.end ? -1 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Parsing a list
// ---------------------------------------------------------------------------

type TokResult = { ok: true; entry: Omit<Entry, 'line' | 'raw'> } | { ok: false; reason: string };

function maybeUnmap(b: Block, mapped: 'ipv4' | 'keep'): { block: Block; converted: boolean } {
  if (mapped === 'ipv4' && b.v === 6 && b.start >= MAPPED_BASE && b.end < MAPPED_BASE + (1n << 32n)) {
    return {
      block: { v: 4, start: b.start - MAPPED_BASE, end: b.end - MAPPED_BASE },
      converted: true,
    };
  }
  return { block: b, converted: false };
}

function makeCidrEntry(
  v: Family,
  n: bigint,
  prefix: number,
  kind: EntryKind,
  mapped: 'ipv4' | 'keep',
  note?: string
): TokResult {
  const mask = prefixMask(v, prefix);
  const network = n & mask;
  const normalized = network !== n;
  const size = 1n << BigInt(BITS[v] - prefix);
  const { block, converted } = maybeUnmap({ v, start: network, end: network + size - 1n }, mapped);
  const pfx = converted ? prefix - 96 : prefix;
  const notes: string[] = [];
  if (note) notes.push(note);
  if (normalized) notes.push(`host bits set, normalized to ${formatIp(block.v, block.start, mapped)}/${pfx}`);
  if (converted) notes.push('IPv4-mapped IPv6 converted to IPv4');
  const text = `${formatIp(block.v, block.start, mapped)}/${pfx}`;
  return {
    ok: true,
    entry: {
      ...block,
      kind: kind === 'ip' ? 'ip' : kind,
      prefix: pfx,
      normalized,
      text: kind === 'ip' ? formatIp(block.v, block.start, mapped) : text,
      note: notes.length ? notes.join('; ') : undefined,
    },
  };
}

function parseSingle(tok: string, mapped: 'ipv4' | 'keep'): TokResult {
  const slash = tok.indexOf('/');
  if (slash < 0) {
    const a = parseAddr(tok);
    if (!a) return { ok: false, reason: describeBadAddr(tok) };
    return makeCidrEntry(a.v, a.n, BITS[a.v], 'ip', mapped);
  }
  const addrStr = tok.slice(0, slash);
  const suffix = tok.slice(slash + 1);
  const a = parseAddr(addrStr);
  if (!a) return { ok: false, reason: describeBadAddr(addrStr) };
  if (suffix === '') return { ok: false, reason: 'missing prefix length after "/"' };
  if (/^[0-9]{1,3}$/.test(suffix)) {
    const p = Number(suffix);
    if (p > BITS[a.v]) {
      return { ok: false, reason: `prefix /${p} is out of range (IPv${a.v} allows 0-${BITS[a.v]})` };
    }
    return makeCidrEntry(a.v, a.n, p, 'cidr', mapped);
  }
  if (a.v === 4 && suffix.includes('.')) {
    const m = parseIPv4(suffix);
    if (m === null) return { ok: false, reason: `invalid netmask "${suffix}"` };
    const p = netmaskToPrefix(m);
    if (p !== null) return makeCidrEntry(4, a.n, p, 'mask', mapped);
    const hp = hostmaskToPrefix(m);
    if (hp !== null) return makeCidrEntry(4, a.n, hp, 'mask', mapped, `wildcard mask ${suffix} read as /${hp}`);
    return { ok: false, reason: `"${suffix}" is not a contiguous netmask or wildcard mask` };
  }
  return { ok: false, reason: `invalid prefix length "${suffix}"` };
}

function describeBadAddr(s: string): string {
  if (s.includes('%')) return `"${s}": IPv6 zone IDs are not supported`;
  if (s.includes(':')) return `"${s}" is not a valid IPv6 address`;
  if (/^\d+\.\d+\.\d+$/.test(s)) return `"${s}": IPv4 addresses need 4 octets (shorthand like 10.1.2 is not supported)`;
  if (/(^|\.)0\d/.test(s) && /^[0-9.]+$/.test(s)) return `"${s}": leading zeros are ambiguous (octal?), remove them`;
  if (/^[0-9.]+$/.test(s)) return `"${s}" is not a valid IPv4 address`;
  return `"${s}" is not an IP address, CIDR or range`;
}

function maskValue(tok: string): boolean {
  const m = parseIPv4(tok);
  if (m === null) return false;
  return netmaskToPrefix(m) !== null || hostmaskToPrefix(m) !== null;
}

function isRangeSep(t: string | undefined): boolean {
  return t === '-' || t === 'to' || t === 'TO' || t === 'To';
}

function parseRange(a: string, b: string, mapped: 'ipv4' | 'keep'): TokResult {
  const x = parseAddr(a);
  const y = parseAddr(b);
  if (!x) return { ok: false, reason: describeBadAddr(a) };
  if (!y) return { ok: false, reason: describeBadAddr(b) };
  if (x.v !== y.v) return { ok: false, reason: 'range mixes IPv4 and IPv6' };
  if (x.n > y.n) return { ok: false, reason: `range start ${a} is after end ${b}` };
  const un = maybeUnmap({ v: x.v, start: x.n, end: y.n }, mapped);
  const blk = un.block;
  return {
    ok: true,
    entry: {
      ...blk,
      kind: 'range',
      text: `${formatIp(blk.v, blk.start, mapped)} - ${formatIp(blk.v, blk.end, mapped)}`,
      note: un.converted ? 'IPv4-mapped IPv6 converted to IPv4' : undefined,
    },
  };
}

/** Parse mixed IPv4/IPv6 CIDRs, IPs, ranges and netmask forms. `#` starts a comment. */
export function parseList(text: string, opts: ParseOptions = {}): ParseResult {
  const mapped = opts.mapped ?? 'ipv4';
  const entries: Entry[] = [];
  const invalid: InvalidItem[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li] ?? '';
    const hash = line.indexOf('#');
    if (hash >= 0) line = line.slice(0, hash);
    const chunks = line.split(/[,;]/);
    for (const chunk of chunks) {
      const norm = chunk
        .trim()
        .replace(/\s*[-–—]\s*/g, ' - ')
        .replace(/^\s+|\s+$/g, '');
      if (!norm) continue;
      const toks = norm.split(/\s+/);
      let i = 0;
      while (i < toks.length) {
        const t = toks[i] ?? '';
        let res: TokResult;
        let raw: string;
        let used = 1;
        if (isRangeSep(toks[i + 1]) && toks[i + 2] !== undefined) {
          const b = toks[i + 2] ?? '';
          res = parseRange(t, b, mapped);
          raw = `${t} - ${b}`;
          used = 3;
        } else if (isRangeSep(t)) {
          res = { ok: false, reason: 'range separator without a start address' };
          raw = t;
        } else if (
          !t.includes('/') &&
          !t.includes(':') &&
          parseIPv4(t) !== null &&
          toks[i + 1] !== undefined &&
          maskValue(toks[i + 1] ?? '')
        ) {
          raw = `${t} ${toks[i + 1]}`;
          res = parseSingle(`${t}/${toks[i + 1]}`, mapped);
          used = 2;
        } else {
          res = parseSingle(t, mapped);
          raw = t;
        }
        if (res.ok) {
          entries.push({ ...res.entry, line: li + 1, raw });
        } else {
          invalid.push({ line: li + 1, text: raw, reason: res.reason });
        }
        i += used;
      }
    }
  }
  return { entries, invalid };
}

export function entriesToBlocks(entries: Entry[]): Block[] {
  return entries.map((e) => ({ v: e.v, start: e.start, end: e.end }));
}

// ---------------------------------------------------------------------------
// Interval algebra
// ---------------------------------------------------------------------------

/** Sort and merge overlapping / adjacent blocks (per family). */
export function mergeBlocks(blocks: Block[]): Block[] {
  const sorted = blocks.slice().sort(compareBlocks);
  const out: Block[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && last.v === b.v && b.start <= last.end + 1n) {
      if (b.end > last.end) last.end = b.end;
    } else {
      out.push({ v: b.v, start: b.start, end: b.end });
    }
  }
  return out;
}

/** a \ b (inputs need not be merged). Result is merged and sorted. */
export function subtractBlocks(a: Block[], b: Block[]): Block[] {
  const A = mergeBlocks(a);
  const B = mergeBlocks(b);
  const out: Block[] = [];
  let j = 0;
  for (const x of A) {
    // skip B blocks that end before x (same family) or belong to an earlier family
    while (j < B.length) {
      const y = B[j];
      if (!y) break;
      if (y.v < x.v || (y.v === x.v && y.end < x.start)) j++;
      else break;
    }
    let cur = x.start;
    let k = j;
    let done = false;
    while (k < B.length) {
      const y = B[k];
      if (!y || y.v !== x.v || y.start > x.end) break;
      if (y.start > cur) out.push({ v: x.v, start: cur, end: y.start - 1n });
      if (y.end >= x.end) {
        done = true;
        break;
      }
      cur = y.end + 1n;
      k++;
    }
    if (!done) out.push({ v: x.v, start: cur, end: x.end });
  }
  return out;
}

export function intersectBlocks(a: Block[], b: Block[]): Block[] {
  const A = mergeBlocks(a);
  const B = mergeBlocks(b);
  const out: Block[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const x = A[i];
    const y = B[j];
    if (!x || !y) break;
    if (x.v !== y.v) {
      if (x.v < y.v) i++;
      else j++;
      continue;
    }
    const s = x.start > y.start ? x.start : y.start;
    const e = x.end < y.end ? x.end : y.end;
    if (s <= e) out.push({ v: x.v, start: s, end: e });
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

/** Minimal CIDR set covering the union of all blocks (== Python collapse_addresses). */
export function aggregate(blocks: Block[]): Cidr[] {
  return blocksToCidrs(mergeBlocks(blocks));
}

/** Exact duplicates removed, sorted by address then prefix; ranges are expanded to their CIDRs. */
export function dedupeSort(entries: Entry[]): { cidrs: Cidr[]; duplicates: number } {
  const all: Cidr[] = [];
  for (const e of entries) for (const c of blockToCidrs(e)) all.push(c);
  all.sort((a, b) => (a.v !== b.v ? a.v - b.v : a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.prefix - b.prefix));
  const out: Cidr[] = [];
  for (const c of all) {
    const last = out[out.length - 1];
    if (last && last.v === c.v && last.start === c.start && last.prefix === c.prefix) continue;
    out.push(c);
  }
  return { cidrs: out, duplicates: all.length - out.length };
}

export type OverlapRelation = 'duplicate' | 'contains' | 'inside' | 'partial';

export interface OverlapPair {
  a: Entry;
  b: Entry;
  /** How `a` relates to `b`. */
  relation: OverlapRelation;
}

export function findOverlaps(entries: Entry[], maxPairs = 2000): { pairs: OverlapPair[]; truncated: boolean } {
  const sorted = entries.slice().sort((x, y) => compareBlocks(x, y) || x.line - y.line);
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (!b || b.v !== a.v || b.start > a.end) break;
      // sorted by start then end: b.start >= a.start
      let relation: OverlapRelation;
      if (a.start === b.start && a.end === b.end) relation = 'duplicate';
      else if (b.end <= a.end) relation = 'contains';
      else relation = 'partial';
      if (pairs.length >= maxPairs) return { pairs, truncated: true };
      pairs.push({ a, b, relation });
    }
  }
  return { pairs, truncated: false };
}

export interface SplitResult {
  cidrs: Cidr[];
  /** Total number of subnets before the display limit was applied. */
  total: bigint;
  truncated: boolean;
  skipped: Cidr[];
}

/** Split every block (as minimal CIDRs) into subnets of the given prefix length. */
export function splitCidrs(
  cidrs: Cidr[],
  prefix4: number,
  prefix6: number,
  limit: number
): SplitResult {
  const out: Cidr[] = [];
  const skipped: Cidr[] = [];
  let total = 0n;
  let truncated = false;
  for (const c of cidrs) {
    const target = c.v === 4 ? prefix4 : prefix6;
    if (target < c.prefix || target > BITS[c.v]) {
      skipped.push(c);
      continue;
    }
    const n = 1n << BigInt(target - c.prefix);
    total += n;
    const step = 1n << BigInt(BITS[c.v] - target);
    for (let i = 0n; i < n; i++) {
      if (out.length >= limit) {
        truncated = true;
        break;
      }
      out.push({ v: c.v, start: c.start + i * step, prefix: target });
    }
  }
  return { cidrs: out, total, truncated, skipped };
}

// ---------------------------------------------------------------------------
// Stats / formatting numbers
// ---------------------------------------------------------------------------

export interface Counts {
  v4: bigint;
  v6: bigint;
  v4Blocks: number;
  v6Blocks: number;
}

export function countAddresses(blocks: Block[]): Counts {
  const c: Counts = { v4: 0n, v6: 0n, v4Blocks: 0, v6Blocks: 0 };
  for (const b of mergeBlocks(blocks)) {
    if (b.v === 4) {
      c.v4 += blockSize(b);
      c.v4Blocks++;
    } else {
      c.v6 += blockSize(b);
      c.v6Blocks++;
    }
  }
  return c;
}

export function withCommas(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "2^64", "≈ 1.844 × 10^19" or an exact comma-grouped number for small counts. */
export function prettyCount(n: bigint): string {
  if (n < 1000000000000n) return withCommas(n);
  if ((n & (n - 1n)) === 0n) return `2^${bitLength(n) - 1}`;
  const s = n.toString();
  return `≈ ${s[0]}.${s.slice(1, 4)} × 10^${s.length - 1}`;
}

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

export type OutFormat =
  | 'cidr'
  | 'ranges'
  | 'nginx'
  | 'apache'
  | 'iptables'
  | 'nftables'
  | 'ipset'
  | 'aws'
  | 'csv';

export interface FormatOptions {
  action: 'allow' | 'deny';
  name: string;
  /** Optional destination port (iptables / AWS). */
  port: string;
  proto: 'tcp' | 'udp';
  mapped: 'ipv4' | 'keep';
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  action: 'allow',
  name: 'allowlist',
  port: '',
  proto: 'tcp',
  mapped: 'ipv4',
};

export const FORMAT_LABELS: Record<OutFormat, string> = {
  cidr: 'CIDR list',
  ranges: 'Ranges (first - last)',
  nginx: 'nginx allow/deny',
  apache: 'Apache Require ip',
  iptables: 'iptables / ip6tables',
  nftables: 'nftables set',
  ipset: 'ipset',
  aws: 'AWS security group JSON',
  csv: 'CSV (cidr, first, last, size)',
};

function safeName(name: string): string {
  const s = name.trim().replace(/[^A-Za-z0-9_.-]+/g, '_');
  return s || 'iplist';
}

export function renderFormat(fmt: OutFormat, blocks: Block[], opts: FormatOptions): string {
  const m = opts.mapped;
  const cidrs = blocksToCidrs(blocks);
  const v4 = cidrs.filter((c) => c.v === 4).map((c) => formatCidr(c, m));
  const v6 = cidrs.filter((c) => c.v === 6).map((c) => formatCidr(c, m));
  const all = [...v4, ...v6];
  const name = safeName(opts.name);
  const allow = opts.action === 'allow';
  const port = opts.port.trim();
  switch (fmt) {
    case 'cidr':
      return all.join('\n');
    case 'ranges':
      return blocks
        .map((b) =>
          b.start === b.end
            ? formatIp(b.v, b.start, m)
            : `${formatIp(b.v, b.start, m)} - ${formatIp(b.v, b.end, m)}`
        )
        .join('\n');
    case 'nginx': {
      if (all.length === 0) return allow ? 'deny all;' : 'allow all;';
      const rule = allow ? 'allow' : 'deny';
      const lines = all.map((c) => `${rule} ${c};`);
      lines.push(allow ? 'deny all;' : 'allow all;');
      return lines.join('\n');
    }
    case 'apache': {
      if (all.length === 0) return allow ? 'Require all denied' : 'Require all granted';
      if (allow) return all.map((c) => `Require ip ${c}`).join('\n');
      return ['<RequireAll>', '    Require all granted', ...all.map((c) => `    Require not ip ${c}`), '</RequireAll>'].join('\n');
    }
    case 'iptables': {
      const target = allow ? 'ACCEPT' : 'DROP';
      const pp = port ? ` -p ${opts.proto} --dport ${port}` : '';
      return [
        ...v4.map((c) => `iptables -A INPUT -s ${c}${pp} -j ${target}`),
        ...v6.map((c) => `ip6tables -A INPUT -s ${c}${pp} -j ${target}`),
      ].join('\n');
    }
    case 'nftables': {
      const parts: string[] = [];
      const set = (label: string, type: string, items: string[]) => {
        parts.push(
          `set ${name}_${label} {`,
          `    type ${type}`,
          '    flags interval',
          '    auto-merge',
          `    elements = { ${items.join(', ')} }`,
          '}'
        );
      };
      if (v4.length) set('v4', 'ipv4_addr', v4);
      if (v6.length) set('v6', 'ipv6_addr', v6);
      return parts.join('\n');
    }
    case 'ipset': {
      const lines: string[] = [];
      if (v4.length) {
        lines.push(`ipset create ${name}_v4 hash:net family inet`);
        for (const c of v4) lines.push(`ipset add ${name}_v4 ${c}`);
      }
      if (v6.length) {
        lines.push(`ipset create ${name}_v6 hash:net family inet6`);
        for (const c of v6) lines.push(`ipset add ${name}_v6 ${c}`);
      }
      return lines.join('\n');
    }
    case 'aws': {
      const portNum = Number(port);
      const hasPort = port !== '' && Number.isInteger(portNum) && portNum >= 0 && portNum <= 65535;
      const perm: Record<string, unknown> = {
        IpProtocol: hasPort ? opts.proto : '-1',
      };
      if (hasPort) {
        perm.FromPort = portNum;
        perm.ToPort = portNum;
      }
      perm.IpRanges = v4.map((c) => ({ CidrIp: c }));
      perm.Ipv6Ranges = v6.map((c) => ({ CidrIpv6: c }));
      return JSON.stringify({ IpPermissions: [perm] }, null, 2);
    }
    case 'csv': {
      const rows = ['cidr,first,last,size'];
      for (const c of cidrs) {
        const b = cidrToBlock(c);
        rows.push(
          [formatCidr(c, m), formatIp(c.v, b.start, m), formatIp(c.v, b.end, m), blockSize(b).toString()].join(',')
        );
      }
      return rows.join('\n');
    }
  }
}

// ---------------------------------------------------------------------------
// Presets for the exclude list
// ---------------------------------------------------------------------------

export interface Preset {
  id: string;
  label: string;
  cidrs: string[];
}

export const PRESETS: Preset[] = [
  { id: 'private', label: 'Private (RFC 1918 + ULA)', cidrs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'] },
  { id: 'loopback', label: 'Loopback', cidrs: ['127.0.0.0/8', '::1/128'] },
  { id: 'linklocal', label: 'Link-local', cidrs: ['169.254.0.0/16', 'fe80::/10'] },
  { id: 'multicast', label: 'Multicast', cidrs: ['224.0.0.0/4', 'ff00::/8'] },
  { id: 'cgnat', label: 'CGNAT (100.64.0.0/10)', cidrs: ['100.64.0.0/10'] },
  {
    id: 'docs',
    label: 'Documentation',
    cidrs: ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24', '2001:db8::/32'],
  },
  {
    id: 'reserved',
    label: 'Other reserved',
    cidrs: ['0.0.0.0/8', '192.0.0.0/24', '192.88.99.0/24', '198.18.0.0/15', '240.0.0.0/4', '255.255.255.255/32', '::/128', '64:ff9b::/96', '100::/64'],
  },
];
