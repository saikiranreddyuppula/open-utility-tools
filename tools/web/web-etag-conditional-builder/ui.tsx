'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
const enc = new TextEncoder();

type Source = 'content' | 'value';

const SAMPLE = 'Hello, conditional caching world!\n';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

/** Format a Date as an RFC 7231 HTTP-date (IMF-fixdate, always GMT). */
function httpDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dow = days[d.getUTCDay()] ?? 'Sun';
  const mon = months[d.getUTCMonth()] ?? 'Jan';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dow}, ${pad(d.getUTCDate())} ${mon} ${d.getUTCFullYear()} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
}

function defaultLastModified(): string {
  // datetime-local format: YYYY-MM-DDTHH:mm
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function EtagConditionalBuilderTool() {
  const [source, setSource] = useState<Source>('content');
  const [content, setContent] = useState(SAMPLE);
  const [rawValue, setRawValue] = useState('33a64df551425fcc55e4d42a148795d9f25f89d4');
  const [weak, setWeak] = useState(false);
  const [lastModified, setLastModified] = useState(defaultLastModified());

  const [hash, setHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = enc.encode(content);
        const buf = await wc.subtle.digest('SHA-1', data as unknown as ArrayBuffer);
        if (!cancelled) {
          setHash(toHex(new Uint8Array(buf)));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to hash content.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content]);

  // Determine the core (unquoted) ETag string.
  const core =
    source === 'content' ? hash : rawValue.trim().replace(/^W\//, '').replace(/^"|"$/g, '');

  const etag = core ? `${weak ? 'W/' : ''}"${core}"` : '';

  // Parse Last-Modified into a Date (datetime-local is local time).
  const lmDate = lastModified ? new Date(lastModified) : null;
  const lmValid = lmDate !== null && !Number.isNaN(lmDate.getTime());
  const lastModifiedHeader = lmValid && lmDate ? httpDate(lmDate) : '';

  const responseHeaders = [
    etag ? `ETag: ${etag}` : '',
    lastModifiedHeader ? `Last-Modified: ${lastModifiedHeader}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const requestHeaders = [
    etag ? `If-None-Match: ${etag}` : '',
    lastModifiedHeader ? `If-Modified-Since: ${lastModifiedHeader}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Inputs" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="ETag from">
              <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content">Hash content (SHA-1)</SelectItem>
                  <SelectItem value="value">Use raw value</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 self-end pb-1">
              <Switch id="weak" checked={weak} onCheckedChange={setWeak} />
              <Label htmlFor="weak" className="text-sm">
                Weak validator (W/)
              </Label>
            </div>
            <Field label="Last-Modified">
              <Input
                type="datetime-local"
                value={lastModified}
                onChange={(e) => setLastModified(e.target.value)}
                className="w-56"
              />
            </Field>
          </OptionsBar>

          {source === 'content' ? (
            <Field label="Content to hash">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                placeholder="Paste the response body to derive a strong ETag…"
                className="min-h-28 font-mono text-sm"
              />
            </Field>
          ) : (
            <Field label="Raw ETag value (unquoted)">
              <Input
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                spellCheck={false}
                placeholder="abc123"
                className="font-mono"
              />
            </Field>
          )}
        </div>
      </Panel>

      {error && <ErrorBanner error={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Response headers (server sends)">
            <CopyButton value={() => responseHeaders} disabled={!responseHeaders} />
          </PanelHeader>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
            {responseHeaders || '—'}
          </pre>
          <StatBar items={[weak ? 'weak ETag' : 'strong ETag', 'first response: 200 OK']} />
        </Panel>

        <Panel>
          <PanelHeader title="Conditional request (client sends next)">
            <CopyButton value={() => requestHeaders} disabled={!requestHeaders} />
          </PanelHeader>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
            {requestHeaders || '—'}
          </pre>
          <StatBar items={['matched: 304 Not Modified', 'changed: 200 OK + new body']} />
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="How 304 works" />
        <div className="space-y-2 p-3 text-sm text-muted-foreground">
          <p>
            The server returns the <code className="font-mono">ETag</code> (and optionally{' '}
            <code className="font-mono">Last-Modified</code>) with the first 200 response. A
            cache stores both the body and these validators.
          </p>
          <p>
            On the next request, the client echoes the ETag in{' '}
            <code className="font-mono">If-None-Match</code> and the date in{' '}
            <code className="font-mono">If-Modified-Since</code>. If the resource is unchanged,
            the server replies <code className="font-mono">304 Not Modified</code> with no body,
            and the client reuses its cached copy. If it changed, the server replies{' '}
            <code className="font-mono">200 OK</code> with the new body and a fresh ETag.
          </p>
          <p>
            A weak validator (<code className="font-mono">W/</code>) signals the entity is
            semantically equivalent but may differ byte-for-byte; it cannot be used for byte-range
            (partial) requests, while a strong validator can.
          </p>
        </div>
      </Panel>
    </div>
  );
}
