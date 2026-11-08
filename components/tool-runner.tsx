'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Copy, Square, TerminalSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SpectreSpinner from '@/components/spectre-spinner';

// Mirrors the serializable projection returned by GET /api/tools. Declared
// locally so this client component never imports lib/tools (which pulls in
// Node's fs).
export interface ToolField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'password' | 'number';
  placeholder?: string;
  default?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  asFile?: boolean;
}

export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  commandHint: string;
  installHint: string | null;
  fields: ToolField[];
  available: boolean;
}

type Status = 'idle' | 'running' | 'complete' | 'error';

function seedValues(fields: ToolField[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) v[f.name] = f.default ?? '';
  return v;
}

export default function ToolRunner({
  tool,
  offline = false,
}: {
  tool: ToolMeta;
  offline?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => seedValues(tool.fields));
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (offline) abortRef.current?.abort();
  }, [offline]);

  const missingRequired = tool.fields.some((f) => f.required && !values[f.name]?.trim());
  const disabled =
    offline || !tool.available || status === 'running' || missingRequired;

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const run = async () => {
    if (offline) {
      setError('Switch to ONLINE mode before running a tool.');
      return;
    }

    setError('');
    setOutput('');
    setStatus('running');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/tools/${tool.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: controller.signal,
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setOutput(full);
        }
      }
      full += decoder.decode();
      setOutput(full);
      const failure = full.match(/^\[SPECTRE_ERROR\] (.+)$/m);
      if (failure) throw new Error(failure[1]);
      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setError(controller.signal.aborted ? 'Tool execution cancelled.' : err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const copyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      toast({ title: 'Output copied to clipboard' });
    }
  };

  return (
    <div className="spectre-card p-6 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">{tool.name}</h2>
        <span
          className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${
            tool.available
              ? 'border-spectre-accent/50 text-spectre-accent'
              : 'border-spectre-border text-spectre-muted'
          }`}
        >
          {tool.available ? 'ready' : 'unavailable'}
        </span>
      </div>
      <p className="text-spectre-muted text-sm mb-3">{tool.description}</p>

      <div className="flex items-center gap-2 mb-4 text-[11px] font-mono text-spectre-muted">
        <TerminalSquare size={12} className="shrink-0" />
        <span className="truncate" title={tool.commandHint}>
          {tool.commandHint}
        </span>
      </div>

      {!tool.available && tool.installHint && (
        <div className="mb-4 p-2 bg-spectre-surface border border-spectre-border rounded text-xs text-spectre-muted">
          Setup: {' '}
          <code className="font-mono text-spectre-text">{tool.installHint}</code>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {tool.fields.map((f) => {
          const common = {
            value: values[f.name] ?? '',
            disabled: offline || status === 'running' || !tool.available,
            className: 'spectre-input w-full',
            placeholder: f.placeholder,
          };

          return (
            <div key={f.name}>
              <label htmlFor={`${tool.id}-${f.name}`} className="block text-xs text-spectre-muted mb-1">
                {f.label}
                {f.required && <span className="text-spectre-danger"> *</span>}
              </label>

              {f.type === 'textarea' ? (
                <textarea
                  {...common}
                  id={`${tool.id}-${f.name}`}
                  rows={4}
                  className="spectre-input w-full h-28 resize-none font-mono text-sm"
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select {...common} id={`${tool.id}-${f.name}`} onChange={(e) => setField(f.name, e.target.value)}>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  id={`${tool.id}-${f.name}`}
                  type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <button
          onClick={run}
          disabled={disabled}
          title={offline ? 'Scanning is disabled in offline mode' : undefined}
          className={`spectre-btn-primary flex items-center gap-2 w-full justify-center ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Play size={16} />
          {offline ? 'Offline' : 'Run'}
        </button>

        {status === 'running' && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="spectre-btn-secondary flex w-full items-center justify-center gap-2 text-sm">
            <Square size={14} /> Cancel
          </button>
        )}

        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 bg-spectre-surface border border-spectre-border rounded-full text-xs font-medium ${
              status === 'running' ? 'text-spectre-accent' : ''
            }`}
          >
            {status === 'running' && (
              <SpectreSpinner size={18} label={`Running ${tool.name}`} />
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

      {output && (
        <div className="flex-1 flex flex-col min-h-64">
          <div className="flex items-center justify-between mb-2">
            <p className="text-spectre-muted text-xs">Output:</p>
            <button
              onClick={copyOutput}
              className="text-spectre-muted hover:text-spectre-accent transition-colors text-xs flex items-center gap-1"
            >
              <Copy size={12} />
              Copy
            </button>
          </div>
          <div className="spectre-output flex-1 whitespace-pre-wrap break-words">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
