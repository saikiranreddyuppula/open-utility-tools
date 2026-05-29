'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Direction = 'request' | 'response' | 'both';

interface Header {
  name: string;
  direction: Direction;
  desc: string;
  example: string;
  deprecated?: boolean;
}

const HEADERS: Header[] = [
  {
    name: 'Accept',
    direction: 'request',
    desc: 'Media types the client can understand, used for content negotiation.',
    example: 'Accept: text/html, application/json;q=0.9',
  },
  {
    name: 'Accept-Encoding',
    direction: 'request',
    desc: 'Content encodings (compression) the client accepts.',
    example: 'Accept-Encoding: gzip, deflate, br',
  },
  {
    name: 'Accept-Language',
    direction: 'request',
    desc: 'Natural languages the client prefers.',
    example: 'Accept-Language: en-US, en;q=0.5',
  },
  {
    name: 'Authorization',
    direction: 'request',
    desc: 'Credentials to authenticate the user agent with the server.',
    example: 'Authorization: Bearer eyJhbGciOi...',
  },
  {
    name: 'Cache-Control',
    direction: 'both',
    desc: 'Directives for caching in both requests and responses.',
    example: 'Cache-Control: no-cache, max-age=0',
  },
  {
    name: 'Content-Type',
    direction: 'both',
    desc: 'The media type of the resource or request body.',
    example: 'Content-Type: application/json; charset=utf-8',
  },
  {
    name: 'Content-Length',
    direction: 'both',
    desc: 'Size of the message body, in bytes.',
    example: 'Content-Length: 348',
  },
  {
    name: 'Content-Encoding',
    direction: 'response',
    desc: 'Compression applied to the response body.',
    example: 'Content-Encoding: gzip',
  },
  {
    name: 'Cookie',
    direction: 'request',
    desc: 'Stored cookies previously sent by the server via Set-Cookie.',
    example: 'Cookie: session=abc123; theme=dark',
  },
  {
    name: 'Set-Cookie',
    direction: 'response',
    desc: 'Sends a cookie from the server to the user agent.',
    example: 'Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax',
  },
  {
    name: 'ETag',
    direction: 'response',
    desc: 'An identifier for a specific version of a resource, used for caching.',
    example: 'ETag: "33a64df551425fcc55e"',
  },
  {
    name: 'If-None-Match',
    direction: 'request',
    desc: 'Makes the request conditional; server responds 304 if ETag matches.',
    example: 'If-None-Match: "33a64df551425fcc55e"',
  },
  {
    name: 'If-Modified-Since',
    direction: 'request',
    desc: 'Conditional request based on the resource modification time.',
    example: 'If-Modified-Since: Wed, 21 Oct 2025 07:28:00 GMT',
  },
  {
    name: 'Last-Modified',
    direction: 'response',
    desc: 'The date and time the resource was last changed.',
    example: 'Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT',
  },
  {
    name: 'Host',
    direction: 'request',
    desc: 'Domain name and optional port of the target server. Required in HTTP/1.1.',
    example: 'Host: example.com',
  },
  {
    name: 'User-Agent',
    direction: 'request',
    desc: 'Identifies the client software making the request.',
    example: 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    name: 'Referer',
    direction: 'request',
    desc: 'The address of the page that linked to the requested resource.',
    example: 'Referer: https://example.com/page',
  },
  {
    name: 'Origin',
    direction: 'request',
    desc: 'Indicates the origin that caused the request, used in CORS.',
    example: 'Origin: https://example.com',
  },
  {
    name: 'Location',
    direction: 'response',
    desc: 'URL to redirect to, used with 3xx and 201 responses.',
    example: 'Location: https://example.com/new-path',
  },
  {
    name: 'Access-Control-Allow-Origin',
    direction: 'response',
    desc: 'Specifies which origins may access the resource (CORS).',
    example: 'Access-Control-Allow-Origin: *',
  },
  {
    name: 'Access-Control-Allow-Methods',
    direction: 'response',
    desc: 'Methods allowed when accessing the resource in a CORS preflight.',
    example: 'Access-Control-Allow-Methods: GET, POST, PUT',
  },
  {
    name: 'Content-Security-Policy',
    direction: 'response',
    desc: 'Controls resources the user agent is allowed to load, mitigating XSS.',
    example: "Content-Security-Policy: default-src 'self'",
  },
  {
    name: 'Strict-Transport-Security',
    direction: 'response',
    desc: 'Forces browsers to use HTTPS for future requests (HSTS).',
    example: 'Strict-Transport-Security: max-age=63072000; includeSubDomains',
  },
  {
    name: 'X-Content-Type-Options',
    direction: 'response',
    desc: 'Prevents MIME-type sniffing when set to nosniff.',
    example: 'X-Content-Type-Options: nosniff',
  },
  {
    name: 'X-Frame-Options',
    direction: 'response',
    desc: 'Controls whether the page can be embedded in a frame (clickjacking defense).',
    example: 'X-Frame-Options: DENY',
  },
  {
    name: 'WWW-Authenticate',
    direction: 'response',
    desc: 'Defines the authentication method to access a resource (with 401).',
    example: 'WWW-Authenticate: Basic realm="Access"',
  },
  {
    name: 'Connection',
    direction: 'both',
    desc: 'Controls whether the network connection stays open after the transaction.',
    example: 'Connection: keep-alive',
  },
  {
    name: 'Transfer-Encoding',
    direction: 'response',
    desc: 'Form of encoding used to transfer the body, e.g. chunked.',
    example: 'Transfer-Encoding: chunked',
  },
  {
    name: 'Range',
    direction: 'request',
    desc: 'Requests only part of a resource (byte ranges).',
    example: 'Range: bytes=0-1023',
  },
  {
    name: 'Retry-After',
    direction: 'response',
    desc: 'How long to wait before making a follow-up request (with 429/503).',
    example: 'Retry-After: 120',
  },
  {
    name: 'Vary',
    direction: 'response',
    desc: 'Lists request headers that affect cache key selection.',
    example: 'Vary: Accept-Encoding, User-Agent',
  },
  {
    name: 'DNT',
    direction: 'request',
    desc: 'Legacy "Do Not Track" preference. Deprecated and largely ignored.',
    example: 'DNT: 1',
    deprecated: true,
  },
  {
    name: 'Pragma',
    direction: 'request',
    desc: 'HTTP/1.0 caching directive, superseded by Cache-Control.',
    example: 'Pragma: no-cache',
    deprecated: true,
  },
  {
    name: 'X-XSS-Protection',
    direction: 'response',
    desc: 'Legacy XSS filter control. Deprecated; use Content-Security-Policy instead.',
    example: 'X-XSS-Protection: 0',
    deprecated: true,
  },
];

