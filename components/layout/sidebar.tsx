'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code2, Search, Shield, Star, History } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CATEGORIES,
  CATEGORY_META,
  getToolsByCategory,
  TOTAL_TOOL_COUNT,
} from '@/lib/registry';
import { useCommandPalette } from '@/components/layout/command-palette-context';

function CountPill({ n }: { n: number }) {
  return (
    <span className="ml-auto rounded-sm bg-muted px-1.5 font-mono text-2xs text-muted-foreground tabular">
      {n}
    </span>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { setOpen } = useCommandPalette();

  const navItem = (
    href: string,
    icon: React.ReactNode,
    label: string,
    count?: number,
    active?: boolean
  ) => (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {count != null && <CountPill n={count} />}
    </Link>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Shield className="size-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Utility Tools</span>
      </div>

      {/* Search trigger */}
      <div className="p-2">
        <button
          onClick={() => {
            setOpen(true);
            onNavigate?.();
          }}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60"
        >
          <Search className="size-3.5" />
          <span>Search tools…</span>
          <kbd className="ml-auto">⌘K</kbd>
        </button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-4 px-2 pb-4">
          <div className="space-y-0.5">
            {navItem(
              '/',
              <Icon name="LayoutGrid" className="size-4" />,
              'All tools',
              TOTAL_TOOL_COUNT,
              pathname === '/'
            )}
            {navItem(
              '/favorites/',
              <Star className="size-4" />,
              'Favorites',
              undefined,
              pathname === '/favorites/'
            )}
            {navItem(
              '/recent/',
              <History className="size-4" />,
              'Recent',
              undefined,
              pathname === '/recent/'
            )}
          </div>

          <div>
            <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categories
            </p>
            <div className="space-y-0.5">
              {CATEGORIES.map((id) => {
                const meta = CATEGORY_META[id];
                const count = getToolsByCategory(id).length;
                if (count === 0) return null;
                const active = pathname === `/categories/${id}/`;
                return (
                  <Link
                    key={id}
                    href={`/categories/${id}/`}
                    onClick={onNavigate}
                    className={cn(
                      'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <span
                      className="flex size-5 items-center justify-center rounded-[5px]"
                      style={{
                        backgroundColor: `color-mix(in oklch, var(${meta.accentVar}) 16%, transparent)`,
                        color: `var(${meta.accentVar})`,
                      }}
                    >
                      <Icon name={meta.icon} className="size-3" />
                    </span>
                    <span className="truncate">{meta.name}</span>
                    <CountPill n={count} />
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t p-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <Code2 className="size-4" />
          <span>Source</span>
        </a>
        <p className="px-2 pt-1 text-2xs text-muted-foreground">
          <span className="mr-1 inline-block size-1.5 rounded-full bg-success align-middle" />
          Runs 100% in your browser
        </p>
      </div>
    </div>
  );
}
