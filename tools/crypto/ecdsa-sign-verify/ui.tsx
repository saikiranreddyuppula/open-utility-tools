'use client';

import { useCallback, useState } from 'react';
import { Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Op = 'sign' | 'verify';
type Curve = 'P-256' | 'P-384' | 'P-521';

const enc = new TextEncoder();

const HASH_FOR: Record<Curve, string> = {
  'P-256': 'SHA-256',
  'P-384': 'SHA-384',
  'P-521': 'SHA-512',
};

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '');
  const b64 = body.replace(/[\s]/g, '');
  if (!b64) throw new Error('No Base64 content found in PEM.');
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error('PEM body is not valid Base64.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

const SAMPLE_MSG = 'Sign me with ECDSA.';

export default function EcdsaSignVerifyTool() {
  const [op, setOp] = useState<Op>('sign');
  const [curve, setCurve] = useState<Curve>('P-256');
  const [keyPem, setKeyPem] = useState('');
  const [message, setMessage] = useState(SAMPLE_MSG);
  const [signature, setSignature] = useState('');
  const [output, setOutput] = useState('');
  const [verdict, setVerdict] = useState<'valid' | 'invalid' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setOutput('');
    setVerdict(null);
    try {
      const hash = HASH_FOR[curve];
      const data = enc.encode(message);
      if (op === 'sign') {
        const der = pemToDer(keyPem);
        const key = await wc.subtle.importKey(
          'pkcs8',
          der as unknown as ArrayBuffer,
          { name: 'ECDSA', namedCurve: curve },
          false,
          ['sign']
        );
        const sig = await wc.subtle.sign(
          { name: 'ECDSA', hash },
          key,
          data as unknown as ArrayBuffer
        );
        setOutput(bytesToBase64(new Uint8Array(sig)));
      } else {
        const der = pemToDer(keyPem);
        const key = await wc.subtle.importKey(
          'spki',
          der as unknown as ArrayBuffer,
          { name: 'ECDSA', namedCurve: curve },
          false,
          ['verify']
        );
        const sigBytes = base64ToBytes(signature);
        const ok = await wc.subtle.verify(
          { name: 'ECDSA', hash },
          key,
          sigBytes as unknown as ArrayBuffer,
          data as unknown as ArrayBuffer
        );
        setVerdict(ok ? 'valid' : 'invalid');
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — check that the key is a ${op === 'sign' ? 'PKCS#8 private' : 'SPKI public'} key for ${curve}.`
          : String(e)
      );
    } finally {
      setBusy(false);
    }
  }, [op, curve, keyPem, message, signature]);

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
        <Field label="Curve">
          <Select value={curve} onValueChange={(v) => setCurve(v as Curve)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P-256">P-256</SelectItem>
              <SelectItem value="P-384">P-384</SelectItem>
              <SelectItem value="P-521">P-521</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hash">
          <span className="flex h-8 items-center font-mono text-xs text-muted-foreground">
            {HASH_FOR[curve]}
          </span>
        </Field>
        <Button type="button" onClick={() => void run()} disabled={busy || !keyPem}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : op === 'sign' ? <PenLine className="size-4" /> : <ShieldCheck className="size-4" />}
          {busy ? 'Working…' : op === 'sign' ? 'Sign' : 'Verify'}
        </Button>
      </OptionsBar>

      <Panel>
        <PanelHeader title={op === 'sign' ? 'Private key (PKCS#8 PEM)' : 'Public key (SPKI PEM)'} />
        <Textarea
          value={keyPem}
          onChange={(e) => setKeyPem(e.target.value)}
          placeholder={`-----BEGIN ${op === 'sign' ? 'PRIVATE' : 'PUBLIC'} KEY-----\n…\n-----END ${op === 'sign' ? 'PRIVATE' : 'PUBLIC'} KEY-----`}
          spellCheck={false}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Message (UTF-8)" />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Text to sign or verify…"
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {op === 'verify' && (
        <Panel>
          <PanelHeader title="Signature (Base64, raw r‖s)" />
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste the Base64 signature to verify…"
            spellCheck={false}
            className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}

      <ErrorBanner error={error} />

      {op === 'sign' && output && (
        <Panel>
          <PanelHeader title="Signature (Base64, raw r‖s)">
            <CopyButton value={output} />
          </PanelHeader>
          <div className="break-all p-3 font-mono text-xs">{output}</div>
        </Panel>
      )}

      {op === 'verify' && verdict && (
        <Panel>
          <div
            className={
              verdict === 'valid'
                ? 'p-4 text-center font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                : 'p-4 text-center font-mono text-sm font-semibold text-red-600 dark:text-red-400'
            }
          >
            {verdict === 'valid' ? 'VALID — signature matches' : 'INVALID — signature does not match'}
          </div>
        </Panel>
      )}
    </div>
  );
}
