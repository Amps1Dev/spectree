'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Play, Trash2 } from 'lucide-react';
import AgentActivity from '@/components/AgentActivity';
import { useChat } from '@/components/ChatProvider';
import { ParsedTarget, TargetStatus } from '@/components/targets/parseTargets';
import { StoredToolOutput } from '@/lib/chatStore';
import { useOfflineMode } from '@/hooks/useOfflineMode';

type ToolName = 'nmap' | 'nikto';

export interface TargetEngagementData {
  source: string;
  targets: ParsedTarget[];
  tools: ToolName[];
  log: string;
  running: boolean;
  logOpen: boolean;
  error?: string;
  engagementId?: string;
  totalFindings?: number;
  startedAt?: number;
  activeTool?: ToolName;
  activeTarget?: string;
  lineCount: number;
  lastActivityAt?: number;
}

interface EngagementEvent {
  type: string;
  target?: string;
  index?: number;
  tool?: ToolName;
  chunk?: string;
  message?: string;
  status?: 'complete' | 'failed';
  findingsCount?: number;
  totalFindings?: number;
  engagementId?: string;
}

interface TargetTableProps {
  chatId: string;
  messageId: string;
  output: StoredToolOutput;
  onGenerateReport?: (engagementId: string) => void;
}

const STATUS_CLASSES: Record<TargetStatus, string> = {
  Pending: 'border-spectre-border text-spectre-muted',
  Scanning: 'border-spectre-accent/60 bg-spectre-accent/10 text-spectre-accent',
  Complete: 'border-spectre-success/60 bg-spectre-success/10 text-spectre-success',
  Failed: 'border-spectre-danger/60 bg-spectre-danger/10 text-spectre-danger',
};

function readCardData(output: StoredToolOutput): TargetEngagementData {
  const raw = (output.data ?? {}) as Partial<TargetEngagementData>;
  return {
    source: typeof raw.source === 'string' ? raw.source : 'target list',
    targets: Array.isArray(raw.targets) ? raw.targets : [],
    tools: Array.isArray(raw.tools)
      ? raw.tools.filter((tool): tool is ToolName => tool === 'nmap' || tool === 'nikto')
      : ['nmap'],
    log: typeof raw.log === 'string' ? raw.log : '',
    running: Boolean(raw.running),
    logOpen: raw.logOpen !== false,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    engagementId:
      typeof raw.engagementId === 'string' ? raw.engagementId : undefined,
    totalFindings:
      typeof raw.totalFindings === 'number' ? raw.totalFindings : undefined,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : undefined,
    activeTool:
      raw.activeTool === 'nmap' || raw.activeTool === 'nikto'
        ? raw.activeTool
        : undefined,
    activeTarget:
      typeof raw.activeTarget === 'string' ? raw.activeTarget : undefined,
    lineCount: typeof raw.lineCount === 'number' ? raw.lineCount : 0,
    lastActivityAt:
      typeof raw.lastActivityAt === 'number' ? raw.lastActivityAt : undefined,
  };
}

function withTargetStatus(
  data: TargetEngagementData,
  event: EngagementEvent,
  status: TargetStatus,
) {
  return {
    ...data,
    targets: data.targets.map((target, index) =>
      event.index === index ||
      (event.index === undefined && event.target === target.target)
        ? {
            ...target,
            status,
            findingsCount:
              event.findingsCount === undefined
                ? target.findingsCount
                : event.findingsCount,
          }
        : target,
    ),
  };
}

