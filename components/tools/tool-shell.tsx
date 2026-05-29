'use client';

import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolCard } from '@/components/tools/tool-card';
import {
  CATEGORY_META,
  getRelatedTools,
  type ToolMetaStatic,
} from '@/lib/registry';
import { useFavorites } from '@/lib/hooks/use-tool-history';

export function ToolShell({
  tool,
  children,
  about,
}: {
  tool: ToolMetaStatic;
  children: React.ReactNode;
  about?: React.ReactNode;
}) {
  const cat = CATEGORY_META[tool.category];
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(tool.slug);
  const related = getRelatedTools(tool.slug);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="size-3" />
          <Link
            href={`/categories/${tool.category}/`}
            className="hover:text-foreground"
            style={{ color: `var(${cat.accentVar})` }}
          >
            {cat.name}
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground">{tool.name}</span>
        </nav>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => toggle(tool.slug)}
          aria-label={fav ? 'Remove favorite' : 'Add favorite'}
          title={fav ? 'Remove favorite' : 'Add favorite'}
        >
          <Star className={cn('size-4', fav && 'fill-warning text-warning')} />
        </Button>
      </div>

      {/* Header */}
      <div className="mb-4 mt-2 flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklch, var(${cat.accentVar}) 14%, transparent)`,
            color: `var(${cat.accentVar})`,
          }}
        >
          <Icon name={tool.icon} className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{tool.name}</h1>
            {tool.loadWasm && (
              <Badge variant="success" className="gap-1">
                <span className="inline-block size-1.5 rounded-full bg-success" />
                runs locally
              </Badge>
            )}
          </div>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Workspace */}
      <div>{children}</div>

      {/* About */}
      {about && (
        <section className="mt-8 max-w-3xl">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            About
          </p>
          <div className="prose-sm space-y-2 text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
            {about}
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-8">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Related
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
            {related.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
