'use client';

import { useEffect, useState } from 'react';
import { getActivityLog, logActivity } from '@/lib/supabase';
import { ActivityLog } from '@/lib/types';
import StatCard from '@/components/stat-card';
import QuickScan from '@/components/quick-scan';

export default function Dashboard() {
  const [stats, setStats] = useState({
    sessionsToday: 0,
    scansRun: 0,
    reportsGenerated: 0,
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const activity = await getActivityLog(10);
        setActivityLog(activity);
        setStats({
          sessionsToday: Math.floor(Math.random() * 20) + 5,
          scansRun: Math.floor(Math.random() * 50) + 10,
          reportsGenerated: Math.floor(Math.random() * 10) + 2,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-spectre-muted">Overview of your penetration testing activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Sessions Today"
          value={stats.sessionsToday}
          icon="activity"
        />
        <StatCard
          title="Scans Run"
          value={stats.scansRun}
          icon="zap"
        />
        <StatCard
          title="Reports Generated"
          value={stats.reportsGenerated}
          icon="file"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 spectre-card p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-spectre-muted text-sm">Loading...</p>
            ) : activityLog.length === 0 ? (
              <p className="text-spectre-muted text-sm">No activities recorded yet</p>
            ) : (
              activityLog.map((log: any) => (
                <div
                  key={log.id}
                  className="flex justify-between items-start p-3 bg-spectre-surface-dark border border-spectre-border rounded text-sm"
                >
                  <div>
                    <p className="text-spectre-text font-medium">{log.action}</p>
                    <p className="text-spectre-muted text-xs">
                      {log.tool && `Tool: ${log.tool}`}
                      {log.target && ` • Target: ${log.target}`}
                    </p>
                  </div>
                  <span className="text-spectre-muted text-xs">
                    {new Date(log.created_at).toLocaleTimeString()}
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
