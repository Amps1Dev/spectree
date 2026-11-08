import { NextRequest } from 'next/server';
import { executeCredentialAudit } from '@/lib/tools';
import { streamTool, textParam } from '@/lib/tool-route';
import { enumValue } from '@/lib/tool-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest) {
  // The shared executor validates scope/blocklists before spawning.
  return streamTool(request, (input, options) =>
    executeCredentialAudit(textParam(input, 'target'), enumValue(input.service, ['ssh', 'ftp', 'smb', 'rdp', 'http-get', 'https-get', 'mysql', 'postgres'], 'service'), textParam(input, 'wordlist'), options),
  );
}
