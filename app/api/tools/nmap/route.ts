import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { saveScan, parseNmapOutput } from '@/lib/store';
import crypto from 'crypto';

const BLOCKED = ['localhost', '127.0.0.1', '::1', '0.0.0.0', ''];

function validateTarget(target: string): string | null {
  const t = target.trim().toLowerCase();
  if (!t) return 'Target is required';
  if (BLOCKED.includes(t)) return 'Scanning localhost is not allowed';
  if (t.includes('..') || t.includes('/etc') || t.includes(';') || t.includes('|') || t.includes('`'))
    return 'Invalid target';
  return null;
}

const SCAN_PROFILES: Record<string, string[]> = {
  quick:   ['-T4', '-F', '--open'],
  service: ['-sV', '-T4', '--open'],
  full:    ['-sV', '-A', '-T4', '--open'],
};

export async function POST(request: NextRequest) {
  try {
    const { target, profile = 'service' } = await request.json();

    const validationError = validateTarget(target);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const args = [...(SCAN_PROFILES[profile] ?? SCAN_PROFILES.service), target.trim()];

    const encoder = new TextEncoder();
    let fullOutput = '';

    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn('nmap', args, { stdio: ['ignore', 'pipe', 'pipe'] });

        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          fullOutput += text;
          controller.enqueue(encoder.encode(text));
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          // nmap writes status to stderr — include it so user sees progress
          controller.enqueue(encoder.encode(`[info] ${text}`));
        });

        proc.on('close', (code) => {
          if (code !== 0 && fullOutput.trim() === '') {
            controller.enqueue(encoder.encode(`[ERROR] nmap exited with code ${code}. Try running: sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)\n`));
          } else {
            // Parse and persist findings
            try {
              const vulns = parseNmapOutput(fullOutput, target.trim());
              saveScan({
                id: crypto.randomUUID(),
                target: target.trim(),
                tool: 'nmap',
                output: fullOutput,
                timestamp: new Date().toISOString(),
                vulnerabilities: vulns,
              });
              controller.enqueue(encoder.encode(`\n[SPECTRE] Scan complete. ${vulns.length} finding(s) saved to Vulnerabilities.\n`));
            } catch (e) {
              controller.enqueue(encoder.encode(`\n[SPECTRE] Scan complete. Could not parse findings.\n`));
            }
          }
          controller.close();
        });

        proc.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            controller.enqueue(encoder.encode('[ERROR] nmap not found. Install with: sudo apt install nmap\n'));
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start nmap' }, { status: 500 });
  }
}
