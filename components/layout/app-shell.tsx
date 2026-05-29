'use client';

import { useState, type ReactNode } from 'react';

import { CommandPaletteProvider } from '@/components/layout/command-palette-context';
import { CommandPalette } from '@/components/command-palette';
import { SidebarContent } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CommandPaletteProvider>
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar */}
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent
            showCloseButton={false}
            className="left-0 top-0 h-dvh max-w-60 translate-x-0 translate-y-0 rounded-none rounded-r-xl border-y-0 border-l-0 p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      <CommandPalette />
    </CommandPaletteProvider>
  );
}
