'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SAMPLE = JSON.stringify(
  {
    name: 'project',
    version: '1.0.0',
    active: true,
    contributors: [
      { name: 'Ada', commits: 120 },
      { name: 'Linus', commits: 88 },
    ],
    meta: { tags: ['cli', 'tool'], stars: 4200, archived: null },
  },
  null,
  2,
);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function badgeClass(type: string): string {
  switch (type) {
    case 'string':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'number':
      return 'text-blue-600 dark:text-blue-400';
    case 'boolean':
      return 'text-purple-600 dark:text-purple-400';
    case 'null':
      return 'text-muted-foreground';
    case 'array':
    case 'object':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}

function previewPrimitive(value: unknown): string {
  const t = typeOf(value);
  if (t === 'string') return JSON.stringify(value);
  if (t === 'null') return 'null';
  return String(value);
}

function countNodes(value: unknown): number {
  const t = typeOf(value);
  if (t === 'array') {
    const arr = value as unknown[];
    let total = arr.length;
    for (let i = 0; i < arr.length; i++) total += countNodes(arr[i]);
    return total;
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    let total = keys.length;
    for (const k of keys) total += countNodes(obj[k]);
    return total;
  }
  return 0;
}

function TreeNode({
  nodeKey,
  value,
  depth,
  defaultOpen,
}: {
  nodeKey: string | number | null;
  value: unknown;
  depth: number;
  defaultOpen: boolean;
}) {
  const type = typeOf(value);
  const isContainer = type === 'object' || type === 'array';
  const [open, setOpen] = useState(defaultOpen);

  const entries = useMemo<Array<[string | number, unknown]>>(() => {
    if (type === 'array') {
      return (value as unknown[]).map((v, i) => [i, v] as [number, unknown]);
    }
    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj).map((k) => [k, obj[k]] as [string, unknown]);
    }
    return [];
  }, [type, value]);

  const childCount = entries.length;
  const summary = type === 'array' ? `[ ${childCount} ]` : `{ ${childCount} }`;

  return (
    <div className="font-mono text-sm leading-6">
      <div
        className={cn('flex items-start gap-1', isContainer && 'cursor-pointer select-none')}
        onClick={isContainer ? () => setOpen((o) => !o) : undefined}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <span className="mt-0.5 inline-flex w-4 shrink-0 justify-center text-muted-foreground">
          {isContainer ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </span>
        {nodeKey !== null && (
          <span className="text-foreground">
            {typeof nodeKey === 'number' ? <span className="text-muted-foreground">{nodeKey}</span> : nodeKey}
            <span className="text-muted-foreground">: </span>
          </span>
        )}
        <span className={cn('shrink-0', badgeClass(type))}>
          {isContainer ? (
            <span>
              {summary}
              {!open && childCount > 0 && (
                <span className="ml-1 text-muted-foreground">{type === 'array' ? 'array' : 'object'}</span>
              )}
            </span>
          ) : (
            previewPrimitive(value)
          )}
        </span>
      </div>
      {isContainer && open && (
        <div>
          {entries.map(([k, v]) => (
            <TreeNode key={String(k)} nodeKey={k} value={v} depth={depth + 1} defaultOpen={defaultOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JsonTreeViewerTool() {
  const [json, setJson] = useState(SAMPLE);
  const [expandKey, setExpandKey] = useState(0);
  const [allOpen, setAllOpen] = useState(true);

  const parsed = useMemo<{ value: JsonValue | undefined; error: string | null }>(() => {
    if (json.trim() === '') return { value: undefined, error: null };
    try {
      return { value: JSON.parse(json) as JsonValue, error: null };
    } catch (e) {
      return { value: undefined, error: `Invalid JSON: ${(e as Error).message}` };
    }
  }, [json]);

  const total = useMemo(() => (parsed.value === undefined ? 0 : countNodes(parsed.value)), [parsed.value]);
  const rootType = parsed.value === undefined ? '' : typeOf(parsed.value);

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner error={parsed.error} />
      <OptionsBar>
        <Field label="View controls">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAllOpen(true);
                setExpandKey((k) => k + 1);
              }}
            >
              Expand all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAllOpen(false);
                setExpandKey((k) => k + 1);
              }}
            >
              Collapse all
            </Button>
          </div>
        </Field>
      </OptionsBar>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON input" />
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder="Paste JSON here"
            spellCheck={false}
            className="min-h-[360px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Tree" />
          <div className="min-h-[360px] overflow-auto rounded-md border bg-background p-3">
            {parsed.value === undefined ? (
              <p className="text-sm text-muted-foreground">{parsed.error ? 'Fix the JSON to see the tree.' : 'Paste JSON to explore it as a tree.'}</p>
            ) : (
              <TreeNode key={expandKey} nodeKey={null} value={parsed.value} depth={0} defaultOpen={allOpen} />
            )}
          </div>
          <StatBar items={[rootType && `root: ${rootType}`, parsed.value !== undefined && `${total} nodes`]} />
        </Panel>
      </div>
    </div>
  );
}
