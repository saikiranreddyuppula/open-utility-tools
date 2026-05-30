'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SAMPLE_A = 'https://example.com/search?q=cats&page=1&sort=asc&utm_source=news';
const SAMPLE_B = 'https://example.com/search?q=cats&page=2&sort=desc&lang=en';

function extractQuery(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const qIdx = t.indexOf('?');
  if (qIdx !== -1) {
    const after = t.slice(qIdx + 1);
    const hashIdx = after.indexOf('#');
    return hashIdx === -1 ? after : after.slice(0, hashIdx);
  }
  // Bare query string (maybe with leading ?)
  return t.replace(/^[?]/, '');
}

// Parse into a map: key -> array of values (preserve repeats).
function parseParams(query: string, caseInsensitive: boolean): Map<string, string[]> {
  const params = new URLSearchParams(query);
  const map = new Map<string, string[]>();
  for (const [k, v] of params.entries()) {
    const key = caseInsensitive ? k.toLowerCase() : k;
    const arr = map.get(key);
    if (arr) arr.push(v);
    else map.set(key, [v]);
  }
  return map;
}

type Category = 'added' | 'removed' | 'changed' | 'unchanged';

interface DiffEntry {
  key: string;
  category: Category;
  a: string[];
  b: string[];
}

function valuesEqual(a: string[], b: string[], ignoreOrder: boolean): boolean {
  if (a.length !== b.length) return false;
  if (ignoreOrder) {
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return a.every((v, i) => v === b[i]);
}

function decodeMaybe(v: string, decode: boolean): string {
  if (!decode) return v;
  try {
    return decodeURIComponent(v.replace(/\+/g, ' '));
  } catch {
    return v;
  }
}

export default function QueryParamsDiffTool() {
  const [urlA, setUrlA] = useState(SAMPLE_A);
  const [urlB, setUrlB] = useState(SAMPLE_B);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [ignoreOrder, setIgnoreOrder] = useState(true);
  const [decode, setDecode] = useState(true);

  const diff = useMemo<DiffEntry[]>(() => {
    const a = parseParams(extractQuery(urlA), caseInsensitive);
    const b = parseParams(extractQuery(urlB), caseInsensitive);
    const keys = new Set<string>([...a.keys(), ...b.keys()]);
    const entries: DiffEntry[] = [];
    for (const key of keys) {
      const av = a.get(key);
      const bv = b.get(key);
      if (av && !bv) {
        entries.push({ key, category: 'removed', a: av, b: [] });
      } else if (!av && bv) {
        entries.push({ key, category: 'added', a: [], b: bv });
      } else if (av && bv) {
        const same = valuesEqual(av, bv, ignoreOrder);
        entries.push({ key, category: same ? 'unchanged' : 'changed', a: av, b: bv });
      }
    }
    entries.sort((x, y) => x.key.localeCompare(y.key));
    return entries;
  }, [urlA, urlB, caseInsensitive, ignoreOrder]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { added: 0, removed: 0, changed: 0, unchanged: 0 };
    for (const e of diff) c[e.category]++;
    return c;
  }, [diff]);

  const sections: Array<{ cat: Category; title: string; cls: string }> = [
    { cat: 'added', title: 'Added (only in B)', cls: 'text-emerald-600 dark:text-emerald-400' },
    { cat: 'removed', title: 'Removed (only in A)', cls: 'text-destructive' },
    { cat: 'changed', title: 'Changed', cls: 'text-amber-600 dark:text-amber-400' },
    { cat: 'unchanged', title: 'Unchanged', cls: 'text-muted-foreground' },
  ];

  const renderVals = (vals: string[]) =>
    vals.length === 0 ? '∅' : vals.map((v) => decodeMaybe(v, decode) || '(empty)').join(', ');

  const copyText = () =>
    sections
      .map((s) => {
        const rows = diff.filter((d) => d.category === s.cat);
        if (rows.length === 0) return '';
        const body = rows
          .map((d) => {
            if (d.category === 'changed') return `  ${d.key}: ${renderVals(d.a)} → ${renderVals(d.b)}`;
            if (d.category === 'added') return `  ${d.key}: ${renderVals(d.b)}`;
            if (d.category === 'removed') return `  ${d.key}: ${renderVals(d.a)}`;
            return `  ${d.key}: ${renderVals(d.a)}`;
          })
          .join('\n');
        return `${s.title}\n${body}`;
      })
      .filter(Boolean)
      .join('\n\n');

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <Field label="URL A">
            <Input value={urlA} onChange={(e) => setUrlA(e.target.value)} placeholder="https://…?a=1" className="font-mono text-xs" />
          </Field>
          <Field label="URL B">
            <Input value={urlB} onChange={(e) => setUrlB(e.target.value)} placeholder="https://…?a=2" className="font-mono text-xs" />
          </Field>
        </div>
        <OptionsBar>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={caseInsensitive} onCheckedChange={setCaseInsensitive} /> Case-insensitive keys
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={ignoreOrder} onCheckedChange={setIgnoreOrder} /> Ignore value order (repeated keys)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={decode} onCheckedChange={setDecode} /> URL-decode values
          </label>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Diff">
          <CopyButton value={copyText} size="icon-sm" />
        </PanelHeader>
        <div className="divide-y">
          {sections.map((s) => {
            const rows = diff.filter((d) => d.category === s.cat);
            return (
              <div key={s.cat} className="px-3 py-2.5">
                <p className={'mb-1.5 text-xs font-semibold ' + s.cls}>
                  {s.title} ({rows.length})
                </p>
                {rows.length === 0 ? (
                  <p className="text-2xs text-muted-foreground">none</p>
                ) : (
                  <div className="space-y-1">
                    {rows.map((d) => (
                      <div key={d.key} className="flex items-baseline gap-2 font-mono text-xs">
                        <code className="shrink-0 font-semibold">{d.key}</code>
                        {d.category === 'changed' ? (
                          <span>
                            <span className="text-destructive">{renderVals(d.a)}</span>
                            <span className="px-1 text-muted-foreground">→</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{renderVals(d.b)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {renderVals(d.category === 'removed' ? d.a : d.b)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <StatBar
          items={[
            `+${counts.added} added`,
            `-${counts.removed} removed`,
            `~${counts.changed} changed`,
            `${counts.unchanged} unchanged`,
          ]}
        />
      </Panel>
    </div>
  );
}
