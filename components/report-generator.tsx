'use client';

import { Download, Send } from 'lucide-react';

interface Finding {
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

interface ReportData {
  executiveSummary: string;
  scope: string;
  findings: Finding[];
  recommendations: string;
  conclusion: string;
}

interface ReportGeneratorProps {
  report: ReportData;
  onDownload: () => void;
}

export default function ReportGenerator({ report, onDownload }: ReportGeneratorProps) {
  const severityColors = {
    HIGH: 'bg-spectre-danger text-white',
    MEDIUM: 'bg-yellow-600 text-white',
    LOW: 'bg-spectre-accent text-black',
  };

  return (
    <div className="spectre-card p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Generated Report</h2>
        <button
          onClick={onDownload}
          className="spectre-btn-primary flex items-center gap-2"
        >
          <Download size={16} />
          Download .txt
        </button>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Executive Summary</h3>
        <p className="text-spectre-text leading-relaxed">{report.executiveSummary}</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Scope</h3>
        <p className="text-spectre-text leading-relaxed">{report.scope}</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-4">Findings</h3>
        <div className="space-y-4">
          {report.findings.map((finding, idx) => (
            <div key={idx} className="border border-spectre-border rounded-lg p-4">
              <div className="flex items-start gap-3 mb-2">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    severityColors[finding.severity]
                  }`}
                >
                  {finding.severity}
                </span>
                <h4 className="font-semibold text-spectre-text">{finding.title}</h4>
              </div>
              <p className="text-spectre-muted text-sm">{finding.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Recommendations</h3>
        <p className="text-spectre-text leading-relaxed">{report.recommendations}</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-spectre-accent mb-3">Conclusion</h3>
        <p className="text-spectre-text leading-relaxed">{report.conclusion}</p>
      </section>

      <button className="spectre-btn-secondary w-full flex items-center justify-center gap-2">
        <Send size={16} />
        Send to Chat
      </button>
    </div>
  );
}
