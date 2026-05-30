'use client';

import { useCallback, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const wc = (
  globalThis as unknown as {
    crypto: { subtle: SubtleCrypto; getRandomValues<T extends ArrayBufferView>(a: T): T };
  }
).crypto;

type Mode = 'encrypt' | 'decrypt';
type KeySize = '128' | '256';

const SALT_LEN = 16;
const IV_LEN = 16; // AES-CBC block size

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim().replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) throw new Error('IV hex must have an even number of digits');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  bits: number,
): Promise<CryptoKey> {
  const baseKey = await wc.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return wc.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-CBC', length: bits },
    false,
    ['encrypt', 'decrypt'],
  );
}

export default function AesCbcText() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [keySize, setKeySize] = useState<KeySize>('256');
  const [passphrase, setPassphrase] = useState('');
  const [iterations, setIterations] = useState('250000');
  const [ivHex, setIvHex] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const randomizeIv = useCallback(() => {
    const iv = wc.getRandomValues(new Uint8Array(IV_LEN));
    setIvHex(bytesToHex(iv));
  }, []);

  const run = useCallback(async () => {
    setError(null);
    setOutput('');
    const iterNum = Number(iterations);
    if (!passphrase) {
      setError('Enter a passphrase.');
      return;
    }
    if (!Number.isFinite(iterNum) || iterNum < 1 || iterNum > 5_000_000) {
      setError('Iterations must be between 1 and 5,000,000.');
      return;
    }
    if (!input.trim()) {
      setError(mode === 'encrypt' ? 'Enter text to encrypt.' : 'Paste Base64 ciphertext to decrypt.');
      return;
    }
    const bits = keySize === '256' ? 256 : 128;
    setBusy(true);
    try {
      if (mode === 'encrypt') {
        let iv: Uint8Array;
        if (ivHex.trim()) {
          iv = hexToBytes(ivHex);
          if (iv.length !== IV_LEN) throw new Error(`IV must be exactly ${IV_LEN} bytes (32 hex chars).`);
        } else {
          iv = wc.getRandomValues(new Uint8Array(IV_LEN));
          setIvHex(bytesToHex(iv));
        }
        const salt = wc.getRandomValues(new Uint8Array(SALT_LEN));
        const key = await deriveKey(passphrase, salt, iterNum, bits);
        const cipher = await wc.subtle.encrypt(
          { name: 'AES-CBC', iv: iv as BufferSource },
          key,
          new TextEncoder().encode(input),
        );
        const cipherBytes = new Uint8Array(cipher);
        const packed = new Uint8Array(salt.length + iv.length + cipherBytes.length);
        packed.set(salt, 0);
        packed.set(iv, salt.length);
        packed.set(cipherBytes, salt.length + iv.length);
        setOutput(bytesToBase64(packed));
      } else {
        let packed: Uint8Array;
        try {
          packed = base64ToBytes(input);
        } catch {
          throw new Error('Input is not valid Base64.');
        }
        if (packed.length < SALT_LEN + IV_LEN + 16) {
          throw new Error('Ciphertext is too short or malformed.');
        }
        const salt = packed.slice(0, SALT_LEN);
        const iv = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
        const data = packed.slice(SALT_LEN + IV_LEN);
        setIvHex(bytesToHex(iv));
        const key = await deriveKey(passphrase, salt, iterNum, bits);
        let plain: ArrayBuffer;
        try {
          plain = await wc.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, key, data as BufferSource);
        } catch {
          throw new Error('Decryption failed — wrong passphrase, key size, iterations, or corrupted data.');
        }
        setOutput(new TextDecoder().decode(plain));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }, [mode, keySize, passphrase, iterations, ivHex, input]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
              <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Key size">
          <Select value={keySize} onValueChange={(v) => setKeySize(v as KeySize)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="128">AES-128</SelectItem>
              <SelectItem value="256">AES-256</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="PBKDF2 iterations">
          <Input value={iterations} onChange={(e) => setIterations(e.target.value)} inputMode="numeric" className="w-32" />
        </Field>
        <Field label="Passphrase" className="min-w-[200px] flex-1">
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter a strong passphrase"
          />
        </Field>
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}
        </Button>
      </OptionsBar>

      <OptionsBar>
        <Field label="IV (16 bytes hex)" className="min-w-[260px] flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={ivHex}
              onChange={(e) => setIvHex(e.target.value)}
              placeholder={mode === 'encrypt' ? 'Leave blank to auto-generate' : 'Read from ciphertext on decrypt'}
              className="font-mono"
            />
            {mode === 'encrypt' && (
              <Button type="button" variant="secondary" size="sm" onClick={randomizeIv} title="Random IV">
                <RefreshCw className="size-3.5" /> Random
              </Button>
            )}
          </div>
        </Field>
      </OptionsBar>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title={mode === 'encrypt' ? 'Plaintext' : 'Base64 ciphertext'} />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'encrypt' ? 'Text to encrypt…' : 'Paste salt||IV||ciphertext Base64 produced by this tool…'}
          spellCheck={false}
          className="min-h-36 rounded-none border-0 font-mono text-sm"
        />
      </Panel>

      {output ? (
        <Panel>
          <PanelHeader title={mode === 'encrypt' ? 'Base64 ciphertext (salt‖IV‖data)' : 'Recovered text'}>
            <CopyButton value={output} />
          </PanelHeader>
          <Textarea readOnly value={output} spellCheck={false} className="min-h-36 rounded-none border-0 font-mono text-sm" />
          <StatBar items={[`AES-${keySize}-CBC`, `${output.length.toLocaleString()} chars`]} />
        </Panel>
      ) : null}
    </div>
  );
}
