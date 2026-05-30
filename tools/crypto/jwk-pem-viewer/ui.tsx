'use client';

import { useCallback, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type KeyKind = 'rsa-sig' | 'rsa-enc' | 'ec';

interface AlgoChoice {
  importAlgo: RsaHashedImportParams | EcKeyImportParams;
  curve?: string;
}

function makeAlgo(kind: KeyKind, curve: string): AlgoChoice {
  if (kind === 'ec') {
    return { importAlgo: { name: 'ECDSA', namedCurve: curve }, curve };
  }
  if (kind === 'rsa-enc') {
    return { importAlgo: { name: 'RSA-OAEP', hash: 'SHA-256' } };
  }
  return { importAlgo: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } };
}

function pemToDer(pem: string): { der: Uint8Array; label: string } {
  const m = pem.match(/-----BEGIN ([^-]+)-----/);
  const label = (m && m[1] ? m[1] : '').trim();
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
  return { der: out, label };
}

function derToPem(buf: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  const b64 = btoa(bin);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function toHexColon(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  return parts.join(':');
}

function strOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : String(x))).join(', ');
  return v === undefined || v === null ? '' : String(v);
}

// rough modulus bit length from JWK 'n' (base64url) or DER size for display
function jwkModulusBits(nB64u: string): number {
  const clean = nB64u.replace(/-/g, '+').replace(/_/g, '/');
  let bin: string;
  try {
    bin = atob(clean + '==='.slice((clean.length + 3) % 4));
  } catch {
    return 0;
  }
  let i = 0;
  while (i < bin.length && bin.charCodeAt(i) === 0) i++;
  const lead = bin.charCodeAt(i) || 0;
  let topBits = 0;
  let x = lead;
  while (x > 0) {
    topBits++;
    x >>= 1;
  }
  return (bin.length - i - 1) * 8 + topBits;
}

interface ParamRow {
  k: string;
  v: string;
}

