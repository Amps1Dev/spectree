import { NextResponse } from 'next/server';
import { TOOLS, resolveBin } from '@/lib/tools';

// Availability depends on which binaries are installed on the host right now,
// so this must never be cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Serializable projection of the registry for the UI. buildArgs/follow are
// intentionally omitted — they stay server-side.
export async function GET() {
  const tools = TOOLS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    commandHint: t.commandHint,
    installHint: t.installHint ?? null,
    fields: t.fields,
    available: resolveBin(t.bins) !== null,
  }));

  return NextResponse.json(tools);
}
