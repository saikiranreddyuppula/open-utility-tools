'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';

const RECENTS_KEY = 'ut:recents';
const FAVORITES_KEY = 'ut:favorites';
const MAX_RECENTS = 8;

/** Recently-opened tool slugs (most-recent first), persisted locally. */
export function useRecents() {
  const [recents, setRecents] = useLocalStorage<string[]>(RECENTS_KEY, []);
  const push = useCallback(
    (slug: string) => {
      setRecents((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, MAX_RECENTS));
    },
    [setRecents]
  );
  return { recents, push };
}

/** Pinned/favorite tool slugs, persisted locally. */
export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(FAVORITES_KEY, []);
  const toggle = useCallback(
    (slug: string) => {
      setFavorites((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [slug, ...prev]
      );
    },
    [setFavorites]
  );
  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);
  return { favorites, toggle, isFavorite };
}
