'use client';

import { useCallback, useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `first,last,city,country
Ada,Lovelace,London,UK
Linus,Torvalds,Helsinki,FI
Grace,Hopper,New York,US`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type Mode = 'separator' | 'template';

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

export default function CsvMergeColumnsTool() {
  const [delim, setDelim] = useState(',');
  const [mode, setMode] = useState<Mode>('separator');
  const [sep, setSep] = useState(' ');
  const [template, setTemplate] = useState('{first} {last}');
  const [newCol, setNewCol] = useState('merged');
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [removeSources, setRemoveSources] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const header = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    return parseCsv(input, delim)[0] ?? [];
  }, [input, delim]);

  const toggleCol = useCallback((h: string) => {
    setSelected((cur) => (cur.includes(h) ? cur.filter((c) => c !== h) : [...cur, h]));
  }, []);

  const result = useMemo<{ output: string; error: string | null; rows: number }>(() => {
    if (!input.trim()) return { output: '', error: null, rows: 0 };
    const rows = parseCsv(input, delim);
    const head = rows[0];
    if (!head || head.length === 0) return { output: '', error: 'CSV has no header row.', rows: 0 };

    const name = newCol.trim() || 'merged';

    if (mode === 'separator') {
      const cols = selected.filter((s) => head.includes(s));
      if (cols.length === 0)
        return { output: '', error: 'Select at least one source column to merge.', rows: 0 };
      const idxs = cols.map((c) => head.indexOf(c));
      const body = rows.slice(1);
      const removeSet = removeSources ? new Set(idxs) : new Set<number>();
      const outHead = head.filter((_, i) => !removeSet.has(i)).concat(name);
      const out: string[][] = [outHead];
      for (const row of body) {
        const parts = idxs.map((i) => row[i] ?? '');
        const filtered = skipEmpty ? parts.filter((p) => p !== '') : parts;
        const merged = filtered.join(sep);
        const kept = row.filter((_, i) => !removeSet.has(i));
        // pad in case data row is short
        while (kept.length < outHead.length - 1) kept.push('');
        out.push([...kept, merged]);
      }
      return { output: toCsv(out, delim), error: null, rows: body.length };
    }

    // template mode
    const placeholders = Array.from(template.matchAll(/\{([^}]+)\}/g), (m) => m[1] ?? '');
    if (placeholders.length === 0)
      return { output: '', error: 'Template needs at least one {ColumnName} placeholder.', rows: 0 };
    const missing = placeholders.filter((p) => !head.includes(p));
    if (missing.length > 0)
      return { output: '', error: `Template references unknown column(s): ${missing.join(', ')}`, rows: 0 };

    const body = rows.slice(1);
    const usedIdxs = placeholders.map((p) => head.indexOf(p));
    const removeSet = removeSources ? new Set(usedIdxs) : new Set<number>();
    const outHead = head.filter((_, i) => !removeSet.has(i)).concat(name);
    const out: string[][] = [outHead];
    for (const row of body) {
      const merged = template.replace(/\{([^}]+)\}/g, (_full, key: string) => {
        const i = head.indexOf(key);
        return i >= 0 ? row[i] ?? '' : '';
      });
      const kept = row.filter((_, i) => !removeSet.has(i));
      while (kept.length < outHead.length - 1) kept.push('');
      out.push([...kept, merged]);
    }
    return { output: toCsv(out, delim), error: null, rows: body.length };
  }, [input, delim, mode, sep, template, newCol, skipEmpty, removeSources, selected]);

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
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="separator">Separator</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="New column name">
          <Input value={newCol} onChange={(e) => setNewCol(e.target.value)} className="h-8 w-40" />
        </Field>
        {mode === 'separator' ? (
          <>
            <Field label="Separator">
              <Input value={sep} onChange={(e) => setSep(e.target.value)} className="h-8 w-24" />
            </Field>
            <Field label="Source columns" className="min-w-full">
              <div className="flex flex-wrap gap-3">
                {header.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Load a CSV to choose columns.</span>
                ) : (
                  header.map((h, i) => (
                    <label key={`${i}-${h}`} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={selected.includes(h)}
                        onCheckedChange={() => toggleCol(h)}
                      />
                      {h === '' ? `(col ${i})` : h}
                    </label>
                  ))
                )}
              </div>
            </Field>
            <Field label="Options">
              <div className="flex h-8 items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={skipEmpty} onCheckedChange={setSkipEmpty} /> skip empty
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={removeSources} onCheckedChange={setRemoveSources} /> remove sources
                </label>
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label="Template ({Column} placeholders)" className="min-w-[20rem] flex-1">
              <Input
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-8 font-mono"
                placeholder="{first} {last}"
              />
            </Field>
            <Field label="Options">
              <label className="flex h-8 items-center gap-1.5 text-xs">
                <Switch checked={removeSources} onCheckedChange={setRemoveSources} /> remove sources
              </label>
            </Field>
          </>
        )}
      </OptionsBar>

      <ErrorBanner error={result.error} />

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
          <PanelHeader title="Merged CSV">
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename="merged.csv"
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

      <StatBar items={[result.rows > 0 && `${result.rows} data rows`]} />
    </div>
  );
}
