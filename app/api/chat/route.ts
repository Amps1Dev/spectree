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
    const { messages } = await request.json();

    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

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
            content: `You are SPECTRE, an expert penetration testing assistant. Help the user enumerate targets, interpret scan results, identify vulnerabilities, and plan attack vectors. Only assist with authorized targets. Be concise and technical.`,
          },
          ...formattedMessages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const encoder = new TextEncoder();
    const readable = response.body;

    if (!readable) {
      return NextResponse.json({ error: 'No response body' }, { status: 500 });
    }

    const transformStream = new TransformStream({
      transform: async (chunk, controller) => {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                controller.enqueue(encoder.encode(token));
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      },
    });

    const body = readable.pipeThrough(transformStream);

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 },
    );
  }
}
