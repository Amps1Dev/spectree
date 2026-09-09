import { NextRequest, NextResponse } from 'next/server';
import { resolveProvider } from '@/lib/llm';
import { ReportData, ReportFinding, Severity } from '@/lib/types';

const SEVERITIES: Severity[] = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

function coerceSeverity(v: unknown): Severity {
  const s = String(v ?? '').trim().toUpperCase();
  if (s.startsWith('CRIT')) return 'HIGH';
  return SEVERITIES.find((sev) => s.includes(sev)) ?? 'INFO';
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Pull a JSON object out of an LLM response that may be wrapped in prose or
// ```json fences. Small local models don't always honour response_format, so
// this is deliberately forgiving. Returns null if nothing parses.
function extractJson(content: string): any | null {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const direct = tryParse(content.trim());
  if (direct !== undefined) return direct;

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const p = tryParse(fenced[1].trim());
    if (p !== undefined) return p;
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const p = tryParse(content.slice(start, end + 1));
    if (p !== undefined) return p;
  }
  return null;
}

function normalizeFindings(raw: unknown): ReportFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f: any): ReportFinding | null => {
      if (typeof f === 'string') {
        return { title: f, severity: 'INFO', description: '' };
      }
      if (f && typeof f === 'object') {
        return {
          title: str(f.title || f.name || f.vulnerability || 'Finding'),
          severity: coerceSeverity(f.severity ?? f.risk ?? f.level),
          description: str(f.description || f.detail || f.summary),
          remediation: f.remediation ? str(f.remediation) : undefined,
          affected: f.affected ? str(f.affected) : undefined,
        };
      }
      return null;
    })
    .filter((f): f is ReportFinding => f !== null);
}

// Always returns a renderable report, even if the model produced plain prose.
function normalizeReport(raw: any, rawContent: string): ReportData {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const hasStructure =
    obj.executiveSummary ||
    obj.summary ||
    obj.findings ||
    obj.scope ||
    obj.recommendations ||
    obj.conclusion;

  if (!hasStructure) {
    // Model ignored the JSON contract — keep its text rather than 500.
    return {
      executiveSummary:
        rawContent.trim() || 'The model did not return a structured report.',
      scope: '',
      findings: [],
      recommendations: '',
      conclusion: '',
    };
  }

  return {
    executiveSummary: str(obj.executiveSummary || obj.summary),
    scope: str(obj.scope),
    findings: normalizeFindings(obj.findings),
    recommendations: str(obj.recommendations),
    conclusion: str(obj.conclusion),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { engagementName, targetIp, findings, provider } = await request.json();
    const cfg = resolveProvider(provider);

    if (cfg.id === 'groq' && !cfg.apiKey) {
      return NextResponse.json(
        {
          error:
            'Groq API key not configured. Switch to the Local (Ollama) provider or set GROQ_API_KEY.',
        },
        { status: 400 },
      );
    }

    const prompt = `Generate a professional penetration test report for the following:

Engagement Name: ${engagementName}
Target IP: ${targetIp}
Findings and Notes:
${findings}

Respond with ONLY a valid JSON object (no prose, no code fences) with this exact shape:
{
  "executiveSummary": "Brief overview of the engagement and key findings",
  "scope": "Description of what was tested",
  "findings": [
    {
      "title": "Vulnerability title",
      "severity": "HIGH|MEDIUM|LOW|INFO",
      "description": "Detailed description",
      "remediation": "How to fix it"
    }
  ],
  "recommendations": "Recommended remediation steps",
  "conclusion": "Final assessment and conclusion"
}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    const response = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional penetration testing report generator. Generate detailed, accurate reports based on provided findings. Always answer with a single JSON object.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
        // Both Groq and Ollama honour this; Ollama requires the word "JSON" in
        // the prompt (present above). extractJson() is the safety net.
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const hint =
        cfg.id === 'ollama'
          ? ' Is Ollama running and the model pulled?'
          : '';
      return NextResponse.json(
        {
          error: `${cfg.label} request failed (${response.status}).${hint} ${detail.slice(0, 200)}`.trim(),
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'The model returned an empty response.' },
        { status: 502 },
      );
    }

    const report = normalizeReport(extractJson(content), content);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Report API error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
