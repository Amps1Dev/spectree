import { ReportData } from '@/lib/types';

export interface ReportMeta {
  engagementName: string;
  targetIp: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  INFO: 3,
};

export function sortedFindings(report: ReportData) {
  return [...report.findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

export function severityCounts(report: ReportData) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of report.findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

/** Plain-text rendering for the .txt download. */
export function reportToText(report: ReportData, meta: ReportMeta): string {
  const findings = sortedFindings(report)
    .map(
      (f) =>
        `[${f.severity}] ${f.title}\n${f.description}${
          f.affected ? `\nAffected: ${f.affected}` : ''
        }${f.remediation ? `\nRemediation: ${f.remediation}` : ''}`,
    )
    .join('\n\n');

  return `ENGAGEMENT: ${meta.engagementName}
TARGET: ${meta.targetIp}

EXECUTIVE SUMMARY
${report.executiveSummary}

SCOPE
${report.scope}

FINDINGS
${findings || 'None recorded.'}

RECOMMENDATIONS
${report.recommendations}

CONCLUSION
${report.conclusion}
`.trim();
}

/** Markdown rendering for the .md download and the Send-to-Chat message. */
export function reportToMarkdown(report: ReportData, meta: ReportMeta): string {
  const findings = sortedFindings(report)
    .map(
      (f) =>
        `### [${f.severity}] ${f.title}\n\n${f.description}${
          f.affected ? `\n\n**Affected:** ${f.affected}` : ''
        }${f.remediation ? `\n\n**Remediation:** ${f.remediation}` : ''}`,
    )
    .join('\n\n');

  return `# ${meta.engagementName || 'Penetration Test Report'}

**Target:** ${meta.targetIp}

## Executive Summary

${report.executiveSummary}

## Scope

${report.scope}

## Findings

${findings || '_None recorded._'}

## Recommendations

${report.recommendations}

## Conclusion

${report.conclusion}
`.trim();
}
