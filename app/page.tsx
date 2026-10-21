'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { ActivityLog } from '@/lib/types';
import { dashboardStats, loadActivity, STATS_EVENT } from '@/lib/local-store';
import StatCard from '@/components/stat-card';
import QuickScan from '@/components/quick-scan';

export default function Dashboard() {
  const [stats, setStats] = useState({ scansRun: 0, reports: 0, chatMessages: 0 });
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // localStorage is client-only, so read after mount (SSR-safe) and show
  // skeletons until then. These numbers are real, local and work fully offline.
  // Refresh when a scan/report fires the stats event (same tab) or another tab
  // writes to storage.
  useEffect(() => {
    const refresh = () => {
      setStats(dashboardStats());
      setActivity(loadActivity());
    };
    refresh();
    setHydrated(true);
    window.addEventListener(STATS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-spectre-muted">Overview of your penetration testing activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Scans Run" value={stats.scansRun} icon="zap" loading={!hydrated} />
        <StatCard title="Reports Generated" value={stats.reports} icon="file" loading={!hydrated} />
        <StatCard title="Chat Messages" value={stats.chatMessages} icon="message" loading={!hydrated} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 spectre-card p-6 animate-fade-in-up">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {!hydrated ? (
              // Skeleton rows while we read local state.
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded bg-spectre-surface-dark border border-spectre-border animate-pulse"
                  />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-spectre-muted text-sm">
                No activity yet — run a scan or generate a report to see it here.
              </p>
            ) : (
              activity.map((log, idx) => (
                <div
                  key={log.id}
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  className="flex justify-between items-start gap-3 p-3 bg-spectre-surface-dark border border-spectre-border rounded text-sm transition-colors hover:border-spectre-accent/40 animate-fade-in-up"
                >
                  <div className="min-w-0">
                    <p className="text-spectre-text font-medium truncate">{log.action}</p>
                    <p className="text-spectre-muted text-xs truncate">
                      {log.tool && `Tool: ${log.tool}`}
                      {log.tool && log.target && ' • '}
                      {log.target && `Target: ${log.target}`}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-spectre-muted text-xs">
                    <Clock size={12} />
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <QuickScan />
      </div>
    </div>
  );
}
