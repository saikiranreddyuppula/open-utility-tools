'use client';

import { type ReactNode } from 'react';

import { CommandPaletteProvider } from '@/components/layout/command-palette-context';
import { CommandPalette } from '@/components/command-palette';
import { Navbar } from '@/components/layout/navbar';
import { SiteFooter } from '@/components/layout/site-footer';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
