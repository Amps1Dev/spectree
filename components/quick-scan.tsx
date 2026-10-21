'use client';

import { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useScan } from '@/hooks/use-scan';
import ScanProgress from '@/components/scan-progress';

export default function QuickScan() {
  const [target, setTarget] = useState('');
  const { status, output, error, elapsed, outputRef, run, cancel } = useScan();
  const noTarget = !target.trim();
  const runScan = () => {
    if (!noTarget) void run('nmap', { target: target.trim(), profile: 'Quick' }, 'quick scan');
  };

  return (
    <div className="spectre-card spectre-card-interactive p-6 flex flex-col animate-fade-in-up">
      <h2 className="text-xl font-semibold mb-4">Quick Scan</h2>

      <div className="space-y-3 mb-4">
        <input
          type="text"
          aria-label="Scan target"
          placeholder="Target IP, hostname or CIDR"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && status !== 'running' && runScan()}
          className="spectre-input w-full"
          disabled={status === 'running'}
        />

        <div className="flex gap-2">
          <button
            onClick={runScan}
            disabled={noTarget || status === 'running'}
            className={`spectre-btn-primary flex items-center gap-2 flex-1 justify-center ${
              noTarget || status === 'running' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Play size={16} />
            Run
          </button>
          {status === 'running' && (
            <button onClick={cancel} className="spectre-btn-danger flex items-center gap-2">
              <Square size={16} />
              Cancel
            </button>
          )}
        </div>

        <ScanProgress status={status} elapsed={elapsed} />
        <p className="text-xs text-spectre-muted">Runs on this host. Localhost and LAN scans work without internet.</p>

        {error && (
          <div role="alert" className="p-2 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {output && (
        <div className="flex-1 min-h-64 animate-fade-in">
          <p className="text-spectre-muted text-xs mb-2">Output:</p>
          <div
            ref={outputRef}
            className={`spectre-output max-h-80 whitespace-pre-wrap break-words ${
              status === 'running' ? 'spectre-cursor' : ''
            }`}
          >
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
