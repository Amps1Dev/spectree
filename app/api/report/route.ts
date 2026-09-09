import { NextRequest, NextResponse } from 'next/server';
import { resolveProvider } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const { engagementName, targetIp, findings, provider } = await request.json();
    const cfg = resolveProvider(provider);

    if (cfg.id === 'groq' && !cfg.apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 },
      );
    }

    const prompt = `Generate a professional penetration test report for the following:

Engagement Name: ${engagementName}
Target IP: ${targetIp}
Findings and Notes:
${findings}

Please provide a structured report with the following sections in JSON format:
{
  "executiveSummary": "Brief overview of the engagement and key findings",
  "scope": "Description of what was tested",
  "findings": [
    {
      "title": "Vulnerability title",
      "severity": "HIGH|MEDIUM|LOW",
      "description": "Detailed description"
    }
  ],
  "recommendations": "Recommended remediation steps",
  "conclusion": "Final assessment and conclusion"
}

Ensure the JSON is valid and properly formatted.`;

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
            content: 'You are a professional penetration testing report generator. Generate detailed, accurate reports based on provided findings.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        // Ask for strict JSON. Both Groq and Ollama support this; Ollama
        // requires the word "JSON" to appear in the prompt (it does, above).
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`${cfg.label} API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const reportData = JSON.parse(jsonMatch[0]);

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 },
    );
  }
}
