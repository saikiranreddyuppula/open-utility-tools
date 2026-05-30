'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type HashName = 'SHA-256' | 'SHA-384' | 'SHA-512';

const enc = new TextEncoder();

// RFC 7638 required members, in lexicographic order, per key type.
const REQUIRED: Record<string, string[]> = {
  RSA: ['e', 'kty', 'n'],
  EC: ['crv', 'kty', 'x', 'y'],
  oct: ['k', 'kty'],
  OKP: ['crv', 'kty', 'x'],
};

function jsonStringSafe(s: string): string {
  // JSON.stringify gives a spec-compliant, minimal JSON string with proper escaping.
  return JSON.stringify(s);
}

function buildCanonical(jwk: Record<string, unknown>): string {
  const kty = jwk['kty'];
  if (typeof kty !== 'string') throw new Error('JWK is missing a string "kty" member.');
  const members = REQUIRED[kty];
  if (!members) {
    throw new Error(`Unsupported "kty": ${kty}. Expected RSA, EC, oct, or OKP.`);
  }
  const parts: string[] = [];
  for (const m of members) {
    const val = jwk[m];
    if (typeof val !== 'string' || val.length === 0) {
      throw new Error(`Missing or empty required member "${m}" for ${kty} key.`);
    }
    parts.push(`${jsonStringSafe(m)}:${jsonStringSafe(val)}`);
  }
  // members already in lexicographic order; no whitespace.
  return `{${parts.join(',')}}`;
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const SAMPLE = JSON.stringify(
  {
    kty: 'RSA',
    n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QcSiCEXfdJqDLgz9o-X4G_zPSAhcS_5GHWcjBg8tkRrxBHbHIeWg8WBnZqA5L3-eYHA',
    e: 'AQAB',
    alg: 'RS256',
    kid: '2011-04-29',
  },
  null,
  2
);

export default function JwkThumbprintTool() {
  const [hash, setHash] = useState<HashName>('SHA-256');

  return (
    <TextToolLayout
      deps={[hash]}
      transform={async (input) => {
        if (!input.trim()) return '';
        let parsed: unknown;
        try {
          parsed = JSON.parse(input);
        } catch {
          throw new Error('Input is not valid JSON.');
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Input must be a JWK JSON object.');
        }
        const jwk = parsed as Record<string, unknown>;
        const canonical = buildCanonical(jwk);
        const digest = await wc.subtle.digest(hash, enc.encode(canonical) as unknown as ArrayBuffer);
        const b64u = toBase64Url(digest);
        const hex = toHex(digest);
        return [
          `Thumbprint (${hash})`,
          `  base64url   ${b64u}`,
          `  hex         ${hex}`,
          '',
          'Canonical JWK (hashed input)',
          `  ${canonical}`,
        ].join('\n');
      }}
      inputLabel="JWK (JSON)"
      outputLabel="Thumbprint"
      sample={SAMPLE}
      downloadName="jwk-thumbprint.txt"
      options={
        <Field label="Hash">
          <Select value={hash} onValueChange={(v) => setHash(v as HashName)}>
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
      }
    />
  );
}
