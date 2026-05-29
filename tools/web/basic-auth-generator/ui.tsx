'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export default function BasicAuthGeneratorTool() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const { token, header, curl } = useMemo(() => {
    const t = b64(`${user}:${pass}`);
    return {
      token: t,
      header: `Authorization: Basic ${t}`,
      curl: `curl -H "Authorization: Basic ${t}" https://example.com`,
    };
  }, [user, pass]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Username</Label>
          <Input value={user} onChange={(e) => setUser(e.target.value)} className="font-mono" placeholder="user" />
        </div>
        <div className="space-y-1">
          <Label>Password</Label>
          <Input value={pass} onChange={(e) => setPass(e.target.value)} className="font-mono" placeholder="password" />
        </div>
      </div>

      <Panel>
        <div className="divide-y">
          {[
            { label: 'Base64 token', value: token },
            { label: 'Header', value: header },
            { label: 'cURL', value: curl },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-3 py-2">
              <span className="w-24 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                {r.label}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{r.value}</code>
              <CopyButton value={r.value} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
      <p className="px-1 text-2xs text-muted-foreground">
        Base64 is encoding, not encryption — Basic Auth must only be used over HTTPS.
      </p>
    </div>
  );
}
