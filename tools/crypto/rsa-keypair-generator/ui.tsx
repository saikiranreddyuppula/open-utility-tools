'use client';
import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: { subtle: SubtleCrypto; getRandomValues<T extends ArrayBufferView>(a: T): T };
  }
).crypto;

type Bits = '2048' | '3072' | '4096';
type Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function toPem(base64: string, label: string): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 64) lines.push(base64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

export default function RsaKeypairGenerator() {
  const [bits, setBits] = useState<Bits>('2048');
  const [hash, setHash] = useState<Hash>('SHA-256');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicPem, setPublicPem] = useState('');
  const [privatePem, setPrivatePem] = useState('');

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const pair = (await webcrypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: Number(bits),
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: { name: hash },
        },
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair;
      const spki = await webcrypto.subtle.exportKey('spki', pair.publicKey);
      const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
      setPublicPem(toPem(bufToBase64(spki), 'PUBLIC KEY'));
      setPrivatePem(toPem(bufToBase64(pkcs8), 'PRIVATE KEY'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key pair');
      setPublicPem('');
      setPrivatePem('');
    } finally {
      setBusy(false);
    }
  }, [bits, hash]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Key size">
          <Select value={bits} onValueChange={(v) => setBits(v as Bits)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2048">2048 bits</SelectItem>
              <SelectItem value="3072">3072 bits</SelectItem>
              <SelectItem value="4096">4096 bits</SelectItem>
            </SelectContent>
          </Select>
        </Field>
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
        <Button type="button" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? 'Generating…' : 'Generate key pair'}
        </Button>
      </OptionsBar>

      <ErrorBanner error={error} />

      {publicPem ? (
        <Panel>
          <PanelHeader title="Public key (SPKI / PEM)">
            <div className="flex gap-2">
              <CopyButton value={publicPem} />
              <DownloadButton data={publicPem} filename="rsa_public.pem" mime="application/x-pem-file" />
            </div>
          </PanelHeader>
          <Textarea readOnly value={publicPem} className="min-h-40 rounded-none border-0 font-mono text-xs" />
        </Panel>
      ) : null}

      {privatePem ? (
        <Panel>
          <PanelHeader title="Private key (PKCS#8 / PEM)">
            <div className="flex gap-2">
              <CopyButton value={privatePem} />
              <DownloadButton data={privatePem} filename="rsa_private.pem" mime="application/x-pem-file" />
            </div>
          </PanelHeader>
          <Textarea readOnly value={privatePem} className="min-h-40 rounded-none border-0 font-mono text-xs" />
        </Panel>
      ) : null}
    </div>
  );
}
