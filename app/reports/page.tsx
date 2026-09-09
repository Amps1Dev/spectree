'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, FileText, AlertCircle } from 'lucide-react';
import ReportGenerator from '@/components/report-generator';
import { useLLM } from '@/components/llm-context';
import { ReportData, SavedReport } from '@/lib/types';
import {
  addReport,
  deleteReport,
  loadReports,
  appendChat,
} from '@/lib/local-store';
import { reportToMarkdown } from '@/lib/report-format';

export default function ReportsPage() {
  const router = useRouter();
  const { provider } = useLLM();

  const [engagementName, setEngagementName] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [findings, setFindings] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedReport[]>([]);

  // Restore saved reports on the client only (SSR-safe).
  useEffect(() => {
    setSaved(loadReports());
  }, []);

  const generateReport = async () => {
    if (!engagementName || !targetIp || !findings) {
      setError('Fill in engagement name, target and findings first.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementName, targetIp, findings, provider }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      const now = new Date().toISOString();
      const generated = data as ReportData;
      setReport(generated);
      setCreatedAt(now);

      const entry: SavedReport = {
        id: crypto.randomUUID(),
        engagementName,
        targetIp,
        findings,
        report: generated,
        createdAt: now,
      };
      setSaved(addReport(entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const openSaved = (r: SavedReport) => {
    setEngagementName(r.engagementName);
    setTargetIp(r.targetIp);
    setFindings(r.findings);
    setReport(r.report);
    setCreatedAt(r.createdAt);
    setError('');
  };

  const removeSaved = (id: string) => {
    setSaved(deleteReport(id));
  };

  const sendToChat = () => {
    if (!report) return;
    appendChat({
      role: 'assistant',
      content: `**Generated report — ${engagementName || 'Untitled'}**\n\n${reportToMarkdown(
        report,
        { engagementName, targetIp },
      )}`,
    });
    router.push('/chat');
  };

  const formIncomplete = !engagementName || !targetIp || !findings;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Report Generator</h1>
        <p className="text-spectre-muted">
          Generate structured penetration test reports with your selected model provider.
        </p>
      </div>

      <div className="reports-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form + saved reports */}
        <div className="lg:col-span-1 space-y-6 no-print">
          <div className="spectre-card p-6">
            <h2 className="text-lg font-semibold mb-4">Report Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-spectre-muted mb-2">
                  Engagement Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., ACME Corp Pentest"
                  value={engagementName}
                  onChange={(e) => setEngagementName(e.target.value)}
                  className="spectre-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-spectre-muted mb-2">Target IP</label>
                <input
                  type="text"
                  placeholder="192.168.1.1"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  className="spectre-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-spectre-muted mb-2">Findings</label>
                <textarea
                  placeholder="Paste your scan results, notes, and findings..."
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  className="spectre-input w-full h-64 resize-none font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={generateReport}
                disabled={loading || formIncomplete}
                className={`spectre-btn-primary w-full ${
                  loading || formIncomplete ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
          </div>

          <div className="spectre-card p-6">
            <h2 className="text-lg font-semibold mb-4">
              Saved Reports {saved.length > 0 && `(${saved.length})`}
            </h2>
            {saved.length === 0 ? (
              <p className="text-spectre-muted text-sm">
                Generated reports are saved here on this device.
              </p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {saved.map((r) => (
                  <li
                    key={r.id}
                    className="group flex items-start justify-between gap-2 p-3 bg-spectre-surface-dark border border-spectre-border rounded hover:border-spectre-accent/50 transition-colors"
                  >
                    <button
                      onClick={() => openSaved(r)}
                      className="flex items-start gap-2 text-left flex-1 min-w-0"
                    >
                      <FileText size={15} className="shrink-0 mt-0.5 text-spectre-accent" />
                      <span className="min-w-0">
                        <span className="block text-sm text-spectre-text font-medium truncate">
                          {r.engagementName || 'Untitled'}
                        </span>
                        <span className="block text-xs text-spectre-muted truncate">
                          {r.targetIp} • {r.report.findings.length} findings •{' '}
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => removeSaved(r.id)}
                      className="shrink-0 text-spectre-muted hover:text-spectre-danger transition-colors"
                      title="Delete report"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: rendered report */}
        <div className="lg:col-span-2">
          {report ? (
            <ReportGenerator
              report={report}
              engagementName={engagementName}
              targetIp={targetIp}
              createdAt={createdAt}
              onSendToChat={sendToChat}
            />
          ) : (
            <div className="spectre-card p-12 flex flex-col items-center justify-center text-center h-full min-h-64 no-print">
              <FileText size={40} className="text-spectre-muted mb-4" />
              <p className="text-spectre-muted">
                Fill in the details and generate a report, or open a saved one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
