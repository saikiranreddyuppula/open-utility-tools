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
import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `id,name,age,city
1,Ada,36,London
2,Linus,54,Helsinki
3,Grace,42,New York
4,Dennis,41,New York
5,Margaret,33,Boston`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type Op =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'ncontains'
  | 'starts'
  | 'ends'
  | 'regex'
  | 'empty'
  | 'nempty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between';

const OPS: { value: Op; label: string; needsValue: boolean; needsTwo?: boolean }[] = [
  { value: 'eq', label: 'equals', needsValue: true },
  { value: 'neq', label: 'not equals', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'ncontains', label: 'not contains', needsValue: true },
  { value: 'starts', label: 'starts with', needsValue: true },
  { value: 'ends', label: 'ends with', needsValue: true },
  { value: 'regex', label: 'matches regex', needsValue: true },
  { value: 'empty', label: 'is empty', needsValue: false },
  { value: 'nempty', label: 'is not empty', needsValue: false },
  { value: 'gt', label: '> (numeric)', needsValue: true },
  { value: 'gte', label: '>= (numeric)', needsValue: true },
  { value: 'lt', label: '< (numeric)', needsValue: true },
  { value: 'lte', label: '<= (numeric)', needsValue: true },
  { value: 'between', label: 'between (numeric)', needsValue: true, needsTwo: true },
];

interface Cond {
  id: number;
  col: string;
  op: Op;
  val: string;
  val2: string;
}

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

let condCounter = 1;

export default function CsvFilterRowsTool() {
  const [delim, setDelim] = useState(',');
  const [combiner, setCombiner] = useState<'and' | 'or'>('and');
  const [invert, setInvert] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [input, setInput] = useState('');
  const [conds, setConds] = useState<Cond[]>([{ id: 0, col: '', op: 'contains', val: '', val2: '' }]);

  const header = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    return parseCsv(input, delim)[0] ?? [];
  }, [input, delim]);

  const result = useMemo<{ output: string; error: string | null; kept: number; dropped: number }>(() => {
    if (!input.trim()) return { output: '', error: null, kept: 0, dropped: 0 };
    const rows = parseCsv(input, delim);
    const head = rows[0];
    if (!head || head.length === 0) return { output: '', error: 'CSV has no header row.', kept: 0, dropped: 0 };

    const active = conds.filter((c) => c.col !== '');
    if (active.length === 0)
      return { output: '', error: 'Add at least one condition (choose a column).', kept: 0, dropped: 0 };

    for (const c of active) {
      if (!head.includes(c.col)) return { output: '', error: `Column "${c.col}" not found.`, kept: 0, dropped: 0 };
      if (c.op === 'regex') {
        try {
          new RegExp(c.val);
        } catch {
          return { output: '', error: `Invalid regex: ${c.val}`, kept: 0, dropped: 0 };
        }
      }
    }

    const evalCond = (cell: string, c: Cond): boolean => {
      const eq = (a: string, b: string) => (caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase());
      const inc = (a: string, b: string) =>
        caseSensitive ? a.includes(b) : a.toLowerCase().includes(b.toLowerCase());
      switch (c.op) {
        case 'eq':
          return eq(cell, c.val);
        case 'neq':
          return !eq(cell, c.val);
        case 'contains':
          return inc(cell, c.val);
        case 'ncontains':
          return !inc(cell, c.val);
        case 'starts':
          return caseSensitive
            ? cell.startsWith(c.val)
            : cell.toLowerCase().startsWith(c.val.toLowerCase());
        case 'ends':
          return caseSensitive
            ? cell.endsWith(c.val)
            : cell.toLowerCase().endsWith(c.val.toLowerCase());
        case 'regex': {
          const re = new RegExp(c.val, caseSensitive ? '' : 'i');
          return re.test(cell);
        }
        case 'empty':
          return cell.trim() === '';
        case 'nempty':
          return cell.trim() !== '';
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          const n = Number(cell);
          const t = Number(c.val);
          if (!Number.isFinite(n) || !Number.isFinite(t)) return false;
          if (c.op === 'gt') return n > t;
          if (c.op === 'gte') return n >= t;
          if (c.op === 'lt') return n < t;
          return n <= t;
        }
        case 'between': {
          const n = Number(cell);
          const lo = Number(c.val);
          const hi = Number(c.val2);
          if (!Number.isFinite(n) || !Number.isFinite(lo) || !Number.isFinite(hi)) return false;
          return n >= Math.min(lo, hi) && n <= Math.max(lo, hi);
        }
        default:
          return false;
      }
    };

    const body = rows.slice(1);
    let kept = 0;
    let dropped = 0;
    const out: string[][] = [];
    for (const row of body) {
      const results = active.map((c) => {
        const idx = head.indexOf(c.col);
        return evalCond(row[idx] ?? '', c);
      });
      const matched = combiner === 'and' ? results.every(Boolean) : results.some(Boolean);
      const keep = invert ? !matched : matched;
      if (keep) {
        out.push(row);
        kept++;
      } else {
        dropped++;
      }
    }

    return { output: toCsv([head, ...out], delim), error: null, kept, dropped };
  }, [input, delim, conds, combiner, invert, caseSensitive]);

  const addCond = useCallback(
    () => setConds((cs) => [...cs, { id: condCounter++, col: '', op: 'contains', val: '', val2: '' }]),
    []
  );
  const removeCond = useCallback((id: number) => setConds((cs) => cs.filter((c) => c.id !== id)), []);
  const updateCond = useCallback(
    (id: number, patch: Partial<Cond>) =>
      setConds((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    []
  );

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
        <Field label="Combine">
          <Select value={combiner} onValueChange={(v) => setCombiner(v as 'and' | 'or')}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={invert} onCheckedChange={setInvert} /> drop matches
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} /> case sensitive
            </label>
          </div>
        </Field>
        <Field label="Conditions" className="min-w-full">
          <div className="flex flex-col gap-2">
            {conds.map((c) => {
              const opDef = OPS.find((o) => o.value === c.op);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <Select value={c.col} onValueChange={(v) => updateCond(c.id, { col: v })}>
                    <SelectTrigger className="h-8 w-36">
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
                  <Select value={c.op} onValueChange={(v) => updateCond(c.id, { op: v as Op })}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {opDef?.needsValue && (
                    <Input
                      value={c.val}
                      onChange={(e) => updateCond(c.id, { val: e.target.value })}
                      placeholder={opDef.needsTwo ? 'min' : 'value'}
                      className="h-8 w-32"
                    />
                  )}
                  {opDef?.needsTwo && (
                    <Input
                      value={c.val2}
                      onChange={(e) => updateCond(c.id, { val2: e.target.value })}
                      placeholder="max"
                      className="h-8 w-24"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCond(c.id)}
                    disabled={conds.length <= 1}
                    title="Remove condition"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })}
            <div>
              <Button variant="secondary" size="sm" onClick={addCond}>
                <Plus className="size-3.5" /> Add condition
              </Button>
            </div>
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
          <PanelHeader title="Filtered CSV">
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename="filtered.csv"
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

      <StatBar items={[`${result.kept} kept`, `${result.dropped} dropped`]} />
    </div>
  );
}
