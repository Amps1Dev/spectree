import { NextRequest } from 'next/server';
import { executeApktool } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';
import { enumValue } from '@/lib/tool-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeApktool(textParam(input, 'apkPath'), enumValue(input.mode ?? 'decode', ['decode', 'build'], 'mode'), options),
  );
}
