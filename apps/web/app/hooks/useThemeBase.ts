'use client';

import { useEffect, useState } from 'react';

export type ResolvedTheme = 'light' | 'dark';

function readTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
}

/**
 * Reads the `dark` class on <html> that ThemeToggle sets, and stays in sync
 * as it changes. The single source of truth for "what theme is the site in
 * right now" — components needing it (e.g. to pick a Monaco theme id) read
 * from here instead of each re-implementing class/MutationObserver detection.
 */
export function useThemeBase(): ResolvedTheme {
  // Must match the SSR default ('light', since readTheme() sees no `document`
  // there) — the real value is applied in the effect below, after mount.
  const [theme, setTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    setTheme(readTheme());
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
