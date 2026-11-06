import { NextRequest, NextResponse } from 'next/server';
import {
  executeNmap,
  ToolExecutionError,
} from '@/lib/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { target = '', profile = 'Quick' } = await request.json();
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const abort = () => abortController.abort();
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });

    const execution = executeNmap(target, profile, {
      signal: abortController.signal,
      onOutput(chunk) {
        void writer.write(encoder.encode(chunk)).catch(abort);
      },
    });

    void execution
      .catch(async (error) => {
        const message = error instanceof Error ? error.message : 'Nmap failed';
        await writer.write(encoder.encode(`Error: ${message}\n`));
      })
      .finally(async () => {
        request.signal.removeEventListener('abort', abort);
        await writer.close().catch(() => {});
      })
      .catch(abort);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Nmap API error:', error);
    const status = error instanceof ToolExecutionError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute nmap' },
      { status },
    );
  }
}
