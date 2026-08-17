'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeBase } from '@/hooks/useThemeBase';

const STORAGE_KEY = 'openscrim-theme';

export function ThemeToggle() {
  const theme = useThemeBase();
  const [mounted, setMounted] = React.useState(false);

  // The no-FOUC inline script in <head> already applies the class before
  // hydration; this just delays the icon until the client can read it.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode, embedded webview); ignore.
    }
  }, [theme]);

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
      className="fixed bottom-4 right-4 z-5000 h-10 w-10 rounded-full shadow-md backdrop-blur-sm bg-background/80 border-border"
    >
      {mounted && theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}
