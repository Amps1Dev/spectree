import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const { engagementName, targetIp, findings } = await request.json();

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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
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
