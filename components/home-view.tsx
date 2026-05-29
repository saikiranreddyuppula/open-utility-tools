'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icon';
import { Input } from '@/components/ui/input';
import { ToolCard } from '@/components/tools/tool-card';
import {
  TOOLS,
  CATEGORIES,
  CATEGORY_META,
  getToolsByCategory,
  getToolMeta,
  TOTAL_TOOL_COUNT,
  type ToolCategory,
  type ToolMetaStatic,
} from '@/lib/registry';
import { searchTools } from '@/lib/search';
import { useRecents } from '@/lib/hooks/use-tool-history';

export function HomeView() {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<ToolCategory | 'all'>('all');
  const { recents } = useRecents();

  const filtered = useMemo(() => {
    let pool = TOOLS;
    if (activeCat !== 'all') pool = pool.filter((t) => t.category === activeCat);
    if (query.trim()) return searchTools(pool, query, 200);
    return pool;
  }, [query, activeCat]);

  const searching = query.trim().length > 0 || activeCat !== 'all';

  const recentTools = recents
    .map((s) => getToolMeta(s))
    .filter((t): t is ToolMetaStatic => Boolean(t))
    .slice(0, 6);

  const cats = CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {TOTAL_TOOL_COUNT} tools, zero uploads
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          A fast, privacy-first collection of developer &amp; file utilities. Everything
          runs in your browser — no data ever leaves your device, and it works fully
          offline.
        </p>
      </div>

      {/* Search + filter chips */}
      <div className="mb-5 space-y-2">
        <div className="relative max-w-xl">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${TOTAL_TOOL_COUNT} tools…`}
            className="h-9 pl-8 font-mono"
            aria-label="Filter tools"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
            All
            <span className="ml-1 font-mono text-2xs opacity-70">{TOTAL_TOOL_COUNT}</span>
          </Chip>
          {cats.map((c) => (
            <Chip
              key={c}
              active={activeCat === c}
              onClick={() => setActiveCat((p) => (p === c ? 'all' : c))}
              accentVar={CATEGORY_META[c].accentVar}
            >
              {CATEGORY_META[c].name}
              <span className="ml-1 font-mono text-2xs opacity-70">
                {getToolsByCategory(c).length}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      {/* Recent strip */}
      {!searching && recentTools.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
            {recentTools.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      {searching ? (
        filtered.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
            {filtered.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No tools match your filter.
          </p>
        )
      ) : (
        <div className="space-y-7">
          {cats.map((c) => {
            const meta = CATEGORY_META[c];
            const tools = getToolsByCategory(c);
            return (
              <section key={c}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex size-6 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `color-mix(in oklch, var(${meta.accentVar}) 14%, transparent)`,
                      color: `var(${meta.accentVar})`,
                    }}
                  >
                    <Icon name={meta.icon} className="size-3.5" />
                  </span>
                  <h2 className="text-base font-semibold">{meta.name}</h2>
                  <span className="rounded-sm bg-muted px-1.5 font-mono text-2xs text-muted-foreground tabular">
                    {tools.length}
                  </span>
                  <Link
                    href={`/categories/${c}/`}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all <ArrowRight className="size-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
                  {tools.map((t) => (
                    <ToolCard key={t.slug} tool={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-10 border-t pt-4 text-center font-mono text-2xs text-muted-foreground">
        All processing happens in your browser. No data leaves your device.
      </footer>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  accentVar,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accentVar?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
      style={active && accentVar ? { color: `var(${accentVar})` } : undefined}
    >
      {children}
    </button>
  );
}
