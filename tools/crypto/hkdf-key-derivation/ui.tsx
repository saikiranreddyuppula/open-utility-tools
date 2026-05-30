'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Encoding = 'utf8' | 'hex' | 'base64';
type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';

const HASH_LEN: Record<Hash, number> = { 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };

function decodeInput(value: string, enc: Encoding): Uint8Array {
  if (enc === 'utf8') return new TextEncoder().encode(value);
  if (enc === 'hex') {
    const clean = value.replace(/\s+/g, '');
    if (clean.length === 0) return new Uint8Array(0);
    if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of characters.');
    if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error('Hex input contains non-hex characters.');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  // base64
  try {
    const bin = atob(value.trim());
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new Error('Invalid Base64 input.');
  }
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

export default function HkdfKeyDerivationTool() {
  const [ikm, setIkm] = useState('password-or-shared-secret');
  const [ikmEnc, setIkmEnc] = useState<Encoding>('utf8');
  const [salt, setSalt] = useState('');
  const [saltEnc, setSaltEnc] = useState<Encoding>('utf8');
  const [info, setInfo] = useState('app:v1 encryption key');
  const [hash, setHash] = useState<Hash>('SHA-256');
  const [lengthStr, setLengthStr] = useState('32');

  const [hex, setHex] = useState('');
  const [b64, setB64] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const length = Number(lengthStr);
        if (!Number.isFinite(length) || !Number.isInteger(length) || length <= 0) {
          throw new Error('Output length must be a positive integer (bytes).');
        }
        const maxLen = 255 * HASH_LEN[hash];
        if (length > maxLen) {
          throw new Error(`HKDF-${hash} can output at most ${maxLen} bytes (255 × hash length).`);
        }
        const ikmBytes = decodeInput(ikm, ikmEnc);
        if (ikmBytes.length === 0) throw new Error('Input key material (IKM) cannot be empty.');
        const saltBytes = salt ? decodeInput(salt, saltEnc) : new Uint8Array(0);
        const infoBytes = new TextEncoder().encode(info);

        const baseKey = await wc.subtle.importKey('raw', ikmBytes as BufferSource, 'HKDF', false, [
          'deriveBits',
        ]);
        const bits = await wc.subtle.deriveBits(
          {
            name: 'HKDF',
            hash,
            salt: saltBytes as BufferSource,
            info: infoBytes as BufferSource,
          },
          baseKey,
          length * 8
        );
        const out = new Uint8Array(bits);
        if (!cancelled) {
          setHex(toHex(out));
          setB64(toBase64(out));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setHex('');
          setB64('');
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [ikm, ikmEnc, salt, saltEnc, info, hash, lengthStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Hash">
            <Select value={hash} onValueChange={(v) => setHash(v as Hash)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHA-256">SHA-256</SelectItem>
                <SelectItem value="SHA-384">SHA-384</SelectItem>
                <SelectItem value="SHA-512">SHA-512</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Output length (bytes)">
            <Input
              value={lengthStr}
              onChange={(e) => setLengthStr(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Input key material (IKM)">
          <Select value={ikmEnc} onValueChange={(v) => setIkmEnc(v as Encoding)}>
            <SelectTrigger className="h-7 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
            </SelectContent>
          </Select>
        </PanelHeader>
        <Input
          value={ikm}
          onChange={(e) => setIkm(e.target.value)}
          placeholder="secret key material"
          className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Salt (optional)">
          <Select value={saltEnc} onValueChange={(v) => setSaltEnc(v as Encoding)}>
            <SelectTrigger className="h-7 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
            </SelectContent>
          </Select>
        </PanelHeader>
        <Input
          value={salt}
          onChange={(e) => setSalt(e.target.value)}
          placeholder="optional salt (recommended)"
          className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Info / context string (UTF-8)" />
        <Input
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          placeholder="application-specific context"
          className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
        />
      </Panel>

      <ErrorBanner error={error} />

      {!error && (hex || b64) && (
        <Panel>
          <PanelHeader title="Derived key (OKM)">
            <CopyButton value={hex} size="icon-sm" disabled={!hex} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Hex</span>
                <CopyButton value={hex} size="icon-sm" />
              </div>
              <code className="block break-all rounded-md border bg-muted/20 p-2 font-mono text-xs">{hex}</code>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Base64</span>
                <CopyButton value={b64} size="icon-sm" />
              </div>
              <code className="block break-all rounded-md border bg-muted/20 p-2 font-mono text-xs">{b64}</code>
            </div>
          </div>
          <StatBar
            items={[
              `HKDF-${hash}`,
              `${hex.length / 2} bytes · ${hex.length * 4} bits`,
              salt ? 'salted extract' : 'zero-salt extract',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
