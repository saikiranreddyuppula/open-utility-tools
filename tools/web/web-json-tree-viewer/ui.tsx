'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const SAMPLE =
  '{\n  "name": "Ada",\n  "age": 36,\n  "active": true,\n  "roles": ["admin", "editor"],\n  "address": { "city": "London", "zip": null }\n}';

function typeOf(value: Json): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

interface CountResult {
  nodes: number;
  objects: number;
  arrays: number;
}

function countNodes(value: Json, acc: CountResult): void {
  acc.nodes += 1;
  if (Array.isArray(value)) {
    acc.arrays += 1;
    for (const item of value) countNodes(item, acc);
  } else if (value !== null && typeof value === 'object') {
    acc.objects += 1;
    for (const v of Object.values(value)) countNodes(v, acc);
  }
}

interface NodeProps {
  label: string;
  value: Json;
  depth: number;
  collapsedAll: number;
  expandedAll: number;
}

function preview(value: Json): string {
  if (Array.isArray(value)) return `[] ${value.length} item${value.length === 1 ? '' : 's'}`;
  const keys = Object.keys(value as Record<string, Json>);
  return `{} ${keys.length} key${keys.length === 1 ? '' : 's'}`;
}

function TreeNode({ label, value, depth, collapsedAll, expandedAll }: NodeProps) {
  const type = typeOf(value);
  const isContainer = type === 'array' || type === 'object';

  // Open by default for the first two levels; respond to global expand/collapse.
  const [open, setOpen] = useState(depth < 2);

  // Re-sync with global expand/collapse triggers.
  const lastCollapse = useMemo(() => collapsedAll, [collapsedAll]);
  const lastExpand = useMemo(() => expandedAll, [expandedAll]);
  const [seenCollapse, setSeenCollapse] = useState(collapsedAll);
  const [seenExpand, setSeenExpand] = useState(expandedAll);

  if (lastCollapse !== seenCollapse) {
    setSeenCollapse(lastCollapse);
    setOpen(false);
  }
  if (lastExpand !== seenExpand) {
    setSeenExpand(lastExpand);
    setOpen(true);
  }

  const indent = { paddingLeft: `${depth * 16}px` };

  if (!isContainer) {
    let rendered: string;
    let valueClass = 'text-foreground';
    if (type === 'string') {
      rendered = `"${value as string}"`;
      valueClass = 'text-emerald-600 dark:text-emerald-400';
    } else if (type === 'number') {
      rendered = String(value);
      valueClass = 'text-blue-600 dark:text-blue-400';
    } else if (type === 'boolean') {
      rendered = String(value);
      valueClass = 'text-purple-600 dark:text-purple-400';
    } else {
      rendered = 'null';
      valueClass = 'text-muted-foreground';
    }
    return (
      <div className="flex items-baseline gap-2 py-0.5 font-mono text-xs" style={indent}>
        <span className="w-3 shrink-0" />
        <span className="text-muted-foreground">{label}:</span>
        <span className={cn('break-all', valueClass)}>{rendered}</span>
        <span className="text-[10px] text-muted-foreground/60">{type}</span>
      </div>
    );
  }

  const entries: [string, Json][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, Json>);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 py-0.5 text-left font-mono text-xs hover:bg-muted/50"
        style={indent}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-foreground/70">{preview(value)}</span>
      </button>
      {open ? (
        <div>
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              label={k}
              value={v}
              depth={depth + 1}
              collapsedAll={collapsedAll}
              expandedAll={expandedAll}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function JsonTreeViewerTool() {
  const [input, setInput] = useState('');
  const [collapsedAll, setCollapsedAll] = useState(0);
  const [expandedAll, setExpandedAll] = useState(0);

  const parsed = useMemo<{ value: Json | undefined; error: string | null }>(() => {
    if (!input.trim()) return { value: undefined, error: null };
    try {
      return { value: JSON.parse(input) as Json, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      return { value: undefined, error: msg };
    }
  }, [input]);

  const stats = useMemo<CountResult | null>(() => {
    if (parsed.value === undefined) return null;
    const acc: CountResult = { nodes: 0, objects: 0, arrays: 0 };
    countNodes(parsed.value, acc);
    return acc;
  }, [parsed.value]);

  const loadSample = useCallback(() => setInput(SAMPLE), []);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="JSON input">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSample}>
              Sample
            </Button>
            <CopyButton value={() => input} />
          </div>
        </PanelHeader>
        <div className="p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Paste JSON here, e.g. {"a": 1, "b": [2, 3]}'
            className="min-h-40 font-mono text-xs"
          />
        </div>
      </Panel>

      <ErrorBanner error={parsed.error} />

      {parsed.value !== undefined ? (
        <Panel>
          <PanelHeader title="Tree">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedAll((n) => n + 1)}
              >
                Expand all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollapsedAll((n) => n + 1)}
              >
                Collapse all
              </Button>
            </div>
          </PanelHeader>
          {stats ? (
            <StatBar
              items={[
                `${stats.nodes} node${stats.nodes === 1 ? '' : 's'}`,
                `${stats.objects} object${stats.objects === 1 ? '' : 's'}`,
                `${stats.arrays} array${stats.arrays === 1 ? '' : 's'}`,
              ]}
            />
          ) : null}
          <div className="overflow-x-auto px-2 py-2">
            <TreeNode
              label="root"
              value={parsed.value}
              depth={0}
              collapsedAll={collapsedAll}
              expandedAll={expandedAll}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
