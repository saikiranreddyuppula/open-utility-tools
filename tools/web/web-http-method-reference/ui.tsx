'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type YesNo = 'yes' | 'no' | 'optional';

interface Method {
  name: string;
  webdav: boolean;
  desc: string;
  safe: YesNo;
  idempotent: YesNo;
  cacheable: YesNo;
  reqBody: YesNo;
  resBody: YesNo;
  success: string;
  summary: string;
  example: string;
}

const METHODS: Method[] = [
  {
    name: 'GET',
    webdav: false,
    desc: 'Retrieve a representation of the target resource.',
    safe: 'yes',
    idempotent: 'yes',
    cacheable: 'yes',
    reqBody: 'no',
    resBody: 'yes',
    success: '200 OK',
    summary:
      'GET requests transfer a current representation of the target resource. They must not have side effects (safe) and should be used for all read operations.',
    example: 'GET /api/users/42 HTTP/1.1',
  },
  {
    name: 'HEAD',
    webdav: false,
    desc: 'Identical to GET but the server returns only headers, no body.',
    safe: 'yes',
    idempotent: 'yes',
    cacheable: 'yes',
    reqBody: 'no',
    resBody: 'no',
    success: '200 OK',
    summary:
      'HEAD is identical to GET except the server omits the response body. Useful for checking existence, size (Content-Length) or freshness without downloading content.',
    example: 'HEAD /downloads/file.zip HTTP/1.1',
  },
  {
    name: 'POST',
    webdav: false,
    desc: 'Submit data to be processed; often creates a subordinate resource.',
    safe: 'no',
    idempotent: 'no',
    cacheable: 'optional',
    reqBody: 'yes',
    resBody: 'yes',
    success: '201 Created / 200 OK',
    summary:
      'POST asks the target resource to process the enclosed representation according to its own semantics. It is neither safe nor idempotent; resubmitting may create duplicates. Cacheable only with explicit freshness headers.',
    example: 'POST /api/users HTTP/1.1',
  },
  {
    name: 'PUT',
    webdav: false,
    desc: 'Replace the target resource with the request payload.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'yes',
    resBody: 'optional',
    success: '200 OK / 201 Created / 204 No Content',
    summary:
      'PUT creates or fully replaces the target resource with the supplied representation. It is idempotent: sending the same PUT repeatedly yields the same final state.',
    example: 'PUT /api/users/42 HTTP/1.1',
  },
  {
    name: 'PATCH',
    webdav: false,
    desc: 'Apply a partial modification to a resource.',
    safe: 'no',
    idempotent: 'no',
    cacheable: 'no',
    reqBody: 'yes',
    resBody: 'optional',
    success: '200 OK / 204 No Content',
    summary:
      'PATCH applies a set of partial changes described by the request body (e.g. JSON Patch / JSON Merge Patch). Not guaranteed idempotent unless the patch format makes it so.',
    example: 'PATCH /api/users/42 HTTP/1.1',
  },
  {
    name: 'DELETE',
    webdav: false,
    desc: 'Remove the target resource.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'optional',
    resBody: 'optional',
    success: '200 OK / 202 Accepted / 204 No Content',
    summary:
      'DELETE requests removal of the target resource. Idempotent: deleting an already-deleted resource still leaves it deleted (often returning 404 thereafter).',
    example: 'DELETE /api/users/42 HTTP/1.1',
  },
  {
    name: 'OPTIONS',
    webdav: false,
    desc: 'Describe the communication options for the target resource.',
    safe: 'yes',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'optional',
    resBody: 'optional',
    success: '200 OK / 204 No Content',
    summary:
      'OPTIONS returns the methods and capabilities supported (via the Allow header) and is the basis of CORS preflight requests.',
    example: 'OPTIONS /api/users HTTP/1.1',
  },
  {
    name: 'CONNECT',
    webdav: false,
    desc: 'Establish a tunnel to the server identified by the target.',
    safe: 'no',
    idempotent: 'no',
    cacheable: 'no',
    reqBody: 'no',
    resBody: 'yes',
    success: '200 (Connection established)',
    summary:
      'CONNECT asks a proxy to establish a TCP tunnel to the destination, most commonly to relay TLS (HTTPS) traffic.',
    example: 'CONNECT example.com:443 HTTP/1.1',
  },
  {
    name: 'TRACE',
    webdav: false,
    desc: 'Perform a message loop-back test along the path to the resource.',
    safe: 'yes',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'no',
    resBody: 'yes',
    success: '200 OK',
    summary:
      'TRACE echoes the received request so the client can see what changed along the chain. Often disabled because it can enable Cross-Site Tracing attacks.',
    example: 'TRACE /path HTTP/1.1',
  },
  {
    name: 'PROPFIND',
    webdav: true,
    desc: 'WebDAV: retrieve properties of a resource or collection.',
    safe: 'yes',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'optional',
    resBody: 'yes',
    success: '207 Multi-Status',
    summary:
      'WebDAV (RFC 4918) PROPFIND retrieves properties (metadata) of a resource or, for a collection, its members. Returns 207 Multi-Status XML.',
    example: 'PROPFIND /dav/folder/ HTTP/1.1',
  },
  {
    name: 'PROPPATCH',
    webdav: true,
    desc: 'WebDAV: set or remove properties on a resource.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'yes',
    resBody: 'yes',
    success: '207 Multi-Status',
    summary:
      'WebDAV PROPPATCH sets and/or removes multiple properties on a resource in a single atomic request.',
    example: 'PROPPATCH /dav/file.txt HTTP/1.1',
  },
  {
    name: 'MKCOL',
    webdav: true,
    desc: 'WebDAV: create a new collection (directory).',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'optional',
    resBody: 'optional',
    success: '201 Created',
    summary:
      'WebDAV MKCOL creates a new collection (the WebDAV equivalent of making a directory) at the request URI.',
    example: 'MKCOL /dav/newfolder/ HTTP/1.1',
  },
  {
    name: 'COPY',
    webdav: true,
    desc: 'WebDAV: copy a resource to the Destination URI.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'no',
    resBody: 'optional',
    success: '201 Created / 204 No Content',
    summary:
      'WebDAV COPY duplicates a resource to the location given in the Destination header.',
    example: 'COPY /dav/a.txt HTTP/1.1',
  },
  {
    name: 'MOVE',
    webdav: true,
    desc: 'WebDAV: move a resource to the Destination URI.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'no',
    resBody: 'optional',
    success: '201 Created / 204 No Content',
    summary:
      'WebDAV MOVE relocates (and effectively renames) a resource to the Destination header URI.',
    example: 'MOVE /dav/a.txt HTTP/1.1',
  },
  {
    name: 'LOCK',
    webdav: true,
    desc: 'WebDAV: take out a lock on a resource.',
    safe: 'no',
    idempotent: 'no',
    cacheable: 'no',
    reqBody: 'optional',
    resBody: 'yes',
    success: '200 OK',
    summary:
      'WebDAV LOCK applies a lock (typically a write lock) to a resource and returns a lock token for subsequent edits.',
    example: 'LOCK /dav/file.txt HTTP/1.1',
  },
  {
    name: 'UNLOCK',
    webdav: true,
    desc: 'WebDAV: remove a lock from a resource.',
    safe: 'no',
    idempotent: 'yes',
    cacheable: 'no',
    reqBody: 'no',
    resBody: 'optional',
    success: '204 No Content',
    summary:
      'WebDAV UNLOCK removes the lock identified by the Lock-Token header from the resource.',
    example: 'UNLOCK /dav/file.txt HTTP/1.1',
  },
];

