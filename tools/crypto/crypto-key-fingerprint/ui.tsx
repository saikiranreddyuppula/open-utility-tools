'use client';

import { useCallback, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

/* ---------------- pure-JS MD5 (RFC 1321) ---------------- */
function md5(bytes: Uint8Array): Uint8Array {
  function rl(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }
  const len = bytes.length;
  const withOne = len + 1;
  const padded = (((withOne + 8) + 63) & ~63);
  const msg = new Uint8Array(padded);
  msg.set(bytes);
  msg[len] = 0x80;
  const bitLen = len * 8;
  // little-endian length (low 32 bits then high 32 bits)
  msg[padded - 8] = bitLen & 0xff;
  msg[padded - 7] = (bitLen >>> 8) & 0xff;
  msg[padded - 6] = (bitLen >>> 16) & 0xff;
  msg[padded - 5] = (bitLen >>> 24) & 0xff;
  const bitHigh = Math.floor(len / 0x20000000); // (len*8) >> 32
  msg[padded - 4] = bitHigh & 0xff;
  msg[padded - 3] = (bitHigh >>> 8) & 0xff;
  msg[padded - 2] = (bitHigh >>> 16) & 0xff;
  msg[padded - 1] = (bitHigh >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  const M = new Uint32Array(16);
  for (let off = 0; off < padded; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      M[i] = (msg[j] ?? 0) | ((msg[j + 1] ?? 0) << 8) | ((msg[j + 2] ?? 0) << 16) | ((msg[j + 3] ?? 0) << 24);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + (K[i] ?? 0) + (M[g] ?? 0)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rl(F, S[i] ?? 0)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, n) => {
    out[n * 4] = v & 0xff;
    out[n * 4 + 1] = (v >>> 8) & 0xff;
    out[n * 4 + 2] = (v >>> 16) & 0xff;
    out[n * 4 + 3] = (v >>> 24) & 0xff;
  });
  return out;
}

/* ---------------- helpers ---------------- */
function bytesToHexColon(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(':');
}

function bytesToBase64NoPad(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin).replace(/=+$/, '');
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return base64ToBytes(b64 + pad);
}

/** Read a 4-byte big-endian length-prefixed field from an OpenSSH blob. */
function readSshField(buf: Uint8Array, pos: number): { data: Uint8Array; next: number } {
  if (pos + 4 > buf.length) throw new Error('Truncated OpenSSH key blob.');
  const len = ((buf[pos] ?? 0) << 24) | ((buf[pos + 1] ?? 0) << 16) | ((buf[pos + 2] ?? 0) << 8) | (buf[pos + 3] ?? 0);
  const start = pos + 4;
  if (start + len > buf.length) throw new Error('Truncated OpenSSH key blob.');
  return { data: buf.slice(start, start + len), next: start + len };
}

interface Parsed {
  blob: Uint8Array; // bytes to fingerprint
  keyType: string;
  bits: number | null;
}

const SAMPLE =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINGYjBQzZpb4eFqZBzCnT0yQ0sJTr0R7qfk2yqL3kQ0a user@host';

function bitLenOfMpint(mp: Uint8Array): number {
  // mpint may have a leading zero byte for sign; count significant bits
  let i = 0;
  while (i < mp.length && mp[i] === 0) i++;
  if (i >= mp.length) return 0;
  const first = mp[i] ?? 0;
  return (mp.length - i - 1) * 8 + (32 - Math.clz32(first));
}

function parseOpenSsh(line: string): Parsed {
  const parts = line.trim().split(/\s+/);
  // find the base64 token (longest, valid b64)
  const b64 = parts.find((p) => /^[A-Za-z0-9+/]+={0,2}$/.test(p) && p.length > 20);
  if (!b64) throw new Error('Could not find the Base64 key blob in the OpenSSH line.');
  const blob = base64ToBytes(b64);
  const { data: typeBytes, next } = readSshField(blob, 0);
  const keyType = new TextDecoder().decode(typeBytes);
  let bits: number | null = null;
  try {
    if (keyType === 'ssh-rsa') {
      const eField = readSshField(blob, next);
      const nField = readSshField(blob, eField.next);
      bits = bitLenOfMpint(nField.data);
    } else if (keyType === 'ssh-ed25519') {
      bits = 256;
    } else if (keyType.startsWith('ecdsa-sha2-nistp')) {
      const m = keyType.match(/nistp(\d+)/);
      bits = m && m[1] ? Number(m[1]) : null;
    }
  } catch {
    bits = null;
  }
  return { blob, keyType, bits };
}

