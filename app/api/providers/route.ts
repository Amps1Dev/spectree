import { NextResponse } from 'next/server';
import {
  DEFAULT_PROVIDER,
  ProviderId,
  checkAvailability,
  resolveProvider,
} from '@/lib/llm';

// Availability is probed live (is Ollama up? is a Groq key set?), so never
// cache this route.
export const dynamic = 'force-dynamic';

const IDS: ProviderId[] = ['ollama', 'groq'];

export async function GET() {
  const providers = await Promise.all(
    IDS.map(async (id) => {
      const cfg = resolveProvider(id);
      return {
        id: cfg.id,
        label: cfg.label,
        model: cfg.model,
        available: await checkAvailability(id),
      };
    }),
  );

  return NextResponse.json({ default: DEFAULT_PROVIDER, providers });
}
