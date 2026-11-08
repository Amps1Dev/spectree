import { NextRequest } from 'next/server';
import { executeNuclei } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeNuclei(textParam(input, 'target'), textParam(input, 'templates', ''), options),
  );
}
