'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Code {
  code: number;
  phrase: string;
  constant: string;
  cacheable: boolean;
  bodyExpected: boolean;
  note: string;
}

const CODES: Code[] = [
  { code: 100, phrase: 'Continue', constant: 'CONTINUE', cacheable: false, bodyExpected: false, note: 'Interim response; client should continue sending the request body.' },
  { code: 101, phrase: 'Switching Protocols', constant: 'SWITCHING_PROTOCOLS', cacheable: false, bodyExpected: false, note: 'Server agrees to switch protocols (e.g. to WebSocket).' },
  { code: 103, phrase: 'Early Hints', constant: 'EARLY_HINTS', cacheable: false, bodyExpected: false, note: 'Lets the client start preloading resources via Link headers.' },
  { code: 200, phrase: 'OK', constant: 'OK', cacheable: true, bodyExpected: true, note: 'Standard success response with a representation in the body.' },
  { code: 201, phrase: 'Created', constant: 'CREATED', cacheable: false, bodyExpected: true, note: 'A new resource was created; Location header points to it.' },
  { code: 202, phrase: 'Accepted', constant: 'ACCEPTED', cacheable: false, bodyExpected: true, note: 'Request accepted for asynchronous processing; not yet complete.' },
  { code: 204, phrase: 'No Content', constant: 'NO_CONTENT', cacheable: true, bodyExpected: false, note: 'Success with no body, e.g. after a successful DELETE or PUT.' },
  { code: 206, phrase: 'Partial Content', constant: 'PARTIAL_CONTENT', cacheable: true, bodyExpected: true, note: 'Response to a Range request; only part of the resource returned.' },
  { code: 301, phrase: 'Moved Permanently', constant: 'MOVED_PERMANENTLY', cacheable: true, bodyExpected: false, note: 'Resource has a new permanent URL in the Location header.' },
  { code: 302, phrase: 'Found', constant: 'FOUND', cacheable: false, bodyExpected: false, note: 'Temporary redirect; method may change to GET by some clients.' },
  { code: 303, phrase: 'See Other', constant: 'SEE_OTHER', cacheable: false, bodyExpected: false, note: 'Redirect to a GET resource, typically after a POST (PRG pattern).' },
  { code: 304, phrase: 'Not Modified', constant: 'NOT_MODIFIED', cacheable: false, bodyExpected: false, note: 'Cached copy is still valid; sent for conditional GET requests.' },
  { code: 307, phrase: 'Temporary Redirect', constant: 'TEMPORARY_REDIRECT', cacheable: false, bodyExpected: false, note: 'Temporary redirect that preserves the original method and body.' },
  { code: 308, phrase: 'Permanent Redirect', constant: 'PERMANENT_REDIRECT', cacheable: true, bodyExpected: false, note: 'Permanent redirect that preserves the original method and body.' },
  { code: 400, phrase: 'Bad Request', constant: 'BAD_REQUEST', cacheable: false, bodyExpected: true, note: 'The server cannot process the request due to a client error.' },
  { code: 401, phrase: 'Unauthorized', constant: 'UNAUTHORIZED', cacheable: false, bodyExpected: true, note: 'Authentication is required or has failed; send WWW-Authenticate.' },
  { code: 403, phrase: 'Forbidden', constant: 'FORBIDDEN', cacheable: false, bodyExpected: true, note: 'Authenticated but not authorized to access the resource.' },
  { code: 404, phrase: 'Not Found', constant: 'NOT_FOUND', cacheable: true, bodyExpected: true, note: 'The target resource does not exist (or is hidden).' },
  { code: 405, phrase: 'Method Not Allowed', constant: 'METHOD_NOT_ALLOWED', cacheable: true, bodyExpected: true, note: 'The method is not supported here; respond with an Allow header.' },
  { code: 406, phrase: 'Not Acceptable', constant: 'NOT_ACCEPTABLE', cacheable: false, bodyExpected: true, note: 'No representation matches the client Accept headers.' },
  { code: 408, phrase: 'Request Timeout', constant: 'REQUEST_TIMEOUT', cacheable: false, bodyExpected: true, note: 'The client took too long to send the complete request.' },
  { code: 409, phrase: 'Conflict', constant: 'CONFLICT', cacheable: false, bodyExpected: true, note: 'The request conflicts with the current state of the resource.' },
  { code: 410, phrase: 'Gone', constant: 'GONE', cacheable: true, bodyExpected: true, note: 'The resource was intentionally and permanently removed.' },
  { code: 411, phrase: 'Length Required', constant: 'LENGTH_REQUIRED', cacheable: false, bodyExpected: true, note: 'The server requires a Content-Length header.' },
  { code: 412, phrase: 'Precondition Failed', constant: 'PRECONDITION_FAILED', cacheable: false, bodyExpected: true, note: 'A conditional header (e.g. If-Match) evaluated to false.' },
  { code: 413, phrase: 'Content Too Large', constant: 'CONTENT_TOO_LARGE', cacheable: false, bodyExpected: true, note: 'The request payload exceeds the server limit (was Payload Too Large).' },
  { code: 415, phrase: 'Unsupported Media Type', constant: 'UNSUPPORTED_MEDIA_TYPE', cacheable: false, bodyExpected: true, note: 'The request body Content-Type is not supported.' },
  { code: 418, phrase: "I'm a teapot", constant: 'IM_A_TEAPOT', cacheable: false, bodyExpected: true, note: 'An April Fools joke (RFC 2324); never brews coffee.' },
  { code: 422, phrase: 'Unprocessable Content', constant: 'UNPROCESSABLE_CONTENT', cacheable: false, bodyExpected: true, note: 'Syntactically valid but semantically invalid; common for validation errors.' },
  { code: 429, phrase: 'Too Many Requests', constant: 'TOO_MANY_REQUESTS', cacheable: false, bodyExpected: true, note: 'Rate limit exceeded; honor the Retry-After header.' },
  { code: 431, phrase: 'Request Header Fields Too Large', constant: 'REQUEST_HEADER_FIELDS_TOO_LARGE', cacheable: false, bodyExpected: true, note: 'The request headers are too large to process.' },
  { code: 451, phrase: 'Unavailable For Legal Reasons', constant: 'UNAVAILABLE_FOR_LEGAL_REASONS', cacheable: false, bodyExpected: true, note: 'Access denied due to legal demands (censorship, takedowns).' },
  { code: 500, phrase: 'Internal Server Error', constant: 'INTERNAL_SERVER_ERROR', cacheable: false, bodyExpected: true, note: 'A generic, unexpected server-side failure.' },
  { code: 501, phrase: 'Not Implemented', constant: 'NOT_IMPLEMENTED', cacheable: true, bodyExpected: true, note: 'The server does not support the functionality required.' },
  { code: 502, phrase: 'Bad Gateway', constant: 'BAD_GATEWAY', cacheable: false, bodyExpected: true, note: 'An upstream server returned an invalid response.' },
  { code: 503, phrase: 'Service Unavailable', constant: 'SERVICE_UNAVAILABLE', cacheable: false, bodyExpected: true, note: 'The server is overloaded or down for maintenance; see Retry-After.' },
  { code: 504, phrase: 'Gateway Timeout', constant: 'GATEWAY_TIMEOUT', cacheable: false, bodyExpected: true, note: 'An upstream server did not respond in time.' },
  { code: 505, phrase: 'HTTP Version Not Supported', constant: 'HTTP_VERSION_NOT_SUPPORTED', cacheable: false, bodyExpected: true, note: 'The HTTP protocol version is not supported.' },
];

