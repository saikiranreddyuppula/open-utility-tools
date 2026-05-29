'use client';

import { Menu, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useCommandPalette } from '@/components/layout/command-palette-context';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { setOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </Button>

      <button
        onClick={() => setOpen(true)}
        className="flex h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60"
      >
        <Search className="size-3.5" />
        <span className="truncate">Search tools…</span>
        <kbd className="ml-auto hidden sm:inline-flex">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        <ThemeToggle />
      </div>
    </header>
  );
}
