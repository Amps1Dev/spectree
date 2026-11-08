import { NextRequest } from 'next/server';
import { executeObjection } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeObjection(textParam(input, 'target'), textParam(input, 'command'), options),
  );
}
