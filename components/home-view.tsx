'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, ShieldCheck, WifiOff, Cpu } from 'lucide-react';

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
  const { recents } = useRecents();

  const cats = CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);
  const searching = query.trim().length > 0;

  const results = useMemo(
    () => (searching ? searchTools(TOOLS, query, 200) : []),
    [query, searching]
  );

  const recentTools = recents
    .map((s) => getToolMeta(s))
    .filter((t): t is ToolMetaStatic => Boolean(t))
    .slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{
            background:
              'radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-2xs font-medium text-muted-foreground backdrop-blur">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            100% client-side · open source · works offline
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Every developer tool.
            <br className="hidden sm:block" />{' '}
            <span className="text-primary">None of your data leaves the browser.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            {TOTAL_TOOL_COUNT} free utilities — convert, format, hash, generate, inspect.
            Everything runs locally in your browser. No uploads, no tracking, no sign-up.
          </p>

          {/* Hero search */}
          <div className="relative mx-auto mt-7 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools — base64, jwt, image, pdf, uuid…"
              className="h-12 rounded-xl pl-10 text-base shadow-sm"
              aria-label="Search tools"
              autoComplete="off"
            />
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-success" /> No data uploaded
            </span>
            <span className="flex items-center gap-1.5">
              <WifiOff className="size-3.5" /> Fully offline
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="size-3.5" /> Rust/WASM speed
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {searching ? (
          /* Search results */
          <section>
            <h2 className="mb-4 text-sm text-muted-foreground">
              {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
            </h2>
            {results.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {results.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No tools match “{query}”. Try a different term.
              </p>
            )}
          </section>
        ) : (
          <>
            {/* Categories */}
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Browse by category</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TOTAL_TOOL_COUNT} tools across {cats.length} categories.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cats.map((c) => (
                  <CategoryCard key={c} category={c} />
                ))}
              </div>
            </section>

            {/* Recent */}
            {recentTools.length > 0 && (
              <section className="mt-14">
                <h2 className="mb-4 text-xl font-semibold tracking-tight">Recently used</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                  {recentTools.map((t) => (
                    <ToolCard key={t.slug} tool={t} />
                  ))}
                </div>
              </section>
            )}

            {/* All tools */}
            <section className="mt-14">
              <h2 className="mb-4 text-xl font-semibold tracking-tight">All tools</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {TOOLS.map((t) => (
                  <ToolCard key={t.slug} tool={t} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function CategoryCard({ category }: { category: ToolCategory }) {
  const meta = CATEGORY_META[category];
  const count = getToolsByCategory(category).length;
  return (
    <Link
      href={`/categories/${category}/`}
      className={cn(
        'group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all',
        'hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md'
      )}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: `color-mix(in oklch, var(${meta.accentVar}) 14%, transparent)`,
          color: `var(${meta.accentVar})`,
        }}
      >
        <Icon name={meta.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{meta.name}</h3>
          <span className="rounded-sm bg-muted px-1.5 font-mono text-2xs text-muted-foreground tabular">
            {count}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meta.description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
