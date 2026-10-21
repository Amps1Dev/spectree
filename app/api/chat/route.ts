import { NextRequest, NextResponse } from 'next/server';
import { requestCompletion, ProviderError } from '@/lib/llm';
import { chatInput } from '@/lib/api-input';
import { chatTextStream } from '@/lib/chat-stream';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const input = chatInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Provide a nonempty messages array with user/assistant roles, text content, and a valid provider.' }, { status: 400 });
  try {
    const response = await requestCompletion(input.data.provider, {
      messages: [
        { role: 'system', content: 'You are SPECTRE, an expert network diagnostics and penetration testing assistant. Help interpret scans and assess networks the user owns or administers. Be concise and technical.' },
        ...input.data.messages,
      ],
      stream: true, temperature: 0.7, max_tokens: 2048,
    }, request.signal);
    if (!response.body) throw new ProviderError('The model returned no response body.', 502);
    return new Response(response.body.pipeThrough(chatTextStream()), { headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no',
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process chat request.' }, { status: error instanceof ProviderError ? error.status : 502 });
  }
}
