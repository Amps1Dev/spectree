'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'spectre_offline';
const CHANGE_EVENT = 'spectre_offline_change';

function readOfflineMode() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistOfflineMode(offline: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(offline));
  } catch {
    // The UI state still works when storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent<boolean>(CHANGE_EVENT, { detail: offline }),
  );
}

export function useOfflineMode() {
  const [offline, setOfflineState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setOfflineState(event.newValue === 'true');
    };
    const syncInCurrentTab = (event: Event) => {
      setOfflineState((event as CustomEvent<boolean>).detail);
    };

    setOfflineState(readOfflineMode());
    setHydrated(true);
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(CHANGE_EVENT, syncInCurrentTab);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(CHANGE_EVENT, syncInCurrentTab);
    };
  }, []);

  const setOffline = useCallback((nextOffline: boolean) => {
    setOfflineState(nextOffline);
    persistOfflineMode(nextOffline);
  }, []);

  const toggleOffline = useCallback(() => {
    setOfflineState((current) => {
      const next = !current;
      persistOfflineMode(next);
      return next;
    });
  }, []);

  return { offline, hydrated, setOffline, toggleOffline };
}
