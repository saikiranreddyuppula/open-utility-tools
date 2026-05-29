'use client';

import { useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type Mode = 'encrypt' | 'decrypt';
type Format = 'hex' | 'base64';

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] ?? 0) ^ (key[i % key.length] ?? 0);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error('Hex input must have an even number of digits.');
  }
  if (clean.length > 0 && !/^[0-9a-f]+$/.test(clean)) {
    throw new Error('Hex input contains non-hexadecimal characters.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  let bin: string;
  try {
    bin = atob(clean);
  } catch {
    throw new Error('Invalid Base64 input.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export default function XorCipherTool() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [format, setFormat] = useState<Format>('hex');
  const [key, setKey] = useState('');
  const [input, setInput] = useState('');

  const { output, error } = useMemo<{ output: string; error: string | null }>(() => {
    if (!input) return { output: '', error: null };
    if (!key) return { output: '', error: 'Enter a key.' };
    try {
      const keyBytes = new TextEncoder().encode(key);
      if (keyBytes.length === 0) {
        return { output: '', error: 'Enter a key.' };
      }
      if (mode === 'encrypt') {
        const data = new TextEncoder().encode(input);
        const result = xorBytes(data, keyBytes);
        return {
          output: format === 'hex' ? bytesToHex(result) : bytesToBase64(result),
          error: null,
        };
      }
      // Decrypt: parse ciphertext from chosen format, XOR, decode UTF-8.
      const data = format === 'hex' ? hexToBytes(input) : base64ToBytes(input);
      const result = xorBytes(data, keyBytes);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(result);
      return { output: text, error: null };
    } catch (err) {
      return { output: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [input, key, mode, format]);

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="encrypt">
                <Lock className="h-3.5 w-3.5" />
                Encrypt
              </TabsTrigger>
              <TabsTrigger value="decrypt">
                <Unlock className="h-3.5 w-3.5" />
                Decrypt
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Format" hint={mode === 'encrypt' ? 'Output encoding' : 'Input encoding'}>
          <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList>
              <TabsTrigger value="hex">Hex</TabsTrigger>
              <TabsTrigger value="base64">Base64</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Key" className="flex-1 min-w-[200px]">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Secret key (repeats over the data)"
          />
        </Field>
      </OptionsBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={mode === 'encrypt' ? 'Plaintext' : `Ciphertext (${format})`} />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encrypt' ? 'Type text to encrypt…' : 'Paste ciphertext to decrypt…'
            }
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title={mode === 'encrypt' ? `Ciphertext (${format})` : 'Plaintext'}>
            <CopyButton value={output} />
          </PanelHeader>
          <Textarea
            value={output}
            readOnly
            placeholder="Result appears here…"
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar
        items={[
          `Key: ${key.length} char${key.length === 1 ? '' : 's'}`,
          input.length > 0 && `Input: ${input.length} char${input.length === 1 ? '' : 's'}`,
          output.length > 0 && `Output: ${output.length} char${output.length === 1 ? '' : 's'}`,
        ]}
      />

      {error && <ErrorBanner error={error} />}
    </div>
  );
}
