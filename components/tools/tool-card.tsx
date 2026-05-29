'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icon';
import { CATEGORY_META, type ToolMetaStatic } from '@/lib/registry';
import { useFavorites } from '@/lib/hooks/use-tool-history';

export function ToolCard({
  tool,
  className,
}: {
  tool: ToolMetaStatic;
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorites();
  const cat = CATEGORY_META[tool.category];
  const fav = isFavorite(tool.slug);

  return (
    <Link
      href={`/tools/${tool.slug}/`}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-lg border bg-card p-3 transition-colors',
        'hover:border-foreground/15 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
        className
      )}
      style={{ ['--cat' as string]: `var(${cat.accentVar})` }}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-l-lg opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: 'var(--cat)' }}
      />
      <div className="flex items-center gap-2">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--cat) 14%, transparent)',
            color: 'var(--cat)',
          }}
        >
          <Icon name={tool.icon} className="size-3.5" />
        </span>
        <span className="truncate text-sm font-medium">{tool.name}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggle(tool.slug);
          }}
          aria-label={fav ? 'Remove favorite' : 'Add favorite'}
          className={cn(
            'ml-auto rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground',
            fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
        >
          <Star className={cn('size-3.5', fav && 'fill-warning text-warning')} />
        </button>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-2xs text-muted-foreground">
        <span>{cat.name}</span>
        {tool.loadWasm && (
          <>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-success" />
              wasm
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
