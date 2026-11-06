"use client";

import { useEffect, useState } from 'react';
import { mergeSaved, type Favorite, type Favorites, type ToolStyles } from '@/lib/design/toolStyles';

// Each tool's settings and favorites, remembered in this browser.

const KEY = 'alchemy:toolStyles';

function load() {
  try { return mergeSaved(JSON.parse(localStorage.getItem(KEY) ?? 'null')); }
  catch { return mergeSaved(null); }
}

export function useToolStyles() {
  const [state, setState] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* just won't persist */ }
  }, [state]);

  return {
    styles: state.styles,
    favorites: state.favorites,
    setStyle: <K extends keyof ToolStyles>(tool: K, patch: Partial<ToolStyles[K]>) =>
      setState((s) => ({ ...s, styles: { ...s.styles, [tool]: { ...s.styles[tool], ...patch } } })),
    addFavorite: <K extends keyof Favorites>(tool: K, name: string, style: Favorites[K][number]['style']) =>
      setState((s) => {
        const fav = { id: Date.now().toString(36), name, style } as Favorite<typeof style>;
        return { ...s, favorites: { ...s.favorites, [tool]: [...s.favorites[tool], fav] } };
      }),
    removeFavorite: (tool: keyof Favorites, id: string) =>
      setState((s) => ({ ...s, favorites: { ...s.favorites, [tool]: (s.favorites[tool] as { id: string }[]).filter((f) => f.id !== id) } })),
  };
}
