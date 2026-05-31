'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Menu, Wrench, Code2, ChevronDown, X, Star, History } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useCommandPalette } from '@/components/layout/command-palette-context';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { CATEGORIES, CATEGORY_META, getToolsByCategory } from '@/lib/registry';

const GITHUB_URL = 'https://github.com/saikiranreddyuppula/open-utility-tools';

export function Navbar() {
  const { setOpen } = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const cats = CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Open Utility Tools</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
                Categories
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="grid w-[28rem] grid-cols-2 gap-0.5">
              {cats.map((c) => {
                const meta = CATEGORY_META[c];
                return (
                  <DropdownMenuItem key={c} asChild>
                    <Link href={`/categories/${c}/`} className="flex items-center gap-2">
                      <span
                        className="flex size-5 items-center justify-center rounded-[5px]"
                        style={{
                          backgroundColor: `color-mix(in oklch, var(${meta.accentVar}) 16%, transparent)`,
                          color: `var(${meta.accentVar})`,
                        }}
                      >
                        <Icon name={meta.icon} className="size-3" />
                      </span>
                      <span className="flex-1 truncate">{meta.name}</span>
                      <span className="font-mono text-2xs text-muted-foreground tabular">
                        {getToolsByCategory(c).length}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/favorites/"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <Star className="size-3.5" />
            Favorites
          </Link>
          <Link
            href="/recent/"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <History className="size-3.5" />
            Recent
          </Link>
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 sm:flex"
          >
            <Search className="size-3.5" />
            <span>Search…</span>
            <kbd className="ml-2">⌘K</kbd>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => setOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>

          <ThemeToggle />

          <Button variant="ghost" size="icon-sm" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
              <Code2 className="size-4" />
            </a>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="left-auto right-0 top-0 h-dvh max-w-72 translate-x-0 translate-y-0 gap-0 rounded-none rounded-l-xl border-y-0 border-r-0 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Menu</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
          <nav className="overflow-y-auto p-2">
            <Link
              href="/favorites/"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            >
              <Star className="size-4" />
              Favorites
            </Link>
            <Link
              href="/recent/"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            >
              <History className="size-4" />
              Recent
            </Link>
            <p className="px-2 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categories
            </p>
            {cats.map((c) => {
              const meta = CATEGORY_META[c];
              return (
                <Link
                  key={c}
                  href={`/categories/${c}/`}
                  onClick={() => setMobileOpen(false)}
                  className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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
                  <span className="flex-1 truncate">{meta.name}</span>
                  <span className="font-mono text-2xs text-muted-foreground tabular">
                    {getToolsByCategory(c).length}
                  </span>
                </Link>
              );
            })}
          </nav>
        </DialogContent>
      </Dialog>
    </header>
  );
}