export default function JwkPemViewerTool() {
  const [kind, setKind] = useState<KeyKind>('ec');
  const [curve, setCurve] = useState('P-256');
  const [input, setInput] = useState('');
  const [pemOut, setPemOut] = useState('');
  const [jwkOut, setJwkOut] = useState('');
  const [params, setParams] = useState<ParamRow[]>([]);
  const [fingerprint, setFingerprint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPemOut('');
    setJwkOut('');
    setParams([]);
    setFingerprint('');
    try {
      const text = input.trim();
      if (!text) throw new Error('Paste a JWK (JSON) or PEM key.');
      const { importAlgo } = makeAlgo(kind, curve);
      const isJwk = text.startsWith('{');

      let key: CryptoKey;
      let isPrivate: boolean;

      if (isJwk) {
        let jwk: JsonWebKey;
        try {
          jwk = JSON.parse(text) as JsonWebKey;
        } catch {
          throw new Error('Input looks like JWK but is not valid JSON.');
        }
        isPrivate = kind === 'ec' ? jwk.d !== undefined : jwk.d !== undefined;
        const usages: KeyUsage[] = kind === 'ec' ? (isPrivate ? ['sign'] : ['verify']) : kind === 'rsa-enc' ? (isPrivate ? ['decrypt'] : ['encrypt']) : isPrivate ? ['sign'] : ['verify'];
        key = await wc.subtle.importKey('jwk', jwk, importAlgo, true, usages);
      } else {
        const { der, label } = pemToDer(text);
        isPrivate = /PRIVATE/.test(label);
        const fmt = isPrivate ? 'pkcs8' : 'spki';
        const usages: KeyUsage[] = kind === 'ec' ? (isPrivate ? ['sign'] : ['verify']) : kind === 'rsa-enc' ? (isPrivate ? ['decrypt'] : ['encrypt']) : isPrivate ? ['sign'] : ['verify'];
        key = await wc.subtle.importKey(fmt, der as unknown as ArrayBuffer, importAlgo, true, usages);
      }

      // Export both representations.
      const jwkExp = await wc.subtle.exportKey('jwk', key);
      setJwkOut(JSON.stringify(jwkExp, null, 2));

      const pemFmt = isPrivate ? 'pkcs8' : 'spki';
      const pemLabel = isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY';
      const derExp = await wc.subtle.exportKey(pemFmt, key);
      setPemOut(derToPem(derExp, pemLabel));

      // Parameter table from the exported JWK (canonical, consistent).
      const rows: ParamRow[] = [];
      rows.push({ k: 'kty', v: strOf(jwkExp.kty) });
      if (jwkExp.crv) rows.push({ k: 'crv', v: strOf(jwkExp.crv) });
      if (jwkExp.alg) rows.push({ k: 'alg', v: strOf(jwkExp.alg) });
      rows.push({ k: 'use/key_ops', v: strOf(jwkExp.use) || strOf(jwkExp.key_ops) || '—' });
      if (jwkExp.kty === 'RSA' && jwkExp.n) {
        rows.push({ k: 'modulus length', v: `${jwkModulusBits(strOf(jwkExp.n))} bits` });
        rows.push({ k: 'public exponent (e)', v: strOf(jwkExp.e) });
        rows.push({ k: 'modulus (n)', v: strOf(jwkExp.n) });
      }
      if (jwkExp.kty === 'EC') {
        rows.push({ k: 'x', v: strOf(jwkExp.x) });
        rows.push({ k: 'y', v: strOf(jwkExp.y) });
      }
      rows.push({ k: 'private', v: isPrivate ? 'yes' : 'no' });
      setParams(rows);

      // SHA-256 fingerprint over the DER of the public/SPKI (or PKCS8) form.
      const fpBuf = await wc.subtle.digest('SHA-256', derExp);
      setFingerprint(toHexColon(fpBuf));
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — confirm the selected key type/curve matches the input.`
          : String(e)
      );
    } finally {
      setBusy(false);
    }
  }, [input, kind, curve]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Key type">
          <Select value={kind} onValueChange={(v) => setKind(v as KeyKind)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ec">EC (ECDSA)</SelectItem>
              <SelectItem value="rsa-sig">RSA (RSASSA-PKCS1-v1_5)</SelectItem>
              <SelectItem value="rsa-enc">RSA (RSA-OAEP)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {kind === 'ec' && (
          <Field label="Curve">
            <Select value={curve} onValueChange={(v) => setCurve(v)}>
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
        )}
        <Button type="button" onClick={() => void run()} disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {busy ? 'Parsing…' : 'Inspect'}
        </Button>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Key input (JWK JSON or PEM)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'{"kty":"EC","crv":"P-256","x":"…","y":"…"}\n\nor\n\n-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----'}
          spellCheck={false}
          className="min-h-36 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <ErrorBanner error={error} />

      {params.length > 0 && (
        <Panel>
          <PanelHeader title="Parameters" />
          <div className="divide-y">
            {params.map((p) => (
              <div key={p.k} className="flex items-start gap-3 px-3 py-1.5">
                <span className="w-40 shrink-0 font-mono text-2xs font-medium text-muted-foreground">{p.k}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{p.v || '—'}</code>
              </div>
            ))}
            <div className="flex items-start gap-3 px-3 py-1.5">
              <span className="w-40 shrink-0 font-mono text-2xs font-medium text-muted-foreground">SHA-256 fingerprint (DER)</span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{fingerprint}</code>
              <CopyButton value={fingerprint} size="icon-sm" />
            </div>
          </div>
        </Panel>
      )}

      {pemOut && (
        <Panel>
          <PanelHeader title="PEM">
            <CopyButton value={pemOut} />
          </PanelHeader>
          <Textarea
            readOnly
            value={pemOut}
            className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}

      {jwkOut && (
        <Panel>
          <PanelHeader title="JWK">
            <CopyButton value={jwkOut} />
          </PanelHeader>
          <Textarea
            readOnly
            value={jwkOut}
            className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}
    </div>
  );
}
