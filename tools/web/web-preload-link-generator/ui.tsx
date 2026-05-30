'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Panel,
  PanelHeader,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type HintType =
  | 'preload'
  | 'prefetch'
  | 'preconnect'
  | 'dns-prefetch'
  | 'modulepreload';
type AsValue = 'script' | 'style' | 'font' | 'image' | 'fetch';

interface Row {
  id: number;
  type: HintType;
  href: string;
  as: AsValue;
  mime: string;
  crossorigin: boolean;
}

const GUIDANCE: Record<HintType, string> = {
  preload:
    'preload — fetch a high-priority resource needed soon on the current page.',
  prefetch:
    'prefetch — low-priority fetch of a resource likely needed on the next navigation.',
  preconnect:
    'preconnect — open TCP+TLS to a third-party origin early to cut connection latency.',
  'dns-prefetch':
    'dns-prefetch — resolve DNS for an origin ahead of time (lighter than preconnect).',
  modulepreload:
    'modulepreload — preload an ES module and its dependency graph.',
};

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

let nextId = 4;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function inferFontMime(href: string): string {
  const ext = href.split('.').pop()?.toLowerCase() ?? '';
  return FONT_MIME[ext] ?? 'font/woff2';
}

function buildTag(r: Row): string {
  const attrs: string[] = [`rel="${r.type}"`];
  const href = r.href.trim();

  if (r.type === 'preconnect' || r.type === 'dns-prefetch') {
    attrs.push(`href="${escapeAttr(href || 'https://example.com')}"`);
    if (r.type === 'preconnect' && r.crossorigin) attrs.push('crossorigin');
    return `<link ${attrs.join(' ')}>`;
  }

  attrs.push(`href="${escapeAttr(href || '/path/to/resource')}"`);

  if (r.type === 'preload') {
    attrs.push(`as="${r.as}"`);
    if (r.as === 'font') {
      const mime = r.mime.trim() || inferFontMime(href);
      attrs.push(`type="${escapeAttr(mime)}"`);
      // Fonts are always fetched anonymously and require crossorigin.
      attrs.push('crossorigin');
    } else {
      if (r.mime.trim()) attrs.push(`type="${escapeAttr(r.mime.trim())}"`);
      if (r.crossorigin) attrs.push('crossorigin');
    }
  }

  return `<link ${attrs.join(' ')}>`;
}

export default function PreloadLinkGenerator() {
  const [rows, setRows] = useState<Row[]>([
    {
      id: 1,
      type: 'preload',
      href: '/fonts/Inter.woff2',
      as: 'font',
      mime: '',
      crossorigin: false,
    },
    {
      id: 2,
      type: 'preconnect',
      href: 'https://fonts.gstatic.com',
      as: 'script',
      mime: '',
      crossorigin: true,
    },
    {
      id: 3,
      type: 'prefetch',
      href: '/next-page.js',
      as: 'script',
      mime: '',
      crossorigin: false,
    },
  ]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        id: nextId++,
        type: 'preload',
        href: '',
        as: 'script',
        mime: '',
        crossorigin: false,
      },
    ]);

  const removeRow = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const output = useMemo(() => rows.map(buildTag).join('\n'), [rows]);

  const usedTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.type))),
    [rows],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Resource hints">
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus className="size-3.5" /> Add
          </Button>
        </PanelHeader>
        <div className="max-h-[560px] divide-y overflow-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={r.type}
                  onValueChange={(v) => update(r.id, { type: v as HintType })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preload">preload</SelectItem>
                    <SelectItem value="prefetch">prefetch</SelectItem>
                    <SelectItem value="preconnect">preconnect</SelectItem>
                    <SelectItem value="dns-prefetch">dns-prefetch</SelectItem>
                    <SelectItem value="modulepreload">modulepreload</SelectItem>
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
              <Input
                value={r.href}
                onChange={(e) => update(r.id, { href: e.target.value })}
                placeholder={
                  r.type === 'preconnect' || r.type === 'dns-prefetch'
                    ? 'https://origin.example.com'
                    : '/path/to/resource'
                }
                className="font-mono text-xs"
                spellCheck={false}
              />
              {r.type === 'preload' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={r.as}
                    onValueChange={(v) => update(r.id, { as: v as AsValue })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="script">script</SelectItem>
                      <SelectItem value="style">style</SelectItem>
                      <SelectItem value="font">font</SelectItem>
                      <SelectItem value="image">image</SelectItem>
                      <SelectItem value="fetch">fetch</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={r.mime}
                    onChange={(e) => update(r.id, { mime: e.target.value })}
                    placeholder="type (optional)"
                    className="w-36 font-mono text-xs"
                    spellCheck={false}
                  />
                  {r.as !== 'font' && (
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={r.crossorigin}
                        onCheckedChange={(c) => update(r.id, { crossorigin: c })}
                      />
                      crossorigin
                    </label>
                  )}
                  {r.as === 'font' && (
                    <span className="text-2xs text-muted-foreground">
                      crossorigin auto-added for fonts
                    </span>
                  )}
                </div>
              )}
              {r.type === 'preconnect' && (
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={r.crossorigin}
                    onCheckedChange={(c) => update(r.id, { crossorigin: c })}
                  />
                  crossorigin (needed for fonts/CORS)
                </label>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Add a resource hint to begin.
            </p>
          )}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Link tags">
            <CopyButton value={() => output} />
          </PanelHeader>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {output || '<!-- add a hint -->'}
          </pre>
          <StatBar
            items={[`${rows.length} tags`, usedTypes.join(', ') || 'none']}
          />
        </Panel>

        <Panel>
          <PanelHeader title="Which hint?" />
          <ul className="space-y-1.5 p-3 text-xs text-muted-foreground">
            {usedTypes.map((t) => (
              <li key={t}>{GUIDANCE[t]}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
