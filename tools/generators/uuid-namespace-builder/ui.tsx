'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Version = 'v5' | 'v3';

const PREDEFINED: { label: string; value: string }[] = [
  { label: 'DNS', value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
  { label: 'URL', value: '6ba7b811-9dad-11d1-80b4-00c04fd430c8' },
  { label: 'OID', value: '6ba7b812-9dad-11d1-80b4-00c04fd430c8' },
  { label: 'X.500', value: '6ba7b814-9dad-11d1-80b4-00c04fd430c8' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBytes(uuid: string): Uint8Array | null {
  const trimmed = uuid.trim();
  if (!UUID_RE.test(trimmed)) return null;
  const hex = trimmed.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

function bytesToUuid(b: Uint8Array): string {
  const hex = Array.from(b.slice(0, 16), (x) => x.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
}

function formatUuid(hash: Uint8Array, version: number): string {
  const b = hash.slice(0, 16);
  b[6] = ((b[6] ?? 0) & 0x0f) | (version << 4);
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(b);
}

function randomV4(): string {
  const b = new Uint8Array(16);
  wc.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  return bytesToUuid(b);
}

function md5(input: Uint8Array): Uint8Array {
  function rol(n: number, c: number): number {
    return (n << c) | (n >>> (32 - c));
  }
  function add(...nums: number[]): number {
    let sum = 0;
    for (const n of nums) sum = (sum + n) >>> 0;
    return sum >>> 0;
  }
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
    21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i += 1) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }
  const originalLenBits = input.length * 8;
  const withOne = input.length + 1;
  const padLen = ((withOne + 8 + 63) & ~63) - withOne;
  const total = withOne + padLen + 8;
  const msg = new Uint8Array(total);
  msg.set(input, 0);
  msg[input.length] = 0x80;
  let len = originalLenBits;
  for (let i = 0; i < 8; i += 1) {
    msg[total - 8 + i] = len & 0xff;
    len = Math.floor(len / 256);
  }
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let chunk = 0; chunk < total; chunk += 64) {
    const M: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const off = chunk + i * 4;
      M[i] =
        ((msg[off] ?? 0) |
          ((msg[off + 1] ?? 0) << 8) |
          ((msg[off + 2] ?? 0) << 16) |
          ((msg[off + 3] ?? 0) << 24)) >>>
        0;
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i += 1) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = add(F, A, K[i] ?? 0, M[g] ?? 0);
      A = D;
      D = C;
      C = B;
      B = add(B, rol(F, s[i] ?? 0));
    }
    a0 = add(a0, A);
    b0 = add(b0, B);
    c0 = add(c0, C);
    d0 = add(d0, D);
  }
  const out = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let w = 0; w < 4; w += 1) {
    const word = words[w] ?? 0;
    out[w * 4] = word & 0xff;
    out[w * 4 + 1] = (word >>> 8) & 0xff;
    out[w * 4 + 2] = (word >>> 16) & 0xff;
    out[w * 4 + 3] = (word >>> 24) & 0xff;
  }
  return out;
}

async function sha1(input: Uint8Array): Promise<Uint8Array> {
  const subtle = (globalThis as unknown as { crypto: { subtle: SubtleCrypto } }).crypto.subtle;
  const buf = new Uint8Array(input);
  const digest = await subtle.digest('SHA-1', buf);
  return new Uint8Array(digest);
}

async function deriveUuid(namespace: Uint8Array, name: string, version: Version): Promise<string> {
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(namespace.length + nameBytes.length);
  combined.set(namespace, 0);
  combined.set(nameBytes, namespace.length);
  const hash = version === 'v5' ? await sha1(combined) : md5(combined);
  return formatUuid(hash, version === 'v5' ? 5 : 3);
}

function applyFormat(uuid: string, upper: boolean, braces: boolean): string {
  let out = upper ? uuid.toUpperCase() : uuid.toLowerCase();
  if (braces) out = `{${out}}`;
  return out;
}

export default function UuidNamespaceBuilder() {
  const [version, setVersion] = useState<Version>('v5');
  const [namespace, setNamespace] = useState(PREDEFINED[0]?.value ?? '');
  const [names, setNames] = useState('alpha\nbeta\ngamma');
  const [upper, setUpper] = useState(false);
  const [braces, setBraces] = useState(false);
  const [rows, setRows] = useState<{ name: string; uuid: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const nsBytes = uuidToBytes(namespace);
      if (!nsBytes) {
        setError('Namespace must be a valid UUID (e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8).');
        setRows([]);
        return;
      }
      const list = names
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 500);
      try {
        const out: { name: string; uuid: string }[] = [];
        for (const n of list) {
          out.push({ name: n, uuid: await deriveUuid(nsBytes, n, version) });
        }
        if (!cancelled) {
          setError(null);
          setRows(out);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to compute UUID hashes in this browser.');
          setRows([]);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [version, namespace, names]);

  const nsBytes = uuidToBytes(namespace);
  const copyAll = rows
    .map((r) => `${r.name}\t${applyFormat(r.uuid, upper, braces)}`)
    .join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Namespace" />
        <OptionsBar>
          <Field label="Version">
            <Tabs value={version} onValueChange={(v) => setVersion(v as Version)}>
              <TabsList>
                <TabsTrigger value="v5">v5 (SHA-1)</TabsTrigger>
                <TabsTrigger value="v3">v3 (MD5)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Predefined">
            <div className="flex flex-wrap gap-2">
              {PREDEFINED.map((ns) => (
                <Button
                  key={ns.label}
                  variant={namespace.trim().toLowerCase() === ns.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNamespace(ns.value)}
                >
                  {ns.label}
                </Button>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setNamespace(randomV4())}>
                <RefreshCw className="size-3.5" /> New v4
              </Button>
            </div>
          </Field>
        </OptionsBar>
        <Field label="Namespace UUID (root)">
          <div className="flex items-center gap-2">
            <Input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="6ba7b810-9dad-11d1-80b4-00c04fd430c8"
              className="font-mono"
              spellCheck={false}
            />
            <CopyButton value={namespace} size="icon-sm" />
          </div>
        </Field>
        <Field label="Names (one per line)">
          <Textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={5}
            spellCheck={false}
            className="font-mono text-sm"
          />
        </Field>
        <OptionsBar>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Braces { }">
            <Switch checked={braces} onCheckedChange={setBraces} />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!error && rows.length > 0 ? (
        <Panel>
          <PanelHeader title={`${rows.length} derived UUID${rows.length === 1 ? '' : 's'}`}>
            <CopyButton value={() => copyAll} label="Copy all" />
          </PanelHeader>
          <div className="max-h-[420px] divide-y overflow-auto">
            {rows.map((r, i) => {
              const formatted = applyFormat(r.uuid, upper, braces);
              return (
                <div key={`${r.name}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-32 shrink-0 truncate text-sm">{r.name}</span>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{formatted}</code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Use as next namespace"
                    onClick={() => setNamespace(r.uuid)}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                  <CopyButton value={formatted} size="icon-sm" />
                </div>
              );
            })}
          </div>
          <StatBar
            items={[
              version === 'v5' ? 'Version 5 (SHA-1)' : 'Version 3 (MD5)',
              nsBytes ? 'valid namespace' : '',
              'deterministic',
            ].filter((x) => x.length > 0)}
          />
        </Panel>
      ) : null}
    </div>
  );
}
