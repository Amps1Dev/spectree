'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'spectre_theme';
const CHANGE_EVENT = 'spectre_theme_change';

function readTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = (next: Theme) => {
      setThemeState(next);
      applyTheme(next);
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) sync(readTheme());
    };
    const syncInCurrentTab = (event: Event) => {
      sync((event as CustomEvent<Theme>).detail);
    };

    sync(readTheme());
    setHydrated(true);
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(CHANGE_EVENT, syncInCurrentTab);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(CHANGE_EVENT, syncInCurrentTab);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme switching still works if browser storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: next }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  return { theme, hydrated, setTheme, toggleTheme };
}
