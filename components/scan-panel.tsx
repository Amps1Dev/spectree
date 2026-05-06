'use client';

import { useState } from 'react';
import { Play, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  label: string;
  value: string;
  flags: string;
}

interface ScanPanelProps {
  title: string;
  tool: 'nmap' | 'nikto';
  profiles: Profile[];
  onOutput: (output: string) => void;
  currentOutput: string;
}

export default function ScanPanel({
  title,
  tool,
  profiles,
  onOutput,
  currentOutput,
}: ScanPanelProps) {
  const [target, setTarget] = useState('');
  const [profile, setProfile] = useState(profiles[0].value);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const isInvalidTarget =
    !target || target === 'localhost' || target === '127.0.0.1' || target.trim() === '';

  const runScan = async () => {
    if (isInvalidTarget) {
      setError('Invalid target. Localhost and 127.0.0.1 are not allowed.');
      return;
    }

    setError('');
    onOutput('');
    setStatus('running');

    try {
      const endpoint = tool === 'nmap' ? '/api/tools/nmap' : '/api/tools/nikto';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, profile }),
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
          onOutput(fullOutput);
        }
      }

      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      onOutput('');
    }
  };

  const copyChatContext = () => {
    if (currentOutput) {
      navigator.clipboard.writeText(currentOutput);
      toast({ title: 'Output copied to clipboard' });
    }
  };

  return (
    <div className="spectre-card p-6 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      <div className="space-y-3 mb-4">
        <input
          type="text"
          placeholder="Target IP or hostname"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="spectre-input w-full"
          disabled={status === 'running'}
        />

        {profiles.length > 1 && (
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="spectre-input w-full"
            disabled={status === 'running'}
          >
            {profiles.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        )}

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

        {error && (
          <div className="p-2 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm">
            {error}
          </div>
        )}
      </div>

      {currentOutput && (
        <div className="flex-1 flex flex-col min-h-96">
          <div className="flex items-center justify-between mb-2">
            <p className="text-spectre-muted text-xs">Output:</p>
            <button
              onClick={copyChatContext}
              className="text-spectre-muted hover:text-spectre-accent transition-colors text-xs flex items-center gap-1"
            >
              <Copy size={12} />
              Copy
            </button>
          </div>
          <div className="spectre-output flex-1 whitespace-pre-wrap break-words">
            {currentOutput}
          </div>
        </div>
      )}
    </div>
  );
}
