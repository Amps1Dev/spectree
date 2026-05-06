'use client';

import { useState } from 'react';
import { Play, Square } from 'lucide-react';

export default function QuickScan() {
  const [target, setTarget] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [error, setError] = useState('');

  const isInvalidTarget = !target || target === 'localhost' || target === '127.0.0.1';

  const runScan = async () => {
    if (isInvalidTarget) {
      setError('Invalid target. Localhost and 127.0.0.1 are not allowed.');
      return;
    }

    setError('');
    setOutput('');
    setStatus('running');

    try {
      const response = await fetch('/api/tools/nmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, profile: 'Quick' }),
      });

      if (!response.ok) {
        throw new Error('Scan failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullOutput = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullOutput += chunk;
          setOutput(fullOutput);
        }
      }

      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      setOutput('');
    }
  };

  const cancelScan = () => {
    setStatus('idle');
    setOutput('');
  };

  return (
    <div className="spectre-card p-6 flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Quick Scan</h2>

      <div className="space-y-3 mb-4">
        <input
          type="text"
          placeholder="Target IP or hostname"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="spectre-input w-full"
          disabled={status === 'running'}
        />

        <div className="flex gap-2">
          <button
            onClick={runScan}
            disabled={isInvalidTarget || status === 'running'}
            className={`spectre-btn-primary flex items-center gap-2 flex-1 justify-center ${
              isInvalidTarget || status === 'running' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Play size={16} />
            Run
          </button>
          {status === 'running' && (
            <button onClick={cancelScan} className="spectre-btn-danger flex items-center gap-2">
              <Square size={16} />
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 bg-spectre-surface border border-spectre-border rounded-full text-xs font-medium ${
              status === 'running' ? 'text-spectre-accent' : ''
            }`}
          >
            {status === 'running' && (
              <div className="w-2 h-2 bg-spectre-accent rounded-full animate-pulse" />
            )}
            <span>{status.toUpperCase()}</span>
          </div>
        </div>

        {error && <div className="p-2 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm">{error}</div>}
      </div>

      {output && (
        <div className="flex-1 min-h-64">
          <p className="text-spectre-muted text-xs mb-2">Output:</p>
          <div className="spectre-output h-full whitespace-pre-wrap break-words">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