function parsePem(text: string): Parsed {
  const m = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m || !m[2]) throw new Error('Could not find a PEM block (BEGIN/END).');
  const der = base64ToBytes(m[2].replace(/\s+/g, ''));
  const label = (m[1] ?? '').trim();
  // Rough key type / bit detection from SPKI OID + size heuristic.
  let keyType = `${label || 'PUBLIC KEY'} (DER/SPKI)`;
  let bits: number | null = null;
  const hex = Array.from(der, (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.includes('2a864886f70d010101')) keyType = 'RSA (SPKI)';
  else if (hex.includes('2a8648ce3d0201')) keyType = 'EC (SPKI)';
  else if (hex.includes('2b6570')) {
    keyType = 'Ed25519 (SPKI)';
    bits = 256;
  }
  // DER total bit length is not the key strength; leave RSA bits unknown unless trivially derivable.
  return { blob: der, keyType, bits };
}

function parseJwk(text: string): Parsed {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const kty = typeof obj.kty === 'string' ? obj.kty : '';
  if (!kty) throw new Error('JWK is missing the "kty" member.');
  let keyType = `JWK ${kty}`;
  let bits: number | null = null;
  let material: Uint8Array;
  if (kty === 'RSA' && typeof obj.n === 'string') {
    const n = base64urlToBytes(obj.n);
    bits = bitLenOfMpint(n);
    keyType = 'JWK RSA';
    material = n;
  } else if (kty === 'EC' && typeof obj.x === 'string' && typeof obj.y === 'string') {
    const x = base64urlToBytes(obj.x);
    const y = base64urlToBytes(obj.y);
    const crv = typeof obj.crv === 'string' ? obj.crv : '';
    const m = crv.match(/(\d+)/);
    bits = m && m[1] ? Number(m[1]) : null;
    keyType = `JWK EC ${crv}`.trim();
    material = new Uint8Array(x.length + y.length);
    material.set(x, 0);
    material.set(y, x.length);
  } else if (kty === 'OKP' && typeof obj.x === 'string') {
    material = base64urlToBytes(obj.x);
    keyType = `JWK OKP ${typeof obj.crv === 'string' ? obj.crv : ''}`.trim();
    bits = material.length * 8;
  } else {
    throw new Error('Unsupported or incomplete JWK (need RSA n, EC x/y, or OKP x).');
  }
  return { blob: material, keyType, bits };
}

function parseKey(text: string): Parsed {
  const t = text.trim();
  if (!t) throw new Error('Enter a public key.');
  if (t.startsWith('{')) return parseJwk(t);
  if (t.includes('-----BEGIN')) return parsePem(t);
  if (/^(ssh-|ecdsa-|sk-)/.test(t) || /\bAAAA[A-Za-z0-9+/]/.test(t)) return parseOpenSsh(t);
  throw new Error('Unrecognized format. Use PEM, OpenSSH authorized_keys, or JWK JSON.');
}

interface Fingerprints {
  md5: string;
  sha256: string;
  keyType: string;
  bits: number | null;
  blobLen: number;
}

export default function CryptoKeyFingerprint() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Fingerprints | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async (text: string) => {
    setError(null);
    setResult(null);
    if (!text.trim()) return;
    try {
      const parsed = parseKey(text);
      const md5Bytes = md5(parsed.blob);
      const shaBuf = await wc.subtle.digest('SHA-256', parsed.blob as BufferSource);
      const sha = new Uint8Array(shaBuf);
      setResult({
        md5: `MD5:${bytesToHexColon(md5Bytes)}`,
        sha256: `SHA256:${bytesToBase64NoPad(sha)}`,
        keyType: parsed.keyType,
        bits: parsed.bits,
        blobLen: parsed.blob.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the key.');
    }
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Public key (PEM / OpenSSH / JWK)" className="w-full">
          <span className="text-2xs text-muted-foreground">
            Fingerprints are computed over the OpenSSH wire blob, DER/SPKI bytes, or JWK key material.
          </span>
        </Field>
        <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); void compute(SAMPLE); }}>
          Sample
        </Button>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input key" />
        <Textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); void compute(e.target.value); }}
          placeholder="ssh-ed25519 AAAA…   or   -----BEGIN PUBLIC KEY-----   or   a JWK { kty: RSA, … }"
          spellCheck={false}
          className="min-h-32 rounded-none border-0 font-mono text-xs"
        />
      </Panel>

      <ErrorBanner error={error} />

      {result && (
        <Panel>
          <PanelHeader title="Fingerprints">
            <CopyButton value={() => `${result.sha256}\n${result.md5}`} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3">
            {[
              { label: 'SHA-256 (modern)', value: result.sha256 },
              { label: 'MD5 (legacy)', value: result.md5 },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-xs">
                  <span className="break-all">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Type: ${result.keyType}`,
              result.bits != null ? `${result.bits} bits` : false,
              `${result.blobLen} blob bytes`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
