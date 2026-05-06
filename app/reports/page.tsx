'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import ReportGenerator from '@/components/report-generator';

export default function ReportsPage() {
  const [engagementName, setEngagementName] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [findings, setFindings] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!engagementName || !targetIp || !findings) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementName,
          targetIp,
          findings,
        }),
      });

      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const text = `
ENGAGEMENT: ${engagementName}
TARGET: ${targetIp}

EXECUTIVE SUMMARY
${report.executiveSummary}

SCOPE
${report.scope}

FINDINGS
${report.findings
  .map(
    (f: any) =>
      `[${f.severity}] ${f.title}\n${f.description}`,
  )
  .join('\n\n')}

RECOMMENDATIONS
${report.recommendations}

CONCLUSION
${report.conclusion}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${engagementName}-report.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Report Generator</h1>
        <p className="text-spectre-muted">Generate structured penetration test reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 spectre-card p-6">
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
                className="spectre-input w-full h-96 resize-none"
              />
            </div>

            <button
              onClick={generateReport}
              disabled={loading || !engagementName || !targetIp || !findings}
              className="spectre-btn-primary w-full"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          {report && <ReportGenerator report={report} onDownload={downloadReport} />}
        </div>
      </div>
    </div>
  );
}
