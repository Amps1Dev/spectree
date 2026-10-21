// Client-side persistence for chat history and generated reports.
//
// The app is a local, operator-run console with no per-user backend wired up
// (Supabase is optional/placeholder), so chat and reports are persisted in the
// browser's localStorage. Every accessor is SSR-safe (guards `window`) and
// swallows JSON / quota errors so a corrupt or full store never crashes a page.

import { ChatMessage, SavedReport, ActivityLog } from '@/lib/types';

const CHAT_KEY = 'spectre.chat.v1';
const REPORTS_KEY = 'spectre.reports.v1';
const ACTIVITY_KEY = 'spectre.activity.v1';
const STATS_KEY = 'spectre.stats.v1';

// Keep history bounded so localStorage can't grow without limit.
const MAX_REPORTS = 50;
const MAX_ACTIVITY = 50;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
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
  notify();
}

export function clearChat(): void {
  remove(CHAT_KEY);
  notify();
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
  notify();
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

// ---- Activity feed + dashboard counters ----
//
// The dashboard used to show random numbers. These give it REAL, offline
// figures: a capped feed of recent actions plus a lifetime scan counter that
// survives the feed being trimmed.

export function safeId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // fall through to the timestamp id
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Let same-tab listeners (e.g. the dashboard) refresh when activity/stats
// change. localStorage's native 'storage' event only fires in OTHER tabs.
export const STATS_EVENT = 'spectre:stats';
function notify(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(STATS_EVENT));
  } catch {
    // ignore
  }
}

export function loadActivity(): ActivityLog[] {
  const list = read<ActivityLog[]>(ACTIVITY_KEY, []);
  return Array.isArray(list) ? list : [];
}

/** Record one action (newest first, capped). */
export function recordActivity(entry: {
  action: string;
  tool?: string;
  target?: string;
}): ActivityLog[] {
  const full: ActivityLog = {
    id: safeId(),
    action: entry.action,
    tool: entry.tool,
    target: entry.target,
    createdAt: new Date().toISOString(),
  };
  const next = [full, ...loadActivity()].slice(0, MAX_ACTIVITY);
  write(ACTIVITY_KEY, next);
  notify();
  return next;
}

export function clearActivity(): void {
  remove(ACTIVITY_KEY);
  notify();
}

interface StatsStore {
  scansRun: number;
}

function scanCount(): number {
  const s = read<StatsStore>(STATS_KEY, { scansRun: 0 });
  return Number.isSafeInteger(s.scansRun) && s.scansRun >= 0 ? s.scansRun : 0;
}

/** Increment the lifetime "scans run" counter. */
export function recordScanRun(): void {
  write(STATS_KEY, { scansRun: scanCount() + 1 });
  notify();
}

/** Real counts for the dashboard stat cards — all derived from local state. */
export function dashboardStats(): {
  scansRun: number;
  reports: number;
  chatMessages: number;
} {
  return {
    scansRun: scanCount(),
    reports: loadReports().length,
    chatMessages: loadChat().length,
  };
}
