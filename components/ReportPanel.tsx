'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';
import AgentActivity from '@/components/AgentActivity';
import SpectreSpinner from '@/components/spectre-spinner';
import MarkdownText from '@/components/markdown-text';
import { useOfflineMode } from '@/hooks/useOfflineMode';

const REPORT_STORAGE_KEY = 'spectre-generated-reports';

interface EngagementSummary {
  id: string;
  createdAt: string;
  findingsCount: number;
  targets: Array<{ ip: string; label?: string }>;
  tools: string[];
}

interface ReportMetadata {
  allFindingsCount: number;
  engagements: EngagementSummary[];
}

interface GeneratedReport {
  report: string;
  generatedAt: string;
  findingsCount: number;
}

interface ReportPanelProps {
  requestedEngagementId?: string;
  onClose?: () => void;
  className?: string;
  standalone?: boolean;
}

function readStoredReports(): Record<string, GeneratedReport> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(REPORT_STORAGE_KEY) || '{}',
    );
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReport(scope: string, report: GeneratedReport) {
  if (typeof window === 'undefined') return;
  try {
    const reports = readStoredReports();
    reports[scope] = report;
    window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // The generated report remains available in React state for this session.
  }
}

export default function ReportPanel({
  requestedEngagementId,
  onClose,
  className = '',
  standalone = false,
}: ReportPanelProps) {
  const { offline } = useOfflineMode();
  const [metadata, setMetadata] = useState<ReportMetadata | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState(
    requestedEngagementId || 'all',
  );
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [reportStartedAt, setReportStartedAt] = useState(0);
  const reportAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (requestedEngagementId) setSelectedEngagement(requestedEngagementId);
  }, [requestedEngagementId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetadata(true);

    void fetch('/api/report', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load findings (${response.status})`);
        }
        return response.json();
      })
      .then((data: ReportMetadata) => {
        if (!cancelled) setMetadata(data);
      })
      .catch((metadataError) => {
        if (!cancelled) {
          setError(
            metadataError instanceof Error
              ? metadataError.message
              : 'Failed to load findings.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMetadata(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedEngagementId]);

  useEffect(() => {
    setReport(readStoredReports()[selectedEngagement] ?? null);
    setCopied(false);
    setError('');
  }, [selectedEngagement]);

  const selectedSummary = useMemo(
    () =>
      selectedEngagement === 'all'
        ? null
        : metadata?.engagements.find(
            (engagement) => engagement.id === selectedEngagement,
          ) ?? null,
    [metadata, selectedEngagement],
  );
  const selectedFindingsCount =
    selectedEngagement === 'all'
      ? metadata?.allFindingsCount ?? 0
      : selectedSummary?.findingsCount ?? 0;

  const generateReport = async () => {
    if (selectedFindingsCount === 0) return;
    if (offline) {
      setError('Switch to ONLINE mode before generating a report.');
      return;
    }

    setGenerating(true);
    setError('');
    setCopied(false);
    setReportStartedAt(Date.now());
    const controller = new AbortController();
    reportAbortRef.current = controller;

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selectedEngagement === 'all'
            ? {}
            : { engagementId: selectedEngagement },
        ),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || `Report generation failed (${response.status})`,
        );
      }

      const generated = data as GeneratedReport;
      setReport(generated);
      writeStoredReport(selectedEngagement, generated);
    } catch (reportError) {
      const cancelled =
        controller.signal.aborted ||
        (reportError instanceof DOMException && reportError.name === 'AbortError');
      setError(
        cancelled
          ? 'Report generation cancelled.'
          : reportError instanceof Error
            ? reportError.message
            : 'Report generation failed.',
      );
    } finally {
      if (reportAbortRef.current === controller) reportAbortRef.current = null;
      setGenerating(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access was denied by the browser.');
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const scope =
      selectedEngagement === 'all'
        ? 'all-findings'
        : `engagement-${selectedEngagement.slice(0, 8)}`;
    link.href = url;
    link.download = `spectre-${scope}-report.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className={`flex min-h-0 flex-col border-spectre-border bg-spectre-card ${standalone ? 'spectre-card' : 'h-full'} ${className}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-spectre-border p-4">
        <div>
          <h2 className="font-semibold">Penetration Test Report</h2>
          <p className="text-xs text-spectre-muted">
            Generate from saved findings
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report panel"
            className="rounded p-1 text-spectre-muted hover:bg-spectre-border/40 hover:text-spectre-text"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loadingMetadata && <p className="flex items-center gap-2 text-xs text-spectre-muted"><SpectreSpinner size={20} label="" />Loading findings…</p>}
        {offline && (
          <div className="rounded border border-spectre-offline/60 bg-spectre-offline/10 px-3 py-2 text-xs text-spectre-muted">
            Offline mode is active. Report generation is disabled.
          </div>
        )}

        <div>
          <label
            htmlFor={`report-scope-${standalone ? 'page' : 'panel'}`}
            className="mb-1.5 block text-xs font-medium text-spectre-muted"
          >
            Findings scope
          </label>
          <select
            id={`report-scope-${standalone ? 'page' : 'panel'}`}
            value={selectedEngagement}
            disabled={loadingMetadata || generating}
            onChange={(event) => setSelectedEngagement(event.target.value)}
            className="spectre-input w-full"
          >
            <option value="all">
              All Findings ({metadata?.allFindingsCount ?? 0})
            </option>
            {metadata?.engagements.map((engagement) => {
              const firstTarget = engagement.targets[0];
              const label = firstTarget?.label || firstTarget?.ip || 'No targets';
              return (
                <option key={engagement.id} value={engagement.id}>
                  {label}
                  {engagement.targets.length > 1
                    ? ` +${engagement.targets.length - 1}`
                    : ''}{' '}
                  · {engagement.findingsCount} findings
                </option>
              );
            })}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void generateReport()}
          disabled={
            loadingMetadata ||
            generating ||
            offline ||
            selectedFindingsCount === 0
          }
          className="spectre-btn-primary w-full"
        >
          {generating ? 'Generating…' : 'Generate Report'}
        </button>

        {!loadingMetadata && selectedFindingsCount === 0 && (
          <div className="rounded-lg border border-spectre-border bg-spectre-surface p-6 text-center">
            <FileText size={30} className="mx-auto mb-2 text-spectre-muted" />
            <h3 className="text-sm font-semibold">No findings in this scope</h3>
            <p className="mt-1 text-xs text-spectre-muted">
              Complete a scan with findings before generating a report.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded border border-spectre-danger/60 bg-spectre-danger/10 p-3 text-xs text-spectre-danger">
            {error}
          </div>
        )}

        {generating && (
          <AgentActivity
            compact
            label={`Drafting from ${selectedFindingsCount} findings`}
            startedAt={reportStartedAt}
            onCancel={() => reportAbortRef.current?.abort()}
          />
        )}

        {report && !generating && (
          <div className="overflow-hidden rounded-lg border border-spectre-border bg-spectre-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-spectre-border p-3">
              <div>
                <h3 className="text-sm font-semibold">Generated Report</h3>
                <p className="text-[11px] text-spectre-muted">
                  {report.findingsCount} findings ·{' '}
                  {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void copyReport()}
                  aria-label="Copy report to clipboard"
                  className="rounded border border-spectre-border p-2 text-spectre-muted hover:border-spectre-accent hover:text-spectre-accent"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  aria-label="Download report as text"
                  className="rounded border border-spectre-border p-2 text-spectre-muted hover:border-spectre-accent hover:text-spectre-accent"
                >
                  <Download size={15} />
                </button>
              </div>
            </div>
            <article className="p-4 text-sm">
              <MarkdownText content={report.report} className="text-sm" />
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
