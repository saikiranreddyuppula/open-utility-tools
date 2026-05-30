'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OutputMode = 'table' | 'root' | 'json';
type SortMode = 'name' | 'source';

const SAMPLE = `:root {
  --color-primary: #3b82f6;
  --color-bg: #ffffff;
  --space-sm: 8px;
  --space-md: 16px; /* base spacing */
}

/* dark theme overrides */
.theme-dark {
  --color-bg: #0f172a;
  --color-primary: #60a5fa;
}

.button {
  --space-sm: 6px;
  padding: var(--space-sm) var(--space-md);
}`;

interface VarDecl {
  name: string;
  value: string;
  scope: string;
  order: number;
}

/** Strip /* *​/ comments so they don't pollute matches. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Walk the CSS tracking the current selector scope by counting braces,
 * collecting every --name: value declaration.
 */
function extract(css: string): VarDecl[] {
  const clean = stripComments(css);
  const decls: VarDecl[] = [];
  let order = 0;

  // Match a selector prelude + its block, non-greedy. Nested blocks are rare in
  // plain CSS variable files, so a flat selector { ... } scan is sufficient.
  const blockRe = /([^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const declRe = /(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;

  while ((m = blockRe.exec(clean)) !== null) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ') || '(unknown)';
    const body = m[2] ?? '';
    let d: RegExpExecArray | null;
    declRe.lastIndex = 0;
    while ((d = declRe.exec(body)) !== null) {
      const name = d[1];
      const value = d[2];
      if (name === undefined || value === undefined) continue;
      decls.push({ name, value: value.trim(), scope: selector, order: order++ });
    }
  }

  // Also catch top-level declarations not wrapped in a block (uncommon but safe).
  const stripped = clean.replace(blockRe, '');
  declRe.lastIndex = 0;
  let t: RegExpExecArray | null;
  while ((t = declRe.exec(stripped)) !== null) {
    const name = t[1];
    const value = t[2];
    if (name === undefined || value === undefined) continue;
    decls.push({ name, value: value.trim(), scope: '(top-level)', order: order++ });
  }

  return decls;
}

export default function CssVariableExtractor() {
  const [output, setOutput] = useState<OutputMode>('table');
  const [sort, setSort] = useState<SortMode>('name');
  const [filter, setFilter] = useState('');

  return (
    <TextToolLayout
      deps={[output, sort, filter]}
      transform={(input) => {
        if (!input.trim()) return '';
        const all = extract(input);
        if (all.length === 0) {
          throw new Error('No CSS custom properties (--name: value) found.');
        }

        const needle = filter.trim().toLowerCase();
        const filtered = needle
          ? all.filter((d) => d.name.toLowerCase().includes(needle))
          : all;

        // Deduplicate by name, keeping the LAST declaration in source order
        // (CSS cascade: later wins) but recording duplicate counts.
        const byName = new Map<string, VarDecl>();
        const dupCount = new Map<string, number>();
        for (const d of filtered) {
          dupCount.set(d.name, (dupCount.get(d.name) ?? 0) + 1);
          byName.set(d.name, d);
        }

        let unique = [...byName.values()];
        if (unique.length === 0) {
          return `No variables match filter "${filter.trim()}".`;
        }
        if (sort === 'name') {
          unique = unique.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          unique = unique.sort((a, b) => a.order - b.order);
        }

        if (output === 'json') {
          const obj: Record<string, string> = {};
          for (const d of unique) obj[d.name] = d.value;
          return JSON.stringify(obj, null, 2);
        }

        if (output === 'root') {
          const body = unique.map((d) => `  ${d.name}: ${d.value};`).join('\n');
          return `:root {\n${body}\n}`;
        }

        // table
        const nameW = Math.max(...unique.map((d) => d.name.length), 4);
        const valW = Math.max(...unique.map((d) => d.value.length), 5);
        const lines: string[] = [];
        lines.push(
          `${'NAME'.padEnd(nameW)}  ${'VALUE'.padEnd(valW)}  SCOPE`,
        );
        lines.push('-'.repeat(nameW + valW + 12));
        for (const d of unique) {
          const dups = dupCount.get(d.name) ?? 1;
          const dupNote = dups > 1 ? ` (×${dups})` : '';
          lines.push(
            `${d.name.padEnd(nameW)}  ${d.value.padEnd(valW)}  ${d.scope}${dupNote}`,
          );
        }
        const dupVars = [...dupCount.entries()].filter(([, c]) => c > 1).length;
        lines.push('');
        lines.push(
          `${unique.length} unique variable(s)${dupVars ? `, ${dupVars} with duplicate definitions` : ''}.`,
        );
        return lines.join('\n');
      }}
      inputLabel="CSS"
      outputLabel="Extracted variables"
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName={output === 'json' ? 'variables.json' : output === 'root' ? 'variables.css' : 'variables.txt'}
      downloadMime={output === 'json' ? 'application/json' : 'text/plain'}
      options={
        <>
          <Field label="Output">
            <Tabs value={output} onValueChange={(v) => setOutput(v as OutputMode)}>
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="root">:root</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Sort by">
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A→Z)</SelectItem>
                <SelectItem value="source">Source order</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Filter by name">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="e.g. color"
              className="w-40"
              spellCheck={false}
            />
          </Field>
        </>
      }
    />
  );
}
