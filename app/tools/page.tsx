'use client';

import { useEffect, useState } from 'react';
import ToolRunner, { ToolMeta } from '@/components/tool-runner';

// Display order for the category sections.
const CATEGORY_ORDER = [
  'Recon',
  'Network',
  'Web',
  'SMB / AD',
  'Credentials',
  'Exploits',
  'System',
];

export default function ToolsPage() {
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Tool Execution</h1>
        <p className="text-spectre-muted">
          Run reconnaissance, scanning and post-exploitation tools against authorized targets.
          {tools.length > 0 && (
            <span className="ml-1">
              {readyCount} of {tools.length} installed on this host.
            </span>
          )}
        </p>
      </div>

      {loading && <p className="text-spectre-muted">Detecting installed tools…</p>}

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
                  <ToolRunner key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
