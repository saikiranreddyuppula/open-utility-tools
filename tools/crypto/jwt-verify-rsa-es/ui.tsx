'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
const enc = new TextEncoder();

const HASH_FOR: Record<string, string> = {
  RS256: 'SHA-256',
  RS384: 'SHA-384',
  RS512: 'SHA-512',
  PS256: 'SHA-256',
  PS384: 'SHA-384',
  PS512: 'SHA-512',
  ES256: 'SHA-256',
  ES384: 'SHA-384',
  ES512: 'SHA-512',
};

const CURVE_FOR: Record<string, string> = {
  ES256: 'P-256',
  ES384: 'P-384',
  ES512: 'P-521',
};

function b64UrlToBytes(seg: string): Uint8Array {
  let s = seg.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64UrlDecodeText(seg: string): string {
  return new TextDecoder().decode(b64UrlToBytes(seg));
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPublicKey(keyText: string, alg: string): Promise<CryptoKey> {
  const hash = HASH_FOR[alg] ?? 'SHA-256';
  const trimmed = keyText.trim();
  const isJwk = trimmed.startsWith('{');
  if (alg.startsWith('ES')) {
    const curve = CURVE_FOR[alg] ?? 'P-256';
    if (isJwk) {
      const jwk = JSON.parse(trimmed) as JsonWebKey;
      return wc.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: curve },
        false,
        ['verify']
      );
    }
    return wc.subtle.importKey(
      'spki',
      pemToBytes(keyText) as unknown as ArrayBuffer,
      { name: 'ECDSA', namedCurve: curve },
      false,
      ['verify']
    );
  }
  const name = alg.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';
  if (isJwk) {
    const jwk = JSON.parse(trimmed) as JsonWebKey;
    return wc.subtle.importKey('jwk', jwk, { name, hash }, false, ['verify']);
  }
  return wc.subtle.importKey(
    'spki',
    pemToBytes(keyText) as unknown as ArrayBuffer,
    { name, hash },
    false,
    ['verify']
  );
}

interface ClaimRow {
  claim: string;
  status: 'PASS' | 'FAIL' | 'N/A';
  detail: string;
}

interface VerifyResult {
  valid: boolean;
  alg: string;
  headerPretty: string;
  payloadPretty: string;
  claims: ClaimRow[];
}

