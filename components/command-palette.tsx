'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command as CommandIcon, CornerDownLeft } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Icon } from '@/components/icon';
import { useCommandPalette } from '@/components/layout/command-palette-context';
import {
  TOOLS,
  CATEGORY_META,
  getToolMeta,
  type ToolCategory,
  type ToolMetaStatic,
} from '@/lib/registry';
import { scoreTool } from '@/lib/search';
import { useRecents, useFavorites } from '@/lib/hooks/use-tool-history';

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { recents } = useRecents();
  const { favorites } = useFavorites();

  // ⌘K / Ctrl+K toggles; "/" opens when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (
        e.key === '/' &&
        !open &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target as HTMLElement)?.isContentEditable
        )
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const go = (slug: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/tools/${slug}/`);
  };

  // Build result groups. When searching, one flat ranked group; otherwise show
  // recents + favorites + per-category groups.
  const grouped = useMemo(() => {
    if (query.trim()) {
      const ranked = TOOLS.map((t) => ({ t, s: scoreTool(t, query) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((r) => r.t);
      return [{ key: 'results', label: 'Results', tools: ranked }];
    }
    const recentTools = recents
      .map((s) => getToolMeta(s))
      .filter((t): t is ToolMetaStatic => Boolean(t));
    const favTools = favorites
      .map((s) => getToolMeta(s))
      .filter((t): t is ToolMetaStatic => Boolean(t));

    const byCat = new Map<ToolCategory, ToolMetaStatic[]>();
    for (const t of TOOLS) {
      const arr = byCat.get(t.category) ?? [];
      arr.push(t);
      byCat.set(t.category, arr);
    }
    const catGroups = (Object.keys(CATEGORY_META) as ToolCategory[])
      .filter((c) => byCat.has(c))
      .map((c) => ({
        key: c,
        label: CATEGORY_META[c].name,
        tools: byCat.get(c)!,
      }));

    return [
      recentTools.length && { key: 'recent', label: 'Recent', tools: recentTools },
      favTools.length && { key: 'fav', label: 'Favorites', tools: favTools },
      ...catGroups,
    ].filter(Boolean) as { key: string; label: string; tools: ToolMetaStatic[] }[];
  }, [query, recents, favorites]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
      className="max-w-2xl"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search tools…  (try: base64, jwt, uuid, hash)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No tools match “{query}”.</CommandEmpty>
        {grouped.map((g) => (
          <CommandGroup key={g.key} heading={g.label}>
            {g.tools.map((t) => (
              <CommandItem
                key={t.slug}
                value={`${t.name} ${t.slug} ${t.keywords.join(' ')}`}
                onSelect={() => go(t.slug)}
                className="gap-2"
              >
                <span
                  className="flex size-5 items-center justify-center rounded-[5px]"
                  style={{
                    backgroundColor: `color-mix(in oklch, var(${CATEGORY_META[t.category].accentVar}) 16%, transparent)`,
                    color: `var(${CATEGORY_META[t.category].accentVar})`,
                  }}
                >
                  <Icon name={t.icon} className="size-3" />
                </span>
                <span className="flex-1 truncate">{t.name}</span>
                <span className="font-mono text-2xs text-muted-foreground">
                  {CATEGORY_META[t.category].name}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex h-9 items-center justify-between border-t bg-muted/30 px-3 font-mono text-2xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CommandIcon className="size-3" /> K to toggle
        </span>
        <span className="flex items-center gap-1">
          <CornerDownLeft className="size-3" /> open
        </span>
      </div>
    </CommandDialog>
  );
}
