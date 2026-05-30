'use client';

import { useEffect, useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type HashType = 'apr1' | 'sha1';

// ---- MD5 implementation (RFC 1321), operates on byte arrays ----
function md5bytes(input: number[]): number[] {
  const rl = (x: number, c: number): number => (x << c) | (x >>> (32 - c));
  const add = (...nums: number[]): number => {
    let s = 0;
    for (const n of nums) s = (s + n) | 0;
    return s;
  };

  const msgLenBits = input.length * 8;
  const padded = input.slice();
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  // 64-bit length, little-endian (low 32 bits then high 32 bits)
  const lo = msgLenBits >>> 0;
  const hi = Math.floor(input.length / 0x20000000) >>> 0;
  for (let i = 0; i < 4; i++) padded.push((lo >>> (8 * i)) & 0xff);
  for (let i = 0; i < 4; i++) padded.push((hi >>> (8 * i)) & 0xff);

  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < padded.length; off += 64) {
    const M: number[] = [];
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      M[i] =
        ((padded[j] ?? 0) |
          ((padded[j + 1] ?? 0) << 8) |
          ((padded[j + 2] ?? 0) << 16) |
          ((padded[j + 3] ?? 0) << 24)) >>>
        0;
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
      F = add(F, A, K[i] ?? 0, M[g] ?? 0);
      A = D;
      D = C;
      C = B;
      B = add(B, rl(F >>> 0, S[i] ?? 7));
    }
    a0 = add(a0, A);
    b0 = add(b0, B);
    c0 = add(c0, C);
    d0 = add(d0, D);
  }

  const out: number[] = [];
  for (const v of [a0, b0, c0, d0]) {
    const u = v >>> 0;
    out.push(u & 0xff, (u >>> 8) & 0xff, (u >>> 16) & 0xff, (u >>> 24) & 0xff);
  }
  return out;
}

function strToBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

const APR_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function apr1Encode64(bytes: number[]): string {
  // Apache's custom base64 ordering used by the apr1 scheme.
  function to64(v: number, n: number): string {
    let out = '';
    let val = v >>> 0;
    for (let i = 0; i < n; i++) {
      out += APR_ALPHABET[val & 0x3f] ?? '.';
      val >>>= 6;
    }
    return out;
  }
  const b = (i: number) => bytes[i] ?? 0;
  let result = '';
  result += to64((b(0) << 16) | (b(6) << 8) | b(12), 4);
  result += to64((b(1) << 16) | (b(7) << 8) | b(13), 4);
  result += to64((b(2) << 16) | (b(8) << 8) | b(14), 4);
  result += to64((b(3) << 16) | (b(9) << 8) | b(15), 4);
  result += to64((b(4) << 16) | (b(10) << 8) | b(5), 4);
  result += to64(b(11), 2);
  return result;
}

/** Apache APR1-MD5 ($apr1$) — the algorithm used by htpasswd's MD5 mode. */
function apr1(password: string, salt: string): string {
  const magic = '$apr1$';
  const pw = strToBytes(password);
  const saltBytes = strToBytes(salt);

  // ctx = password + magic + salt
  let ctx = pw.concat(strToBytes(magic), saltBytes);

  // alt = MD5(password + salt + password)
  const alt = md5bytes(pw.concat(saltBytes, pw));

  // append alt for each block of the password
  let pwLen = pw.length;
  let i = pwLen;
  while (i > 0) {
    ctx = ctx.concat(alt.slice(0, Math.min(16, i)));
    i -= 16;
  }

  // for each bit of password length, append \0 or first char of password
  for (let j = pwLen; j > 0; j >>= 1) {
    if (j & 1) ctx.push(0);
    else ctx.push(pw[0] ?? 0);
  }

  let digest = md5bytes(ctx);

  // 1000 iterations of strengthening
  for (let round = 0; round < 1000; round++) {
    let c: number[] = [];
    if (round & 1) c = c.concat(pw);
    else c = c.concat(digest);
    if (round % 3 !== 0) c = c.concat(saltBytes);
    if (round % 7 !== 0) c = c.concat(pw);
    if (round & 1) c = c.concat(digest);
    else c = c.concat(pw);
    digest = md5bytes(c);
  }

  return `${magic}${salt}$${apr1Encode64(digest)}`;
}

