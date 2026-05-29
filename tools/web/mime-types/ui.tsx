'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { MIME_TYPES } from '@/lib/web/mime';

export default function MimeTypesTool() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^\./, '');
    if (!s) return MIME_TYPES;
    return MIME_TYPES.filter(
      (m) => m.ext.includes(s) || m.mime.includes(s) || m.name.toLowerCase().includes(s)
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by extension or MIME — png, application/json, video…"
        className="h-9 font-mono"
      />
      <Panel>
        <div className="divide-y">
          {filtered.map((m) => (
            <div key={m.ext} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 font-mono text-xs font-semibold">.{m.ext}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{m.mime}</code>
              <span className="hidden text-2xs text-muted-foreground sm:inline">{m.name}</span>
              <CopyButton value={m.mime} size="icon-sm" />
            </div>
          ))}
          {filtered.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No match.</p>}
        </div>
      </Panel>
    </div>
  );
}
