'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const SAMPLE = `[
  { "id": 1, "name": "Alice", "addr": { "city": "NYC", "zip": "10001" }, "tags": ["a", "b"] },
  { "id": 2, "name": "Bob", "addr": { "city": "LA" }, "tags": [] }
]`;

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
const DELIM_CHAR: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Explode: nested plain objects become dotted columns up to `maxDepth`;
// arrays (and objects beyond depth) are serialized as JSON strings.
function flattenExplode(
  obj: Record<string, unknown>,
  prefix: string,
  depth: number,
  maxDepth: number,
  out: Map<string, string>,
): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && depth < maxDepth) {
      flattenExplode(v, key, depth + 1, maxDepth, out);
    } else if (v === null || v === undefined) {
      out.set(key, '');
    } else if (Array.isArray(v) || isPlainObject(v)) {
      out.set(key, JSON.stringify(v));
    } else {
      out.set(key, String(v));
    }
  }
}

function formatField(field: string, delim: string, quoteAll: boolean): string {
  const needs = quoteAll || field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r');
  return needs ? `"${field.replace(/"/g, '""')}"` : field;
}

export default function JsonToCsvExplodeArrayTool() {
  const [input, setInput] = useState('');
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [depth, setDepth] = useState('10');
  const [bom, setBom] = useState(false);
  const [quoteAll, setQuoteAll] = useState(false);

  const result = useMemo<{ output: string; error: string | null; rows: number; cols: number }>(() => {
    if (!input.trim()) return { output: '', error: null, rows: 0, cols: 0 };
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return { output: '', error: `Invalid JSON: ${(e as Error).message}`, rows: 0, cols: 0 };
    }
    if (!Array.isArray(parsed)) {
      return { output: '', error: 'Input must be a JSON array of objects.', rows: 0, cols: 0 };
    }
    const dn = Number(depth);
    if (!Number.isFinite(dn) || !Number.isInteger(dn) || dn < 1) {
      return { output: '', error: 'Flatten depth must be a positive integer.', rows: 0, cols: 0 };
    }

    const rowMaps: Array<Map<string, string>> = [];
    const headerOrder: string[] = [];
    const seen = new Set<string>();
    for (const el of parsed) {
      if (!isPlainObject(el)) {
        return { output: '', error: 'Every array element must be a JSON object.', rows: 0, cols: 0 };
      }
      const m = new Map<string, string>();
      flattenExplode(el, '', 0, dn, m);
      for (const key of m.keys()) {
        if (!seen.has(key)) { seen.add(key); headerOrder.push(key); }
      }
      rowMaps.push(m);
    }

    const dch = DELIM_CHAR[delim];
    const lines: string[] = [];
    lines.push(headerOrder.map((h) => formatField(h, dch, quoteAll)).join(dch));
    for (const m of rowMaps) {
      lines.push(headerOrder.map((h) => formatField(m.get(h) ?? '', dch, quoteAll)).join(dch));
    }
    const csv = (bom ? '﻿' : '') + lines.join('\n');
    return { output: csv, error: null, rows: rowMaps.length, cols: headerOrder.length };
  }, [input, delim, depth, bom, quoteAll]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Flatten depth">
          <Input value={depth} onChange={(e) => setDepth(e.target.value)} inputMode="numeric" className="w-20" />
        </Field>
        <Field label="Include BOM">
          <Switch checked={bom} onCheckedChange={setBom} />
        </Field>
        <Field label="Quote all">
          <Switch checked={quoteAll} onCheckedChange={setQuoteAll} />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="[ { ... }, { ... } ]"
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="CSV">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar
        items={[
          result.rows > 0 ? `${result.rows} rows` : false,
          result.cols > 0 ? `${result.cols} columns` : false,
        ]}
      />
    </div>
  );
}
