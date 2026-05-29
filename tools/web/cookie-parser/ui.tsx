'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';

interface Cookie {
  name: string;
  value: string;
  attrs: Record<string, string>;
}

function parseCookies(input: string): Cookie[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  // Set-Cookie style: name=value; Attr=...; one cookie per line.
  // Cookie style: name=value; name2=value2 (no attributes).
  const isSetCookie = /;\s*(httponly|secure|samesite|path|domain|expires|max-age)/i.test(trimmed);

  if (isSetCookie) {
    return trimmed.split('\n').filter(Boolean).map((line) => {
      const parts = line.split(';').map((p) => p.trim());
      const [first, ...rest] = parts;
      const eq = first!.indexOf('=');
      const attrs: Record<string, string> = {};
      for (const p of rest) {
        const i = p.indexOf('=');
        if (i === -1) attrs[p] = 'true';
        else attrs[p.slice(0, i)] = p.slice(i + 1);
      }
      return { name: first!.slice(0, eq), value: first!.slice(eq + 1), attrs };
    });
  }

  // plain Cookie header: split on ;
  return trimmed.split(';').map((p) => p.trim()).filter(Boolean).map((pair) => {
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i), value: pair.slice(i + 1), attrs: {} };
  });
}

export default function CookieParserTool() {
  const [input, setInput] = useState('sessionId=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600');
  const cookies = useMemo(() => parseCookies(input), [input]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Cookie / Set-Cookie header" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="name=value; Path=/; HttpOnly; …"
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {cookies.map((c, i) => (
        <Panel key={i}>
          <PanelHeader title={c.name || `cookie ${i + 1}`} />
          <div className="divide-y">
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="w-24 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Value</span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{c.value}</code>
            </div>
            {Object.entries(c.attrs).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-24 shrink-0 font-mono text-2xs text-muted-foreground">{k}</span>
                <code className="min-w-0 flex-1 font-mono text-xs">{v}</code>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      {cookies.length === 0 && input.trim() && (
        <p className="px-1 text-2xs text-muted-foreground">No cookies parsed.</p>
      )}
    </div>
  );
}
