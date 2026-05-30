'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `First Name,Last-Name,emailAddress,Sign Up Date
Ada,Lovelace,ada@x.io,2024-01-02
Linus,Torvalds,linus@x.io,2024-02-11`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type CaseMode =
  | 'none'
  | 'snake'
  | 'camel'
  | 'pascal'
  | 'kebab'
  | 'title'
  | 'lower'
  | 'upper'
  | 'trim';

const CASES: { value: CaseMode; label: string }[] = [
  { value: 'none', label: '(no transform)' },
  { value: 'snake', label: 'snake_case' },
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'kebab', label: 'kebab-case' },
  { value: 'title', label: 'Title Case' },
  { value: 'lower', label: 'lowercase' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'trim', label: 'trim + strip special' },
];

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1] ?? '';
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string, delim: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => !(l === '' && idx === arr.length - 1))
    .map((l) => parseLine(l, delim));
}

function formatField(field: string, delim: string): string {
  const needs = field.includes('"') || field.includes('\n') || field.includes(delim);
  return needs ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][], delim: string): string {
  return rows.map((r) => r.map((f) => formatField(f, delim)).join(delim)).join('\n');
}

function words(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function applyCase(name: string, mode: CaseMode): string {
  if (mode === 'none') return name;
  if (mode === 'trim') return name.trim().replace(/[^a-zA-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
  const w = words(name);
  if (w.length === 0) return name.trim();
  switch (mode) {
    case 'snake':
      return w.map((x) => x.toLowerCase()).join('_');
    case 'kebab':
      return w.map((x) => x.toLowerCase()).join('-');
    case 'lower':
      return w.join(' ').toLowerCase();
    case 'upper':
      return w.join(' ').toUpperCase();
    case 'title':
      return w.map((x) => (x[0] ?? '').toUpperCase() + x.slice(1).toLowerCase()).join(' ');
    case 'pascal':
      return w.map((x) => (x[0] ?? '').toUpperCase() + x.slice(1).toLowerCase()).join('');
    case 'camel':
      return w
        .map((x, i) =>
          i === 0 ? x.toLowerCase() : (x[0] ?? '').toUpperCase() + x.slice(1).toLowerCase()
        )
        .join('');
    default:
      return name;
  }
}

function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : `${n}_${count + 1}`;
  });
}

export default function CsvRenameHeadersTool() {
  const [delim, setDelim] = useState(',');
  const [input, setInput] = useState('');
  // editable header names, parallel to original; order maps new-position -> original index
  const [names, setNames] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const lastHeaderKey = useRef('');

  const original = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    return parseCsv(input, delim)[0] ?? [];
  }, [input, delim]);

  // re-init editable state when the parsed header changes
  useEffect(() => {
    const key = `${original.length}|${original.join('\u0000')}`;
    if (key !== lastHeaderKey.current) {
      lastHeaderKey.current = key;
      setNames(original.slice());
      setOrder(original.map((_, i) => i));
    }
  }, [original]);

  const applyBulk = (mode: CaseMode) => {
    if (mode === 'none') return;
    setNames((cur) => cur.map((n) => applyCase(n, mode)));
  };

  const move = (pos: number, dir: -1 | 1) => {
    setOrder((cur) => {
      const next = cur.slice();
      const target = pos + dir;
      if (target < 0 || target >= next.length) return cur;
      const a = next[pos];
      const b = next[target];
      if (a === undefined || b === undefined) return cur;
      next[pos] = b;
      next[target] = a;
      return next;
    });
  };

  const result = useMemo<{ output: string; error: string | null; dupWarn: string | null }>(() => {
    if (!input.trim()) return { output: '', error: null, dupWarn: null };
    const rows = parseCsv(input, delim);
    const head = rows[0];
    if (!head || head.length === 0) return { output: '', error: 'CSV has no header row.', dupWarn: null };

    const orderedOrig = order.filter((i) => i >= 0 && i < head.length);
    const orderedNames = orderedOrig.map((i) => (names[i] ?? head[i] ?? '').trim() || `col_${i + 1}`);
    const finalNames = dedupe(orderedNames);
    const hadDup = finalNames.some((n, i) => n !== orderedNames[i]);

    const body = rows.slice(1);
    const out: string[][] = [finalNames];
    for (const row of body) {
      out.push(orderedOrig.map((i) => row[i] ?? ''));
    }
    return {
      output: toCsv(out, delim),
      error: null,
      dupWarn: hadDup ? 'Duplicate header names were auto-suffixed (_2, _3, …).' : null,
    };
  }, [input, delim, names, order]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={setDelim}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DELIMS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Bulk case transform">
          <Select value="none" onValueChange={(v) => applyBulk(v as CaseMode)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="apply to all…" />
            </SelectTrigger>
            <SelectContent>
              {CASES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Headers (edit / reorder)" className="min-w-full">
          {order.length === 0 ? (
            <span className="text-xs text-muted-foreground">Load a CSV to edit its headers.</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {order.map((origIdx, pos) => (
                <div key={`${origIdx}-${pos}`} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {pos + 1}
                  </span>
                  <Input
                    value={names[origIdx] ?? ''}
                    onChange={(e) =>
                      setNames((cur) => {
                        const next = cur.slice();
                        next[origIdx] = e.target.value;
                        return next;
                      })
                    }
                    className="h-8 w-56 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">
                    was “{original[origIdx] ?? ''}”
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(pos, -1)}
                    disabled={pos === 0}
                    title="Move up"
                  >
                    <ArrowDownUp className="size-3.5 rotate-180" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(pos, 1)}
                    disabled={pos === order.length - 1}
                    title="Move down"
                  >
                    <ArrowDownUp className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />
      {result.dupWarn && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {result.dupWarn}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Input CSV">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              Sample
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row..."
            spellCheck={false}
            className="min-h-[300px] font-mono text-sm"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Renamed CSV">
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename="renamed.csv"
              mime="text/csv"
              disabled={!result.output}
              label="Download"
            />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[300px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar items={[order.length > 0 && `${order.length} columns`]} />
    </div>
  );
}
