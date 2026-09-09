import { NextRequest } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { getTool, resolveBin } from '@/lib/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TIMEOUT = 180_000;

function streamHeaders() {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  };
}

async function cleanup(paths: string[]) {
  await Promise.all(paths.map((p) => unlink(p).catch(() => {})));
}

// Reject empty / loopback targets for network tools. Strips scheme, path and
// port so `http://localhost:8080/x` is caught too.
function hostIsBlocked(value: string): boolean {
  const v = (value || '').trim();
  if (!v) return true;
  const host = v
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tool: string } },
) {
  const encoder = new TextEncoder();
  const message = (msg: string) =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(msg));
          controller.close();
        },
      }),
      { headers: streamHeaders() },
    );

  const tool = getTool(params.tool);
  if (!tool) return message(`✗ Unknown tool "${params.tool}".`);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  // Apply defaults, keep only known fields, coerce to string.
  const p: Record<string, string> = {};
  for (const f of tool.fields) {
    const raw = body[f.name];
    p[f.name] =
      raw === undefined || raw === null || String(raw) === ''
        ? f.default ?? ''
        : String(raw);
  }

  for (const f of tool.fields) {
    if (f.required && !p[f.name]) return message(`✗ "${f.label}" is required.`);
  }

  if (tool.blocksLocalhost && 'target' in p && hostIsBlocked(p.target)) {
    return message(
      '✗ Empty target, localhost and 127.0.0.1 are not allowed for this tool.',
    );
  }

  const bin = resolveBin(tool.bins);
  if (!bin) {
    const hint = tool.installHint ? `\nInstall: ${tool.installHint}` : '';
    return message(
      `⚠ ${tool.name} is not installed on this host (looked for: ${tool.bins.join(', ')}).${hint}`,
    );
  }

  // Write any asFile fields (e.g. pasted hashes) to temp files.
  const tempFiles: string[] = [];
  try {
    for (const f of tool.fields) {
      if (f.asFile) {
        const path = join(tmpdir(), `spectre-${tool.id}-${randomUUID()}`);
        await writeFile(path, p[f.name] ?? '', 'utf8');
        tempFiles.push(path);
        p[f.name] = path;
      }
    }
  } catch (err) {
    await cleanup(tempFiles);
    return message(`✗ Failed to prepare input: ${(err as Error).message}`);
  }

  const args = tool.buildArgs(p);
  const followArgs = tool.follow ? tool.follow(p) : null;
  const timeoutMs = tool.timeoutMs ?? DEFAULT_TIMEOUT;

  // Mask secret values (passwords, tokens) in the echoed command line.
  const secrets = tool.fields
    .filter((f) => f.type === 'password')
    .map((f) => p[f.name])
    .filter(Boolean);
  const label = bin.split('/').pop() || bin;
  const redact = (a: string) => (secrets.includes(a) ? '****' : a);

  const state: { child: ChildProcess | null; timedOut: boolean } = {
    child: null,
    timedOut: false,
  };

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const emit = (s: string) => {
        if (!closed) controller.enqueue(encoder.encode(s));
      };
      const finish = async () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        await cleanup(tempFiles);
        controller.close();
      };

      const timer = setTimeout(() => {
        state.timedOut = true;
        emit(`\n\n⏱ Timed out after ${Math.round(timeoutMs / 1000)}s — terminating.\n`);
        state.child?.kill('SIGTERM');
      }, timeoutMs);

      const run = (runArgs: string[], onClose: () => void) => {
        emit(`$ ${label} ${runArgs.map(redact).join(' ')}\n\n`);
        let child: ChildProcess;
        try {
          child = spawn(bin, runArgs);
        } catch (err) {
          emit(`Error: ${(err as Error).message}\n`);
          onClose();
          return;
        }
        state.child = child;
        child.stdout?.on('data', (d) => emit(d.toString()));
        child.stderr?.on('data', (d) => emit(d.toString()));
        child.on('error', (err) => {
          emit(`Error: ${err.message}\n`);
          onClose();
        });
        child.on('close', (code) => {
          if (code !== 0 && !state.timedOut) {
            emit(`\n[${tool.name} exited with code ${code}]\n`);
          }
          onClose();
        });
      };

      run(args, () => {
        if (!state.timedOut && followArgs && followArgs.length) {
          emit('\n');
          run(followArgs, () => {
            void finish();
          });
        } else {
          void finish();
        }
      });
    },
    cancel() {
      state.child?.kill('SIGTERM');
      void cleanup(tempFiles);
    },
  });

  return new Response(stream, { headers: streamHeaders() });
}
