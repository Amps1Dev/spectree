import { NextRequest } from 'next/server';
import { executeMobSF } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';
import { enumValue } from '@/lib/tool-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeMobSF(textParam(input, 'filePath'), enumValue(input.mode ?? 'static', ['static', 'dynamic'], 'mode'), options),
  );
}
