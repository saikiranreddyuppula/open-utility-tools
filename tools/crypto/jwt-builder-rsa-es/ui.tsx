'use client';

import { useEffect, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
const enc = new TextEncoder();

type Alg =
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'PS256'
  | 'ES256'
  | 'ES384'
  | 'ES512';

const HASH_FOR: Record<Alg, string> = {
  RS256: 'SHA-256',
  RS384: 'SHA-384',
  RS512: 'SHA-512',
  PS256: 'SHA-256',
  ES256: 'SHA-256',
  ES384: 'SHA-384',
  ES512: 'SHA-512',
};

const CURVE_FOR: Record<string, string> = {
  ES256: 'P-256',
  ES384: 'P-384',
  ES512: 'P-521',
};

function b64UrlFromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlFromString(text: string): string {
  return b64UrlFromBytes(enc.encode(text));
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('Private key is empty.');
  let bin: string;
  try {
    bin = atob(body);
  } catch {
    throw new Error('Private key is not valid Base64. Paste a PEM PKCS#8 key.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPrivateKey(pem: string, alg: Alg): Promise<CryptoKey> {
  const keyData = pemToBytes(pem);
  const hash = HASH_FOR[alg] ?? 'SHA-256';
  if (alg.startsWith('ES')) {
    return wc.subtle.importKey(
      'pkcs8',
      keyData as unknown as ArrayBuffer,
      { name: 'ECDSA', namedCurve: CURVE_FOR[alg] ?? 'P-256' },
      false,
      ['sign']
    );
  }
  const name = alg.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';
  return wc.subtle.importKey(
    'pkcs8',
    keyData as unknown as ArrayBuffer,
    { name, hash },
    false,
    ['sign']
  );
}

async function sign(
  signingInput: string,
  key: CryptoKey,
  alg: Alg
): Promise<Uint8Array> {
  const data = enc.encode(signingInput);
  const hash = HASH_FOR[alg] ?? 'SHA-256';
  let params: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  if (alg.startsWith('ES')) {
    params = { name: 'ECDSA', hash };
  } else {
    params = { name: 'RSASSA-PKCS1-v1_5' };
  }
  const sig = await wc.subtle.sign(params, key, data as unknown as ArrayBuffer);
  return new Uint8Array(sig);
}

const SAMPLE_PAYLOAD =
  '{\n  "sub": "1234567890",\n  "name": "Jane Doe",\n  "iat": 1716239022\n}';

export default function JwtBuilderRsaEsTool() {
  const [alg, setAlg] = useState<Alg>('RS256');
  const [headerText, setHeaderText] = useState('{\n  "typ": "JWT"\n}');
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [pem, setPem] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addClaim = (key: string) => {
    try {
      const obj = JSON.parse(payload) as Record<string, unknown>;
      const now = Math.floor(Date.now() / 1000);
      const defaults: Record<string, unknown> = {
        iat: now,
        exp: now + 3600,
        nbf: now,
        sub: 'subject',
        iss: 'issuer',
        aud: 'audience',
      };
      obj[key] = defaults[key];
      setPayload(JSON.stringify(obj, null, 2));
    } catch {
      setError('Payload is not valid JSON; cannot add claim.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pem.trim()) {
        setToken('');
        setError(null);
        return;
      }
      try {
        const headerObj = JSON.parse(headerText) as Record<string, unknown>;
        const payloadObj = JSON.parse(payload) as Record<string, unknown>;
        const fullHeader = { ...headerObj, alg, typ: headerObj['typ'] ?? 'JWT' };
        const h = b64UrlFromString(JSON.stringify(fullHeader));
        const p = b64UrlFromString(JSON.stringify(payloadObj));
        const signingInput = `${h}.${p}`;
        const key = await importPrivateKey(pem, alg);
        const sigBytes = await sign(signingInput, key, alg);
        const jwt = `${signingInput}.${b64UrlFromBytes(sigBytes)}`;
        if (!cancelled) {
          setToken(jwt);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setToken('');
          setError(e instanceof Error ? e.message : 'Failed to sign JWT.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alg, headerText, payload, pem]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Algorithm">
          <Select value={alg} onValueChange={(v) => setAlg(v as Alg)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RS256">RS256</SelectItem>
              <SelectItem value="RS384">RS384</SelectItem>
              <SelectItem value="RS512">RS512</SelectItem>
              <SelectItem value="PS256">PS256</SelectItem>
              <SelectItem value="ES256">ES256</SelectItem>
              <SelectItem value="ES384">ES384</SelectItem>
              <SelectItem value="ES512">ES512</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quick-add claims" className="flex-1">
          <div className="flex flex-wrap gap-1">
            {(['iat', 'exp', 'nbf', 'sub', 'iss', 'aud'] as const).map((c) => (
              <Button key={c} variant="outline" size="sm" onClick={() => addClaim(c)}>
                +{c}
              </Button>
            ))}
          </div>
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Header (JSON)" />
          <Textarea
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            spellCheck={false}
            className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Payload (JSON)" />
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
            className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Private key (PEM, PKCS#8)" />
        <Textarea
          value={pem}
          onChange={(e) => setPem(e.target.value)}
          spellCheck={false}
          placeholder={'-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----'}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {error && <ErrorBanner error={error} />}

      {token && (
        <Panel>
          <PanelHeader title="Signed JWT">
            <CopyButton value={token} />
          </PanelHeader>
          <code className="block break-all p-3 font-mono text-xs">
            <span className="text-cat-crypto">{token.split('.')[0]}</span>.
            <span className="text-cat-web">{token.split('.')[1]}</span>.
            <span className="text-muted-foreground">{token.split('.')[2]}</span>
          </code>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Signed locally with the Web Crypto API — your private key never leaves the browser.
      </p>
    </div>
  );
}
