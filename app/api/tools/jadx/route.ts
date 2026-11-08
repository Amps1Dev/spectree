import { NextRequest } from 'next/server';
import { executeJadx } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeJadx(textParam(input, 'apkPath'), textParam(input, 'outputDir'), options),
  );
}
