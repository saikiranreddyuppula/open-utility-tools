'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';
import { HTTP_STATUSES, statusClass } from '@/lib/web/http-status';
import { cn } from '@/lib/utils';

const CLASS_COLOR: Record<string, string> = {
  Informational: 'text-cat-web',
  Success: 'text-success',
  Redirection: 'text-warning',
  'Client Error': 'text-destructive',
  'Server Error': 'text-destructive',
};

export default function HttpStatusCodesTool() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return HTTP_STATUSES;
    return HTTP_STATUSES.filter(
      (h) =>
        String(h.code).includes(s) ||
        h.message.toLowerCase().includes(s) ||
        h.description.toLowerCase().includes(s)
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by code or text — 404, timeout, redirect…"
        className="h-9 font-mono"
      />
      <Panel>
        <div className="divide-y">
          {filtered.map((h) => (
            <div key={h.code} className="flex items-start gap-3 px-3 py-2">
              <span className={cn('w-12 shrink-0 font-mono text-sm font-semibold tabular', CLASS_COLOR[statusClass(h.code)])}>
                {h.code}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{h.message}</span>
                  <span className="text-2xs text-muted-foreground">{statusClass(h.code)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{h.description}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching status codes.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
