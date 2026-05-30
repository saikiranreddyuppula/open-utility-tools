'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function b64UrlDecode(seg: string): string {
  let s = seg.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  let bin: string;
  try {
    bin = atob(s);
  } catch {
    throw new Error('JWT contains invalid Base64url.');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

interface ClaimCheck {
  claim: string;
  status: 'PASS' | 'FAIL' | 'N/A';
  detail: string;
}

function fmtTime(secs: number, nowSecs: number): string {
  const d = new Date(secs * 1000);
  if (Number.isNaN(d.getTime())) return 'invalid';
  const diff = secs - nowSecs;
  const abs = Math.abs(diff);
  const unit =
    abs < 60
      ? `${Math.round(abs)}s`
      : abs < 3600
        ? `${Math.round(abs / 60)}m`
        : abs < 86400
          ? `${Math.round(abs / 3600)}h`
          : `${Math.round(abs / 86400)}d`;
  const rel = diff === 0 ? 'now' : diff > 0 ? `in ${unit}` : `${unit} ago`;
  return `${d.toISOString()} (${rel})`;
}

interface Decoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  payloadPretty: string;
}

export default function JwtClaimsValidatorTool() {
  const [jwt, setJwt] = useState('');
  const [expIss, setExpIss] = useState('');
  const [expAud, setExpAud] = useState('');
  const [nowStr, setNowStr] = useState(() =>
    new Date().toISOString().slice(0, 19)
  );

  const result = useMemo<
    { error: string } | { decoded: Decoded; checks: ClaimCheck[]; now: number }
  >(() => {
    const raw = jwt.trim();
    if (!raw) return { error: '' };
    const parts = raw.split('.');
    if (parts.length < 2) {
      return { error: 'Not a JWT — expected at least header.payload sections.' };
    }
    const headerSeg = parts[0] ?? '';
    const payloadSeg = parts[1] ?? '';
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = JSON.parse(b64UrlDecode(headerSeg)) as Record<string, unknown>;
      payload = JSON.parse(b64UrlDecode(payloadSeg)) as Record<string, unknown>;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to decode JWT.' };
    }

    const parsedNow = Date.parse(nowStr);
    const now = Number.isNaN(parsedNow)
      ? Math.floor(Date.now() / 1000)
      : Math.floor(parsedNow / 1000);

    const checks: ClaimCheck[] = [];

    const exp = payload['exp'];
    if (typeof exp === 'number') {
      const ok = now < exp;
      checks.push({
        claim: 'exp',
        status: ok ? 'PASS' : 'FAIL',
        detail: ok
          ? `not expired — ${fmtTime(exp, now)}`
          : `EXPIRED — ${fmtTime(exp, now)}`,
      });
    } else {
      checks.push({ claim: 'exp', status: 'N/A', detail: 'no expiry claim' });
    }

    const nbf = payload['nbf'];
    if (typeof nbf === 'number') {
      const ok = now >= nbf;
      checks.push({
        claim: 'nbf',
        status: ok ? 'PASS' : 'FAIL',
        detail: ok
          ? `active — not-before ${fmtTime(nbf, now)}`
          : `NOT YET VALID — ${fmtTime(nbf, now)}`,
      });
    } else {
      checks.push({ claim: 'nbf', status: 'N/A', detail: 'no not-before claim' });
    }

    const iat = payload['iat'];
    if (typeof iat === 'number') {
      const ok = iat <= now + 60;
      checks.push({
        claim: 'iat',
        status: ok ? 'PASS' : 'FAIL',
        detail: ok
          ? `issued ${fmtTime(iat, now)}`
          : `issued in the future — ${fmtTime(iat, now)}`,
      });
    } else {
      checks.push({ claim: 'iat', status: 'N/A', detail: 'no issued-at claim' });
    }

    const wantIss = expIss.trim();
    const iss = payload['iss'];
    if (wantIss) {
      const ok = iss === wantIss;
      checks.push({
        claim: 'iss',
        status: ok ? 'PASS' : 'FAIL',
        detail: ok
          ? `matches "${wantIss}"`
          : `expected "${wantIss}", got ${typeof iss === 'string' ? `"${iss}"` : 'none'}`,
      });
    } else if (typeof iss === 'string') {
      checks.push({ claim: 'iss', status: 'N/A', detail: `present: "${iss}"` });
    }

    const wantAud = expAud.trim();
    const aud = payload['aud'];
    if (wantAud) {
      const audList = Array.isArray(aud)
        ? aud.filter((a): a is string => typeof a === 'string')
        : typeof aud === 'string'
          ? [aud]
          : [];
      const ok = audList.includes(wantAud);
      checks.push({
        claim: 'aud',
        status: ok ? 'PASS' : 'FAIL',
        detail: ok
          ? `contains "${wantAud}"`
          : `expected "${wantAud}" in [${audList.join(', ') || 'none'}]`,
      });
    } else if (aud !== undefined) {
      const shown = Array.isArray(aud) ? aud.join(', ') : String(aud);
      checks.push({ claim: 'aud', status: 'N/A', detail: `present: ${shown}` });
    }

    return {
      decoded: { header, payload, payloadPretty: JSON.stringify(payload, null, 2) },
      checks,
      now,
    };
  }, [jwt, expIss, expAud, nowStr]);

  const SAMPLE =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjIsImlzcyI6ImF1dGguZXhhbXBsZS5jb20iLCJhdWQiOiJhcGkifQ.signature';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Expected issuer (iss)">
          <Input
            value={expIss}
            onChange={(e) => setExpIss(e.target.value)}
            placeholder="auth.example.com"
            className="font-mono"
          />
        </Field>
        <Field label="Expected audience (aud)">
          <Input
            value={expAud}
            onChange={(e) => setExpAud(e.target.value)}
            placeholder="api"
            className="font-mono"
          />
        </Field>
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
        <PanelHeader title="JWT">
          <button
            type="button"
            className="rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted"
            onClick={() => setJwt(SAMPLE)}
          >
            Sample
          </button>
        </PanelHeader>
        <Textarea
          value={jwt}
          onChange={(e) => setJwt(e.target.value)}
          spellCheck={false}
          placeholder="header.payload.signature"
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error || null} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Claim policy checks" />
            <div className="divide-y">
              {result.checks.map((c) => (
                <div key={c.claim} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={
                      c.status === 'PASS'
                        ? 'w-16 shrink-0 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                        : c.status === 'FAIL'
                          ? 'w-16 shrink-0 font-mono text-xs font-semibold text-red-600 dark:text-red-400'
                          : 'w-16 shrink-0 font-mono text-xs text-muted-foreground'
                    }
                  >
                    {c.status}
                  </span>
                  <code className="w-12 shrink-0 font-mono text-xs">{c.claim}</code>
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `now = ${new Date(result.now * 1000).toISOString()}`,
                `${result.checks.filter((c) => c.status === 'FAIL').length} failing`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Decoded payload">
              <CopyButton value={result.decoded.payloadPretty} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">
              {result.decoded.payloadPretty}
            </pre>
          </Panel>
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Signature is NOT verified — this checks claim policy only. Use a verifier for trust.
      </p>
    </div>
  );
}
