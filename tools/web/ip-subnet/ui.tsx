'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255 || p === '') return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export default function IpSubnetTool() {
  const [cidr, setCidr] = useState('192.168.1.0/24');

  const { rows, error } = useMemo(() => {
    const m = cidr.trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
    if (!m) return { rows: [], error: 'Enter CIDR like 192.168.1.0/24' };
    const ip = ipToInt(m[1]!);
    const prefix = Number(m[2]);
    if (ip === null || prefix < 0 || prefix > 32) return { rows: [], error: 'Invalid IP or prefix' };
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix >= 31 ? total : total - 2;
    const firstHost = prefix >= 31 ? network : network + 1;
    const lastHost = prefix >= 31 ? broadcast : broadcast - 1;
    return {
      error: null,
      rows: [
        ['Network', intToIp(network)],
        ['Broadcast', intToIp(broadcast)],
        ['Netmask', intToIp(mask)],
        ['Wildcard', intToIp(~mask >>> 0)],
        ['First host', intToIp(firstHost)],
        ['Last host', intToIp(lastHost)],
        ['Total addresses', total.toLocaleString()],
        ['Usable hosts', usable.toLocaleString()],
        ['Prefix', `/${prefix}`],
      ] as [string, string][],
    };
  }, [cidr]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={cidr}
        onChange={(e) => setCidr(e.target.value)}
        placeholder="192.168.1.0/24"
        className="h-10 font-mono text-base"
        spellCheck={false}
      />
      {error ? (
        <ErrorBanner error={error} />
      ) : (
        <Panel>
          <PanelHeader title="Subnet" />
          <div className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 px-3 py-2">
                <span className="w-36 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                <code className="min-w-0 flex-1 font-mono text-sm">{v}</code>
                <CopyButton value={v} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
