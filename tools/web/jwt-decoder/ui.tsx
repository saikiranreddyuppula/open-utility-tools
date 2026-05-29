'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNzE2MjM5MDIyLCJleHAiOjE3MTYyNDI2MjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function b64urlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

interface Decoded {
  header: string;
  payload: string;
  signature: string;
  claims: Record<string, unknown>;
}

export default function JwtDecoderTool() {
  const [token, setToken] = useState('');

  const { decoded, error } = useMemo<{ decoded: Decoded | null; error: string | null }>(() => {
    const t = token.trim();
    if (!t) return { decoded: null, error: null };
    const parts = t.split('.');
    if (parts.length < 2)
      return { decoded: null, error: 'Not a JWT — expected at least header.payload.' };
    try {
      const header = b64urlDecode(parts[0]!);
      const payload = b64urlDecode(parts[1]!);
      const claims = JSON.parse(payload) as Record<string, unknown>;
      return {
        decoded: { header, payload, signature: parts[2] ?? '', claims },
        error: null,
      };
    } catch (e) {
      return { decoded: null, error: e instanceof Error ? e.message : 'Invalid JWT encoding.' };
    }
  }, [token]);

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof decoded?.claims.exp === 'number' ? (decoded.claims.exp as number) : null;
  const iat = typeof decoded?.claims.iat === 'number' ? (decoded.claims.iat as number) : null;

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="JWT">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setToken(SAMPLE)}
          >
            Sample
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setToken('')}
          >
            Clear
          </button>
        </PanelHeader>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste a JWT (header.payload.signature)…"
          spellCheck={false}
          className="min-h-24 resize-y break-all rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {error && <ErrorBanner error={error} />}

      {decoded && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Header">
                <CopyButton value={() => pretty(decoded.header)} size="icon-sm" />
              </PanelHeader>
              <pre className="overflow-auto p-3 font-mono text-xs">{pretty(decoded.header)}</pre>
            </Panel>
            <Panel>
              <PanelHeader title="Payload">
                <CopyButton value={() => pretty(decoded.payload)} size="icon-sm" />
              </PanelHeader>
              <pre className="overflow-auto p-3 font-mono text-xs">{pretty(decoded.payload)}</pre>
            </Panel>
          </div>

          <StatBar
            items={[
              exp != null && `exp: ${new Date(exp * 1000).toISOString()}`,
              exp != null && (exp < now ? '⚠ EXPIRED' : `valid for ${Math.round((exp - now) / 60)}min`),
              iat != null && `iat: ${new Date(iat * 1000).toISOString()}`,
              `signature: ${decoded.signature ? decoded.signature.slice(0, 16) + '…' : 'none'}`,
            ]}
          />
          <p className="px-1 text-2xs text-muted-foreground">
            Decoding only — the signature is <strong>not</strong> verified (that needs the secret/key).
          </p>
        </>
      )}
    </div>
  );
}
