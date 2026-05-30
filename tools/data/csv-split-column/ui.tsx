'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `id,fullname,coords
1,Ada Lovelace,51.5/-0.1
2,Linus Torvalds,60.2/24.9
3,Grace Hopper,40.7/-74.0`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type SplitMode = 'delim' | 'regex' | 'positions';

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

function splitByPositions(value: string, cuts: number[]): string[] {
  const sorted = [...cuts].filter((c) => c > 0).sort((a, b) => a - b);
  const parts: string[] = [];
  let prev = 0;
  for (const c of sorted) {
    parts.push(value.slice(prev, c));
    prev = c;
  }
  parts.push(value.slice(prev));
  return parts;
}

export default function CsvSplitColumnTool() {
  const [delim, setDelim] = useState(',');
  const [sourceCol, setSourceCol] = useState('');
  const [mode, setMode] = useState<SplitMode>('delim');
  const [pattern, setPattern] = useState(' ');
  const [positions, setPositions] = useState('');
  const [maxSplits, setMaxSplits] = useState('');
  const [names, setNames] = useState('');
  const [keepRemainder, setKeepRemainder] = useState(true);
  const [removeSource, setRemoveSource] = useState(false);
  const [input, setInput] = useState('');

  const header = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    return parseCsv(input, delim)[0] ?? [];
  }, [input, delim]);

  const result = useMemo<{ output: string; error: string | null; parts: number }>(() => {
    if (!input.trim()) return { output: '', error: null, parts: 0 };
    const rows = parseCsv(input, delim);
    const head = rows[0];
    if (!head || head.length === 0) return { output: '', error: 'CSV has no header row.', parts: 0 };
    if (!sourceCol) return { output: '', error: 'Choose a source column to split.', parts: 0 };
    const srcIdx = head.indexOf(sourceCol);
    if (srcIdx < 0) return { output: '', error: `Column "${sourceCol}" not found.`, parts: 0 };

    let cuts: number[] = [];
    let re: RegExp | null = null;
    const max = maxSplits.trim() === '' ? Infinity : Math.floor(Number(maxSplits));

    if (mode === 'regex') {
      try {
        re = new RegExp(pattern);
      } catch {
        return { output: '', error: `Invalid regex: ${pattern}`, parts: 0 };
      }
    } else if (mode === 'positions') {
      cuts = positions
        .split(',')
        .map((s) => Math.floor(Number(s.trim())))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (cuts.length === 0)
        return { output: '', error: 'Enter comma-separated cut positions (e.g. 3,6).', parts: 0 };
    } else if (pattern === '') {
      return { output: '', error: 'Enter a delimiter to split on.', parts: 0 };
    }
    if (mode !== 'positions' && Number.isFinite(max) && max < 1)
      return { output: '', error: 'Max splits must be ≥ 1 (or blank).', parts: 0 };

    const body = rows.slice(1);

    const splitValue = (value: string): string[] => {
      if (mode === 'positions') return splitByPositions(value, cuts);
      let parts: string[];
      if (mode === 'regex' && re) parts = value.split(re);
      else parts = value.split(pattern);
      if (Number.isFinite(max) && parts.length > max) {
        if (keepRemainder) {
          const headParts = parts.slice(0, max - 1);
          // rejoin remainder using a representative separator
          const sepForJoin = mode === 'delim' ? pattern : '';
          const rest = parts.slice(max - 1).join(sepForJoin);
          parts = [...headParts, rest];
        } else {
          parts = parts.slice(0, max);
        }
      }
      return parts;
    };

    const splitRows = body.map((row) => splitValue(row[srcIdx] ?? ''));
    const maxParts = splitRows.reduce((m, p) => Math.max(m, p.length), 0);

    const userNames = names
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const newNames: string[] = [];
    for (let i = 0; i < maxParts; i++) {
      newNames.push(userNames[i] ?? `${sourceCol}_${i + 1}`);
    }

    const removeSet = removeSource ? new Set([srcIdx]) : new Set<number>();
    const baseHead = head.filter((_, i) => !removeSet.has(i));
    const outHead = [...baseHead, ...newNames];
    const out: string[][] = [outHead];
    for (let r = 0; r < body.length; r++) {
      const row = body[r] ?? [];
      const base = row.filter((_, i) => !removeSet.has(i));
      const parts = splitRows[r] ?? [];
      const padded: string[] = [];
      for (let i = 0; i < maxParts; i++) padded.push(parts[i] ?? '');
      out.push([...base, ...padded]);
    }

    return { output: toCsv(out, delim), error: null, parts: maxParts };
  }, [input, delim, sourceCol, mode, pattern, positions, maxSplits, names, keepRemainder, removeSource]);

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
        <Field label="Source column">
          <Select value={sourceCol} onValueChange={setSourceCol}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="column" />
            </SelectTrigger>
            <SelectContent>
              {header.length === 0 ? (
                <SelectItem value="__none" disabled>
                  (load CSV first)
                </SelectItem>
              ) : (
                header.map((h, i) => (
                  <SelectItem key={`${i}-${h}`} value={h}>
                    {h === '' ? `(col ${i})` : h}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Split by">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SplitMode)}>
            <TabsList>
              <TabsTrigger value="delim">Delimiter</TabsTrigger>
              <TabsTrigger value="regex">Regex</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'positions' ? (
          <Field label="Cut positions (e.g. 3,6)">
            <Input
              value={positions}
              onChange={(e) => setPositions(e.target.value)}
              className="h-8 w-40 font-mono"
              placeholder="3,6"
            />
          </Field>
        ) : (
          <Field label={mode === 'regex' ? 'Regex pattern' : 'Delimiter string'}>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="h-8 w-40 font-mono"
              placeholder={mode === 'regex' ? '\\s+' : 'space'}
            />
          </Field>
        )}
        {mode !== 'positions' && (
          <Field label="Max splits (blank = all)">
            <Input
              value={maxSplits}
              onChange={(e) => setMaxSplits(e.target.value)}
              inputMode="numeric"
              className="h-8 w-28"
            />
          </Field>
        )}
        <Field label="New column names (comma sep, optional)" className="min-w-[18rem] flex-1">
          <Input
            value={names}
            onChange={(e) => setNames(e.target.value)}
            className="h-8 font-mono"
            placeholder="first,last"
          />
        </Field>
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            {mode !== 'positions' && (
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={keepRemainder} onCheckedChange={setKeepRemainder} /> keep remainder
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={removeSource} onCheckedChange={setRemoveSource} /> remove source
            </label>
          </div>
        </Field>
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
          <PanelHeader title="Split CSV">
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename="split.csv"
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

      <StatBar items={[result.parts > 0 && `split into ${result.parts} new column(s)`]} />
    </div>
  );
}
