'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MDAwMDAwMDAsIm5iZiI6MTUxNjIzOTAyMn0' +
  '.kqj3Wf3b9o6m2t0J6jq7yqkq1F2s3l4m5n6o7p8q9r0';

const dec = new TextDecoder('utf-8', { fatal: true });

/** Decode a base64url segment to a UTF-8 string. */
function base64UrlDecode(seg: string): string {
  let b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) throw new Error('Invalid base64url length');
  if (pad) b64 += '='.repeat(4 - pad);
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error('Segment is not valid base64url');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

const DATE_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at']);

function formatClaimDate(seconds: number): string {
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return 'invalid date';
  return `${d.toISOString()} (${d.toLocaleString()})`;
}

interface Decoded {
  header: string;
  payload: string;
  signature: string;
  alg: string;
  typ: string;
  notes: { key: string; text: string }[];
}

function decodeJwt(token: string): Decoded {
  const t = token.trim();
  if (!t) throw new Error('Enter a JWT');
  const parts = t.split('.');
  if (parts.length !== 3) {
    throw new Error(`Expected 3 dot-separated segments, found ${parts.length}`);
  }
  const [h, p, s] = parts;
  const headerRaw = base64UrlDecode(h ?? '');
  const payloadRaw = base64UrlDecode(p ?? '');

  let headerObj: Record<string, unknown>;
  let payloadObj: Record<string, unknown>;
  try {
    headerObj = JSON.parse(headerRaw) as Record<string, unknown>;
  } catch {
    throw new Error('Header is not valid JSON');
  }
  try {
    payloadObj = JSON.parse(payloadRaw) as Record<string, unknown>;
  } catch {
    throw new Error('Payload is not valid JSON');
  }

  const notes: { key: string; text: string }[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  for (const key of Object.keys(payloadObj)) {
    if (!DATE_CLAIMS.has(key)) continue;
    const raw = payloadObj[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    let text = formatClaimDate(raw);
    if (key === 'exp') {
      text += raw < nowSec ? ' — EXPIRED' : ' — valid';
    } else if (key === 'nbf') {
      text += raw > nowSec ? ' — not yet valid' : ' — active';
    }
    notes.push({ key, text });
  }

  const alg = typeof headerObj['alg'] === 'string' ? (headerObj['alg'] as string) : 'unknown';
  const typ = typeof headerObj['typ'] === 'string' ? (headerObj['typ'] as string) : '—';

  return {
    header: JSON.stringify(headerObj, null, 2),
    payload: JSON.stringify(payloadObj, null, 2),
    signature: s ?? '',
    alg,
    typ,
    notes,
  };
}

export default function JwtInspectorTool() {
  const [token, setToken] = useState('');

  const { result, error } = useMemo(() => {
    if (!token.trim()) return { result: null, error: null };
    try {
      return { result: decodeJwt(token), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="JWT">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setToken(SAMPLE)}
          >
            Load sample
          </button>
        </PanelHeader>
        <Textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOi...header.eyJzdWIiOi...payload.signature"
          spellCheck={false}
          className="min-h-28 font-mono text-xs"
        />
      </Panel>

      <ErrorBanner error={error} />

      {result && (
        <>
          <StatBar
            items={[
              `alg: ${result.alg}`,
              `typ: ${result.typ}`,
              result.notes.length > 0 && `${result.notes.length} date claim${result.notes.length === 1 ? '' : 's'}`,
              'signature not verified',
            ]}
          />

          <Panel>
            <PanelHeader title="Header">
              <CopyButton value={result.header} />
            </PanelHeader>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs">{result.header}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="Payload">
              <CopyButton value={result.payload} />
            </PanelHeader>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs">{result.payload}</pre>
          </Panel>

          {result.notes.length > 0 && (
            <Panel>
              <PanelHeader title="Decoded date claims" />
              <div className="flex flex-col gap-2">
                {result.notes.map((n) => (
                  <Field key={n.key} label={n.key}>
                    <span className="font-mono text-xs text-muted-foreground">{n.text}</span>
                  </Field>
                ))}
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Signature">
              <CopyButton value={result.signature} />
            </PanelHeader>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs break-all whitespace-pre-wrap">
              {result.signature || '(none)'}
            </pre>
          </Panel>
        </>
      )}
    </div>
  );
}
