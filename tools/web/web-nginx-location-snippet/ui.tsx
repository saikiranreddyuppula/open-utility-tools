'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function NginxSnippetGenerator() {
  const [serverName, setServerName] = useState('example.com');
  const [port, setPort] = useState('80');
  const [root, setRoot] = useState('/var/www/html');
  const [upstream, setUpstream] = useState('http://127.0.0.1:3000');
  const [cacheDays, setCacheDays] = useState('30');

  const [reverseProxy, setReverseProxy] = useState(false);
  const [spa, setSpa] = useState(true);
  const [httpsRedirect, setHttpsRedirect] = useState(true);
  const [gzip, setGzip] = useState(true);
  const [staticCache, setStaticCache] = useState(true);
  const [rateLimit, setRateLimit] = useState(false);

  const config = useMemo(() => {
    const top: string[] = [];
    const server: string[] = [];

    if (rateLimit) {
      top.push('# Define a rate-limit zone (place in the http {} block)');
      top.push('limit_req_zone $binary_remote_addr zone=req_limit:10m rate=10r/s;');
      top.push('');
    }

    server.push('server {');
    server.push(`    listen ${port.trim() || '80'};`);
    server.push(`    server_name ${serverName.trim() || '_'};`);
    server.push('');

    if (httpsRedirect) {
      server.push('    # Redirect all HTTP traffic to HTTPS');
      server.push('    return 301 https://$host$request_uri;');
      server.push('}');
      server.push('');
      // Emit a second server block for the HTTPS side.
      server.push('server {');
      server.push('    listen 443 ssl http2;');
      server.push(`    server_name ${serverName.trim() || '_'};`);
      server.push('');
      server.push('    # ssl_certificate     /etc/ssl/certs/your.crt;');
      server.push('    # ssl_certificate_key /etc/ssl/private/your.key;');
      server.push('');
    }

    server.push(`    root ${root.trim() || '/var/www/html'};`);
    server.push('    index index.html;');
    server.push('');

    if (gzip) {
      server.push('    # Compress text responses on the fly');
      server.push('    gzip on;');
      server.push('    gzip_vary on;');
      server.push('    gzip_min_length 1024;');
      server.push(
        '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;',
      );
      server.push('');
    }

    if (reverseProxy) {
      server.push('    # Forward requests to the upstream application');
      server.push('    location / {');
      if (rateLimit) {
        server.push('        limit_req zone=req_limit burst=20 nodelay;');
      }
      server.push(`        proxy_pass ${upstream.trim() || 'http://127.0.0.1:3000'};`);
      server.push('        proxy_http_version 1.1;');
      server.push('        proxy_set_header Host $host;');
      server.push('        proxy_set_header X-Real-IP $remote_addr;');
      server.push(
        '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      );
      server.push('        proxy_set_header X-Forwarded-Proto $scheme;');
      server.push('        proxy_set_header Upgrade $http_upgrade;');
      server.push('        proxy_set_header Connection "upgrade";');
      server.push('    }');
      server.push('');
    } else if (spa) {
      server.push('    # Single-page app: fall back to index.html for client routing');
      server.push('    location / {');
      if (rateLimit) {
        server.push('        limit_req zone=req_limit burst=20 nodelay;');
      }
      server.push('        try_files $uri $uri/ /index.html;');
      server.push('    }');
      server.push('');
    } else {
      server.push('    location / {');
      if (rateLimit) {
        server.push('        limit_req zone=req_limit burst=20 nodelay;');
      }
      server.push('        try_files $uri $uri/ =404;');
      server.push('    }');
      server.push('');
    }

    if (staticCache) {
      const days = Number(cacheDays);
      const expires = Number.isFinite(days) && days > 0 ? `${days}d` : '30d';
      server.push('    # Long-lived cache for hashed static assets');
      server.push(
        '    location ~* \\.(?:css|js|jpg|jpeg|png|gif|ico|svg|woff2?|ttf)$ {',
      );
      server.push(`        expires ${expires};`);
      server.push('        add_header Cache-Control "public, immutable";');
      server.push('        access_log off;');
      server.push('    }');
      server.push('');
    }

    // Trim trailing blank line then close.
    while (server.length > 0 && server[server.length - 1] === '') server.pop();
    server.push('}');

    return [...top, ...server].join('\n');
  }, [
    serverName,
    port,
    root,
    upstream,
    cacheDays,
    reverseProxy,
    spa,
    httpsRedirect,
    gzip,
    staticCache,
    rateLimit,
  ]);

  const recipeCount = [
    reverseProxy,
    spa,
    httpsRedirect,
    gzip,
    staticCache,
    rateLimit,
  ].filter(Boolean).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Options" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="server_name" className="min-w-[160px] flex-1">
              <Input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="font-mono"
                spellCheck={false}
              />
            </Field>
            <Field label="listen port">
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-24 font-mono"
                inputMode="numeric"
              />
            </Field>
          </OptionsBar>
          <Field label="root path">
            <Input
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Reverse proxy</span>
              <Switch checked={reverseProxy} onCheckedChange={setReverseProxy} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">SPA try_files</span>
              <Switch checked={spa} onCheckedChange={setSpa} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">HTTPS redirect</span>
              <Switch checked={httpsRedirect} onCheckedChange={setHttpsRedirect} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">gzip</span>
              <Switch checked={gzip} onCheckedChange={setGzip} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Static cache headers</span>
              <Switch checked={staticCache} onCheckedChange={setStaticCache} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Rate limit</span>
              <Switch checked={rateLimit} onCheckedChange={setRateLimit} />
            </label>
          </div>

          {reverseProxy && (
            <Field label="proxy_pass upstream">
              <Input
                value={upstream}
                onChange={(e) => setUpstream(e.target.value)}
                className="font-mono"
                spellCheck={false}
              />
            </Field>
          )}
          {staticCache && (
            <Field label="cache duration (days)">
              <Input
                value={cacheDays}
                onChange={(e) => setCacheDays(e.target.value)}
                className="w-24 font-mono"
                inputMode="numeric"
              />
            </Field>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="nginx.conf snippet">
          <CopyButton value={() => config} />
        </PanelHeader>
        <pre className="max-h-[560px] overflow-auto p-3 font-mono text-xs leading-relaxed">
          {config}
        </pre>
        <StatBar
          items={[
            `${recipeCount} recipe${recipeCount === 1 ? '' : 's'}`,
            httpsRedirect ? '2 server blocks' : '1 server block',
            `${config.split('\n').length} lines`,
          ]}
        />
      </Panel>
    </div>
  );
}