function directionLabel(d: Direction): string {
  if (d === 'request') return 'Request';
  if (d === 'response') return 'Response';
  return 'Request & Response';
}

export default function HttpHeadersReferenceTool() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Direction | 'all'>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HEADERS.filter((h) => {
      if (filter !== 'all') {
        if (filter === 'request' && h.direction === 'response') return false;
        if (filter === 'response' && h.direction === 'request') return false;
      }
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.desc.toLowerCase().includes(q) ||
        h.example.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="HTTP headers" />
        <OptionsBar>
          <Field label="Search" className="flex-1" hint="By header name, keyword, or example">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="cache, cors, authorization…"
            />
          </Field>
          <Field label="Direction">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Direction | 'all')}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <StatBar items={[`${results.length} of ${HEADERS.length} headers`]} />
      </Panel>

      {results.length === 0 ? (
        <Panel>
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No headers match “{query}”.
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          {results.map((h) => (
            <Panel key={h.name}>
              <div className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-medium">
                      {h.name}
                    </code>
                    <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {directionLabel(h.direction)}
                    </span>
                    {h.deprecated ? (
                      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Deprecated
                      </span>
                    ) : (
                      <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        Standard
                      </span>
                    )}
                  </div>
                  <CopyButton value={h.example} />
                </div>
                <p className="text-sm text-muted-foreground">{h.desc}</p>
                <code className={cn('block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs')}>
                  {h.example}
                </code>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
