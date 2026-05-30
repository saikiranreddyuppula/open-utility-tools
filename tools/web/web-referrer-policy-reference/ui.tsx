'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Policy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

interface PolicyInfo {
  value: Policy;
  behavior: string;
}

const POLICIES: PolicyInfo[] = [
  { value: 'no-referrer', behavior: 'Never send a Referer header at all.' },
  {
    value: 'no-referrer-when-downgrade',
    behavior:
      'Send the full URL, but omit it on an HTTPS → HTTP downgrade. (Legacy default.)',
  },
  { value: 'origin', behavior: 'Send only the origin (scheme + host + port) for every request.' },
  {
    value: 'origin-when-cross-origin',
    behavior:
      'Send the full URL for same-origin requests, but only the origin for cross-origin ones.',
  },
  {
    value: 'same-origin',
    behavior: 'Send the full URL for same-origin requests; send nothing cross-origin.',
  },
  {
    value: 'strict-origin',
    behavior:
      'Send only the origin, and only when the security level stays the same (no HTTPS → HTTP).',
  },
  {
    value: 'strict-origin-when-cross-origin',
    behavior:
      'Full URL same-origin, origin-only cross-origin, and nothing on an HTTPS → HTTP downgrade. (Modern default.)',
  },
  {
    value: 'unsafe-url',
    behavior: 'Always send the full URL (including path and query). Not recommended.',
  },
];

function isPotentiallyTrustworthy(scheme: string): boolean {
  // For our purposes: https/wss are "secure"; http/ws are not.
  return scheme === 'https:' || scheme === 'wss:';
}

function originOf(u: URL): string {
  return `${u.protocol}//${u.host}`;
}

function strippedFullUrl(u: URL): string {
  // Referer never includes fragment, and credentials are stripped.
  const clone = new URL(u.href);
  clone.hash = '';
  clone.username = '';
  clone.password = '';
  return clone.href;
}

interface Computed {
  ok: true;
  referer: string | null;
  sameOrigin: boolean;
  downgrade: boolean;
}

interface Failed {
  ok: false;
  error: string;
}

function compute(srcRaw: string, dstRaw: string, policy: Policy): Computed | Failed {
  let src: URL;
  let dst: URL;
  try {
    src = new URL(srcRaw);
  } catch {
    return { ok: false, error: 'Source URL is not a valid absolute URL.' };
  }
  try {
    dst = new URL(dstRaw);
  } catch {
    return { ok: false, error: 'Destination URL is not a valid absolute URL.' };
  }

  const sameOrigin = originOf(src) === originOf(dst);
  const srcSecure = isPotentiallyTrustworthy(src.protocol);
  const dstSecure = isPotentiallyTrustworthy(dst.protocol);
  const downgrade = srcSecure && !dstSecure;

  const full = strippedFullUrl(src);
  const origin = originOf(src) + '/';

  let referer: string | null;
  switch (policy) {
    case 'no-referrer':
      referer = null;
      break;
    case 'unsafe-url':
      referer = full;
      break;
    case 'origin':
      referer = origin;
      break;
    case 'no-referrer-when-downgrade':
      referer = downgrade ? null : full;
      break;
    case 'origin-when-cross-origin':
      referer = sameOrigin ? full : origin;
      break;
    case 'same-origin':
      referer = sameOrigin ? full : null;
      break;
    case 'strict-origin':
      referer = downgrade ? null : origin;
      break;
    case 'strict-origin-when-cross-origin':
      if (downgrade) referer = null;
      else if (sameOrigin) referer = full;
      else referer = origin;
      break;
    default:
      referer = null;
      break;
  }

  return { ok: true, referer, sameOrigin, downgrade };
}

export default function ReferrerPolicyTool() {
  const [src, setSrc] = useState('https://app.example.com/dashboard?token=abc#section');
  const [dst, setDst] = useState('http://analytics.other.com/collect');
  const [policy, setPolicy] = useState<Policy>('strict-origin-when-cross-origin');

  const result = useMemo(() => compute(src, dst, policy), [src, dst, policy]);

  const headerLine =
    result.ok && result.referer ? `Referer: ${result.referer}` : '(no Referer header sent)';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Source URL (the page making the request)" className="min-w-[280px] flex-1">
            <Input
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Destination URL (the request target)" className="min-w-[280px] flex-1">
            <Input
              value={dst}
              onChange={(e) => setDst(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Referrer-Policy" className="min-w-[240px]">
            <Select value={policy} onValueChange={(v) => setPolicy(v as Policy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Simulated Referer">
            <CopyButton value={() => (result.referer ? `Referer: ${result.referer}` : '')} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm',
                result.referer ? 'bg-muted/30' : 'bg-muted/30 text-muted-foreground italic',
              )}
            >
              {headerLine}
            </div>
            <StatBar
              items={[
                result.sameOrigin ? 'same-origin' : 'cross-origin',
                result.downgrade ? 'HTTPS → HTTP downgrade' : 'no downgrade',
                `policy: ${policy}`,
              ]}
            />
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Policy reference" />
        <div className="max-h-[360px] divide-y overflow-auto">
          {POLICIES.map((p) => (
            <div
              key={p.value}
              className={cn(
                'flex items-start gap-3 px-3 py-2',
                p.value === policy && 'bg-muted/40',
              )}
            >
              <code className="w-64 shrink-0 font-mono text-xs">{p.value}</code>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">{p.behavior}</span>
              <CopyButton value={p.value} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
