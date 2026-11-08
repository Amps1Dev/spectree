'use client';

import { Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import SpectreSpinner from '@/components/spectre-spinner';

const ROTATING_MESSAGES = [
  'Analysing request…',
  'Selecting tools…',
  'Running scan…',
  'Parsing output…',
  'Composing response…',
];

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export default function AgentActivity({
  compact = false,
  toolName,
  target,
  lineCount = 0,
  lastActivityAt,
  startedAt,
  onCancel,
  label = 'SPECTRE is working',
}: {
  compact?: boolean;
  toolName?: string;
  target?: string;
  lineCount?: number;
  lastActivityAt?: number | null;
  startedAt?: number;
  onCancel?: () => void;
  label?: string;
}) {
  const reducedMotion = useReducedMotion();
  const stableStart = useMemo(() => startedAt ?? Date.now(), [startedAt]);
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - stableStart) / 1000)),
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [lastActivitySeconds, setLastActivitySeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - stableStart) / 1000)));
      if (lastActivityAt) {
        setLastActivitySeconds(
          Math.max(0, Math.floor((now - lastActivityAt) / 1000)),
        );
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lastActivityAt, stableStart]);

  useEffect(() => {
    if (toolName || reducedMotion) return;
    const timer = window.setInterval(
      () => setMessageIndex((current) => (current + 1) % ROTATING_MESSAGES.length),
      2500,
    );
    return () => window.clearInterval(timer);
  }, [reducedMotion, toolName]);

  const status = toolName
    ? `Running ${toolName}${target ? ` on ${target}` : ''}…`
    : ROTATING_MESSAGES[messageIndex];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border border-spectre-border bg-spectre-card text-spectre-text shadow-sm ${
        compact ? 'p-3' : 'max-w-lg rounded-bl-none p-4'
      }`}
    >
      <div className="flex items-center gap-3">
        <SpectreSpinner size={compact ? 32 : 44} label="" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
              {label}
            </p>
            <span className="font-mono text-xs tabular-nums text-spectre-muted">
              {formatElapsed(elapsed)}
            </span>
          </div>
          <p className={`truncate text-spectre-muted ${compact ? 'text-xs' : 'text-sm'}`}>
            {status}
          </p>
          {(lineCount > 0 || lastActivityAt) && (
            <p className="mt-1 text-[11px] text-spectre-muted">
              {lineCount > 0 ? `${lineCount} live lines` : 'Stream active'}
              {lastActivityAt ? ` · last activity ${lastActivitySeconds}s ago` : ''}
            </p>
          )}
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-spectre-border px-2 py-1 text-xs text-spectre-muted hover:border-spectre-danger hover:text-spectre-danger"
          >
            <Square size={11} fill="currentColor" />
            Cancel
          </button>
        )}
      </div>

      {elapsed >= 60 && (
        <p className="mt-2 text-xs text-spectre-warning">
          Taking longer than usual… SPECTRE is still active.
        </p>
      )}
    </div>
  );
}
