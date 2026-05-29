'use client';

import Link from 'next/link';
import { Star, History } from 'lucide-react';

import { ToolCard } from '@/components/tools/tool-card';
import { getToolMeta, type ToolMetaStatic } from '@/lib/registry';
import { useRecents, useFavorites } from '@/lib/hooks/use-tool-history';

export function SavedToolsView({ kind }: { kind: 'favorites' | 'recent' }) {
  const { recents } = useRecents();
  const { favorites } = useFavorites();

  const slugs = kind === 'favorites' ? favorites : recents;
  const tools = slugs
    .map((s) => getToolMeta(s))
    .filter((t): t is ToolMetaStatic => Boolean(t));

  const title = kind === 'favorites' ? 'Favorites' : 'Recent';
  const Empty = kind === 'favorites' ? Star : History;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">{title}</h1>
      {tools.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
          {tools.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Empty className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {kind === 'favorites'
              ? 'Star a tool to pin it here.'
              : 'Tools you open will appear here.'}
          </p>
          <Link href="/" className="text-sm text-primary hover:underline">
            Browse all tools
          </Link>
        </div>
      )}
    </div>
  );
}
