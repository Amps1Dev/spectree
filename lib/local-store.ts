// Client-side persistence for chat history and generated reports.
//
// The app is a local, operator-run console with no per-user backend wired up
// (Supabase is optional/placeholder), so chat and reports are persisted in the
// browser's localStorage. Every accessor is SSR-safe (guards `window`) and
// swallows JSON / quota errors so a corrupt or full store never crashes a page.

import { ChatMessage, SavedReport } from '@/lib/types';

const CHAT_KEY = 'spectre.chat.v1';
const REPORTS_KEY = 'spectre.reports.v1';

// Keep history bounded so localStorage can't grow without limit.
const MAX_REPORTS = 50;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled (private mode) or full — persistence is best-effort.
  }
}

function remove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---- Chat history ----

export function loadChat(): ChatMessage[] {
  const msgs = read<ChatMessage[]>(CHAT_KEY, []);
  return Array.isArray(msgs) ? msgs : [];
}

export function saveChat(messages: ChatMessage[]): void {
  write(CHAT_KEY, messages);
}

export function clearChat(): void {
  remove(CHAT_KEY);
}

/** Append one message to the stored chat and return the new list. */
export function appendChat(message: ChatMessage): ChatMessage[] {
  const next = [...loadChat(), message];
  saveChat(next);
  return next;
}

// ---- Saved reports ----

export function loadReports(): SavedReport[] {
  const list = read<SavedReport[]>(REPORTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveReports(list: SavedReport[]): void {
  write(REPORTS_KEY, list);
}

/** Prepend a report (newest first), capped at MAX_REPORTS, return the new list. */
export function addReport(report: SavedReport): SavedReport[] {
  const next = [report, ...loadReports()].slice(0, MAX_REPORTS);
  saveReports(next);
  return next;
}

export function deleteReport(id: string): SavedReport[] {
  const next = loadReports().filter((r) => r.id !== id);
  saveReports(next);
  return next;
}
