'use client';

import { MonitorCog, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'spectre-theme';
const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'system'];

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = preference === 'system' ? systemTheme() : preference;
  // dataset.theme is the DOM representation of the CSS data-theme attribute.
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }

    const initial = isThemePreference(stored) ? stored : 'system';
    setPreference(initial);
    setResolved(applyTheme(initial));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    setResolved(applyTheme(preference));
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // The current tab still follows the selected theme without persistence.
    }

    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setResolved(applyTheme('system'));
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, [mounted, preference]);

  const cycleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(preference);
    setPreference(THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]);
  };

  const label = mounted
    ? preference === 'system'
      ? `System theme (${resolved})`
      : `${preference[0].toUpperCase()}${preference.slice(1)} theme`
    : 'System theme';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`${label}. Change theme`}
      title={`${label} · light → dark → system`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-spectre-border bg-spectre-card text-spectre-text shadow-sm transition-colors hover:border-spectre-accent hover:text-spectre-accent"
    >
      {!mounted || preference === 'system' ? (
        <MonitorCog size={17} aria-hidden="true" />
      ) : preference === 'light' ? (
        <Sun size={17} aria-hidden="true" />
      ) : (
        <Moon size={17} aria-hidden="true" />
      )}
    </button>
  );
}
