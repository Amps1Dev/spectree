import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagements,
  getVulnerabilities,
  Severity,
  Vulnerability,
} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL =
  process.env.SPECTRE_GROQ_URL ||
  'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';
const SEVERITIES: Severity[] = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

function groupFindings(findings: Vulnerability[]) {
  const grouped: Record<
    Severity,
    Record<string, Array<Omit<Vulnerability, 'id' | 'timestamp' | 'engagementId'>>>
  > = {
    HIGH: {},
    MEDIUM: {},
    LOW: {},
    INFO: {},
  };

  for (const finding of findings) {
    const byTarget = grouped[finding.severity];
    byTarget[finding.target] ??= [];
    byTarget[finding.target].push({
      target: finding.target,
      severity: finding.severity,
      service: finding.service,
      port: finding.port,
      description: finding.description,
      remediation: finding.remediation,
      tool: finding.tool,
    });
  }

  return grouped;
}

export async function GET() {
  const findings = getVulnerabilities();
  const engagements = getEngagements().map((engagement) => ({
    ...engagement,
    findingsCount: findings.filter(
      (finding) => finding.engagementId === engagement.id,
    ).length,
  }));

  return NextResponse.json({
    allFindingsCount: findings.length,
    engagements,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const engagementId =
      typeof body.engagementId === 'string' && body.engagementId.trim()
        ? body.engagementId.trim()
        : undefined;
    const allFindings = getVulnerabilities();
    const findings = engagementId
      ? allFindings.filter((finding) => finding.engagementId === engagementId)
      : allFindings;

    if (findings.length === 0) {
      return NextResponse.json(
        {
          error: engagementId
            ? 'This engagement has no findings to report.'
            : 'There are no findings to report.',
          findingsCount: 0,
        },
        { status: 404 },
      );
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 },
      );
    }

    const targets = Array.from(
      new Set(findings.map((finding) => finding.target)),
    );
    const groupedFindings = groupFindings(findings);
    const severityCounts = Object.fromEntries(
      SEVERITIES.map((severity) => [
        severity,
        Object.values(groupedFindings[severity]).reduce(
          (count, targetFindings) => count + targetFindings.length,
          0,
        ),
      ]),
    );

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior penetration testing report writer. Produce a clear Markdown report with exactly these major sections: Executive Summary, Scope, Findings by Severity, and Overall Recommendations. Scope must list every tested target. Under Findings by Severity, organize HIGH, MEDIUM, LOW, and INFO findings by target. For every finding include target, affected service/port, description, and concrete remediation. Do not invent findings or claim testing beyond the supplied data.',
          },
          {
            role: 'user',
            content: `Write the penetration test report from this structured evidence:\n\n${JSON.stringify(
              {
                engagementId: engagementId ?? null,
                targets,
                findingsCount: findings.length,
                severityCounts,
                findingsBySeverityAndTarget: groupedFindings,
              },
              null,
              2,
            )}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 6000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Groq report error:', detail);
      return NextResponse.json(
        { error: `Groq API error: ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    const report = payload.choices?.[0]?.message?.content;

    if (typeof report !== 'string' || !report.trim()) {
      return NextResponse.json(
        { error: 'Groq returned an empty report.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      report: report.trim(),
      generatedAt: new Date().toISOString(),
      findingsCount: findings.length,
    });
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 },
    );
  }
}
