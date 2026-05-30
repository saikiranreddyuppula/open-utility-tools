'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type Mode = 'redirect' | 'rewrite';
type Status = '301' | '302' | '307' | '410';
type WwwMode = 'none' | 'to-www' | 'to-non-www';
type SlashMode = 'none' | 'remove' | 'add';

interface Row {
  id: number;
  source: string;
  target: string;
  status: Status;
}

const STATUS_LABEL: Record<Status, string> = {
  '301': '301 Moved Permanently',
  '302': '302 Found (temporary)',
  '307': '307 Temporary Redirect',
  '410': '410 Gone',
};

function escapeRegex(path: string): string {
  // Escape regex special chars; anchor for RewriteRule form.
  return path.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&');
}

function normalizeSource(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  if (!s.startsWith('/')) s = `/${s}`;
  return s;
}

let nextId = 4;

export default function HtaccessRedirectBuilderTool() {
  const [mode, setMode] = useState<Mode>('redirect');
  const [rows, setRows] = useState<Row[]>([
    { id: 1, source: '/old-page', target: 'https://example.com/new-page', status: '301' },
    { id: 2, source: '/blog/2019/post', target: '/blog/post', status: '301' },
    { id: 3, source: '/discontinued', target: '', status: '410' },
  ]);
  const [forceHttps, setForceHttps] = useState(false);
  const [www, setWww] = useState<WwwMode>('none');
  const [slash, setSlash] = useState<SlashMode>('none');
  const [noCase, setNoCase] = useState(false);
  const [domain, setDomain] = useState('example.com');

  const addRow = () => {
    setRows((r) => [...r, { id: nextId++, source: '', target: '', status: '301' }]);
  };
  const removeRow = (id: number) => {
    setRows((r) => r.filter((x) => x.id !== id));
  };
  const update = (id: number, patch: Partial<Row>) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const output = useMemo(() => {
    const lines: string[] = [];
    const needsEngine =
      mode === 'rewrite' || forceHttps || www !== 'none' || slash !== 'none';

    if (needsEngine) {
      lines.push('RewriteEngine On');
      lines.push('');
    }

    if (forceHttps) {
      lines.push('# Force HTTPS');
      lines.push('RewriteCond %{HTTPS} off');
      lines.push('RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]');
      lines.push('');
    }

    const host = domain.trim() || 'example.com';
    const bareHost = host.replace(/^www\./i, '');
    if (www === 'to-www') {
      lines.push('# Redirect non-www to www');
      lines.push(`RewriteCond %{HTTP_HOST} ^${escapeRegex(bareHost)}$ [NC]`);
      lines.push(`RewriteRule ^(.*)$ https://www.${bareHost}/$1 [L,R=301]`);
      lines.push('');
    } else if (www === 'to-non-www') {
      lines.push('# Redirect www to non-www');
      lines.push(`RewriteCond %{HTTP_HOST} ^www\\.${escapeRegex(bareHost)}$ [NC]`);
      lines.push(`RewriteRule ^(.*)$ https://${bareHost}/$1 [L,R=301]`);
      lines.push('');
    }

    if (slash === 'remove') {
      lines.push('# Remove trailing slash');
      lines.push('RewriteCond %{REQUEST_FILENAME} !-d');
      lines.push('RewriteRule ^(.*)/$ /$1 [L,R=301]');
      lines.push('');
    } else if (slash === 'add') {
      lines.push('# Add trailing slash');
      lines.push('RewriteCond %{REQUEST_FILENAME} !-f');
      lines.push('RewriteRule ^(.*[^/])$ /$1/ [L,R=301]');
      lines.push('');
    }

    const ncFlag = noCase ? 'NC,' : '';
    const valid = rows.filter((r) => normalizeSource(r.source));

    if (valid.length > 0) {
      lines.push('# URL redirects');
      for (const r of valid) {
        const src = normalizeSource(r.source);
        const tgt = r.target.trim();
        if (r.status === '410') {
          if (mode === 'rewrite') {
            const rx = `^${escapeRegex(src.slice(1))}$`;
            lines.push(`RewriteRule ${rx} - [${ncFlag}G,L]`);
          } else {
            lines.push(`Redirect 410 ${src}`);
          }
          continue;
        }
        if (!tgt) continue;
        if (mode === 'rewrite') {
          const rx = `^${escapeRegex(src.slice(1))}$`;
          lines.push(`RewriteRule ${rx} ${tgt} [${ncFlag}R=${r.status},L]`);
        } else {
          lines.push(`Redirect ${r.status} ${src} ${tgt}`);
        }
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }, [mode, rows, forceHttps, www, slash, noCase, domain]);

  const ruleCount = rows.filter((r) => normalizeSource(r.source)).length;

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Output style">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="redirect">Redirect</TabsTrigger>
                  <TabsTrigger value="rewrite">RewriteRule</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Canonical domain">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-48 font-mono"
                placeholder="example.com"
              />
            </Field>
            <Field label="WWW canonical">
              <Select value={www} onValueChange={(v) => setWww(v as WwwMode)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="to-www">non-www → www</SelectItem>
                  <SelectItem value="to-non-www">www → non-www</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Trailing slash">
              <Select value={slash} onValueChange={(v) => setSlash(v as SlashMode)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Leave as-is</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                  <SelectItem value="add">Add</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Force HTTPS">
              <Switch checked={forceHttps} onCheckedChange={setForceHttps} />
            </Field>
            <Field label="Case-insensitive [NC]">
              <Switch checked={noCase} onCheckedChange={setNoCase} />
            </Field>
          </OptionsBar>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Source path</span>
              <span className="flex-1">Target URL / path</span>
              <span className="w-40">Status</span>
              <span className="w-8" />
            </div>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input
                  value={r.source}
                  onChange={(e) => update(r.id, { source: e.target.value })}
                  placeholder="/old-path"
                  className="flex-1 font-mono"
                />
                <Input
                  value={r.target}
                  onChange={(e) => update(r.id, { target: e.target.value })}
                  placeholder={r.status === '410' ? '(gone — no target)' : '/new or https://…'}
                  disabled={r.status === '410'}
                  className="flex-1 font-mono"
                />
                <Select
                  value={r.status}
                  onValueChange={(v) => update(r.id, { status: v as Status })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(r.id)}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={addRow}>
                <Plus className="size-3.5" /> Add redirect
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title=".htaccess">
          <CopyButton value={() => output} label="Copy" />
          <DownloadButton data={() => output} filename=".htaccess" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {output}
        </pre>
        <StatBar
          items={[
            `mode: ${mode}`,
            `${ruleCount} redirect rule${ruleCount === 1 ? '' : 's'}`,
            noCase ? 'case-insensitive' : null,
            forceHttps ? 'force HTTPS' : null,
          ]}
        />
      </Panel>
    </div>
  );
}
