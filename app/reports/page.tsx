'use client';

import ReportPanel from '@/components/ReportPanel';

export default function ReportsPage() {
  return (
    <div className="space-y-8 p-8">
      <header>
        <h1 className="mb-2 text-4xl font-bold">Report Generator</h1>
        <p className="text-spectre-muted">
          Turn saved scan findings into a structured penetration test report.
        </p>
      </header>

      <ReportPanel standalone className="min-h-[32rem]" />
    </div>
  );
}