const CLASSES: Record<number, { name: string; desc: string }> = {
  1: { name: 'Informational', desc: 'Request received, continuing process.' },
  2: { name: 'Success', desc: 'The request was successfully received, understood, and accepted.' },
  3: { name: 'Redirection', desc: 'Further action is needed to complete the request.' },
  4: { name: 'Client Error', desc: 'The request contains bad syntax or cannot be fulfilled.' },
  5: { name: 'Server Error', desc: 'The server failed to fulfill a valid request.' },
};

function classOf(code: number): number {
  return Math.floor(code / 100);
}

interface ResultOk {
  ok: true;
  kind: 'single';
  code: Code;
}
interface ResultClass {
  ok: true;
  kind: 'class';
  cls: number;
  codes: Code[];
}
interface ResultFail {
  ok: false;
  error: string;
}

function lookup(raw: string): ResultOk | ResultClass | ResultFail {
  const s = raw.trim();
  if (!s) return { ok: false, error: 'Enter a status code (e.g. 404), a class (e.g. 4xx), or a name.' };

  // class form like 4xx / 4XX / 4**
  const clsMatch = /^([1-5])(?:xx|XX|\*\*)$/.exec(s);
  if (clsMatch) {
    const d = Number(clsMatch[1] ?? '');
    const codes = CODES.filter((c) => classOf(c.code) === d);
    return { ok: true, kind: 'class', cls: d, codes };
  }

  // pure number
  if (/^\d{3}$/.test(s)) {
    const n = Number(s);
    const found = CODES.find((c) => c.code === n);
    if (found) return { ok: true, kind: 'single', code: found };
    const d = classOf(n);
    if (CLASSES[d]) {
      return {
        ok: false,
        error: `${n} is not a well-known code, but it is a ${d}xx (${CLASSES[d]?.name}) response.`,
      };
    }
    return { ok: false, error: `${n} is outside the valid 100–599 status range.` };
  }

  // name / keyword search
  const needle = s.toLowerCase().replace(/[\s-]+/g, '_');
  const exact = CODES.find(
    (c) => c.constant.toLowerCase() === needle || c.phrase.toLowerCase() === s.toLowerCase(),
  );
  if (exact) return { ok: true, kind: 'single', code: exact };

  const fuzzy = CODES.filter((c) =>
    `${c.constant} ${c.phrase} ${c.note}`.toLowerCase().includes(s.toLowerCase()),
  );
  const first = fuzzy[0];
  if (first) return { ok: true, kind: 'single', code: first };

  return { ok: false, error: `No status code matches “${raw}”.` };
}