export default function JwtVerifyRsaEsTool() {
  const [jwt, setJwt] = useState('');
  const [keyText, setKeyText] = useState('');
  const [nowStr, setNowStr] = useState(() =>
    new Date().toISOString().slice(0, 19)
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = jwt.trim();
      if (!raw || !keyText.trim()) {
        setResult(null);
        setError(null);
        return;
      }
      try {
        const parts = raw.split('.');
        if (parts.length !== 3) {
          throw new Error('A signed JWT must have three dot-separated parts.');
        }
        const headerSeg = parts[0] ?? '';
        const payloadSeg = parts[1] ?? '';
        const sigSeg = parts[2] ?? '';
        const header = JSON.parse(b64UrlDecodeText(headerSeg)) as Record<
          string,
          unknown
        >;
        const payload = JSON.parse(b64UrlDecodeText(payloadSeg)) as Record<
          string,
          unknown
        >;
        const alg = typeof header['alg'] === 'string' ? header['alg'] : '';
        if (!HASH_FOR[alg]) {
          throw new Error(`Unsupported or missing alg "${alg}". Use RS/PS/ES 256/384/512.`);
        }

        const key = await importPublicKey(keyText, alg);
        const signingInput = enc.encode(`${headerSeg}.${payloadSeg}`);
        const sig = b64UrlToBytes(sigSeg);

        const hash = HASH_FOR[alg] ?? 'SHA-256';
        let params: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
        if (alg.startsWith('ES')) {
          params = { name: 'ECDSA', hash };
        } else if (alg.startsWith('PS')) {
          const len = alg === 'PS256' ? 32 : alg === 'PS384' ? 48 : 64;
          params = { name: 'RSA-PSS', saltLength: len };
        } else {
          params = { name: 'RSASSA-PKCS1-v1_5' };
        }

        const valid = await wc.subtle.verify(
          params,
          key,
          sig as unknown as ArrayBuffer,
          signingInput as unknown as ArrayBuffer
        );

        const parsedNow = Date.parse(nowStr);
        const now = Number.isNaN(parsedNow)
          ? Math.floor(Date.now() / 1000)
          : Math.floor(parsedNow / 1000);

        const claims: ClaimRow[] = [];
        const exp = payload['exp'];
        if (typeof exp === 'number') {
          claims.push({
            claim: 'exp',
            status: now < exp ? 'PASS' : 'FAIL',
            detail: `${new Date(exp * 1000).toISOString()}`,
          });
        } else {
          claims.push({ claim: 'exp', status: 'N/A', detail: 'absent' });
        }
        const nbf = payload['nbf'];
        if (typeof nbf === 'number') {
          claims.push({
            claim: 'nbf',
            status: now >= nbf ? 'PASS' : 'FAIL',
            detail: `${new Date(nbf * 1000).toISOString()}`,
          });
        } else {
          claims.push({ claim: 'nbf', status: 'N/A', detail: 'absent' });
        }
        const iat = payload['iat'];
        if (typeof iat === 'number') {
          claims.push({
            claim: 'iat',
            status: iat <= now + 60 ? 'PASS' : 'FAIL',
            detail: `${new Date(iat * 1000).toISOString()}`,
          });
        } else {
          claims.push({ claim: 'iat', status: 'N/A', detail: 'absent' });
        }

        if (!cancelled) {
          setResult({
            valid,
            alg,
            headerPretty: JSON.stringify(header, null, 2),
            payloadPretty: JSON.stringify(payload, null, 2),
            claims,
          });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError(e instanceof Error ? e.message : 'Verification failed.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt, keyText, nowStr]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Reference 'now' (UTC)">
          <Input
            value={nowStr}
            onChange={(e) => setNowStr(e.target.value)}
            placeholder="2026-05-30T12:00:00"
            className="font-mono"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="JWT" />
        <Textarea
          value={jwt}
          onChange={(e) => setJwt(e.target.value)}
          spellCheck={false}
          placeholder="header.payload.signature"
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Public key (PEM SPKI or JWK)" />
        <Textarea
          value={keyText}
          onChange={(e) => setKeyText(e.target.value)}
          spellCheck={false}
          placeholder={'-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----\n\nor a JWK { "kty": "RSA", … }'}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {error && <ErrorBanner error={error} />}

      {result && (
        <>
          <Panel>
            <PanelHeader title="Signature" />
            <div className="p-3">
              <span
                className={
                  result.valid
                    ? 'inline-flex items-center gap-2 rounded-md bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'inline-flex items-center gap-2 rounded-md bg-red-500/15 px-3 py-1.5 font-mono text-sm font-semibold text-red-600 dark:text-red-400'
                }
              >
                {result.valid ? 'VALID' : 'INVALID'} · {result.alg}
              </span>
            </div>
            <div className="divide-y border-t">
              {result.claims.map((c) => (
                <div key={c.claim} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={
                      c.status === 'PASS'
                        ? 'w-14 shrink-0 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                        : c.status === 'FAIL'
                          ? 'w-14 shrink-0 font-mono text-xs font-semibold text-red-600 dark:text-red-400'
                          : 'w-14 shrink-0 font-mono text-xs text-muted-foreground'
                    }
                  >
                    {c.status}
                  </span>
                  <code className="w-12 shrink-0 font-mono text-xs">{c.claim}</code>
                  <span className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`alg = ${result.alg}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Decoded payload">
              <CopyButton value={result.payloadPretty} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">
              {result.payloadPretty}
            </pre>
          </Panel>
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Verified locally with the Web Crypto API; nothing is uploaded.
      </p>
    </div>
  );
}
