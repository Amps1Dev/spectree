import { NextRequest, NextResponse } from 'next/server';
import { ToolExecutionError, ToolExecutionOptions, ToolExecutionResult } from './tools';
import { requiredText } from './tool-scope';

type ToolInput = Record<string, unknown>;
type Executor = (input: ToolInput, options: ToolExecutionOptions) => Promise<ToolExecutionResult>;

export function textParam(input: ToolInput, name: string, fallback?: string): string {
  const value = input[name];
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === '' && fallback === '') return '';
  return requiredText(value, name, 4096);
}

// All dedicated routes use the same plain-text streaming contract as Nmap and
// Nikto. Their typed executors enforce target/app/file scope before spawning.
export async function streamTool(request: NextRequest, execute: Executor) {
  let disconnect: (() => void) | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    let input: unknown;
    try { input = await request.json(); } catch { throw new ToolExecutionError('Request body must be valid JSON', 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ToolExecutionError('Request body must be an object', 400);
    const body = input as ToolInput;
    if (body.offline === true) throw new ToolExecutionError('Tool execution is disabled in offline mode', 409);

    const encoder = new TextEncoder();
    const controller = new AbortController();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const streamWriter = writable.getWriter();
    writer = streamWriter;
    const abort = () => controller.abort();
    disconnect = abort;
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });
    void streamWriter.closed.catch(abort);

    const execution = execute(body, {
      signal: controller.signal,
      onOutput(chunk) {
        if (!controller.signal.aborted) void streamWriter.write(encoder.encode(chunk)).catch(abort);
      },
    });

    void execution.catch(async (error) => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      await streamWriter.write(encoder.encode(`\n[SPECTRE_ERROR] ${message}\n`));
    }).finally(async () => {
      request.signal.removeEventListener('abort', abort);
      await streamWriter.close().catch(() => {});
    }).catch(abort);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (disconnect) {
      request.signal.removeEventListener('abort', disconnect);
      disconnect();
    }
    if (writer) void writer.abort().catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tool execution failed' },
      { status: error instanceof ToolExecutionError ? error.status : 500 },
    );
  }
}
