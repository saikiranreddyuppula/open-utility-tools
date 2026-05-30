'use client';

import { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type HashName = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
type SaltKind = 'utf8' | 'hex';

interface Output {
  hex: string;
  base64: string;
  summary: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(buf: ArrayBuffer): string {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('Hex salt must have an even number of digits.');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex salt contains non-hex characters.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export default function Pbkdf2Tool() {
  const [pass, setPass] = useState('correct horse battery staple');
  const [salt, setSalt] = useState('s4lt-example');
  const [saltKind, setSaltKind] = useState<SaltKind>('utf8');
  const [hash, setHash] = useState<HashName>('SHA-256');
  const [iters, setIters] = useState('600000');
  const [bits, setBits] = useState('256');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Output | null>(null);

  const randomizeSalt = useCallback(() => {
    const bytes = new Uint8Array(16);
    wc.getRandomValues(bytes);
    setSalt(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    setSaltKind('hex');
  }, []);

  const derive = useCallback(async () => {
    setError(null);
    setOut(null);
    const iterN = Number(iters);
    const bitN = Number(bits);
    if (!Number.isFinite(iterN) || iterN < 1 || !Number.isInteger(iterN)) {
      setError('Iterations must be a positive integer.');
      return;
    }
    if (iterN > 5_000_000) {
      setError('Iterations capped at 5,000,000 to keep the browser responsive.');
      return;
    }
    if (!Number.isFinite(bitN) || bitN < 8 || bitN % 8 !== 0 || bitN > 4096) {
      setError('Key length must be a multiple of 8 bits, 8–4096.');
      return;
    }
    let saltBytes: Uint8Array;
    try {
      saltBytes = saltKind === 'hex' ? hexToBytes(salt) : new TextEncoder().encode(salt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid salt.');
      return;
    }
    if (saltBytes.length === 0) {
      setError('Salt must not be empty.');
      return;
    }

    setBusy(true);
    try {
      const baseKey = await wc.subtle.importKey(
        'raw',
        new TextEncoder().encode(pass),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derived = await wc.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: iterN, hash },
        baseKey,
        bitN
      );
      const summary = `PBKDF2-${hash} iter=${iterN} dkLen=${bitN}bit salt(${saltKind})=${salt}`;
      setOut({ hex: toHex(derived), base64: toBase64(derived), summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Derivation failed.');
    } finally {
      setBusy(false);
    }
  }, [pass, salt, saltKind, hash, iters, bits]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Passphrase (UTF-8)" className="min-w-[240px] flex-1">
            <Input value={pass} onChange={(e) => setPass(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Salt" className="min-w-[200px] flex-1">
            <Input value={salt} onChange={(e) => setSalt(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Salt encoding">
            <Select value={saltKind} onValueChange={(v) => setSaltKind(v as SaltKind)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utf8">UTF-8</SelectItem>
                <SelectItem value="hex">Hex</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={' '}>
            <Button variant="outline" size="sm" onClick={randomizeSalt}>
              <RefreshCw className="size-3.5" /> Random salt
            </Button>
          </Field>
        </OptionsBar>
        <OptionsBar className="rounded-t-none border-t-0">
          <Field label="Hash">
            <Select value={hash} onValueChange={(v) => setHash(v as HashName)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHA-1">SHA-1</SelectItem>
                <SelectItem value="SHA-256">SHA-256</SelectItem>
                <SelectItem value="SHA-384">SHA-384</SelectItem>
                <SelectItem value="SHA-512">SHA-512</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Iterations">
            <Input
              value={iters}
              onChange={(e) => setIters(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Key length (bits)">
            <Input
              value={bits}
              onChange={(e) => setBits(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
          <Field label={' '}>
            <Button size="sm" onClick={() => void derive()} disabled={busy}>
              {busy ? 'Deriving…' : 'Derive key'}
            </Button>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {out && (
        <Panel>
          <PanelHeader title="Derived key">
            <CopyButton value={() => `Hex: ${out.hex}\nBase64: ${out.base64}\n${out.summary}`} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hex
                </span>
                <CopyButton value={out.hex} size="icon-sm" />
              </div>
              <code className="block break-all font-mono text-xs">{out.hex}</code>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Base64
                </span>
                <CopyButton value={out.base64} size="icon-sm" />
              </div>
              <code className="block break-all font-mono text-xs">{out.base64}</code>
            </div>
          </div>
          <StatBar items={[out.summary]} />
        </Panel>
      )}
    </div>
  );
}
