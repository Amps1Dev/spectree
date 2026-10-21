import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { getTool, resolveBin, validateTarget } from '@/lib/tools';
import { executeTool } from '@/lib/tool-execution';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: { tool: string } }) {
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const tool = getTool(params.tool);
  if (!tool) return fail(`Unknown tool "${params.tool}".`, 404);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Expected a JSON object.');
  } catch { return fail('Invalid JSON request body.'); }

  const p: Record<string, string> = {};
  for (const f of tool.fields) {
    const raw = body[f.name];
    if (raw != null && typeof raw !== 'string' && typeof raw !== 'number') return fail(`"${f.label}" must be text or a number.`);
    const value = raw == null || raw === '' ? f.default ?? '' : String(raw);
    p[f.name] = f.type === 'password' || f.asFile ? value : value.trim();
    if (f.required && !p[f.name].trim()) return fail(`"${f.label}" is required.`);
    if (p[f.name].includes('\0')) return fail(`"${f.label}" contains a null character.`);
    if (!p[f.name]) continue;
    if (f.type === 'select' && !f.options?.some((o) => o.value === p[f.name])) return fail(`Invalid "${f.label}" option.`);
    if (f.type === 'number' && (!/^\d+$/.test(p[f.name]) || !Number.isSafeInteger(Number(p[f.name])) || Number(p[f.name]) < (f.min ?? 1) || Number(p[f.name]) > (f.max ?? Number.MAX_SAFE_INTEGER))) return fail(`"${f.label}" must be a whole number between ${f.min ?? 1} and ${f.max ?? Number.MAX_SAFE_INTEGER}.`);
    if (f.pattern && !new RegExp(f.pattern).test(p[f.name])) return fail(`Invalid "${f.label}" format.`);
    if (f.name === 'ports' && !p[f.name].split(',').every((range) => {
      const bounds = range.split('-').map(Number);
      const first = bounds[0];
      const last = bounds[1] ?? first;
      return first >= 1 && last <= 65535 && first <= last;
    })) return fail('Ports must be between 1 and 65535, with ascending ranges.');
    if (f.validate) {
      const reason = validateTarget(f.validate, p[f.name]);
      if (reason) return fail(`"${f.label}" ${reason}.`);
    }
  }

  const bin = resolveBin(tool.bins);
  if (!bin) return fail(`${tool.name} is not installed on this host.${tool.installHint ? ` Install: ${tool.installHint}` : ''}`, 503);
  const tempFiles: string[] = [];
  const cleanup = async () => { await Promise.all(tempFiles.map((path) => unlink(path).catch(() => {}))); };
  try {
    for (const f of tool.fields) {
      if (!f.asFile) continue;
      const path = join(tmpdir(), `spectre-${tool.id}-${randomUUID()}`);
      tempFiles.push(path);
      await writeFile(path, p[f.name], { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      p[f.name] = path;
    }
    const structured = request.headers.get('accept')?.includes('application/x-ndjson') ?? false;
    const stream = executeTool({
      bin, args: tool.buildArgs(p), followArgs: tool.follow?.(p), name: tool.name,
      secrets: tool.fields.filter((f) => f.type === 'password').map((f) => p[f.name]).filter(Boolean),
      timeoutMs: tool.timeoutMs ?? 180_000, signal: request.signal, structured, cleanup,
    });
    return new Response(stream, { headers: {
      'Content-Type': structured ? 'application/x-ndjson; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no',
    } });
  } catch {
    await cleanup();
    return fail('Failed to prepare the tool input.', 500);
  }
}
