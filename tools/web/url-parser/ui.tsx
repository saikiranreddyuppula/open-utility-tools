'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE = 'https://user:pass@example.com:8443/path/to/page?q=hello+world&page=2#section';

export default function UrlParserTool() {
  const [value, setValue] = useState('');

  const { url, error } = useMemo(() => {
    if (!value.trim()) return { url: null, error: null };
    try {
      return { url: new URL(value.trim()), error: null };
    } catch {
      return { url: null, error: 'Invalid URL. Include a protocol, e.g. https://' };
    }
  }, [value]);

  const parts: { label: string; value: string }[] = url
    ? [
        { label: 'Protocol', value: url.protocol },
        { label: 'Username', value: url.username },
        { label: 'Password', value: url.password },
        { label: 'Hostname', value: url.hostname },
        { label: 'Port', value: url.port },
        { label: 'Path', value: url.pathname },
        { label: 'Query', value: url.search },
        { label: 'Hash', value: url.hash },
        { label: 'Origin', value: url.origin },
      ]
    : [];

  const params = url ? Array.from(url.searchParams.entries()) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://example.com/path?query=value#hash"
          className="h-9 font-mono"
        />
      </div>
      <button
        className="w-fit rounded px-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setValue(SAMPLE)}
      >
        Load sample
      </button>

      {error && <ErrorBanner error={error} />}

      {url && (
        <>
          <Panel>
            <PanelHeader title="Components" />
            <div className="divide-y">
              {parts.map((p) => (
                <div key={p.label} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-24 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                    {p.label}
                  </span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {p.value || <span className="text-muted-foreground">—</span>}
                  </code>
                  {p.value && <CopyButton value={p.value} size="icon-sm" />}
                </div>
              ))}
            </div>
          </Panel>

          {params.length > 0 && (
            <Panel>
              <PanelHeader title={`Query parameters · ${params.length}`} />
              <div className="divide-y">
                {params.map(([k, v], i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="w-40 shrink-0 truncate font-mono text-xs font-medium">{k}</span>
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      {v}
                    </code>
                    <CopyButton value={v} size="icon-sm" />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
