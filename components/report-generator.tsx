'use client';

import ReactMarkdown from 'react-markdown';
import { Download, FileDown, Printer, Send } from 'lucide-react';
import { ReportData, Severity } from '@/lib/types';
import {
  reportToText,
  reportToMarkdown,
  severityCounts,
  sortedFindings,
} from '@/lib/report-format';

interface ReportGeneratorProps {
  report: ReportData;
  engagementName: string;
  targetIp: string;
  createdAt?: string;
  onSendToChat: () => void;
}

const SEVERITY_BADGE: Record<Severity, string> = {
  HIGH: 'bg-spectre-danger text-white',
  MEDIUM: 'bg-yellow-600 text-white',
  LOW: 'bg-spectre-accent text-black',
  INFO: 'bg-spectre-border text-spectre-text',
};

const SEVERITY_LABEL: Severity[] = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

// Compact markdown styling (no @tailwindcss/typography in this project).
const md = {
  p: (props: any) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: (props: any) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props: any) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  strong: (props: any) => <strong className="font-semibold" {...props} />,
  a: (props: any) => <a className="text-spectre-accent underline" {...props} />,
  code: ({ inline, ...props }: any) =>
    inline ? (
      <code
        className="px-1 py-0.5 rounded bg-spectre-surface-dark font-mono text-xs text-spectre-accent"
        {...props}
      />
    ) : (
      <code
        className="block p-3 my-2 rounded bg-spectre-surface-dark font-mono text-xs overflow-x-auto"
        {...props}
      />
    ),
};

function Prose({ text }: { text: string }) {
  if (!text?.trim()) {
    return <p className="text-spectre-muted text-sm italic">Not provided.</p>;
  }
  return (
    <div className="text-spectre-text text-sm">
      <ReactMarkdown components={md}>{text}</ReactMarkdown>
    </div>
  );
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export default function ReportGenerator({
  report,
  engagementName,
  targetIp,
  createdAt,
  onSendToChat,
}: ReportGeneratorProps) {
  const meta = { engagementName, targetIp };
  const counts = severityCounts(report);
  const findings = sortedFindings(report);
  const slug = (engagementName || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return (
    <div className="spectre-card p-8 space-y-8 print-report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{engagementName || 'Generated Report'}</h2>
          <p className="text-spectre-muted text-sm font-mono mt-1">
            {targetIp}
            {createdAt && (
              <span className="ml-2">• {new Date(createdAt).toLocaleString()}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="spectre-btn-secondary flex items-center gap-2 text-sm"
            title="Open the browser print dialog — choose 'Save as PDF'"
          >
            <Printer size={15} />
            Print / PDF
          </button>
          <button
            onClick={() => triggerDownload(`${slug}-report.txt`, reportToText(report, meta), 'text/plain')}
            className="spectre-btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={15} />
            .txt
          </button>
          <button
            onClick={() =>
              triggerDownload(`${slug}-report.md`, reportToMarkdown(report, meta), 'text/markdown')
            }
            className="spectre-btn-secondary flex items-center gap-2 text-sm"
          >
            <FileDown size={15} />
            .md
          </button>
        </div>
      </div>

      {/* Severity summary */}
      <div className="flex flex-wrap gap-2">
        {SEVERITY_LABEL.map((sev) => (
          <span
            key={sev}
            className={`severity-badge px-3 py-1 rounded text-xs font-bold ${SEVERITY_BADGE[sev]} ${
              counts[sev] === 0 ? 'opacity-40' : ''
            }`}
          >
            {sev}: {counts[sev]}
          </span>
        ))}
      </div>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Executive Summary</h3>
        <Prose text={report.executiveSummary} />
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Scope</h3>
        <Prose text={report.scope} />
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-4">
          Findings ({findings.length})
        </h3>
        {findings.length === 0 ? (
          <p className="text-spectre-muted text-sm italic">No findings recorded.</p>
        ) : (
          <div className="space-y-4">
            {findings.map((finding, idx) => (
              <div key={idx} className="border border-spectre-border rounded-lg p-4">
                <div className="flex items-start gap-3 mb-2">
                  <span
                    className={`severity-badge px-3 py-1 rounded text-xs font-bold shrink-0 ${
                      SEVERITY_BADGE[finding.severity]
                    }`}
                  >
                    {finding.severity}
                  </span>
                  <h4 className="font-semibold text-spectre-text">{finding.title}</h4>
                </div>
                <div className="text-spectre-muted text-sm">
                  <ReactMarkdown components={md}>{finding.description}</ReactMarkdown>
                </div>
                {finding.affected && (
                  <p className="text-spectre-muted text-xs mt-2">
                    <span className="font-semibold text-spectre-text">Affected: </span>
                    {finding.affected}
                  </p>
                )}
                {finding.remediation && (
                  <p className="text-spectre-muted text-xs mt-1">
                    <span className="font-semibold text-spectre-text">Remediation: </span>
                    {finding.remediation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Recommendations</h3>
        <Prose text={report.recommendations} />
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Conclusion</h3>
        <Prose text={report.conclusion} />
      </section>

      <button
        onClick={onSendToChat}
        className="spectre-btn-secondary w-full flex items-center justify-center gap-2 no-print"
      >
        <Send size={16} />
        Send to Chat
      </button>
    </div>
  );
}
