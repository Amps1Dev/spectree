'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

export interface ProviderInfo {
  id: string;
  label: string;
  model: string;
  available: boolean;
}

interface LLMContextValue {
  provider: string;
  setProvider: (id: string) => void;
  providers: ProviderInfo[];
}

const STORAGE_KEY = 'spectre.llmProvider';

const LLMContext = createContext<LLMContextValue | null>(null);

export function LLMProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<string>('ollama');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  // Restore the persisted choice before anything hits the network.
  useEffect(() => {
    const saved =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (saved) setProviderState(saved);
  }, []);

  // Discover providers + live availability. Adopt the server default only when
  // the user hasn't already chosen one.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProviders(data.providers ?? []);
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved && data.default) setProviderState(data.default);
      })
      .catch(() => {
        /* leave defaults; the sidebar simply won't show status dots */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setProvider = (id: string) => {
    setProviderState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode / storage disabled — selection still works in-session */
    }
  };

  return (
    <LLMContext.Provider value={{ provider, setProvider, providers }}>
      {children}
    </LLMContext.Provider>
  );
}

export function useLLM(): LLMContextValue {
  const ctx = useContext(LLMContext);
  if (!ctx) throw new Error('useLLM must be used within <LLMProvider>');
  return ctx;
}
