'use client';

import { SessionContext } from '@/lib/types';

interface ContextPanelProps {
  context: SessionContext;
  onClear: () => void;
}

export default function ContextPanel({ context, onClear }: ContextPanelProps) {
  return (
    <div className="flex-[35%] bg-spectre-surface border-l border-spectre-border p-6 flex flex-col">
      <h2 className="text-lg font-semibold mb-6">Session Context</h2>

      <div className="space-y-6 flex-1">
        <div>
          <p className="text-spectre-muted text-sm mb-2">Current Target</p>
          <div className="bg-spectre-surface-dark border border-spectre-border rounded p-3">
            <p className="text-spectre-text text-sm font-mono">
              {context.targetIp || 'No target set'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-spectre-muted text-sm mb-2">Suggested Next Steps</p>
          <div className="space-y-2">
            {context.suggestedSteps.length === 0 ? (
              <p className="text-spectre-muted text-sm">No suggestions yet</p>
            ) : (
              <ul className="space-y-2">
                {context.suggestedSteps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-sm text-spectre-text bg-spectre-surface-dark border border-spectre-border rounded p-2"
                  >
                    <span className="text-spectre-accent">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onClear}
        className="spectre-btn-secondary w-full mt-6"
      >
        Clear Session
      </button>
    </div>
  );
}
