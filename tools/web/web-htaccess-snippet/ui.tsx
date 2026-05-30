'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type WwwMode = 'none' | 'to-www' | 'to-non-www';
type RedirectStatus = '301' | '302';

export default function HtaccessSnippetTool() {
  // Redirect
  const [redirectOn, setRedirectOn] = useState(true);
  const [redirectFrom, setRedirectFrom] = useState('/old-page');
  const [redirectTo, setRedirectTo] = useState('https://example.com/new-page');
  const [redirectStatus, setRedirectStatus] = useState<RedirectStatus>('301');

  // HTTPS + www
  const [forceHttps, setForceHttps] = useState(true);
  const [www, setWww] = useState<WwwMode>('none');
  const [domain, setDomain] = useState('example.com');

  // Custom rewrite
  const [rewriteOn, setRewriteOn] = useState(false);
  const [rwPattern, setRwPattern] = useState('^article/([0-9]+)/?$');
  const [rwSub, setRwSub] = useState('index.php?id=$1');
  const [rwFlags, setRwFlags] = useState('L,QSA');

  // IP access
  const [ipOn, setIpOn] = useState(false);
  const [ipAction, setIpAction] = useState<'deny' | 'allow'>('deny');
  const [ipList, setIpList] = useState('192.168.1.1\n203.0.113.0/24');

  // Security headers
  const [headersOn, setHeadersOn] = useState(true);
  const [xfo, setXfo] = useState(true);
  const [xcto, setXcto] = useState(true);
  const [csp, setCsp] = useState(false);
  const [cspValue, setCspValue] = useState("default-src 'self'");

  // Caching
  const [cacheOn, setCacheOn] = useState(false);
  const [cacheDays, setCacheDays] = useState('30');

  const output = useMemo(() => {
    const blocks: string[] = [];
    const host = domain.trim() || 'example.com';
    const bareHost = host.replace(/^www\./i, '');

    const rewriteNeeded = forceHttps || www !== 'none' || rewriteOn;

    const rwLines: string[] = [];
    if (rewriteNeeded) {
      rwLines.push('RewriteEngine On');
      if (forceHttps) {
        rwLines.push('# Force HTTPS');
        rwLines.push('RewriteCond %{HTTPS} off');
        rwLines.push('RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]');
      }
      if (www === 'to-www') {
        rwLines.push('# Force www');
        rwLines.push(`RewriteCond %{HTTP_HOST} !^www\\. [NC]`);
        rwLines.push(`RewriteRule ^(.*)$ https://www.%{HTTP_HOST}/$1 [L,R=301]`);
      } else if (www === 'to-non-www') {
        rwLines.push('# Force non-www');
        rwLines.push(`RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]`);
        rwLines.push(`RewriteRule ^(.*)$ https://%1/$1 [L,R=301]`);
      }
      if (rewriteOn) {
        const pattern = rwPattern.trim() || '^(.*)$';
        const sub = rwSub.trim() || '$1';
        const flags = rwFlags.trim();
        rwLines.push('# Custom rewrite');
        rwLines.push(`RewriteRule ${pattern} ${sub}${flags ? ` [${flags}]` : ''}`);
      }
    }
    if (rwLines.length > 0) {
      blocks.push('<IfModule mod_rewrite.c>\n' + indent(rwLines) + '\n</IfModule>');
    }

    if (redirectOn) {
      let from = redirectFrom.trim();
      if (from && !from.startsWith('/')) from = `/${from}`;
      const to = redirectTo.trim();
      if (from && to) {
        blocks.push(`# Simple redirect\nRedirect ${redirectStatus} ${from} ${to}`);
      }
    }

    if (ipOn) {
      const ips = ipList
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ips.length > 0) {
        if (ipAction === 'deny') {
          const lines: string[] = ['<RequireAll>', '  Require all granted'];
          for (const ip of ips) lines.push(`  Require not ip ${ip}`);
          lines.push('</RequireAll>');
          blocks.push(`# Deny listed IPs (Apache 2.4)\n${lines.join('\n')}`);
        } else {
          const lines: string[] = ['<RequireAny>'];
          for (const ip of ips) lines.push(`  Require ip ${ip}`);
          lines.push('</RequireAny>');
          blocks.push(`# Allow only listed IPs (Apache 2.4)\n${lines.join('\n')}`);
        }
      }
    }

    if (headersOn) {
      const hLines: string[] = [];
      if (xfo) hLines.push('Header set X-Frame-Options "SAMEORIGIN"');
      if (xcto) hLines.push('Header set X-Content-Type-Options "nosniff"');
      hLines.push('Header set Referrer-Policy "strict-origin-when-cross-origin"');
      if (csp) {
        const cv = (cspValue.trim() || "default-src 'self'").replace(/"/g, '\\"');
        hLines.push(`Header set Content-Security-Policy "${cv}"`);
      }
      if (hLines.length > 0) {
        blocks.push(
          '# Security headers\n<IfModule mod_headers.c>\n' + indent(hLines) + '\n</IfModule>',
        );
      }
    }

    if (cacheOn) {
      const daysNum = Number(cacheDays);
      const days = Number.isFinite(daysNum) && daysNum > 0 ? Math.round(daysNum) : 30;
      const exp: string[] = [
        'ExpiresActive On',
        `ExpiresByType image/jpeg "access plus ${days} days"`,
        `ExpiresByType image/png "access plus ${days} days"`,
        `ExpiresByType image/webp "access plus ${days} days"`,
        `ExpiresByType image/svg+xml "access plus ${days} days"`,
        `ExpiresByType text/css "access plus ${days} days"`,
        `ExpiresByType application/javascript "access plus ${days} days"`,
        `ExpiresByType font/woff2 "access plus ${days} days"`,
      ];
      blocks.push(
        '# Browser caching\n<IfModule mod_expires.c>\n' + indent(exp) + '\n</IfModule>',
      );
    }

    if (blocks.length === 0) {
      return '# Enable at least one recipe above to generate rules.\n';
    }
    return blocks.join('\n\n') + '\n';
  }, [
    redirectOn,
    redirectFrom,
    redirectTo,
    redirectStatus,
    forceHttps,
    www,
    domain,
    rewriteOn,
    rwPattern,
    rwSub,
    rwFlags,
    ipOn,
    ipAction,
    ipList,
    headersOn,
    xfo,
    xcto,
    csp,
    cspValue,
    cacheOn,
    cacheDays,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Recipes" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Canonical domain">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-48 font-mono"
              />
            </Field>
            <Field label="Force HTTPS">
              <Switch checked={forceHttps} onCheckedChange={setForceHttps} />
            </Field>
            <Field label="WWW canonical">
              <Select value={www} onValueChange={(v) => setWww(v as WwwMode)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="to-www">Force www</SelectItem>
                  <SelectItem value="to-non-www">Force non-www</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Simple redirect">
              <Switch checked={redirectOn} onCheckedChange={setRedirectOn} />
            </Field>
            <Field label="From path">
              <Input
                value={redirectFrom}
                onChange={(e) => setRedirectFrom(e.target.value)}
                disabled={!redirectOn}
                className="w-44 font-mono"
              />
            </Field>
            <Field label="To URL">
              <Input
                value={redirectTo}
                onChange={(e) => setRedirectTo(e.target.value)}
                disabled={!redirectOn}
                className="w-64 font-mono"
              />
            </Field>
            <Field label="Status">
              <Select
                value={redirectStatus}
                onValueChange={(v) => setRedirectStatus(v as RedirectStatus)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301</SelectItem>
                  <SelectItem value="302">302</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Custom RewriteRule">
              <Switch checked={rewriteOn} onCheckedChange={setRewriteOn} />
            </Field>
            <Field label="Pattern">
              <Input
                value={rwPattern}
                onChange={(e) => setRwPattern(e.target.value)}
                disabled={!rewriteOn}
                className="w-56 font-mono"
              />
            </Field>
            <Field label="Substitution">
              <Input
                value={rwSub}
                onChange={(e) => setRwSub(e.target.value)}
                disabled={!rewriteOn}
                className="w-56 font-mono"
              />
            </Field>
            <Field label="Flags">
              <Input
                value={rwFlags}
                onChange={(e) => setRwFlags(e.target.value)}
                disabled={!rewriteOn}
                className="w-32 font-mono"
              />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="IP access control">
              <Switch checked={ipOn} onCheckedChange={setIpOn} />
            </Field>
            <Field label="Action">
              <Select
                value={ipAction}
                onValueChange={(v) => setIpAction(v as 'deny' | 'allow')}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deny">Deny listed</SelectItem>
                  <SelectItem value="allow">Allow only listed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="IPs / CIDRs (one per line)" className="flex-1 min-w-[220px]">
              <textarea
                value={ipList}
                onChange={(e) => setIpList(e.target.value)}
                disabled={!ipOn}
                rows={3}
                className="w-full rounded-md border bg-background px-2 py-1 font-mono text-xs disabled:opacity-50"
                spellCheck={false}
              />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Security headers">
              <Switch checked={headersOn} onCheckedChange={setHeadersOn} />
            </Field>
            <Field label="X-Frame-Options">
              <Switch checked={xfo} onCheckedChange={setXfo} />
            </Field>
            <Field label="X-Content-Type-Options">
              <Switch checked={xcto} onCheckedChange={setXcto} />
            </Field>
            <Field label="CSP">
              <Switch checked={csp} onCheckedChange={setCsp} />
            </Field>
            <Field label="CSP value" className="flex-1 min-w-[220px]">
              <Input
                value={cspValue}
                onChange={(e) => setCspValue(e.target.value)}
                disabled={!csp}
                className="font-mono"
              />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Browser caching">
              <Switch checked={cacheOn} onCheckedChange={setCacheOn} />
            </Field>
            <Field label="Cache duration (days)">
              <Input
                type="number"
                min={1}
                value={cacheDays}
                onChange={(e) => setCacheDays(e.target.value)}
                disabled={!cacheOn}
                className="w-24 font-mono"
              />
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title=".htaccess">
          <CopyButton value={() => output} label="Copy" />
          <DownloadButton data={() => output} filename=".htaccess" />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {output}
        </pre>
        <StatBar
          items={[
            forceHttps ? 'HTTPS' : null,
            www !== 'none' ? www : null,
            redirectOn ? 'redirect' : null,
            headersOn ? 'headers' : null,
            cacheOn ? 'caching' : null,
          ]}
        />
      </Panel>
    </div>
  );
}

function indent(lines: string[]): string {
  return lines.map((l) => `  ${l}`).join('\n');
}
