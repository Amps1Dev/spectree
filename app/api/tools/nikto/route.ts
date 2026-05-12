import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { saveScan, parseNiktoOutput } from '@/lib/store';
import crypto from 'crypto';

const BLOCKED = ['localhost', '127.0.0.1', '::1', '0.0.0.0', ''];

function validateTarget(target: string): string | null {
  const t = target.trim().toLowerCase();
  if (!t) return 'Target is required';
  if (BLOCKED.some((b) => t === b || t.startsWith(b + ':'))) return 'Scanning localhost is not allowed';
  if (t.includes('..') || t.includes(';') || t.includes('|') || t.includes('`'))
    return 'Invalid target';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { target } = await request.json();

    const validationError = validateTarget(target);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const encoder = new TextEncoder();
    let fullOutput = '';

    const stream = new ReadableStream({
      start(controller) {
        // nikto -h <target> -Format txt
        const proc = spawn('nikto', ['-h', target.trim(), '-Format', 'txt'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          fullOutput += text;
          controller.enqueue(encoder.encode(text));
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          controller.enqueue(encoder.encode(`[info] ${chunk.toString()}`));
        });

        proc.on('close', (code) => {
          try {
            const vulns = parseNiktoOutput(fullOutput, target.trim());
            saveScan({
              id: crypto.randomUUID(),
              target: target.trim(),
              tool: 'nikto',
              output: fullOutput,
              timestamp: new Date().toISOString(),
              vulnerabilities: vulns,
            });
            controller.enqueue(encoder.encode(`\n[SPECTRE] Scan complete. ${vulns.length} finding(s) saved to Vulnerabilities.\n`));
          } catch {
            controller.enqueue(encoder.encode(`\n[SPECTRE] Scan complete.\n`));
          }
          controller.close();
        });

        proc.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            controller.enqueue(encoder.encode('[ERROR] nikto not found. Install with: sudo apt install nikto\n'));
          } else {
            controller.enqueue(encoder.encode(`[ERROR] ${err.message}\n`));
          }
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to start nikto' }, { status: 500 });
  }
}