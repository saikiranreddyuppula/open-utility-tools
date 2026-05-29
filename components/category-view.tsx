'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Icon } from '@/components/icon';
import { Input } from '@/components/ui/input';
import { ToolCard } from '@/components/tools/tool-card';
import {
  CATEGORY_META,
  getToolsByCategory,
  type ToolCategory,
} from '@/lib/registry';
import { searchTools } from '@/lib/search';

export function CategoryView({ category }: { category: ToolCategory }) {
  const [query, setQuery] = useState('');
  const meta = CATEGORY_META[category];
  const tools = useMemo(() => getToolsByCategory(category), [category]);
  const filtered = useMemo(
    () => (query.trim() ? searchTools(tools, query, 200) : tools),
    [tools, query]
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex size-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklch, var(${meta.accentVar}) 14%, transparent)`,
            color: `var(${meta.accentVar})`,
          }}
        >
          <Icon name={meta.icon} className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{meta.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {meta.description} · {tools.length} tools
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${meta.name} tools…`}
          className="h-9 pl-8 font-mono"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
          {filtered.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {tools.length === 0 ? 'No tools in this category yet.' : 'No tools match your filter.'}
        </p>
      )}
    </div>
  );
}
