'use client';

import { useEffect, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
const enc = new TextEncoder();

type Encoding = 'hex' | 'HEX' | 'base64';

const ALGOS = [
  { name: 'SHA-1', bits: 160 },
  { name: 'SHA-256', bits: 256 },
  { name: 'SHA-384', bits: 384 },
  { name: 'SHA-512', bits: 512 },
] as const;

function toHex(bytes: Uint8Array, upper: boolean): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return upper ? out.toUpperCase() : out;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}

function encode(bytes: Uint8Array, fmt: Encoding): string {
  if (fmt === 'base64') return toB64(bytes);
  return toHex(bytes, fmt === 'HEX');
}

interface Digest {
  name: string;
  bits: number;
  bytes: number;
  value: string;
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog';

export default function ShaMultiHashTextTool() {
  const [input, setInput] = useState(SAMPLE);
  const [fmt, setFmt] = useState<Encoding>('hex');
  const [digests, setDigests] = useState<Digest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = enc.encode(input);
        const results: Digest[] = [];
        for (const algo of ALGOS) {
          const buf = await wc.subtle.digest(
            algo.name,
            data as unknown as ArrayBuffer
          );
          const bytes = new Uint8Array(buf);
          results.push({
            name: algo.name,
            bits: algo.bits,
            bytes: bytes.length,
            value: encode(bytes, fmt),
          });
        }
        if (!cancelled) {
          setDigests(results);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to hash input.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [input, fmt]);

  const byteCount = enc.encode(input).length;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Output encoding">
          <Tabs value={fmt} onValueChange={(v) => setFmt(v as Encoding)}>
            <TabsList>
              <TabsTrigger value="hex">hex</TabsTrigger>
              <TabsTrigger value="HEX">HEX</TabsTrigger>
              <TabsTrigger value="base64">Base64</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input text">
          <button
            type="button"
            className="rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted"
            onClick={() => setInput(SAMPLE)}
          >
            Sample
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder="Paste text to hash with all four SHA variants…"
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${input.length} chars`, `${byteCount} bytes (UTF-8)`]} />
      </Panel>

      {error && <ErrorBanner error={error} />}

      {digests.length > 0 && (
        <Panel>
          <PanelHeader title="Digests" />
          <div className="divide-y">
            {digests.map((d) => (
              <div key={d.name} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex items-center gap-2">
                  <code className="w-20 shrink-0 font-mono text-xs font-semibold">
                    {d.name}
                  </code>
                  <span className="text-2xs text-muted-foreground">
                    {d.bits} bits · {d.bytes} bytes
                  </span>
                  <span className="ml-auto">
                    <CopyButton value={d.value} size="icon-sm" />
                  </span>
                </div>
                <code className="break-all font-mono text-xs text-muted-foreground">
                  {d.value}
                </code>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Hashed locally with the Web Crypto API. SHA-1 is shown for legacy compatibility only —
        it is not collision-resistant.
      </p>
    </div>
  );
}
