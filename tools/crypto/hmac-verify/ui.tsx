'use client';

import { useCallback, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
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

type Enc = 'utf8' | 'hex' | 'base64';
type KeyEnc = 'utf8' | 'hex' | 'base64';
type MacEnc = 'hex' | 'base64';
type Hash = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

const enc = new TextEncoder();

function fromHex(s: string): Uint8Array {
  const clean = s.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex value contains non-hex characters.');
  if (clean.length % 2 !== 0) throw new Error('Hex value must have an even number of digits.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  let bin: string;
  try {
    bin = atob(clean);
  } catch {
    throw new Error('Value is not valid Base64.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decode(value: string, encoding: Enc, label: string): Uint8Array {
  try {
    if (encoding === 'utf8') return enc.encode(value);
    if (encoding === 'hex') return fromHex(value);
    return fromBase64(value);
  } catch (e) {
    throw new Error(`${label}: ${e instanceof Error ? e.message : String(e)}`);
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

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export default function HmacVerifyTool() {
  const [message, setMessage] = useState('The quick brown fox jumps over the lazy dog');
  const [msgEnc, setMsgEnc] = useState<Enc>('utf8');
  const [key, setKey] = useState('secretkey');
  const [keyEnc, setKeyEnc] = useState<KeyEnc>('utf8');
  const [hash, setHash] = useState<Hash>('SHA-256');
  const [expected, setExpected] = useState('');
  const [macEnc, setMacEnc] = useState<MacEnc>('hex');

  const [computedHex, setComputedHex] = useState('');
  const [computedB64, setComputedB64] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setComputedHex('');
    setComputedB64('');
    setValid(null);
    try {
      const keyBytes = decode(key, keyEnc, 'Key');
      if (keyBytes.length === 0) throw new Error('Key is empty.');
      const msgBytes = decode(message, msgEnc, 'Message');
      const cryptoKey = await wc.subtle.importKey(
        'raw',
        keyBytes as unknown as ArrayBuffer,
        { name: 'HMAC', hash: { name: hash } },
        false,
        ['sign']
      );
      const sig = await wc.subtle.sign('HMAC', cryptoKey, msgBytes as unknown as ArrayBuffer);
      const macBytes = new Uint8Array(sig);
      setComputedHex(toHex(macBytes));
      setComputedB64(toBase64(macBytes));
      const exp = expected.trim();
      if (exp) {
        const expBytes = macEnc === 'hex' ? fromHex(exp) : fromBase64(exp);
        setValid(timingSafeEqual(macBytes, expBytes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [message, msgEnc, key, keyEnc, hash, expected, macEnc]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Hash">
          <Select value={hash} onValueChange={(v) => setHash(v as Hash)}>
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
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {busy ? 'Computing…' : 'Verify'}
        </Button>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Message">
          <Select value={msgEnc} onValueChange={(v) => setMsgEnc(v as Enc)}>
            <SelectTrigger className="h-7 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
            </SelectContent>
          </Select>
        </PanelHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message that was authenticated…"
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Secret key">
          <Select value={keyEnc} onValueChange={(v) => setKeyEnc(v as KeyEnc)}>
            <SelectTrigger className="h-7 w-28">
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
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Shared secret…"
          spellCheck={false}
          className="rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Expected MAC (optional)">
          <Select value={macEnc} onValueChange={(v) => setMacEnc(v as MacEnc)}>
            <SelectTrigger className="h-7 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
            </SelectContent>
          </Select>
        </PanelHeader>
        <Input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Paste the MAC to compare against…"
          spellCheck={false}
          className="rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
        />
      </Panel>

      <ErrorBanner error={error} />

      {computedHex && (
        <Panel>
          <PanelHeader title="Computed HMAC" />
          <div className="space-y-3 p-3">
            {valid !== null && (
              <div
                className={
                  valid
                    ? 'text-center font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'text-center font-mono text-sm font-semibold text-red-600 dark:text-red-400'
                }
              >
                {valid ? 'VALID — MAC matches' : 'INVALID — MAC does not match'}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="w-14 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">Hex</span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{computedHex}</code>
              <CopyButton value={computedHex} size="icon-sm" />
            </div>
            <div className="flex items-start gap-2">
              <span className="w-14 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">Base64</span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{computedB64}</code>
              <CopyButton value={computedB64} size="icon-sm" />
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
