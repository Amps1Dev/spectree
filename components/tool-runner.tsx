'use client';

import { useState } from 'react';
import { Play, Square, Copy, TerminalSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useScan } from '@/hooks/use-scan';
import ScanProgress from '@/components/scan-progress';

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

function seedValues(fields: ToolField[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) v[f.name] = f.default ?? '';
  return v;
}

export default function ToolRunner({ tool }: { tool: ToolMeta }) {
  const [values, setValues] = useState<Record<string, string>>(() => seedValues(tool.fields));
  const { status, output, error, elapsed, outputRef, run: startScan, cancel } = useScan();
  const { toast } = useToast();

  const missingRequired = tool.fields.some((f) => f.required && !values[f.name]?.trim());
  const disabled = !tool.available || status === 'running' || missingRequired;

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const run = () => {
    if (!disabled) void startScan(tool.id, values, tool.name);
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast({ title: 'Output copied to clipboard' });
    } catch {
      toast({ title: 'Could not copy output. Select and copy the text manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="spectre-card spectre-card-interactive p-6 flex flex-col h-full animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">{tool.name}</h2>
        <span
          className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${
            tool.available
              ? 'border-spectre-accent/50 text-spectre-accent'
              : 'border-spectre-border text-spectre-muted'
          }`}
        >
          {tool.available ? 'ready' : 'not installed'}
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
          Install with{' '}
          <code className="font-mono text-spectre-text">{tool.installHint}</code>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {tool.fields.map((f) => {
          const common = {
            id: `${tool.id}-${f.name}`,
            value: values[f.name] ?? '',
            disabled: status === 'running' || !tool.available,
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
                  rows={4}
                  className="spectre-input w-full h-28 resize-none font-mono text-sm"
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select {...common} onChange={(e) => setField(f.name, e.target.value)}>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={disabled}
            className={`spectre-btn-primary flex items-center gap-2 flex-1 justify-center ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
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

        {error && (
          <div role="alert" className="p-2 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {output && (
        <div className="flex-1 flex flex-col min-h-64 animate-fade-in">
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
          <div
            ref={outputRef}
            className={`spectre-output flex-1 max-h-96 whitespace-pre-wrap break-words ${
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
