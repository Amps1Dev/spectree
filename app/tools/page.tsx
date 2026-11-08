'use client';

import { useEffect, useState } from 'react';
import ToolRunner, { ToolMeta } from '@/components/tool-runner';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import SpectreSpinner from '@/components/spectre-spinner';

// Display order for the category sections.
const CATEGORY_ORDER = [
  'Network & Web',
  'Mobile',
  'Reverse Engineering',
  'Credential & Protocol Auditing',
];

export default function ToolsPage() {
  const { offline } = useOfflineMode();
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tools', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load tools (${res.status})`);
        const data: ToolMeta[] = await res.json();
        if (!cancelled) setTools(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tools');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = CATEGORY_ORDER.filter((c) => tools.some((t) => t.category === c));
  const readyCount = tools.filter((t) => t.available).length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Tool Execution</h1>
        <p className="text-spectre-muted">
          Run reconnaissance, scanning and post-exploitation tools against authorized targets.
          {tools.length > 0 && (
            <span className="ml-1">
              {readyCount} of {tools.length} available on this host.
            </span>
          )}
        </p>
      </div>

      {offline && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-spectre-offline/60 bg-spectre-offline/10 px-4 py-3 text-sm text-spectre-muted"
        >
          Offline mode is active. Scan controls are disabled until you switch
          back to ONLINE in the sidebar.
        </div>
      )}

      {loading && <p className="flex items-center gap-3 text-spectre-muted"><SpectreSpinner label="" />Detecting available tools…</p>}

      {error && (
        <div className="p-3 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        categories.map((category) => {
          const inCategory = tools.filter((t) => t.category === category);
          return (
            <section key={category} className="mb-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-spectre-muted mb-4">
                {category}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {inCategory.map((tool) => (
                  <ToolRunner key={tool.id} tool={tool} offline={offline} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
