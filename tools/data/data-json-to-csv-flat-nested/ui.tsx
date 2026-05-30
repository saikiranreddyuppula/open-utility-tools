'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const SAMPLE = `[
  { "id": 1, "user": { "name": "Alice" }, "scores": [90, 85] },
  { "id": 2, "user": { "name": "Bob" }, "scores": [70] }
]`;

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
const DELIM_CHAR: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Recursively flatten objects and arrays into dot-path leaves.
// Arrays index by position (a.0, a.1). Empty objects/arrays become empty-string leaves.
function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(prefix, '');
      return;
    }
    value.forEach((item, i) => {
      flatten(item, prefix ? `${prefix}.${i}` : String(i), out);
    });
  } else if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      out.set(prefix, '');
      return;
    }
    for (const [k, v] of entries) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (value === null || value === undefined) {
    out.set(prefix, '');
  } else {
    out.set(prefix, String(value));
  }
}

function formatField(field: string, delim: string): string {
  const needs = field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r');
  return needs ? `"${field.replace(/"/g, '""')}"` : field;
}

export default function JsonToCsvFlatNestedTool() {
  const [input, setInput] = useState('');
  const [delim, setDelim] = useState<DelimKey>('comma');

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

    const rowMaps: Array<Map<string, string>> = [];
    const headerOrder: string[] = [];
    const seen = new Set<string>();
    for (const el of parsed) {
      if (!isPlainObject(el)) {
        return { output: '', error: 'Every array element must be a JSON object.', rows: 0, cols: 0 };
      }
      const m = new Map<string, string>();
      flatten(el, '', m);
      for (const key of m.keys()) {
        if (!seen.has(key)) { seen.add(key); headerOrder.push(key); }
      }
      rowMaps.push(m);
    }

    const dch = DELIM_CHAR[delim];
    const lines: string[] = [];
    lines.push(headerOrder.map((h) => formatField(h, dch)).join(dch));
    for (const m of rowMaps) {
      lines.push(headerOrder.map((h) => formatField(m.get(h) ?? '', dch)).join(dch));
    }
    return { output: lines.join('\n'), error: null, rows: rowMaps.length, cols: headerOrder.length };
  }, [input, delim]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Nested JSON">
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
          <PanelHeader title="Flat CSV">
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
