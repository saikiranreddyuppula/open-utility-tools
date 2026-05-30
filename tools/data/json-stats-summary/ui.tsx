'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Format = 'text' | 'json';

type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeOf(v: unknown): JsonType {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'null';
}

interface Stats {
  nodes: number;
  maxDepth: number;
  typeCounts: Record<JsonType, number>;
  keyFreq: Map<string, number>;
  longestString: number;
  largestArray: number;
  paths: Map<string, Set<JsonType>>;
}

function elementTypes(arr: unknown[]): string {
  const set = new Set<JsonType>();
  for (const el of arr) set.add(typeOf(el));
  if (set.size === 0) return 'empty';
  return Array.from(set).join(' | ');
}

function analyze(value: unknown): Stats {
  const stats: Stats = {
    nodes: 0,
    maxDepth: 0,
    typeCounts: { object: 0, array: 0, string: 0, number: 0, boolean: 0, null: 0 },
    keyFreq: new Map<string, number>(),
    longestString: 0,
    largestArray: 0,
    paths: new Map<string, Set<JsonType>>(),
  };

  const walk = (node: unknown, depth: number, path: string) => {
    stats.nodes += 1;
    if (depth > stats.maxDepth) stats.maxDepth = depth;
    const t = typeOf(node);
    stats.typeCounts[t] += 1;

    const existing = stats.paths.get(path) ?? new Set<JsonType>();
    existing.add(t);
    stats.paths.set(path, existing);

    if (t === 'string' && typeof node === 'string') {
      if (node.length > stats.longestString) stats.longestString = node.length;
    } else if (t === 'array' && Array.isArray(node)) {
      if (node.length > stats.largestArray) stats.largestArray = node.length;
      node.forEach((el) => walk(el, depth + 1, path ? `${path}[]` : '[]'));
    } else if (t === 'object' && isPlainObject(node)) {
      for (const key of Object.keys(node)) {
        stats.keyFreq.set(key, (stats.keyFreq.get(key) ?? 0) + 1);
        walk(node[key], depth + 1, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(value, 1, '');
  return stats;
}

export default function JsonStatsSummaryTool() {
  const [format, setFormat] = useState<Format>('text');
  const [includePaths, setIncludePaths] = useState(true);
  const [topN, setTopN] = useState('15');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let value: unknown;
      try {
        value = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const stats = analyze(value);
      const topNum = Number(topN);
      const limit = Number.isFinite(topNum) && topNum > 0 ? Math.floor(topNum) : 15;

      const sortedKeys = Array.from(stats.keyFreq.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit);

      const pathEntries = Array.from(stats.paths.entries())
        .filter(([p]) => p !== '')
        .sort((a, b) => a[0].localeCompare(b[0]));

      if (format === 'json') {
        const report: Record<string, unknown> = {
          totalNodes: stats.nodes,
          maxDepth: stats.maxDepth,
          typeCounts: stats.typeCounts,
          uniqueKeys: stats.keyFreq.size,
          longestStringLength: stats.longestString,
          largestArrayLength: stats.largestArray,
          topKeys: sortedKeys.map(([k, n]) => ({ key: k, count: n })),
        };
        if (includePaths) {
          report.pathTypes = Object.fromEntries(
            pathEntries.map(([p, set]) => [p, Array.from(set).join(' | ')]),
          );
        }
        return JSON.stringify(report, null, 2);
      }

      const lines: string[] = [];
      lines.push('=== JSON Structure Stats ===');
      lines.push(`Total nodes:        ${stats.nodes}`);
      lines.push(`Max nesting depth:  ${stats.maxDepth}`);
      lines.push(`Unique object keys: ${stats.keyFreq.size}`);
      lines.push(`Longest string:     ${stats.longestString} chars`);
      lines.push(`Largest array:      ${stats.largestArray} items`);
      lines.push('');
      lines.push('Type counts:');
      (Object.keys(stats.typeCounts) as JsonType[]).forEach((t) => {
        lines.push(`  ${t.padEnd(8)} ${stats.typeCounts[t]}`);
      });
      lines.push('');
      lines.push(`Top ${Math.min(limit, sortedKeys.length)} keys by frequency:`);
      sortedKeys.forEach(([k, n]) => lines.push(`  ${String(n).padStart(4)}  ${k}`));

      if (includePaths) {
        lines.push('');
        lines.push('Path type map (schema skeleton):');
        // Infer array element types from the root value for nicer output where possible.
        if (Array.isArray(value)) {
          lines.push(`  [] (root array of): ${elementTypes(value)}`);
        }
        pathEntries.forEach(([p, set]) => {
          lines.push(`  ${p}: ${Array.from(set).join(' | ')}`);
        });
      }

      return lines.join('\n');
    },
    [format, includePaths, topN],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[format, includePaths, topN]}
      inputLabel="JSON document"
      outputLabel="Structure report"
      sample={JSON.stringify(
        {
          users: [
            { id: 1, name: 'Ada', roles: ['admin'], meta: { active: true } },
            { id: 2, name: 'Linus', roles: ['dev', 'ops'], meta: { active: false } },
          ],
          page: 1,
          total: 2,
        },
        null,
        2,
      )}
      downloadName="json-stats.txt"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Output">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Path type map">
            <Switch checked={includePaths} onCheckedChange={setIncludePaths} />
          </Field>
          <Field label="Top N keys">
            <Input value={topN} onChange={(e) => setTopN(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
        </>
      }
    />
  );
}
