'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, Download } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
const IV_LEN = 12;
const ENC_EXT = '.enc';

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
    { name: 'AES-GCM', length: bits },
    false,
    ['encrypt', 'decrypt'],
  );
}

interface ResultFile {
  url: string;
  name: string;
  size: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AesGcmFile() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [keySize, setKeySize] = useState<KeySize>('256');
  const [passphrase, setPassphrase] = useState('');
  const [iterations, setIterations] = useState('250000');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setError(null);
  }, []);

  const run = useCallback(async () => {
    reset();
    const iterNum = Number(iterations);
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (!passphrase) {
      setError('Enter a passphrase.');
      return;
    }
    if (!Number.isFinite(iterNum) || iterNum < 1 || iterNum > 5_000_000) {
      setError('Iterations must be between 1 and 5,000,000.');
      return;
    }
    const bits = keySize === '256' ? 256 : 128;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      if (mode === 'encrypt') {
        const salt = wc.getRandomValues(new Uint8Array(SALT_LEN));
        const iv = wc.getRandomValues(new Uint8Array(IV_LEN));
        const key = await deriveKey(passphrase, salt, iterNum, bits);
        const cipher = await wc.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, buf);
        const cipherBytes = new Uint8Array(cipher);
        const packed = new Uint8Array(SALT_LEN + IV_LEN + cipherBytes.length);
        packed.set(salt, 0);
        packed.set(iv, SALT_LEN);
        packed.set(cipherBytes, SALT_LEN + IV_LEN);
        const blob = new Blob([packed as BlobPart], { type: 'application/octet-stream' });
        setResult({ url: URL.createObjectURL(blob), name: `${file.name}${ENC_EXT}`, size: packed.length });
      } else {
        const packed = new Uint8Array(buf);
        if (packed.length < SALT_LEN + IV_LEN + 16) {
          throw new Error('File is too short to be valid AES-GCM ciphertext from this tool.');
        }
        const salt = packed.slice(0, SALT_LEN);
        const iv = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
        const data = packed.slice(SALT_LEN + IV_LEN);
        const key = await deriveKey(passphrase, salt, iterNum, bits);
        let plain: ArrayBuffer;
        try {
          plain = await wc.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
        } catch {
          throw new Error('Authentication failed — wrong passphrase, key size, iterations, or corrupted file.');
        }
        const outName = file.name.endsWith(ENC_EXT)
          ? file.name.slice(0, -ENC_EXT.length)
          : `decrypted-${file.name}`;
        const blob = new Blob([plain], { type: 'application/octet-stream' });
        setResult({ url: URL.createObjectURL(blob), name: outName, size: plain.byteLength });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }, [mode, keySize, passphrase, iterations, file, reset]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
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
      </OptionsBar>

      <Panel>
        <PanelHeader title={mode === 'encrypt' ? 'File to encrypt' : 'Encrypted file to decrypt'} />
        <div className="flex flex-wrap items-center gap-3 p-3">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Choose file
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                reset();
              }
              e.target.value = '';
            }}
          />
          {file ? (
            <span className="text-sm text-muted-foreground">
              {file.name} · {formatBytes(file.size)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No file chosen</span>
          )}
          <Button type="button" className="ml-auto" onClick={() => void run()} disabled={busy || !file}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === 'encrypt' ? 'Encrypt file' : 'Decrypt file'}
          </Button>
        </div>
        <StatBar items={[`AES-${keySize}-GCM`, 'layout: salt(16) ‖ IV(12) ‖ ciphertext+tag', 'all in-browser']} />
      </Panel>

      <ErrorBanner error={error} />

      {result && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className="font-mono text-sm">{result.name}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(result.size)}</span>
            <a href={result.url} download={result.name} className="ml-auto">
              <Button size="sm">
                <Download className="size-3.5" /> Download
              </Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
