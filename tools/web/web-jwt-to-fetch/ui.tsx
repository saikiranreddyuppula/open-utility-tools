'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthScheme = 'none' | 'bearer' | 'apikey';

interface Header {
  id: number;
  key: string;
  value: string;
}

let nextId = 10;

function jsString(s: string): string {
  return JSON.stringify(s);
}

export default function FetchBuilderTool() {
  const [url, setUrl] = useState('https://api.example.com/v1/users');
  const [method, setMethod] = useState<Method>('POST');
  const [authScheme, setAuthScheme] = useState<AuthScheme>('bearer');
  const [token, setToken] = useState('YOUR_TOKEN_HERE');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [headers, setHeaders] = useState<Header[]>([
    { id: 1, key: 'Accept', value: 'application/json' },
  ]);
  const [body, setBody] = useState('{\n  "name": "Ada",\n  "role": "admin"\n}');
  const [useBody, setUseBody] = useState(true);

  const addHeader = () =>
    setHeaders((h) => [...h, { id: nextId++, key: '', value: '' }]);

  const result = useMemo<
    { error: string } | { code: string; warning: string | null }
  >(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { error: 'Enter a request URL.' };

    const bodyAllowed = method !== 'GET' && method !== 'DELETE';
    const wantBody = useBody && body.trim() !== '';
    let warning: string | null = null;
    let bodyLiteral = '';

    if (wantBody) {
      try {
        const parsed: unknown = JSON.parse(body);
        bodyLiteral = JSON.stringify(parsed, null, 2);
      } catch {
        return { error: 'Request body is not valid JSON.' };
      }
      if (!bodyAllowed) {
        warning = `${method} requests cannot have a body; it will be ignored by most servers.`;
      }
    }

    // Build headers object
    const headerLines: string[] = [];
    const explicit = headers.filter((h) => h.key.trim());
    const hasContentType = explicit.some(
      (h) => h.key.trim().toLowerCase() === 'content-type',
    );
    if (wantBody && !hasContentType) {
      headerLines.push(`    'Content-Type': ${jsString('application/json')},`);
    }
    if (authScheme === 'bearer') {
      headerLines.push(
        `    Authorization: ${jsString(`Bearer ${token.trim() || 'YOUR_TOKEN'}`)},`,
      );
    } else if (authScheme === 'apikey') {
      const hk = apiKeyHeader.trim() || 'X-API-Key';
      headerLines.push(`    ${jsKeyName(hk)}: ${jsString(token.trim() || 'YOUR_API_KEY')},`);
    }
    for (const h of explicit) {
      headerLines.push(`    ${jsKeyName(h.key.trim())}: ${jsString(h.value)},`);
    }

    const optionParts: string[] = [`    method: ${jsString(method)},`];
    if (headerLines.length > 0) {
      optionParts.push(`    headers: {\n${headerLines.map((l) => `  ${l}`).join('\n')}\n    },`);
    }
    if (wantBody) {
      const indentedBody = bodyLiteral
        .split('\n')
        .map((l, i) => (i === 0 ? l : `    ${l}`))
        .join('\n');
      optionParts.push(`    body: JSON.stringify(${indentedBody}),`);
    }

    const code = [
      'async function request() {',
      `  const response = await fetch(${jsString(trimmedUrl)}, {`,
      optionParts.join('\n'),
      '  });',
      '',
      '  if (!response.ok) {',
      '    throw new Error(`HTTP ${response.status}: ${response.statusText}`);',
      '  }',
      '',
      '  return response.json();',
      '}',
      '',
      'request().then(console.log).catch(console.error);',
    ].join('\n');

    return { code, warning };
  }, [url, method, authScheme, token, apiKeyHeader, headers, body, useBody]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Request" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Method">
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as Method[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="URL" className="flex-1 min-w-[260px]">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Auth">
              <Select value={authScheme} onValueChange={(v) => setAuthScheme(v as AuthScheme)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="apikey">API key header</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {authScheme === 'apikey' && (
              <Field label="Header name">
                <Input
                  value={apiKeyHeader}
                  onChange={(e) => setApiKeyHeader(e.target.value)}
                  className="w-40 font-mono"
                />
              </Field>
            )}
            {authScheme !== 'none' && (
              <Field label="Token / key" className="flex-1 min-w-[220px]">
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono"
                />
              </Field>
            )}
          </OptionsBar>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Header name</span>
              <span className="flex-1">Value</span>
              <span className="w-8" />
            </div>
            {headers.map((h) => (
              <div key={h.id} className="flex items-center gap-2">
                <Input
                  value={h.key}
                  onChange={(e) =>
                    setHeaders((hs) => hs.map((x) => (x.id === h.id ? { ...x, key: e.target.value } : x)))
                  }
                  placeholder="Accept"
                  className="flex-1 font-mono"
                />
                <Input
                  value={h.value}
                  onChange={(e) =>
                    setHeaders((hs) => hs.map((x) => (x.id === h.id ? { ...x, value: e.target.value } : x)))
                  }
                  placeholder="application/json"
                  className="flex-1 font-mono"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setHeaders((hs) => hs.filter((x) => x.id !== h.id))}
                  aria-label="Remove header"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={addHeader}>
                <Plus className="size-3.5" /> Add header
              </Button>
            </div>
          </div>

          <OptionsBar>
            <Field label="JSON body" className="flex-1 min-w-[260px]">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
                rows={6}
                className="font-mono"
              />
            </Field>
          </OptionsBar>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useBody}
              onChange={(e) => setUseBody(e.target.checked)}
              id="usebody"
              className="size-4"
            />
            <label htmlFor="usebody">Include request body</label>
          </div>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="fetch() snippet">
            <CopyButton value={() => result.code} label="Copy" />
            <DownloadButton data={() => result.code} filename="request.js" />
          </PanelHeader>
          {result.warning && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-2xs text-amber-700 dark:text-amber-400">
              {result.warning}
            </div>
          )}
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
            {result.code}
          </pre>
          <StatBar items={[`${method}`, `${result.code.length} chars`]} />
        </Panel>
      )}
    </div>
  );
}

function jsKeyName(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