function randomSalt(len: number): string {
  const bytes = new Uint8Array(len);
  wc.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += APR_ALPHABET[(bytes[i] ?? 0) % 64] ?? '.';
  }
  return s;
}

async function sha1Htpasswd(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await wc.subtle.digest('SHA-1', data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `{SHA}${b64}`;
}

export default function HtaccessBasicAuthGenerator() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('s3cr3t-pass');
  const [hashType, setHashType] = useState<HashType>('apr1');
  const [authName, setAuthName] = useState('Restricted Area');
  const [authFile, setAuthFile] = useState('/var/www/.htpasswd');
  const [sha1Hash, setSha1Hash] = useState<string>('');

  // Compute SHA1 asynchronously when needed.
  useEffect(() => {
    let active = true;
    if (hashType === 'sha1' && password) {
      sha1Htpasswd(password).then((h) => {
        if (active) setSha1Hash(h);
      });
    }
    return () => {
      active = false;
    };
  }, [hashType, password]);

  const computed = useMemo(() => {
    const user = username.trim();
    if (!user) return { error: 'Enter a username.' };
    if (/[:\s]/.test(user)) return { error: 'Username cannot contain spaces or a colon.' };
    if (!password) return { error: 'Enter a password.' };

    let hash: string;
    if (hashType === 'apr1') {
      hash = apr1(password, randomSalt(8));
    } else {
      if (!sha1Hash) return { pending: true as const };
      hash = sha1Hash;
    }
    const htpasswdLine = `${user}:${hash}`;
    const htaccess = [
      'AuthType Basic',
      `AuthName "${authName.replace(/"/g, '')}"`,
      `AuthUserFile ${authFile.trim() || '/var/www/.htpasswd'}`,
      'Require valid-user',
    ].join('\n');
    return { htpasswdLine, htaccess };
  }, [username, password, hashType, authName, authFile, sha1Hash]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="w-40 font-mono" />
        </Field>
        <Field label="Password">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} className="w-48 font-mono" />
        </Field>
        <Field label="Hash type">
          <Select value={hashType} onValueChange={(v) => setHashType(v as HashType)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apr1">APR1-MD5 ($apr1$)</SelectItem>
              <SelectItem value="sha1">SHA-1 ({'{SHA}'})</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="AuthName (realm)" className="min-w-[180px]">
          <Input value={authName} onChange={(e) => setAuthName(e.target.value)} className="font-mono" />
        </Field>
        <Field label="AuthUserFile path" className="min-w-[220px] flex-1">
          <Input value={authFile} onChange={(e) => setAuthFile(e.target.value)} className="font-mono" />
        </Field>
      </OptionsBar>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Hashing runs entirely in your browser; the password never leaves the page. The APR1 salt is random,
        so the htpasswd line changes on each keystroke. bcrypt is not generated here because it cannot be
        computed offline without a dependency; APR1-MD5 and SHA-1 are both accepted by Apache.
      </div>

      {'error' in computed ? (
        <ErrorBanner error={computed.error} />
      ) : 'pending' in computed ? (
        <Panel>
          <div className="p-3 text-sm text-muted-foreground">Computing hash…</div>
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader title=".htpasswd line">
              <CopyButton value={computed.htpasswdLine} />
              <DownloadButton data={computed.htpasswdLine + '\n'} filename=".htpasswd" />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{computed.htpasswdLine}</pre>
          </Panel>

          <Panel>
            <PanelHeader title=".htaccess">
              <CopyButton value={computed.htaccess} />
              <DownloadButton data={computed.htaccess + '\n'} filename=".htaccess" />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{computed.htaccess}</pre>
            <StatBar items={[hashType === 'apr1' ? 'APR1-MD5' : 'SHA-1', `user: ${username.trim()}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
