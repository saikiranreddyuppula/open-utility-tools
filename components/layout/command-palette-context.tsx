'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PaletteCtx {
  open: boolean;
  setOpen: (o: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<PaletteCtx | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen(!open) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCommandPalette(): PaletteCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}
