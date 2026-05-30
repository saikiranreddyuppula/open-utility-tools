'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'build' | 'parse';

interface Row {
  id: number;
  uri: string;
  rel: string;
  type: string;
  title: string;
  as: string;
  crossorigin: string;
  media: string;
}

const PARAM_ORDER: Array<keyof Row> = ['rel', 'type', 'title', 'as', 'crossorigin', 'media'];

let nextId = 1;
function emptyRow(): Row {
  return { id: nextId++, uri: '', rel: '', type: '', title: '', as: '', crossorigin: '', media: '' };
}

const PRESETS: Array<{ label: string; rows: Array<Partial<Row>> }> = [
  {
    label: 'Pagination',
    rows: [
      { uri: 'https://api.example.com/items?page=1', rel: 'first' },
      { uri: 'https://api.example.com/items?page=2', rel: 'prev' },
      { uri: 'https://api.example.com/items?page=4', rel: 'next' },
      { uri: 'https://api.example.com/items?page=20', rel: 'last' },
    ],
  },
  {
    label: 'Resource hints',
    rows: [
      { uri: '/styles/main.css', rel: 'preload', as: 'style' },
      { uri: '/fonts/inter.woff2', rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      { uri: 'https://cdn.example.com', rel: 'preconnect' },
    ],
  },
  {
    label: 'Canonical',
    rows: [{ uri: 'https://example.com/page', rel: 'canonical' }],
  },
];

function buildHeader(rows: Row[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    const uri = row.uri.trim();
    if (!uri) continue;
    let segment = `<${uri}>`;
    for (const key of PARAM_ORDER) {
      const val = row[key];
      if (typeof val === 'string' && val.trim()) {
        const escaped = val.trim().replace(/"/g, '\\"');
        segment += `; ${key}="${escaped}"`;
      }
    }
    parts.push(segment);
  }
  return parts.join(', ');
}

interface ParsedLink {
  uri: string;
  params: Array<{ key: string; value: string }>;
}

// Split a Link header into top-level comma-separated links without breaking
// commas that appear inside <...> targets or "..." quoted parameter values.
function splitLinks(header: string): string[] {
  const result: string[] = [];
  let depthAngle = 0;
  let inQuote = false;
  let current = '';
  for (let i = 0; i < header.length; i++) {
    const ch = header[i] ?? '';
    if (inQuote) {
      current += ch;
      if (ch === '\\') {
        const next = header[i + 1];
        if (next !== undefined) {
          current += next;
          i++;
        }
      } else if (ch === '"') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      current += ch;
    } else if (ch === '<') {
      depthAngle++;
      current += ch;
    } else if (ch === '>') {
      if (depthAngle > 0) depthAngle--;
      current += ch;
    } else if (ch === ',' && depthAngle === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

function splitParams(segment: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i] ?? '';
    if (inQuote) {
      current += ch;
      if (ch === '\\') {
        const next = segment[i + 1];
        if (next !== undefined) {
          current += next;
          i++;
        }
      } else if (ch === '"') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      current += ch;
    } else if (ch === ';') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

function unquote(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return v;
}

function parseHeader(header: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  for (const linkStr of splitLinks(header)) {
    const segs = splitParams(linkStr);
    const first = segs[0]?.trim() ?? '';
    const m = first.match(/^<([^>]*)>$/);
    if (!m) continue;
    const uri = m[1] ?? '';
    const params: Array<{ key: string; value: string }> = [];
    for (let i = 1; i < segs.length; i++) {
      const seg = (segs[i] ?? '').trim();
      if (!seg) continue;
      const eq = seg.indexOf('=');
      if (eq === -1) {
        params.push({ key: seg, value: '' });
      } else {
        const key = seg.slice(0, eq).trim();
        const value = unquote(seg.slice(eq + 1));
        params.push({ key, value });
      }
    }
    links.push({ uri, params });
  }
  return links;
}

export default function LinkHeaderBuilderTool() {
  const [mode, setMode] = useState<Mode>('build');
  const [rows, setRows] = useState<Row[]>(() => {
    const r = emptyRow();
    r.uri = 'https://api.example.com/items?page=4';
    r.rel = 'next';
    return [r];
  });
  const [parseInput, setParseInput] = useState(
    '<https://api.example.com/items?page=2>; rel="prev", <https://api.example.com/items?page=4>; rel="next", <https://api.example.com/items?page=20>; rel="last"'
  );

  const built = useMemo(() => buildHeader(rows), [rows]);

  const parsed = useMemo<{ links: ParsedLink[]; error: string | null }>(() => {
    const t = parseInput.trim();
    if (!t) return { links: [], error: null };
    const links = parseHeader(t);
    if (links.length === 0) return { links: [], error: 'No valid Link entries found. Each must look like <uri>; rel="next".' };
    return { links, error: null };
  }, [parseInput]);

  const updateRow = (id: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setRows(preset.rows.map((p) => ({ ...emptyRow(), ...p })));
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="build">Build</TabsTrigger>
                <TabsTrigger value="parse">Parse</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {mode === 'build' ? (
        <>
          <Panel>
            <PanelHeader title="Links">
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </PanelHeader>
            <div className="space-y-3 p-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                    <Input
                      value={row.uri}
                      onChange={(e) => updateRow(row.id, { uri: e.target.value })}
                      placeholder="Target URI (https://…)"
                      className="h-8 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      aria-label="Remove link"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PARAM_ORDER.map((key) => (
                      <Input
                        key={key}
                        value={row[key]}
                        onChange={(e) => updateRow(row.id, { [key]: e.target.value } as Partial<Row>)}
                        placeholder={key}
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addRow}>
                <Plus className="size-3.5" /> Add link
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Link header value">
              <CopyButton value={() => built} size="icon-sm" />
            </PanelHeader>
            <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
              {built || '(add at least one URI)'}
            </pre>
            <StatBar items={[`${rows.filter((r) => r.uri.trim()).length} link(s)`, `${built.length} chars`]} />
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Link header">
              <button
                className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setParseInput('')}
              >
                Clear
              </button>
            </PanelHeader>
            <Textarea
              value={parseInput}
              onChange={(e) => setParseInput(e.target.value)}
              placeholder='Paste a Link header value, e.g. <https://…>; rel="next"'
              spellCheck={false}
              className="min-h-24 resize-y break-all rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </Panel>

          <ErrorBanner error={parsed.error} />

          {parsed.links.length > 0 && (
            <Panel>
              <PanelHeader title="Parsed links" />
              <div className="divide-y">
                {parsed.links.map((link, i) => (
                  <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      <code className="min-w-0 flex-1 break-all font-mono text-xs">{link.uri}</code>
                      <CopyButton value={link.uri} size="icon-sm" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {link.params.length === 0 ? (
                        <span className="text-2xs text-muted-foreground">(no parameters)</span>
                      ) : (
                        link.params.map((p, j) => (
                          <span
                            key={j}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs"
                          >
                            {p.key}
                            {p.value ? `="${p.value}"` : ''}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <StatBar items={[`${parsed.links.length} link(s) parsed`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
