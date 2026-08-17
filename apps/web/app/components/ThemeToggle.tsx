'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'openscrim-theme';

type ResolvedTheme = 'light' | 'dark';

function getInitialTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<ResolvedTheme>('light');
  const [mounted, setMounted] = React.useState(false);

  // Pick up the class that the no-FOUC inline script in <head> already applied,
  // so the icon matches the rendered colours on first paint.
  React.useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next: ResolvedTheme = prev === 'dark' ? 'light' : 'dark';
      const root = document.documentElement;
      root.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage may be unavailable (private mode, embedded webview); ignore.
      }
      return next;
    });
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={
        mounted
          ? theme === 'dark'
            ? 'Switch to light mode'
            : 'Switch to dark mode'
          : 'Toggle theme'
      }
      aria-pressed={mounted ? theme === 'dark' : undefined}
      className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-md backdrop-blur-sm bg-background/80 border-border"
    >
      {mounted && theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}
