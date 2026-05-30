'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
type BodyMode = 'none' | 'raw' | 'json' | 'form';

interface HeaderRow {
  id: number;
  key: string;
  value: string;
}

interface FormRow {
  id: number;
  key: string;
  value: string;
}

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** Single-quote a value for POSIX shells, escaping embedded single quotes. */
function shq(value: string): string {
  if (value === '') return "''";
  // Safe characters need no quoting; otherwise wrap in single quotes.
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

let nextId = 1;
function makeId(): number {
  nextId += 1;
  return nextId;
}

export default function CurlCommandBuilderTool() {
  const [method, setMethod] = useState<Method>('POST');
  const [url, setUrl] = useState('https://api.example.com/v1/users');
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { id: makeId(), key: 'Accept', value: 'application/json' },
  ]);
  const [bodyMode, setBodyMode] = useState<BodyMode>('json');
  const [rawBody, setRawBody] = useState('');
  const [jsonBody, setJsonBody] = useState('{\n  "name": "Ada",\n  "role": "admin"\n}');
  const [formRows, setFormRows] = useState<FormRow[]>([
    { id: makeId(), key: 'file', value: '@./photo.png' },
  ]);
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [follow, setFollow] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [silent, setSilent] = useState(false);
  const [outFile, setOutFile] = useState('');

  const addHeader = () =>
    setHeaders((rows) => [...rows, { id: makeId(), key: '', value: '' }]);
  const updHeader = (id: number, patch: Partial<HeaderRow>) =>
    setHeaders((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delHeader = (id: number) =>
    setHeaders((rows) => rows.filter((r) => r.id !== id));

  const addForm = () =>
    setFormRows((rows) => [...rows, { id: makeId(), key: '', value: '' }]);
  const updForm = (id: number, patch: Partial<FormRow>) =>
    setFormRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delForm = (id: number) =>
    setFormRows((rows) => rows.filter((r) => r.id !== id));

  const result = useMemo((): { error: string } | { command: string } => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return { error: 'Enter a request URL.' };

    const lines: string[] = ['curl'];

    // Method: only emit -X when it differs from curl's implied default.
    const sendsBody = bodyMode !== 'none';
    const impliedMethod = sendsBody ? 'POST' : 'GET';
    if (method !== impliedMethod) {
      lines.push(`-X ${method}`);
    }

    // Auth
    if (authUser.trim() || authPass) {
      lines.push(`-u ${shq(`${authUser}:${authPass}`)}`);
    }

    // Headers (build a working copy so JSON mode can auto-add Content-Type)
    const hdrs = headers
      .filter((h) => h.key.trim() !== '')
      .map((h) => `${h.key.trim()}: ${h.value}`);

    if (bodyMode === 'json') {
      const hasCT = hdrs.some((h) => /^content-type\s*:/i.test(h));
      if (!hasCT) hdrs.push('Content-Type: application/json');
    }
    for (const h of hdrs) {
      lines.push(`-H ${shq(h)}`);
    }

    // Body
    if (bodyMode === 'raw') {
      if (rawBody !== '') lines.push(`--data-raw ${shq(rawBody)}`);
    } else if (bodyMode === 'json') {
      // Validate JSON to surface mistakes early; still emit the raw text.
      if (jsonBody.trim() !== '') {
        try {
          JSON.parse(jsonBody);
        } catch {
          return { error: 'JSON body is not valid JSON. Fix it or switch to Raw.' };
        }
        lines.push(`--data ${shq(jsonBody)}`);
      }
    } else if (bodyMode === 'form') {
      for (const f of formRows) {
        const key = f.key.trim();
        if (key === '') continue;
        lines.push(`-F ${shq(`${key}=${f.value}`)}`);
      }
    }

    // Boolean flags
    if (follow) lines.push('-L');
    if (insecure) lines.push('-k');
    if (silent) lines.push('-s');
    if (outFile.trim()) lines.push(`-o ${shq(outFile.trim())}`);

    // URL always last
    lines.push(shq(trimmedUrl));

    const command = lines.join(' \\\n  ');
    return { command };
  }, [
    method,
    url,
    headers,
    bodyMode,
    rawBody,
    jsonBody,
    formRows,
    authUser,
    authPass,
    follow,
    insecure,
    silent,
    outFile,
  ]);

  const command = 'command' in result ? result.command : '';

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Request" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Method">
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="URL" className="min-w-[280px] flex-1">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                spellCheck={false}
                className="font-mono"
                placeholder="https://api.example.com/path"
              />
            </Field>
          </OptionsBar>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Headers</Label>
              <Button variant="ghost" size="sm" onClick={addHeader}>
                <Plus className="size-3.5" /> Add header
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {headers.map((h) => (
                <div key={h.id} className="flex items-center gap-2">
                  <Input
                    value={h.key}
                    onChange={(e) => updHeader(h.id, { key: e.target.value })}
                    placeholder="Header-Name"
                    spellCheck={false}
                    className="w-48 font-mono"
                  />
                  <Input
                    value={h.value}
                    onChange={(e) => updHeader(h.id, { value: e.target.value })}
                    placeholder="value"
                    spellCheck={false}
                    className="flex-1 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => delHeader(h.id)}
                    aria-label="Remove header"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              {headers.length === 0 && (
                <p className="text-2xs text-muted-foreground">No headers.</p>
              )}
            </div>
          </div>

          <OptionsBar>
            <Field label="Basic auth user">
              <Input
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                placeholder="username"
                spellCheck={false}
                className="w-40"
              />
            </Field>
            <Field label="Basic auth password">
              <Input
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                placeholder="password"
                spellCheck={false}
                className="w-40"
              />
            </Field>
            <Field label="Output to file (-o)">
              <Input
                value={outFile}
                onChange={(e) => setOutFile(e.target.value)}
                placeholder="response.json"
                spellCheck={false}
                className="w-44 font-mono"
              />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <div className="flex items-center gap-2">
              <Switch id="follow" checked={follow} onCheckedChange={setFollow} />
              <Label htmlFor="follow" className="text-sm">
                Follow redirects (-L)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="insecure" checked={insecure} onCheckedChange={setInsecure} />
              <Label htmlFor="insecure" className="text-sm">
                Insecure (-k)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="silent" checked={silent} onCheckedChange={setSilent} />
              <Label htmlFor="silent" className="text-sm">
                Silent (-s)
              </Label>
            </div>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Body" />
        <div className="flex flex-col gap-3 p-3">
          <OptionsBar>
            <Field label="Body type">
              <Select value={bodyMode} onValueChange={(v) => setBodyMode(v as BodyMode)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="form">Form (-F)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          {bodyMode === 'raw' && (
            <Textarea
              value={rawBody}
              onChange={(e) => setRawBody(e.target.value)}
              spellCheck={false}
              placeholder="key=value&other=thing"
              className="min-h-24 font-mono text-sm"
            />
          )}
          {bodyMode === 'json' && (
            <Textarea
              value={jsonBody}
              onChange={(e) => setJsonBody(e.target.value)}
              spellCheck={false}
              placeholder='{"key":"value"}'
              className="min-h-28 font-mono text-sm"
            />
          )}
          {bodyMode === 'form' && (
            <div className="flex flex-col gap-2">
              {formRows.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input
                    value={f.key}
                    onChange={(e) => updForm(f.id, { key: e.target.value })}
                    placeholder="field"
                    spellCheck={false}
                    className="w-44 font-mono"
                  />
                  <Input
                    value={f.value}
                    onChange={(e) => updForm(f.id, { value: e.target.value })}
                    placeholder="value or @file"
                    spellCheck={false}
                    className="flex-1 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => delForm(f.id)}
                    aria-label="Remove field"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addForm} className="self-start">
                <Plus className="size-3.5" /> Add field
              </Button>
            </div>
          )}
          {bodyMode === 'none' && (
            <p className="text-2xs text-muted-foreground">No request body.</p>
          )}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="curl command">
            <CopyButton value={() => command} />
          </PanelHeader>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
            {command}
          </pre>
          <StatBar
            items={[
              method,
              `${headers.filter((h) => h.key.trim()).length} header(s)`,
              `body: ${bodyMode}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
