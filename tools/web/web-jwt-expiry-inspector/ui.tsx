'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNzE2MjM5MDIyLCJuYmYiOjE3MTYyMzkwMjIsImV4cCI6MTcxNjI0MjYyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function b64urlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fmtDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  const units: Array<[string, number]> = [
    ['y', 365 * 24 * 3600],
    ['d', 24 * 3600],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  const parts: string[] = [];
  let rem = abs;
  for (const [label, size] of units) {
    if (rem >= size) {
      const v = Math.floor(rem / size);
      rem -= v * size;
      parts.push(`${v}${label}`);
    }
    if (parts.length >= 2) break;
  }
  if (parts.length === 0) return '0s';
  return parts.join(' ');
}

function relative(targetSec: number, nowSec: number, future: string, past: string): string {
  const delta = targetSec - nowSec;
  if (delta >= 0) return `${future} ${fmtDuration(delta)}`;
  return `${fmtDuration(delta)} ${past}`;
}

interface ClaimTime {
  key: string;
  raw: number;
  utc: string;
  local: string;
  rel: string;
}

interface Result {
  times: ClaimTime[];
  notValidYet: boolean;
  expired: boolean;
  payload: Record<string, unknown>;
}

const TIME_CLAIMS: Array<{ key: string; label: string }> = [
  { key: 'iat', label: 'Issued at' },
  { key: 'nbf', label: 'Not before' },
  { key: 'exp', label: 'Expires' },
];

export default function JwtExpiryInspectorTool() {
  const [token, setToken] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const { result, error } = useMemo<{ result: Result | null; error: string | null }>(() => {
    const t = token.trim();
    if (!t) return { result: null, error: null };
    const parts = t.split('.');
    if (parts.length < 2) {
      return { result: null, error: 'Not a JWT — expected at least header.payload.' };
    }
    try {
      const payloadStr = b64urlDecode(parts[1] ?? '');
      const payload = JSON.parse(payloadStr) as Record<string, unknown>;

      const times: ClaimTime[] = [];
      for (const claim of TIME_CLAIMS) {
        const v = payload[claim.key];
        if (typeof v !== 'number' || !Number.isFinite(v)) continue;
        const date = new Date(v * 1000);
        let rel: string;
        if (claim.key === 'exp') {
          rel = v < now ? `expired ${fmtDuration(now - v)} ago` : `expires in ${fmtDuration(v - now)}`;
        } else if (claim.key === 'nbf') {
          rel = v > now ? `valid in ${fmtDuration(v - now)}` : relative(v, now, 'active since', 'ago');
        } else {
          rel = relative(v, now, 'in', 'ago');
        }
        times.push({
          key: claim.key,
          raw: v,
          utc: date.toISOString(),
          local: date.toLocaleString(),
          rel,
        });
      }

      const expVal = payload.exp;
      const nbfVal = payload.nbf;
      const expired = typeof expVal === 'number' && expVal < now;
      const notValidYet = typeof nbfVal === 'number' && nbfVal > now;

      return { result: { times, notValidYet, expired, payload }, error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Invalid JWT encoding.' };
    }
  }, [token, now]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="JWT">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setNow(Math.floor(Date.now() / 1000))}
          >
            Refresh now
          </button>
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

      <ErrorBanner error={error} />

      {result && (
        <>
          {(result.expired || result.notValidYet) && (
            <div className="flex flex-wrap gap-2 px-1">
              {result.expired && (
                <span className="rounded bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
                  Token is EXPIRED
                </span>
              )}
              {result.notValidYet && (
                <span className="rounded bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Token is NOT YET VALID (nbf in the future)
                </span>
              )}
            </div>
          )}

          {result.times.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No time claims (iat / nbf / exp) found in the payload.
            </p>
          ) : (
            <Panel>
              <PanelHeader title="Time claims">
                <CopyButton
                  value={() =>
                    result.times
                      .map((t) => `${t.key}: ${t.raw} | ${t.utc} | ${t.rel}`)
                      .join('\n')
                  }
                  size="icon-sm"
                />
              </PanelHeader>
              <div className="divide-y">
                {result.times.map((t) => {
                  const label = TIME_CLAIMS.find((c) => c.key === t.key)?.label ?? t.key;
                  return (
                    <div key={t.key} className="flex flex-col gap-1 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs font-semibold">{t.key}</code>
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{t.raw}</span>
                      </div>
                      <div className="grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>
                          <span className="text-foreground">UTC:</span> {t.utc}
                        </span>
                        <span>
                          <span className="text-foreground">Local:</span> {t.local}
                        </span>
                      </div>
                      <span className="text-xs font-medium">{t.rel}</span>
                    </div>
                  );
                })}
              </div>
              <StatBar
                items={[
                  `reference now: ${new Date(now * 1000).toISOString()}`,
                  result.expired ? 'status: expired' : result.notValidYet ? 'status: not yet valid' : 'status: active',
                ]}
              />
            </Panel>
          )}

          <p className="px-1 text-2xs text-muted-foreground">
            Decoding only — the signature is <strong>not</strong> verified. The token never leaves your browser.
          </p>
        </>
      )}
    </div>
  );
}
