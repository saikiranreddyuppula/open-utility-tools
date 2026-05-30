'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Scheme = 'http' | 'https' | 'ftp' | 'ws' | 'wss' | 'custom';

interface QueryParam {
  id: number;
  key: string;
  value: string;
}

let qid = 0;
const mkParam = (key: string, value: string): QueryParam => ({ id: qid++, key, value });

interface Part {
  label: string;
  value: string;
}

type Result =
  | { ok: true; url: string; parts: Part[] }
  | { ok: false; error: string };

function encodePath(segments: string, plusSpace: boolean): string {
  // Encode each segment but keep the slashes that separate them.
  const enc = segments
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return plusSpace ? enc : enc.replace(/\+/g, '%20');
}

export default function UrlBuilderTool() {
  const [scheme, setScheme] = useState<Scheme>('https');
  const [customScheme, setCustomScheme] = useState('app');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('api.example.com');
  const [port, setPort] = useState('');
  const [path, setPath] = useState('/v1/users/search');
  const [fragment, setFragment] = useState('section-2');
  const [params, setParams] = useState<QueryParam[]>(() => [
    mkParam('q', 'hello world'),
    mkParam('page', '2'),
  ]);

  const [trailingSlash, setTrailingSlash] = useState(false);
  const [sortParams, setSortParams] = useState(false);
  const [plusSpace, setPlusSpace] = useState(false);

  const update = (id: number, patch: Partial<QueryParam>) =>
    setParams((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: number) => setParams((ps) => ps.filter((p) => p.id !== id));
  const add = () => setParams((ps) => [...ps, mkParam('', '')]);

  const result = useMemo<Result>(() => {
    const sch = (scheme === 'custom' ? customScheme.trim() : scheme).replace(/:$/, '');
    if (!sch || !/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(sch)) {
      return { ok: false, error: 'Scheme must start with a letter (e.g. https, ftp, myapp).' };
    }
    if (!host.trim()) {
      return { ok: false, error: 'Host is required (e.g. example.com).' };
    }

    // Build base authority manually so we can validate with the WHATWG parser.
    let base = `${sch}://`;
    if (username.trim()) {
      base += encodeURIComponent(username.trim());
      if (password) base += `:${encodeURIComponent(password)}`;
      base += '@';
    }
    base += host.trim();
    if (port.trim()) {
      const p = Number(port);
      if (!Number.isInteger(p) || p < 0 || p > 65535) {
        return { ok: false, error: 'Port must be an integer from 0 to 65535.' };
      }
      base += `:${p}`;
    }

    let url: URL;
    try {
      url = new URL(base);
    } catch {
      return { ok: false, error: 'Could not parse the host/authority — check for invalid characters.' };
    }

    // Path
    let rawPath = path.trim();
    if (rawPath && !rawPath.startsWith('/')) rawPath = `/${rawPath}`;
    let encodedPath = rawPath ? encodePath(rawPath, plusSpace) : '/';
    if (trailingSlash && !encodedPath.endsWith('/')) encodedPath += '/';
    url.pathname = encodedPath;

    // Query
    const pairs = params
      .filter((p) => p.key.trim() !== '')
      .map((p) => ({ key: p.key.trim(), value: p.value }));
    const ordered = sortParams
      ? [...pairs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      : pairs;
    const qsParts = ordered.map((p) => {
      const k = encodeURIComponent(p.key);
      let v = encodeURIComponent(p.value);
      if (!plusSpace) v = v.replace(/\+/g, '%20');
      else v = v.replace(/%20/g, '+');
      let key = k;
      if (plusSpace) key = key.replace(/%20/g, '+');
      else key = key.replace(/\+/g, '%20');
      return `${key}=${v}`;
    });
    url.search = qsParts.length ? `?${qsParts.join('&')}` : '';

    // Fragment
    url.hash = fragment.trim() ? `#${encodeURIComponent(fragment.trim()).replace(/%20/g, plusSpace ? '+' : '%20')}` : '';

    const finalUrl = url.toString();

    const parts: Part[] = [
      { label: 'scheme', value: sch },
      { label: 'username', value: username.trim() || '—' },
      { label: 'password', value: password ? '••••••' : '—' },
      { label: 'host', value: host.trim() },
      { label: 'port', value: port.trim() || '(default)' },
      { label: 'path', value: encodedPath },
      { label: 'query', value: url.search || '—' },
      { label: 'fragment', value: url.hash || '—' },
    ];

    return { ok: true, url: finalUrl, parts };
  }, [
    scheme,
    customScheme,
    username,
    password,
    host,
    port,
    path,
    fragment,
    params,
    trailingSlash,
    sortParams,
    plusSpace,
  ]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Scheme" className="min-w-[120px]">
            <Select value={scheme} onValueChange={(v) => setScheme(v as Scheme)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['http', 'https', 'ftp', 'ws', 'wss', 'custom'] as Scheme[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {scheme === 'custom' && (
            <Field label="Custom scheme" className="min-w-[120px]">
              <Input
                value={customScheme}
                onChange={(e) => setCustomScheme(e.target.value)}
                className="w-28 font-mono"
              />
            </Field>
          )}
          <Field label="Host" className="min-w-[200px] flex-1">
            <Input value={host} onChange={(e) => setHost(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Port" className="min-w-[90px]">
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              placeholder="—"
              className="w-20 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="Username" className="min-w-[140px]">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Password" className="min-w-[140px]">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Path" className="min-w-[220px] flex-1">
            <Input value={path} onChange={(e) => setPath(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Fragment" className="min-w-[140px]">
            <Input value={fragment} onChange={(e) => setFragment(e.target.value)} className="font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Query parameters">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {params.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2">
              <Input
                value={p.key}
                onChange={(e) => update(p.id, { key: e.target.value })}
                placeholder="key"
                className="w-40 font-mono"
              />
              <span className="text-muted-foreground">=</span>
              <Input
                value={p.value}
                onChange={(e) => update(p.id, { value: e.target.value })}
                placeholder="value"
                className="flex-1 font-mono"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(p.id)}
                aria-label="Remove parameter"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {params.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">No query parameters.</div>
          )}
        </div>
        <OptionsBar className="rounded-none border-0 border-t">
          <Field label="Trailing slash">
            <Switch checked={trailingSlash} onCheckedChange={setTrailingSlash} />
          </Field>
          <Field label="Sort params">
            <Switch checked={sortParams} onCheckedChange={setSortParams} />
          </Field>
          <Field label="Spaces as +">
            <Switch checked={plusSpace} onCheckedChange={setPlusSpace} />
          </Field>
        </OptionsBar>
      </Panel>

      {result.ok ? (
        <Panel>
          <PanelHeader title="Composed URL">
            <CopyButton value={() => result.url} />
          </PanelHeader>
          <div className="flex items-center gap-2 p-3">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
              {result.url}
            </code>
            <CopyButton value={result.url} />
          </div>
          <div className="divide-y border-t">
            {result.parts.map((p) => (
              <div key={p.label} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-24 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                  {p.label}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-sm">{p.value}</code>
              </div>
            ))}
          </div>
          <StatBar items={[`${result.url.length} chars`]} />
        </Panel>
      ) : (
        <ErrorBanner error={result.error} />
      )}
    </div>
  );
}
