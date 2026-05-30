'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

function parseIPv4(s: string): bigint | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

function parseIPv6(s: string): bigint | null {
  let str = s.trim();
  if (str.includes('.')) {
    const lastColon = str.lastIndexOf(':');
    if (lastColon < 0) return null;
    const v4 = parseIPv4(str.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = (v4 >> 16n) & 0xffffn;
    const lo = v4 & 0xffffn;
    str = `${str.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }
  if (!/^[0-9a-fA-F:]+$/.test(str)) return null;
  if (str.split('::').length - 1 > 1) return null;
  let groups: string[];
  if (str.includes('::')) {
    const [headRaw, tailRaw] = str.split('::') as [string, string];
    const head = headRaw === '' ? [] : headRaw.split(':');
    const tail = tailRaw === '' ? [] : tailRaw.split(':');
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  } else {
    groups = str.split(':');
  }
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    if (g === '' || g.length > 4 || !/^[0-9a-fA-F]+$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

type IpVal = { version: 4 | 6; n: bigint };

function parseIp(s: string): IpVal | null {
  const t = s.trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) {
    const n = parseIPv4(t);
    return n === null ? null : { version: 4, n };
  }
  if (t.includes(':')) {
    const n = parseIPv6(t);
    return n === null ? null : { version: 6, n };
  }
  return null;
}

interface CidrRange {
  raw: string;
  version: 4 | 6;
  prefix: number;
  network: bigint;
  mask: bigint;
}

function parseCidr(s: string): CidrRange | null {
  const t = s.trim();
  const slash = t.lastIndexOf('/');
  if (slash < 0) return null;
  const base = t.slice(0, slash);
  const prefStr = t.slice(slash + 1);
  if (!/^\d+$/.test(prefStr)) return null;
  const prefix = Number(prefStr);
  const ip = parseIp(base);
  if (!ip) return null;
  const bits = ip.version === 4 ? 32 : 128;
  if (prefix < 0 || prefix > bits) return null;
  const full = (1n << BigInt(bits)) - 1n;
  const mask = prefix === 0 ? 0n : (full ^ ((1n << BigInt(bits - prefix)) - 1n));
  const network = ip.n & mask;
  return { raw: t, version: ip.version, prefix, network, mask };
}

interface IpResult {
  raw: string;
  ok: boolean;
  matches: string[];
}

export default function IpCidrMembershipTool() {
  const [cidrs, setCidrs] = useState('10.0.0.0/8\n192.168.0.0/16\n172.16.0.0/12\n2001:db8::/32');
  const [ips, setIps] = useState('10.1.2.3\n192.168.1.50\n8.8.8.8\n172.20.0.1\n2001:db8::dead:beef');

  const { ranges, badCidrs } = useMemo(() => {
    const r: CidrRange[] = [];
    const bad: string[] = [];
    for (const line of cidrs.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const c = parseCidr(t);
      if (c) r.push(c); else bad.push(t);
    }
    return { ranges: r, badCidrs: bad };
  }, [cidrs]);

  const overlaps = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const a = ranges[i];
        const b = ranges[j];
        if (!a || !b || a.version !== b.version) continue;
        // overlap if one network is contained in the other's broader mask
        const broader = a.prefix <= b.prefix ? a : b;
        const narrower = a.prefix <= b.prefix ? b : a;
        if ((narrower.network & broader.mask) === broader.network) {
          out.push(`${a.raw}  ↔  ${b.raw}`);
        }
      }
    }
    return out;
  }, [ranges]);

  const { results, badIps } = useMemo(() => {
    const res: IpResult[] = [];
    const bad: string[] = [];
    for (const line of ips.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const ip = parseIp(t);
      if (!ip) { bad.push(t); continue; }
      const matches: string[] = [];
      for (const c of ranges) {
        if (c.version !== ip.version) continue;
        if ((ip.n & c.mask) === c.network) matches.push(c.raw);
      }
      res.push({ raw: t, ok: matches.length > 0, matches });
    }
    return { results: res, badIps: bad };
  }, [ips, ranges]);

  const error = ranges.length === 0 ? 'Enter at least one valid CIDR range.' : null;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="CIDR ranges (one per line)" className="min-w-[260px] flex-1">
            <Textarea value={cidrs} onChange={(e) => setCidrs(e.target.value)} spellCheck={false} className="min-h-[120px] font-mono text-xs" />
          </Field>
          <Field label="IP addresses to test (one per line)" className="min-w-[260px] flex-1">
            <Textarea value={ips} onChange={(e) => setIps(e.target.value)} spellCheck={false} className="min-h-[120px] font-mono text-xs" />
          </Field>
        </OptionsBar>
        {(badCidrs.length > 0 || badIps.length > 0) && (
          <StatBar items={[
            ...(badCidrs.length > 0 ? [`Ignored invalid CIDR: ${badCidrs.join(', ')}`] : []),
            ...(badIps.length > 0 ? [`Ignored invalid IP: ${badIps.join(', ')}`] : []),
          ]} />
        )}
      </Panel>

      {error ? (
        <ErrorBanner error={error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Membership results">
              <CopyButton value={() => results.map((r) => `${r.raw}\t${r.ok ? r.matches.join(', ') : 'no match'}`).join('\n')} />
            </PanelHeader>
            <div className="divide-y">
              {results.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No valid IP addresses to test.</div>
              ) : results.map((r) => (
                <div key={r.raw} className="flex items-center gap-3 px-3 py-2">
                  <code className="w-48 shrink-0 break-all font-mono text-sm">{r.raw}</code>
                  {r.ok ? (
                    <span className="flex flex-wrap gap-1">
                      {r.matches.map((m) => (
                        <span key={m} className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">{m}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">no match</span>
                  )}
                </div>
              ))}
            </div>
            <StatBar items={[`${results.filter((r) => r.ok).length} matched`, `${results.length} tested`, `${ranges.length} ranges`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Overlapping ranges" />
            <div className="divide-y">
              {overlaps.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No overlaps detected among the CIDR ranges.</div>
              ) : overlaps.map((o) => (
                <div key={o} className="px-3 py-2 font-mono text-sm">{o}</div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
