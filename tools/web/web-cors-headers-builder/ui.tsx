'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
type Method = (typeof METHODS)[number];

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CorsHeadersBuilderTool() {
  const [origin, setOrigin] = useState('https://app.example.com');
  const [methods, setMethods] = useState<Record<Method, boolean>>({
    GET: true,
    POST: true,
    PUT: false,
    PATCH: false,
    DELETE: false,
    OPTIONS: true,
  });
  const [allowHeaders, setAllowHeaders] = useState('Content-Type, Authorization');
  const [exposeHeaders, setExposeHeaders] = useState('');
  const [credentials, setCredentials] = useState(true);
  const [maxAge, setMaxAge] = useState('86400');

  const result = useMemo(() => {
    const warnings: string[] = [];
    const lines: string[] = [];

    const trimmedOrigin = origin.trim() || '*';
    const isWildcardOrigin = trimmedOrigin === '*';
    const selMethods = METHODS.filter((m) => methods[m]);
    const headerList = splitList(allowHeaders);
    const headersWildcard = headerList.includes('*');

    lines.push(`Access-Control-Allow-Origin: ${trimmedOrigin}`);

    if (selMethods.length > 0) {
      lines.push(`Access-Control-Allow-Methods: ${selMethods.join(', ')}`);
    } else {
      warnings.push('No methods selected; preflight will reject all requests.');
    }

    if (headerList.length > 0) {
      lines.push(`Access-Control-Allow-Headers: ${headerList.join(', ')}`);
    }

    const exposeList = splitList(exposeHeaders);
    if (exposeList.length > 0) {
      lines.push(`Access-Control-Expose-Headers: ${exposeList.join(', ')}`);
    }

    if (credentials) {
      lines.push('Access-Control-Allow-Credentials: true');
    }

    const maxAgeNum = Number(maxAge);
    if (maxAge.trim()) {
      if (Number.isFinite(maxAgeNum) && Number.isInteger(maxAgeNum) && maxAgeNum >= 0) {
        lines.push(`Access-Control-Max-Age: ${maxAgeNum}`);
      } else {
        warnings.push('Max-Age must be a non-negative integer number of seconds; ignored.');
      }
    }

    // Credentials incompatibilities
    if (credentials) {
      if (isWildcardOrigin) {
        warnings.push(
          'Allow-Credentials:true is incompatible with Origin "*". Echo the request Origin instead (and add Vary: Origin).',
        );
      }
      if (headersWildcard) {
        warnings.push('Allow-Credentials:true makes "*" in Allow-Headers be treated literally — list real header names.');
      }
      if (exposeList.includes('*')) {
        warnings.push('Allow-Credentials:true makes "*" in Expose-Headers be treated literally — list real header names.');
      }
    }
    if (!isWildcardOrigin && trimmedOrigin.includes(',')) {
      warnings.push('Allow-Origin accepts a single value — choose one origin per response (echo the request Origin to support many).');
    }

    // Preflight example
    const preflight: string[] = [];
    preflight.push('HTTP/1.1 204 No Content');
    preflight.push(`Access-Control-Allow-Origin: ${trimmedOrigin}`);
    if (selMethods.length > 0) preflight.push(`Access-Control-Allow-Methods: ${selMethods.join(', ')}`);
    if (headerList.length > 0) preflight.push(`Access-Control-Allow-Headers: ${headerList.join(', ')}`);
    if (credentials) preflight.push('Access-Control-Allow-Credentials: true');
    if (maxAge.trim() && Number.isInteger(maxAgeNum) && maxAgeNum >= 0) {
      preflight.push(`Access-Control-Max-Age: ${maxAgeNum}`);
    }
    if (!isWildcardOrigin) preflight.push('Vary: Origin');

    return { headers: lines.join('\n'), preflight: preflight.join('\n'), warnings };
  }, [origin, methods, allowHeaders, exposeHeaders, credentials, maxAge]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Policy" />
        <div className="space-y-4 p-3">
          <OptionsBar>
            <Field label="Allowed origin" className="min-w-[260px] flex-1">
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="https://app.example.com or *"
                className="font-mono"
              />
            </Field>
            <Field label="Max-Age (seconds)" className="w-40">
              <Input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} className="font-mono" />
            </Field>
          </OptionsBar>

          <Field label="Allowed methods">
            <div className="flex flex-wrap gap-3">
              {METHODS.map((m) => (
                <Label key={m} className="flex items-center gap-2 text-sm font-normal">
                  <Switch
                    checked={methods[m]}
                    onCheckedChange={(c) => setMethods((prev) => ({ ...prev, [m]: c }))}
                  />
                  <code className="font-mono text-xs">{m}</code>
                </Label>
              ))}
            </div>
          </Field>

          <OptionsBar>
            <Field label="Allowed request headers" className="min-w-[240px] flex-1">
              <Input
                value={allowHeaders}
                onChange={(e) => setAllowHeaders(e.target.value)}
                placeholder="Content-Type, Authorization"
                className="font-mono"
              />
            </Field>
            <Field label="Exposed response headers" className="min-w-[240px] flex-1">
              <Input
                value={exposeHeaders}
                onChange={(e) => setExposeHeaders(e.target.value)}
                placeholder="X-Request-Id, X-Total-Count"
                className="font-mono"
              />
            </Field>
          </OptionsBar>

          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch checked={credentials} onCheckedChange={setCredentials} /> Allow credentials (cookies / auth)
          </Label>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Response headers">
          <CopyButton value={() => result.headers} label="Copy" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{result.headers}</pre>
        <StatBar items={[`${result.headers.split('\n').length} header line(s)`]} />
      </Panel>

      {result.warnings.length > 0 && (
        <Panel>
          <PanelHeader title="Warnings" />
          <ul className="space-y-1 p-3 text-xs text-amber-600 dark:text-amber-500">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Preflight OPTIONS response example">
          <CopyButton value={() => result.preflight} label="Copy" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{result.preflight}</pre>
      </Panel>
    </div>
  );
}
