'use client';
import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const webcrypto = (
  globalThis as unknown as {
    crypto: { subtle: SubtleCrypto; getRandomValues<T extends ArrayBufferView>(a: T): T };
  }
).crypto;

type Mode = 'encrypt' | 'decrypt';

const PBKDF2_ITERATIONS = 250000;
const SALT_LEN = 16;
const IV_LEN = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export default function AesEncryptDecrypt() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [passphrase, setPassphrase] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setError(null);
    setOutput('');
    if (!passphrase) {
      setError('Enter a passphrase');
      return;
    }
    if (!input) {
      setError(mode === 'encrypt' ? 'Enter text to encrypt' : 'Enter Base64 ciphertext to decrypt');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'encrypt') {
        const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LEN));
        const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
        const key = await deriveKey(passphrase, salt);
        const cipher = await webcrypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv as BufferSource },
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
          throw new Error('Input is not valid Base64');
        }
        if (packed.length < SALT_LEN + IV_LEN + 1) {
          throw new Error('Ciphertext is too short or malformed');
        }
        const salt = packed.slice(0, SALT_LEN);
        const iv = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
        const data = packed.slice(SALT_LEN + IV_LEN);
        const key = await deriveKey(passphrase, salt);
        let plain: ArrayBuffer;
        try {
          plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
        } catch {
          throw new Error('Decryption failed — wrong passphrase or corrupted data');
        }
        setOutput(new TextDecoder().decode(plain));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }, [mode, passphrase, input]);

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
        <Field label="Passphrase" className="flex-1">
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter a strong passphrase"
            className="max-w-sm"
          />
        </Field>
        <Button type="button" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}
        </Button>
      </OptionsBar>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title={mode === 'encrypt' ? 'Plaintext' : 'Base64 ciphertext'} />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'encrypt' ? 'Text to encrypt…' : 'Paste Base64 produced by this tool…'}
          className="min-h-40 rounded-none border-0 font-mono text-sm"
        />
      </Panel>

      {output ? (
        <Panel>
          <PanelHeader title={mode === 'encrypt' ? 'Base64 ciphertext' : 'Plaintext'}>
            <CopyButton value={output} />
          </PanelHeader>
          <Textarea readOnly value={output} className="min-h-40 rounded-none border-0 font-mono text-sm" />
        </Panel>
      ) : null}
    </div>
  );
}
