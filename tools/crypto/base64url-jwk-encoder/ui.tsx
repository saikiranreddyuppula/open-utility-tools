'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Direction = 'decode' | 'encode';
type Interp = 'hex' | 'decimal' | 'utf8';

function base64urlToBytes(s: string): Uint8Array {
  const clean = s.trim().replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) {
    throw new Error('Not valid Base64url: only A–Z a–z 0–9 - _ allowed (no padding).');
  }
  const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = 0; i < bytes.length; i++) n = (n << 8n) | BigInt(bytes[i] ?? 0);
  return n;
}

function hexToBytes(hex: string): Uint8Array {
  let clean = hex.trim().replace(/^0x/i, '').replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex must contain only 0–9 and a–f.');
  if (clean.length % 2 !== 0) clean = `0${clean}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bigIntToBytes(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('JWK integer fields are unsigned; value must be ≥ 0.');
  if (n === 0n) return new Uint8Array([0]);
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return hexToBytes(hex);
}

export default function Base64urlJwkEncoder() {
  const [direction, setDirection] = useState<Direction>('decode');
  const [interp, setInterp] = useState<Interp>('decimal');
  const [input, setInput] = useState('AQAB'); // common JWK exponent e = 65537

  const result = useMemo(() => {
    const value = input.trim();
    if (!value) return { output: '', bytes: 0, note: '' };
    try {
      if (direction === 'decode') {
        const bytes = base64urlToBytes(value);
        let output: string;
        if (interp === 'hex') output = bytesToHex(bytes) || '(empty)';
        else if (interp === 'decimal') output = bytesToBigInt(bytes).toString(10);
        else output = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        return { output, bytes: bytes.length, note: 'big-endian, unsigned' };
      }
      // encode
      let bytes: Uint8Array;
      if (interp === 'hex') bytes = hexToBytes(value);
      else if (interp === 'decimal') {
        let n: bigint;
        try {
          n = BigInt(value);
        } catch {
          throw new Error('Decimal value must be a whole number.');
        }
        bytes = bigIntToBytes(n);
      } else bytes = new TextEncoder().encode(value);
      return { output: bytesToBase64url(bytes), bytes: bytes.length, note: 'no padding (RFC 4648 §5)' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Conversion failed.' };
    }
  }, [direction, interp, input]);

  const inputLabel = direction === 'decode' ? 'Base64url value (e.g. JWK n, e, x, y, d)' : `Input as ${interp === 'hex' ? 'hex bytes' : interp === 'decimal' ? 'decimal integer' : 'UTF-8 text'}`;
  const outputLabel = direction === 'decode' ? `Decoded as ${interp === 'hex' ? 'hex bytes' : interp === 'decimal' ? 'decimal integer' : 'UTF-8 text'}` : 'Base64url value';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Direction">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="decode">Base64url → value</TabsTrigger>
              <TabsTrigger value="encode">value → Base64url</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Value interpretation">
          <Tabs value={interp} onValueChange={(v) => setInterp(v as Interp)}>
            <TabsList>
              <TabsTrigger value="decimal">Decimal int</TabsTrigger>
              <TabsTrigger value="hex">Hex bytes</TabsTrigger>
              <TabsTrigger value="utf8">UTF-8</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={inputLabel} />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={direction === 'decode' ? 'AQAB' : interp === 'decimal' ? '65537' : interp === 'hex' ? '01 00 01' : 'text'}
            spellCheck={false}
            className="min-h-36 rounded-none border-0 font-mono text-sm"
          />
        </Panel>

        <Panel>
          <PanelHeader title={outputLabel}>
            {!('error' in result) && result.output && <CopyButton value={result.output} />}
          </PanelHeader>
          {'error' in result ? (
            <div className="p-3">
              <ErrorBanner error={result.error} />
            </div>
          ) : (
            <Textarea
              readOnly
              value={result.output}
              placeholder="Result appears here…"
              spellCheck={false}
              className="min-h-36 rounded-none border-0 font-mono text-sm"
            />
          )}
          {!('error' in result) && (
            <StatBar items={[`${result.bytes} byte${result.bytes === 1 ? '' : 's'}`, result.note]} />
          )}
        </Panel>
      </div>
    </div>
  );
}