function yn(v: YesNo): { label: string; cls: string } {
  if (v === 'yes') return { label: 'Yes', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (v === 'no') return { label: 'No', cls: 'text-rose-600 dark:text-rose-400' };
  return { label: 'Optional', cls: 'text-amber-600 dark:text-amber-400' };
}

function Cell({ value }: { value: YesNo }) {
  const { label, cls } = yn(value);
  return <span className={cn('font-mono text-xs font-medium', cls)}>{label}</span>;
}

export default function HttpMethodReferenceTool() {
  const [q, setQ] = useState('');
  const [showWebdav, setShowWebdav] = useState(false);
  const [selected, setSelected] = useState<string | null>('GET');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return METHODS.filter((m) => {
      if (!showWebdav && m.webdav) return false;
      if (!s) return true;
      return `${m.name} ${m.desc} ${m.success}`.toLowerCase().includes(s);
    });
  }, [q, showWebdav]);

  const active = useMemo(
    () => METHODS.find((m) => m.name === selected) ?? null,
    [selected],
  );

  const expressSnippet = active
    ? `res.set('Allow', '${active.name}').sendStatus(405); // example guard`
    : '';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="HTTP Methods">
          <label className="mr-auto flex cursor-pointer items-center gap-2 pl-1 text-2xs text-muted-foreground">
            <Switch checked={showWebdav} onCheckedChange={setShowWebdav} id="webdav" />
            Show WebDAV
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="h-7 w-44"
            spellCheck={false}
          />
        </PanelHeader>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-2xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Safe</th>
                <th className="px-3 py-2 font-medium">Idempotent</th>
                <th className="px-3 py-2 font-medium">Cacheable</th>
                <th className="px-3 py-2 font-medium">Req body</th>
                <th className="px-3 py-2 font-medium">Res body</th>
                <th className="px-3 py-2 font-medium">Success</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.name}
                  onClick={() => setSelected(m.name)}
                  className={cn(
                    'cursor-pointer border-b last:border-0 hover:bg-muted/40',
                    selected === m.name && 'bg-muted/50',
                  )}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs font-semibold">{m.name}</span>
                    {m.webdav && (
                      <Badge variant="secondary" className="ml-2 text-2xs">
                        DAV
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Cell value={m.safe} />
                  </td>
                  <td className="px-3 py-2">
                    <Cell value={m.idempotent} />
                  </td>
                  <td className="px-3 py-2">
                    <Cell value={m.cacheable} />
                  </td>
                  <td className="px-3 py-2">
                    <Cell value={m.reqBody} />
                  </td>
                  <td className="px-3 py-2">
                    <Cell value={m.resBody} />
                  </td>
                  <td className="px-3 py-2 font-mono text-2xs text-muted-foreground">
                    {m.success}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No methods match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <StatBar
          items={[`${rows.length} methods`, showWebdav ? 'incl. WebDAV' : 'core only']}
        />
      </Panel>

      {active && (
        <Panel>
          <PanelHeader title={`${active.name} — details`}>
            <CopyButton value={() => `${active.example}\n\n${active.summary}`} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <p className="text-sm leading-relaxed">{active.summary}</p>
            <div className="space-y-1">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Example request line
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <code className="flex-1 font-mono text-xs">{active.example}</code>
                <CopyButton value={active.example} size="icon-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Express guard snippet
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <code className="flex-1 font-mono text-xs">{expressSnippet}</code>
                <CopyButton value={expressSnippet} size="icon-sm" />
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
