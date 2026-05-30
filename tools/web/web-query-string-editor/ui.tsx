'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowDownUp } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Pair {
  id: number;
  key: string;
  value: string;
}

let nextId = 1;
function makePair(key: string, value: string): Pair {
  return { id: nextId++, key, value };
}

function parseInput(raw: string): Pair[] {
  const t = raw.trim();
  if (!t) return [];
  let query = t;
  const qIdx = t.indexOf('?');
  if (qIdx !== -1) {
    const after = t.slice(qIdx + 1);
    const hashIdx = after.indexOf('#');
    query = hashIdx === -1 ? after : after.slice(0, hashIdx);
  } else {
    query = t.replace(/^[?]/, '');
  }
  const params = new URLSearchParams(query);
  const pairs: Pair[] = [];
  for (const [k, v] of params.entries()) pairs.push(makePair(k, v));
  return pairs;
}

function baseUrl(raw: string): string {
  const t = raw.trim();
  const qIdx = t.indexOf('?');
  if (qIdx !== -1) return t.slice(0, qIdx);
  if (t.startsWith('?') || !t.includes('/')) return '';
  return t;
}

function serialize(pairs: Pair[], plusSpace: boolean): string {
  const live = pairs.filter((p) => p.key !== '');
  const params = new URLSearchParams();
  for (const p of live) params.append(p.key, p.value);
  let s = params.toString();
  if (plusSpace) {
    s = s.replace(/%20/g, '+');
  } else {
    s = s.replace(/\+/g, '%20');
  }
  return s;
}

function toJsonView(pairs: Pair[]): string {
  const live = pairs.filter((p) => p.key !== '');
  const obj: Record<string, string | string[]> = {};
  for (const p of live) {
    const existing = obj[p.key];
    if (existing === undefined) {
      obj[p.key] = p.value;
    } else if (Array.isArray(existing)) {
      existing.push(p.value);
    } else {
      obj[p.key] = [existing, p.value];
    }
  }
  return JSON.stringify(obj, null, 2);
}

export default function QueryStringEditorTool() {
  const [raw, setRaw] = useState('https://example.com/search?q=hello+world&tag=a&tag=b&page=1');
  const [pairs, setPairs] = useState<Pair[]>(() =>
    parseInput('https://example.com/search?q=hello+world&tag=a&tag=b&page=1')
  );
  const [base, setBase] = useState(() => baseUrl('https://example.com/search?q=hello+world&tag=a&tag=b&page=1'));
  const [decodeDisplay, setDecodeDisplay] = useState(true);
  const [plusSpace, setPlusSpace] = useState(true);

  const load = () => {
    setPairs(parseInput(raw));
    setBase(baseUrl(raw));
  };

  const update = (id: number, patch: Partial<Pair>) =>
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: number) => setPairs((prev) => prev.filter((p) => p.id !== id));
  const add = () => setPairs((prev) => [...prev, makePair('', '')]);
  const sortByKey = () =>
    setPairs((prev) => [...prev].sort((a, b) => a.key.localeCompare(b.key)));

  const dedupe = (keepLast: boolean) => {
    setPairs((prev) => {
      const seen = new Map<string, Pair>();
      const order: string[] = [];
      for (const p of prev) {
        if (!seen.has(p.key)) order.push(p.key);
        if (keepLast || !seen.has(p.key)) seen.set(p.key, p);
      }
      return order.map((k) => seen.get(k)).filter((p): p is Pair => p !== undefined);
    });
  };

  const queryOut = useMemo(() => serialize(pairs, plusSpace), [pairs, plusSpace]);
  const fullUrl = useMemo(() => (queryOut ? `${base}?${queryOut}` : base), [base, queryOut]);
  const jsonOut = useMemo(() => toJsonView(pairs), [pairs]);

  const display = (v: string): string => {
    if (!decodeDisplay) return v;
    try {
      return decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      return v;
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Source URL / query string">
          <Button variant="secondary" size="sm" onClick={load}>
            Load
          </Button>
        </PanelHeader>
        <div className="p-3">
          <Input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="https://example.com/path?a=1&b=2"
            className="font-mono text-xs"
          />
        </div>
        <OptionsBar>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={decodeDisplay} onCheckedChange={setDecodeDisplay} /> Decode values for editing
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={plusSpace} onCheckedChange={setPlusSpace} /> Encode space as + (else %20)
          </label>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Parameters">
          <div className="flex flex-wrap gap-1">
            <button
              className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={sortByKey}
            >
              <ArrowDownUp className="size-3" /> Sort
            </button>
            <button
              className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => dedupe(false)}
            >
              Dedupe (first)
            </button>
            <button
              className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => dedupe(true)}
            >
              Dedupe (last)
            </button>
          </div>
        </PanelHeader>
        <div className="space-y-2 p-3">
          {pairs.length === 0 && (
            <p className="text-sm text-muted-foreground">No parameters. Add one or load a URL above.</p>
          )}
          {pairs.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Input
                value={p.key}
                onChange={(e) => update(p.id, { key: e.target.value })}
                placeholder="key"
                className="h-8 font-mono text-xs"
              />
              <span className="text-muted-foreground">=</span>
              <Input
                value={display(p.value)}
                onChange={(e) => update(p.id, { value: e.target.value })}
                placeholder="value"
                className="h-8 font-mono text-xs"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => remove(p.id)} aria-label="Remove">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add parameter
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Rebuilt query string">
          <CopyButton value={() => queryOut} size="icon-sm" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
          {queryOut || '(empty)'}
        </pre>
      </Panel>

      <Panel>
        <PanelHeader title="Full URL">
          <CopyButton value={() => fullUrl} size="icon-sm" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{fullUrl || '(empty)'}</pre>
      </Panel>

      <Panel>
        <PanelHeader title="JSON object view">
          <CopyButton value={() => jsonOut} size="icon-sm" />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{jsonOut}</pre>
        <StatBar items={[`${pairs.filter((p) => p.key !== '').length} param(s)`]} />
      </Panel>
    </div>
  );
}
