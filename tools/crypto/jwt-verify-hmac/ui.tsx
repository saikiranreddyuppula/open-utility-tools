'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle } from 'lucide-react';

const subtle = (
  globalThis as unknown as {
    crypto: {
      subtle: SubtleCrypto;
    };
  }
).crypto.subtle;

type Alg = 'HS256' | 'HS384' | 'HS512';

const ALG_HASH: Record<Alg, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

function base64UrlToBytes(input: string): Uint8Array {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJson(part: string): Record<string, unknown> {
  const text = new TextDecoder().decode(base64UrlToBytes(part));
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Segment is not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

interface Result {
  signatureValid: boolean;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  alg: string;
  expired: boolean | null;
  notYetValid: boolean | null;
  expText: string | null;
}

export default function JwtVerifyHmacTool() {
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [secretIsBase64, setSecretIsBase64] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!token.trim() || !secret) {
      setResult(null);
      setError(null);
      return;
    }
    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) {
        throw new Error('A JWT must have exactly three dot-separated segments');
      }
      const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

      const header = decodeJson(headerB64);
      const payload = decodeJson(payloadB64);

      const alg = typeof header.alg === 'string' ? header.alg : '';
      if (alg !== 'HS256' && alg !== 'HS384' && alg !== 'HS512') {
        throw new Error(
          `Unsupported alg "${alg || 'none'}". Only HS256, HS384 and HS512 are supported.`,
        );
      }
      const hash = ALG_HASH[alg as Alg];

      const keyBytes = secretIsBase64
        ? base64UrlToBytes(secret.replace(/-/g, '+').replace(/_/g, '/'))
        : new TextEncoder().encode(secret);

      const key = await subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'HMAC', hash: { name: hash } },
        false,
        ['sign'],
      );

      const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const sigBuffer = await subtle.sign('HMAC', key, signingInput);
      const computed = bytesToBase64Url(new Uint8Array(sigBuffer));

      const signatureValid = computed === sigB64.replace(/=+$/, '');

      const nowSec = Math.floor(Date.now() / 1000);
      let expired: boolean | null = null;
      let expText: string | null = null;
      if (typeof payload.exp === 'number') {
        expired = nowSec >= payload.exp;
        expText = new Date(payload.exp * 1000).toLocaleString();
      }
      let notYetValid: boolean | null = null;
      if (typeof payload.nbf === 'number') {
        notYetValid = nowSec < payload.nbf;
      }

      setResult({
        signatureValid,
        header,
        payload,
        alg,
        expired,
        notYetValid,
        expText,
      });
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Failed to verify token');
    }
  }, [token, secret, secretIsBase64]);

  useEffect(() => {
    void run();
  }, [run]);

  const fullyValid =
    result !== null &&
    result.signatureValid &&
    result.expired !== true &&
    result.notYetValid !== true;

  return (
    <Panel>
      <PanelHeader title="JWT HMAC Verifier" />
      <OptionsBar>
        <Field label="Secret" className="flex-1" hint="The shared HMAC secret">
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="your-256-bit-secret"
            type="password"
          />
        </Field>
        <Field label="Secret is Base64">
          <div className="flex h-9 items-center">
            <input
              type="checkbox"
              checked={secretIsBase64}
              onChange={(e) => setSecretIsBase64(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </Field>
      </OptionsBar>

      <Field label="JWT">
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
          className="min-h-[120px] font-mono text-sm"
        />
      </Field>

      <ErrorBanner error={error} />

      {result !== null && (
        <div className="space-y-4">
          <div
            className={
              fullyValid
                ? 'flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-green-700 dark:text-green-400'
                : 'flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-red-700 dark:text-red-400'
            }
          >
            {fullyValid ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="font-medium">
              {result.signatureValid
                ? fullyValid
                  ? 'Signature valid and token is currently active'
                  : 'Signature valid, but token is expired or not yet valid'
                : 'Invalid signature'}
            </span>
          </div>

          <StatBar
            items={[
              `Algorithm: ${result.alg}`,
              `Signature: ${result.signatureValid ? 'valid' : 'invalid'}`,
              result.expText !== null &&
                `Expires: ${result.expText} (${result.expired ? 'expired' : 'active'})`,
              result.notYetValid !== null &&
                `Not before: ${result.notYetValid ? 'not yet valid' : 'active'}`,
            ]}
          />

          <Field label="Header">
            <Textarea
              readOnly
              value={JSON.stringify(result.header, null, 2)}
              className="min-h-[100px] font-mono text-sm"
            />
          </Field>
          <Field label="Payload">
            <Textarea
              readOnly
              value={JSON.stringify(result.payload, null, 2)}
              className="min-h-[140px] font-mono text-sm"
            />
          </Field>
        </div>
      )}
    </Panel>
  );
}
