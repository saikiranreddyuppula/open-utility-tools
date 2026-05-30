'use client';

import { useMemo, useState } from 'react';

import { GeneratorList } from '@/components/tools/generator-list';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// KSUID epoch: 2014-05-13T00:00:00Z = Unix 1400000000.
const KSUID_EPOCH = 1_400_000_000;

/** Encode a byte array (big-endian) into Base62, left-padded to `pad` chars. */
function base62Encode(bytes: Uint8Array, pad: number): string {
  let input: number[] = Array.from(bytes);
  const out: string[] = [];
  while (input.length > 0) {
    let rem = 0;
    const next: number[] = [];
    for (const b of input) {
      const acc = rem * 256 + b;
      const q = Math.floor(acc / 62);
      rem = acc % 62;
      if (next.length > 0 || q > 0) next.push(q);
    }
    out.push(B62[rem] ?? '0');
    input = next;
  }
  return out.reverse().join('').padStart(pad, '0');
}

/** Decode a Base62 string into a fixed-length big-endian byte array. */
function base62Decode(str: string, len: number): Uint8Array | null {
  let digits: number[] = [0];
  for (const ch of str) {
    const v = B62.indexOf(ch);
    if (v < 0) return null;
    let carry = v;
    for (let i = digits.length - 1; i >= 0; i--) {
      const acc = (digits[i] ?? 0) * 62 + carry;
      digits[i] = acc & 0xff;
      carry = acc >> 8;
    }
    while (carry > 0) {
      digits.unshift(carry & 0xff);
      carry >>= 8;
    }
  }
  while (digits.length < len) digits.unshift(0);
  if (digits.length > len) digits = digits.slice(digits.length - len);
  return new Uint8Array(digits);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateKsuid(): string {
  const bytes = new Uint8Array(20);
  // 4-byte big-endian KSUID timestamp.
  const ts = Math.floor(Date.now() / 1000) - KSUID_EPOCH;
  bytes[0] = (ts >>> 24) & 0xff;
  bytes[1] = (ts >>> 16) & 0xff;
  bytes[2] = (ts >>> 8) & 0xff;
  bytes[3] = ts & 0xff;
  // 16 random payload bytes.
  const payload = new Uint8Array(16);
  wc.getRandomValues(payload);
  bytes.set(payload, 4);
  return base62Encode(bytes, 27);
}

interface Decoded {
  timestamp: number;
  iso: string;
  payloadHex: string;
  rawHex: string;
}

function decodeKsuid(input: string): Decoded | null {
  const s = input.trim();
  if (s.length !== 27) return null;
  const bytes = base62Decode(s, 20);
  if (!bytes) return null;
  const ts =
    ((bytes[0] ?? 0) << 24) |
    ((bytes[1] ?? 0) << 16) |
    ((bytes[2] ?? 0) << 8) |
    (bytes[3] ?? 0);
  const tsUnsigned = ts >>> 0;
  const unix = tsUnsigned + KSUID_EPOCH;
  const payload = bytes.subarray(4);
  return {
    timestamp: unix,
    iso: new Date(unix * 1000).toISOString(),
    payloadHex: toHex(payload),
    rawHex: toHex(bytes),
  };
}

export default function KsuidGeneratorTool() {
  const [decodeInput, setDecodeInput] = useState('');

  const decoded = useMemo(() => {
    if (!decodeInput.trim()) return null;
    return decodeKsuid(decodeInput);
  }, [decodeInput]);

  const decodeError =
    decodeInput.trim() && !decoded ? 'Not a valid 27-character Base62 KSUID.' : null;

  return (
    <div className="flex flex-col gap-4">
      <GeneratorList
        generate={generateKsuid}
        defaultCount={5}
        maxCount={500}
        downloadName="ksuids.txt"
        label="KSUIDs"
      />

      <Panel>
        <PanelHeader title="Decode a KSUID" />
        <div className="space-y-3 p-3">
          <Input
            value={decodeInput}
            onChange={(e) => setDecodeInput(e.target.value)}
            placeholder="Paste a 27-char KSUID, e.g. 0ujtsYcgvSTl8PAuAdqWYSMnLOv"
            className="font-mono"
          />
          <ErrorBanner error={decodeError} />
          {decoded && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { label: 'UTC time', value: decoded.iso },
                { label: 'Unix timestamp', value: String(decoded.timestamp) },
                { label: 'Payload (16 bytes hex)', value: decoded.payloadHex },
                { label: 'Raw (20 bytes hex)', value: decoded.rawHex },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-xs">
                    <span className="truncate">{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <StatBar items={['epoch 2014-05-13T00:00:00Z', '4-byte time + 16-byte random']} />
      </Panel>
    </div>
  );
}
