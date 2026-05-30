'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'bearer' | 'basic' | 'apikey' | 'digest';

/** UTF-8 safe base64 of an arbitrary string (handles non-ASCII). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

interface Built {
  headerName: string;
  headerValue: string;
  note?: string;
}

export default function AuthHeaderBuilderTool() {
  const [mode, setMode] = useState<Mode>('bearer');

  // Bearer
  const [token, setToken] = useState('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc123');

  // Basic
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('s3cr3t');

  // API key
  const [keyHeader, setKeyHeader] = useState('X-API-Key');
  const [keyScheme, setKeyScheme] = useState('');
  const [keyValue, setKeyValue] = useState('sk_live_5f8a2b1c9d');

  // Digest scaffold
  const [realm, setRealm] = useState('api@example.com');
  const [nonce, setNonce] = useState('dcd98b7102dd2f0e8b11d0f600bfb0c093');
  const [uri, setUri] = useState('/v1/resource');
  const [digestUser, setDigestUser] = useState('alice');

  const built = useMemo<{ ok: true; value: Built } | { ok: false; error: string }>(() => {
    switch (mode) {
      case 'bearer': {
        const t = token.trim();
        if (!t) return { ok: false, error: 'Enter a token.' };
        return { ok: true, value: { headerName: 'Authorization', headerValue: `Bearer ${t}` } };
      }
      case 'basic': {
        if (user.includes(':'))
          return { ok: false, error: 'The username cannot contain a colon (":").' };
        const encoded = utf8ToBase64(`${user}:${pass}`);
        return {
          ok: true,
          value: {
            headerName: 'Authorization',
            headerValue: `Basic ${encoded}`,
            note: `base64("${user}:${pass.replace(/./g, '•')}")`,
          },
        };
      }
      case 'apikey': {
        const name = keyHeader.trim() || 'X-API-Key';
        const v = keyValue.trim();
        if (!v) return { ok: false, error: 'Enter an API key value.' };
        const scheme = keyScheme.trim();
        const value = scheme ? `${scheme} ${v}` : v;
        return { ok: true, value: { headerName: name, headerValue: value } };
      }
      case 'digest': {
        const value =
          `Digest username="${digestUser}", realm="${realm}", nonce="${nonce}", ` +
          `uri="${uri}", response="<MD5-digest>", qop=auth, nc=00000001, cnonce="<client-nonce>"`;
        return {
          ok: true,
          value: {
            headerName: 'Authorization',
            headerValue: value,
            note: 'Scaffold only — the response digest must be computed by the client per RFC 7616.',
          },
        };
      }
      default:
        return { ok: false, error: 'Unknown mode.' };
    }
  }, [mode, token, user, pass, keyHeader, keyScheme, keyValue, realm, nonce, uri, digestUser]);

  const headerLine = built.ok ? `${built.value.headerName}: ${built.value.headerValue}` : '';
  const curl = built.ok ? `curl -H '${headerLine}' https://api.example.com/` : '';
  const fetchObj = built.ok
    ? `fetch('https://api.example.com/', {\n  headers: {\n    '${built.value.headerName}': '${built.value.headerValue.replace(/'/g, "\\'")}',\n  },\n});`
    : '';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Scheme">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="bearer">Bearer</TabsTrigger>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="apikey">API key</TabsTrigger>
                <TabsTrigger value="digest">Digest</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Inputs" />
        <div className="space-y-3 p-3">
          {mode === 'bearer' && (
            <Field label="Token">
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                spellCheck={false}
                className="font-mono text-xs"
              />
            </Field>
          )}

          {mode === 'basic' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Username">
                <Input value={user} onChange={(e) => setUser(e.target.value)} spellCheck={false} />
              </Field>
              <Field label="Password">
                <Input value={pass} onChange={(e) => setPass(e.target.value)} spellCheck={false} />
              </Field>
            </div>
          )}

          {mode === 'apikey' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Header name">
                <Input
                  value={keyHeader}
                  onChange={(e) => setKeyHeader(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Scheme word (optional)" hint="e.g. ApiKey, Token — leave blank for raw">
                <Input
                  value={keyScheme}
                  onChange={(e) => setKeyScheme(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Key value">
                <Input
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
          )}

          {mode === 'digest' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Username">
                <Input
                  value={digestUser}
                  onChange={(e) => setDigestUser(e.target.value)}
                  spellCheck={false}
                />
              </Field>
              <Field label="Realm">
                <Input value={realm} onChange={(e) => setRealm(e.target.value)} spellCheck={false} />
              </Field>
              <Field label="Nonce">
                <Input
                  value={nonce}
                  onChange={(e) => setNonce(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="URI">
                <Input
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
          )}
        </div>
      </Panel>

      {!built.ok ? (
        <ErrorBanner error={built.error} />
      ) : (
        <Panel>
          <PanelHeader title="Output">
            <CopyButton value={() => headerLine} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <Out label="Header line" value={headerLine} />
            <Out label="curl" value={curl} />
            <Out label="fetch() headers" value={fetchObj} multiline />
            {built.value.note && (
              <p className="text-2xs text-muted-foreground">{built.value.note}</p>
            )}
          </div>
          <StatBar items={[`scheme: ${mode}`, `${headerLine.length} chars`]} />
        </Panel>
      )}
    </div>
  );
}

function Out({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <code
          className={
            multiline
              ? 'flex-1 whitespace-pre-wrap break-all font-mono text-xs'
              : 'flex-1 overflow-x-auto whitespace-pre break-all font-mono text-xs'
          }
        >
          {value}
        </code>
        <CopyButton value={value} size="icon-sm" />
      </div>
    </div>
  );
}