export default function StatusCodeExplainerTool() {
  const [query, setQuery] = useState('404');
  const result = useMemo(() => lookup(query), [query]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field
            label="Code, class, or name"
            hint="Try: 418 · 429 · 5xx · TOO_MANY_REQUESTS · teapot"
            className="min-w-[280px] flex-1"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="404"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok && <ErrorBanner error={result.error} />}

      {result.ok && result.kind === 'single' && (
        <SingleView code={result.code} />
      )}

      {result.ok && result.kind === 'class' && (
        <Panel>
          <PanelHeader title={`${result.cls}xx — ${CLASSES[result.cls]?.name ?? 'Unknown'}`}>
            <CopyButton
              value={() => result.codes.map((c) => `${c.code} ${c.phrase}`).join('\n')}
            />
          </PanelHeader>
          <p className="px-3 pt-3 text-sm text-muted-foreground">
            {CLASSES[result.cls]?.desc}
          </p>
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.codes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setQuery(String(c.code))}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
              >
                <code className="w-12 shrink-0 font-mono text-sm font-semibold">{c.code}</code>
                <span className="w-56 shrink-0 text-sm">{c.phrase}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {c.note}
                </span>
              </button>
            ))}
          </div>
          <StatBar items={[`${result.codes.length} codes in class`]} />
        </Panel>
      )}
    </div>
  );
}

function SingleView({ code }: { code: Code }) {
  const cls = classOf(code.code);
  const clsInfo = CLASSES[cls];
  const statusLine = `HTTP/1.1 ${code.code} ${code.phrase}`;
  const express = `res.status(${code.code}).${
    code.bodyExpected ? `json({ error: '${code.phrase}' })` : 'end()'
  };`;

  const colorByClass: Record<number, string> = {
    1: 'text-sky-600 dark:text-sky-400',
    2: 'text-emerald-600 dark:text-emerald-400',
    3: 'text-amber-600 dark:text-amber-400',
    4: 'text-orange-600 dark:text-orange-400',
    5: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <Panel>
      <PanelHeader title="Status code">
        <CopyButton value={() => `${statusLine}\n${code.note}`} />
      </PanelHeader>
      <div className="space-y-4 p-4">
        <div className="flex items-baseline gap-3">
          <span className={cn('font-mono text-4xl font-bold', colorByClass[cls])}>
            {code.code}
          </span>
          <span className="text-xl font-medium">{code.phrase}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Class" value={`${cls}xx ${clsInfo?.name ?? ''}`} />
          <Stat label="Constant" value={code.constant} mono />
          <Stat label="Cacheable by default" value={code.cacheable ? 'Yes' : 'No'} />
          <Stat label="Body expected" value={code.bodyExpected ? 'Yes' : 'No'} />
        </div>

        <p className="text-sm leading-relaxed">{code.note}</p>
        {clsInfo && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{cls}xx {clsInfo.name}:</span> {clsInfo.desc}
          </p>
        )}

        <Snippet label="Status line" value={statusLine} />
        <Snippet label="Express / Node snippet" value={express} />
      </div>
    </Panel>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('text-sm', mono && 'font-mono text-xs')}>{value}</div>
    </div>
  );
}

function Snippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-xs">{value}</code>
        <CopyButton value={value} size="icon-sm" />
      </div>
    </div>
  );
}
