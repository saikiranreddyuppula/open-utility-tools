'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

function entityEncode(s: string): string {
  return Array.from(s)
    .map((c) => (Math.random() > 0.5 ? `&#${c.charCodeAt(0)};` : `&#x${c.charCodeAt(0).toString(16)};`))
    .join('');
}

export default function EmailObfuscatorTool() {
  const [email, setEmail] = useState('hello@example.com');

  const outputs = useMemo(() => {
    if (!email) return [];
    const entities = entityEncode(email);
    const reversed = email.split('').reverse().join('');
    return [
      { label: 'HTML entities', value: `<a href="mailto:${entities}">${entities}</a>` },
      {
        label: 'CSS reverse',
        value: `<span style="unicode-bidi:bidi-override;direction:rtl">${reversed}</span>`,
      },
      {
        label: 'JS write',
        value: `<script>document.write(['${email.split('@')[0]}','${email.split('@')[1]}'].join('@'))</script>`,
      },
      { label: 'AT/DOT', value: email.replace('@', ' [at] ').replace(/\./g, ' [dot] ') },
    ];
  }, [email]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Email address</label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-md font-mono" />
      </div>
      {outputs.length > 0 && (
        <Panel>
          <div className="divide-y">
            {outputs.map((o) => (
              <div key={o.label} className="flex items-start gap-3 px-3 py-2">
                <span className="w-28 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{o.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{o.value}</code>
                <CopyButton value={o.value} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">Obfuscation deters naive scrapers; it is not real security.</p>
    </div>
  );
}
