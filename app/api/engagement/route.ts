import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  executeNikto,
  executeNmap,
  normalizeScanTarget,
  ToolExecutionError,
} from '@/lib/tools';
import {
  EngagementTarget,
  getEngagements,
  parseNiktoOutput,
  parseNmapOutput,
  saveEngagement,
  saveScan,
  ScanTool,
  Vulnerability,
} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED_TOOLS: ScanTool[] = ['nmap', 'nikto'];

function parseRequestTargets(value: unknown): EngagementTarget[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolExecutionError('At least one target is required', 400);
  }
  if (value.length > 500) {
    throw new ToolExecutionError('A batch may contain at most 500 targets', 400);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ToolExecutionError(`Target ${index + 1} is invalid`, 400);
    }
    const target = item as Record<string, unknown>;

    return {
      ip: normalizeScanTarget(target.ip),
      label: String(target.label ?? '').trim() || undefined,
      notes: String(target.notes ?? '').trim() || undefined,
    };
  });
}

function parseRequestTools(value: unknown): ScanTool[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolExecutionError('Select at least one tool', 400);
  }

  const requested = Array.from(new Set(value.map((tool) => String(tool))));
  const unsupported = requested.filter(
    (tool) => !SUPPORTED_TOOLS.includes(tool as ScanTool),
  );
  if (unsupported.length > 0) {
    throw new ToolExecutionError(
      `Unsupported tools: ${unsupported.join(', ')}`,
      400,
    );
  }

  return requested as ScanTool[];
}

export async function GET() {
  return NextResponse.json({ engagements: getEngagements() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targets = parseRequestTargets(body.targets);
    const tools = parseRequestTools(body.tools);
    const engagementId = randomUUID();
    const createdAt = new Date().toISOString();

    saveEngagement({ id: engagementId, targets, tools, createdAt });

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const emit = (event: Record<string, unknown>) => {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            } catch {
              closed = true;
              abortController.abort();
            }
          }
        };
        const close = () => {
          if (closed) return;
          closed = true;
          request.signal.removeEventListener('abort', abort);
          try {
            controller.close();
          } catch {
            // The client may already have cancelled the stream.
          }
        };

        const run = async () => {
          let totalFindings = 0;

          for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            if (abortController.signal.aborted) break;

            emit({
              type: 'target_start',
              target: target.ip,
              index,
              engagementId,
            });

            let targetFindings = 0;
            let targetFailed = false;

            for (const tool of tools) {
              if (abortController.signal.aborted) break;

              let output = '';
              let findings: Vulnerability[] = [];
              let exitCode: number | null = null;

              emit({ type: 'tool_start', target: target.ip, index, tool });

              try {
                const result = await (tool === 'nmap'
                  ? executeNmap(target.ip, 'Service', {
                      signal: abortController.signal,
                      onOutput(chunk) {
                        emit({
                          type: 'tool_output',
                          target: target.ip,
                          index,
                          tool,
                          chunk,
                        });
                      },
                    })
                  : executeNikto(target.ip, {
                      signal: abortController.signal,
                      onOutput(chunk) {
                        emit({
                          type: 'tool_output',
                          target: target.ip,
                          index,
                          tool,
                          chunk,
                        });
                      },
                    }));

                output = result.output;
                exitCode = result.exitCode;
                targetFailed ||= result.exitCode !== 0;
              } catch (error) {
                targetFailed = true;
                output = error instanceof ToolExecutionError ? error.output : '';
                emit({
                  type: 'tool_error',
                  target: target.ip,
                  index,
                  tool,
                  message: error instanceof Error ? error.message : `${tool} failed`,
                });
              }

              findings =
                tool === 'nmap'
                  ? parseNmapOutput(output, target.ip, engagementId)
                  : parseNiktoOutput(output, target.ip, engagementId);

              saveScan({
                id: randomUUID(),
                engagementId,
                target: target.ip,
                tool,
                output,
                timestamp: new Date().toISOString(),
                vulnerabilities: findings,
              });

              targetFindings += findings.length;
              totalFindings += findings.length;
              emit({
                type: 'tool_complete',
                target: target.ip,
                index,
                tool,
                exitCode,
                findingsCount: findings.length,
              });
            }

            emit({
              type: 'target_complete',
              target: target.ip,
              index,
              findingsCount: targetFindings,
              status: targetFailed ? 'failed' : 'complete',
            });
          }

          emit({
            type: 'engagement_complete',
            engagementId,
            totalFindings,
          });
        };

        void run()
          .catch((error) => {
            emit({
              type: 'engagement_error',
              engagementId,
              message:
                error instanceof Error ? error.message : 'Engagement failed',
            });
          })
          .finally(close);
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Engagement-Id': engagementId,
      },
    });
  } catch (error) {
    const status = error instanceof ToolExecutionError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start engagement',
      },
      { status },
    );
  }
}