export default function TargetTable({
  chatId,
  messageId,
  output,
  onGenerateReport,
}: TargetTableProps) {
  const { offline } = useOfflineMode();
  const { appendMessage, setEngagementId, updateMessage } = useChat();
  const initial = readCardData(output);
  const [data, setData] = useState<TargetEngagementData>(initial);
  const dataRef = useRef(initial);
  const controllerRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (dataRef.current.running) return;
    const next = readCardData(output);
    dataRef.current = next;
    setData(next);
  }, [output]);

  useEffect(() => {
    if (data.logOpen && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data.log, data.logOpen]);

  const commit = (next: TargetEngagementData) => {
    dataRef.current = next;
    setData(next);
    updateMessage(
      messageId,
      (message) => ({
        ...message,
        toolOutputs: message.toolOutputs?.map((item) =>
          item.id === output.id
            ? {
                ...item,
                status: next.running
                  ? 'running'
                  : next.engagementId
                    ? 'complete'
                    : 'staged',
                data: next as unknown as Record<string, unknown>,
              }
            : item,
        ),
      }),
      chatId,
    );
  };

  const patchData = (patch: Partial<TargetEngagementData>) => {
    commit({ ...dataRef.current, ...patch });
  };

  const toggleTool = (tool: ToolName) => {
    if (data.running) return;
    const tools = data.tools.includes(tool)
      ? data.tools.filter((item) => item !== tool)
      : [...data.tools, tool];
    patchData({ tools, error: undefined });
  };

  const removeTarget = (id: string) => {
    if (data.running) return;
    patchData({
      targets: data.targets.filter((target) => target.id !== id),
      error: undefined,
    });
  };

  const handleEvent = (event: EngagementEvent) => {
    let next = dataRef.current;

    switch (event.type) {
      case 'target_start':
        next = withTargetStatus(next, event, 'Scanning');
        next = {
          ...next,
          engagementId: event.engagementId ?? next.engagementId,
          activeTarget: event.target,
          log: `${next.log}\n▶ Starting ${event.target ?? 'target'}\n`,
        };
        break;
      case 'tool_start':
        next = {
          ...next,
          activeTool: event.tool,
          activeTarget: event.target,
          log: `${next.log}\n[${event.target}] Running ${event.tool?.toUpperCase()}\n`,
        };
        break;
      case 'tool_output': {
        const chunk = event.chunk ?? '';
        next = {
          ...next,
          activeTool: event.tool,
          activeTarget: event.target,
          lineCount:
            next.lineCount + Math.max(1, chunk.split(/\r?\n/).filter(Boolean).length),
          lastActivityAt: Date.now(),
          log: `${next.log}[${event.target}] [${event.tool}] ${chunk}`,
        };
        break;
      }
      case 'tool_error':
        next = {
          ...next,
          log: `${next.log}\n[${event.target}] [${event.tool}] ERROR: ${event.message ?? 'Tool failed'}\n`,
        };
        break;
      case 'target_complete':
        next = withTargetStatus(
          next,
          event,
          event.status === 'failed' ? 'Failed' : 'Complete',
        );
        next = {
          ...next,
          activeTool: undefined,
          log: `${next.log}\n■ ${event.target}: ${event.findingsCount ?? 0} findings\n`,
        };
        break;
      case 'engagement_complete':
        next = {
          ...next,
          running: false,
          activeTool: undefined,
          activeTarget: undefined,
          engagementId: event.engagementId ?? next.engagementId,
          totalFindings: event.totalFindings ?? 0,
          log: `${next.log}\n✓ Engagement complete: ${event.totalFindings ?? 0} total findings\n`,
        };
        break;
      case 'engagement_error':
        next = {
          ...next,
          running: false,
          activeTool: undefined,
          error: event.message || 'The engagement failed.',
        };
        break;
      default:
        return;
    }

    commit(next);
  };

  const startEngagement = async () => {
    if (offline) {
      patchData({ error: 'Switch to ONLINE mode before starting an engagement.' });
      return;
    }
    if (data.tools.length === 0) {
      patchData({ error: 'Select at least one tool.' });
      return;
    }
    if (data.targets.some((target) => !target.valid)) {
      patchData({ error: 'Remove invalid target rows before starting.' });
      return;
    }
    if (data.targets.length === 0) {
      patchData({ error: 'Add at least one target.' });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    let summaryPosted = false;
    commit({
      ...dataRef.current,
      targets: dataRef.current.targets.map((target) => ({
        ...target,
        status: 'Pending',
        findingsCount: undefined,
      })),
      running: true,
      error: undefined,
      engagementId: undefined,
      totalFindings: undefined,
      startedAt: Date.now(),
      activeTool: undefined,
      activeTarget: undefined,
      lineCount: 0,
      lastActivityAt: undefined,
      log: '',
      logOpen: true,
    });

    try {
      const response = await fetch('/api/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: dataRef.current.targets.map(({ target, label, notes }) => ({
            ip: target,
            label,
            notes,
          })),
          tools: dataRef.current.tools,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `Engagement failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('The engagement returned no progress stream.');
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as EngagementEvent;
          handleEvent(event);
          if (event.type === 'engagement_complete' && event.engagementId) {
            const findings = event.totalFindings ?? 0;
            setEngagementId(event.engagementId, chatId);
            appendMessage(
              'assistant',
              `Engagement complete: ${dataRef.current.targets.length} targets, ${findings} findings`,
              [
                {
                  id: globalThis.crypto.randomUUID(),
                  type: 'engagement-summary',
                  status: 'complete',
                  data: {
                    engagementId: event.engagementId,
                    targetsCount: dataRef.current.targets.length,
                    findingsCount: findings,
                  },
                },
              ],
              chatId,
            );
            summaryPosted = true;
          }
        }
        if (done) break;
      }

      if (buffered.trim()) {
        const event = JSON.parse(buffered) as EngagementEvent;
        handleEvent(event);
        if (
          !summaryPosted &&
          event.type === 'engagement_complete' &&
          event.engagementId
        ) {
          const findings = event.totalFindings ?? 0;
          setEngagementId(event.engagementId, chatId);
          appendMessage(
            'assistant',
            `Engagement complete: ${dataRef.current.targets.length} targets, ${findings} findings`,
            [
              {
                id: globalThis.crypto.randomUUID(),
                type: 'engagement-summary',
                status: 'complete',
                data: {
                  engagementId: event.engagementId,
                  targetsCount: dataRef.current.targets.length,
                  findingsCount: findings,
                },
              },
            ],
            chatId,
          );
        }
      }
    } catch (engagementError) {
      const cancelled = controller.signal.aborted;
      commit({
        ...dataRef.current,
        running: false,
        activeTool: undefined,
        activeTarget: undefined,
        error: cancelled
          ? 'Engagement cancelled.'
          : engagementError instanceof Error
            ? engagementError.message
            : 'The engagement failed.',
        targets: dataRef.current.targets.map((target) =>
          target.status === 'Scanning' ? { ...target, status: 'Failed' } : target,
        ),
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (dataRef.current.running) patchData({ running: false });
    }
  };

  const invalidCount = data.targets.filter((target) => !target.valid).length;

  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-spectre-border bg-spectre-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-spectre-border bg-spectre-surface px-4 py-3">
        <div>
          <h3 className="font-semibold">Targets staged</h3>
          <p className="text-xs text-spectre-muted">
            {data.targets.length} rows from {data.source}
            {invalidCount > 0 ? ` · ${invalidCount} invalid` : ''}
          </p>
        </div>
        {data.engagementId && (
          <span className="rounded-full border border-spectre-success/60 bg-spectre-success/10 px-2 py-1 text-xs text-spectre-success">
            Complete · {data.totalFindings ?? 0} findings
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-spectre-border bg-spectre-bg text-xs uppercase text-spectre-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-spectre-border">
            {data.targets.map((target) => (
              <tr key={target.id} className={target.valid ? '' : 'bg-spectre-danger/5'}>
                <td className="px-4 py-3 font-mono text-xs">
                  <span className={target.valid ? 'text-spectre-text' : 'text-spectre-danger'}>
                    {target.target}
                  </span>
                  {!target.valid && (
                    <span className="mt-1 block font-sans text-[11px] text-spectre-danger">
                      {target.error}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-spectre-muted">
                  {target.label || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${STATUS_CLASSES[target.status]}`}>
                    {target.status}
                    {target.findingsCount !== undefined
                      ? ` · ${target.findingsCount}`
                      : ''}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {!data.running && !data.engagementId && (
                    <button
                      type="button"
                      onClick={() => removeTarget(target.id)}
                      aria-label={`Remove ${target.target}`}
                      className="rounded p-1 text-spectre-muted hover:bg-spectre-danger/10 hover:text-spectre-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 border-t border-spectre-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            {(['nmap', 'nikto'] as ToolName[]).map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-spectre-text">
                <input
                  type="checkbox"
                  checked={data.tools.includes(tool)}
                  disabled={data.running || Boolean(data.engagementId)}
                  onChange={() => toggleTool(tool)}
                  className="accent-spectre-accent"
                />
                {tool}
              </label>
            ))}
          </div>

          {!data.engagementId ? (
            <button
              type="button"
              onClick={() => void startEngagement()}
              disabled={
                data.running ||
                offline ||
                invalidCount > 0 ||
                data.targets.length === 0 ||
                data.tools.length === 0
              }
              className="spectre-btn-primary inline-flex items-center gap-2"
            >
              <Play size={15} />
              Start Engagement
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onGenerateReport?.(data.engagementId!)}
              className="spectre-btn-secondary"
            >
              Generate report
            </button>
          )}
        </div>

        {data.error && (
          <p className="rounded border border-spectre-danger/60 bg-spectre-danger/10 px-3 py-2 text-xs text-spectre-danger">
            {data.error}
          </p>
        )}

        {data.running && (
          <AgentActivity
            compact
            label="Engagement in progress"
            toolName={data.activeTool}
            target={data.activeTarget}
            lineCount={data.lineCount}
            lastActivityAt={data.lastActivityAt}
            startedAt={data.startedAt}
            onCancel={() => controllerRef.current?.abort()}
          />
        )}

        {(data.log || data.running) && (
          <div className="overflow-hidden rounded border border-spectre-border">
            <button
              type="button"
              onClick={() => patchData({ logOpen: !data.logOpen })}
              className="flex w-full items-center justify-between bg-spectre-surface px-3 py-2 text-xs font-medium text-spectre-text hover:bg-spectre-border/40"
            >
              Live output · {data.lineCount} lines
              {data.logOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {data.logOpen && (
              <pre ref={logRef} className="spectre-output max-h-64 whitespace-pre-wrap rounded-none border-0">
                {data.log || 'Waiting for tool output…'}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
