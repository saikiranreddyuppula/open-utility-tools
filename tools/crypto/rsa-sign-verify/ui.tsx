'use client';

import { useEffect, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
const enc = new TextEncoder();

type Op = 'sign' | 'verify';
type Scheme = 'RSASSA-PKCS1-v1_5' | 'RSA-PSS';
type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';

function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('Key is empty.');
  let bin: string;
  try {
    bin = atob(body);
  } catch {
    throw new Error('Key is not valid Base64 — paste a PEM key.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  let bin: string;
  try {
    bin = atob(clean);
  } catch {
    throw new Error('Signature is not valid Base64.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function saltLen(hash: Hash): number {
  return hash === 'SHA-256' ? 32 : hash === 'SHA-384' ? 48 : 64;
}

export default function RsaSignVerifyTool() {
  const [op, setOp] = useState<Op>('sign');
  const [scheme, setScheme] = useState<Scheme>('RSASSA-PKCS1-v1_5');
  const [hash, setHash] = useState<Hash>('SHA-256');
  const [keyText, setKeyText] = useState('');
  const [message, setMessage] = useState('The quick brown fox jumps over the lazy dog');
  const [sigInput, setSigInput] = useState('');
  const [output, setOutput] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setVerifyResult(null);
      setOutput('');
      if (!keyText.trim()) {
        setError(null);
        return;
      }
      try {
        const data = enc.encode(message);
        const keyBytes = pemToBytes(keyText);
        if (op === 'sign') {
          const key = await wc.subtle.importKey(
            'pkcs8',
            keyBytes as unknown as ArrayBuffer,
            { name: scheme, hash },
            false,
            ['sign']
          );
          const params =
            scheme === 'RSA-PSS'
              ? { name: 'RSA-PSS', saltLength: saltLen(hash) }
              : { name: 'RSASSA-PKCS1-v1_5' };
          const sig = await wc.subtle.sign(
            params,
            key,
            data as unknown as ArrayBuffer
          );
          if (!cancelled) {
            setOutput(bytesToB64(new Uint8Array(sig)));
            setError(null);
          }
        } else {
          if (!sigInput.trim()) {
            setError(null);
            return;
          }
          const key = await wc.subtle.importKey(
            'spki',
            keyBytes as unknown as ArrayBuffer,
            { name: scheme, hash },
            false,
            ['verify']
          );
          const params =
            scheme === 'RSA-PSS'
              ? { name: 'RSA-PSS', saltLength: saltLen(hash) }
              : { name: 'RSASSA-PKCS1-v1_5' };
          const sigBytes = b64ToBytes(sigInput);
          const ok = await wc.subtle.verify(
            params,
            key,
            sigBytes as unknown as ArrayBuffer,
            data as unknown as ArrayBuffer
          );
          if (!cancelled) {
            setVerifyResult(ok);
            setError(null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Operation failed.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [op, scheme, hash, keyText, message, sigInput]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Operation">
          <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
            <TabsList>
              <TabsTrigger value="sign">Sign</TabsTrigger>
              <TabsTrigger value="verify">Verify</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Scheme">
          <Select value={scheme} onValueChange={(v) => setScheme(v as Scheme)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RSASSA-PKCS1-v1_5">RSASSA-PKCS1-v1_5</SelectItem>
              <SelectItem value="RSA-PSS">RSA-PSS</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hash">
          <Select value={hash} onValueChange={(v) => setHash(v as Hash)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SHA-256">SHA-256</SelectItem>
              <SelectItem value="SHA-384">SHA-384</SelectItem>
              <SelectItem value="SHA-512">SHA-512</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader
          title={op === 'sign' ? 'Private key (PEM, PKCS#8)' : 'Public key (PEM, SPKI)'}
        />
        <Textarea
          value={keyText}
          onChange={(e) => setKeyText(e.target.value)}
          spellCheck={false}
          placeholder={
            op === 'sign'
              ? '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----'
              : '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----'
          }
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Message (UTF-8)" />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {op === 'verify' && (
        <Panel>
          <PanelHeader title="Signature (Base64)" />
          <Textarea
            value={sigInput}
            onChange={(e) => setSigInput(e.target.value)}
            spellCheck={false}
            placeholder="Base64-encoded signature to verify"
            className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}

      {error && <ErrorBanner error={error} />}

      {op === 'sign' && output && (
        <Panel>
          <PanelHeader title="Signature (Base64)">
            <CopyButton value={output} />
          </PanelHeader>
          <code className="block break-all p-3 font-mono text-xs">{output}</code>
        </Panel>
      )}

      {op === 'verify' && verifyResult !== null && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="p-3">
            <span
              className={
                verifyResult
                  ? 'inline-flex items-center gap-2 rounded-md bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'inline-flex items-center gap-2 rounded-md bg-red-500/15 px-3 py-1.5 font-mono text-sm font-semibold text-red-600 dark:text-red-400'
              }
            >
              {verifyResult ? 'VALID signature' : 'INVALID signature'}
            </span>
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Signed and verified locally with the Web Crypto API. Generate key pairs with the RSA
        Key Pair Generator.
      </p>
    </div>
  );
}
