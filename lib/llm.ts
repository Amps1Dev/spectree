// Central LLM provider resolution shared by the API routes.
//
// Groq and Ollama both expose an OpenAI-compatible POST /v1/chat/completions
// endpoint with identical SSE streaming, so the routes speak one request shape
// and this module is the only place that knows how the providers differ:
// base URL, model name, and whether an API key is required. Ollama is the
// local option (the same qwen2.5:1.5b the cdeception project runs); Groq is the
// cloud option.

export type ProviderId = 'ollama' | 'groq';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  model: string;
  /** Full URL of the OpenAI-compatible chat completions endpoint. */
  chatUrl: string;
  /** Omitted for local Ollama, which needs no auth. */
  apiKey?: string;
}

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
).replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

// Local-first by default so the app runs offline out of the box.
export const DEFAULT_PROVIDER: ProviderId =
  process.env.DEFAULT_LLM_PROVIDER === 'groq' ? 'groq' : 'ollama';

export function resolveProvider(requested?: string): ProviderConfig {
  const id: ProviderId =
    requested === 'groq' || requested === 'ollama' ? requested : DEFAULT_PROVIDER;

  if (id === 'groq') {
    return {
      id: 'groq',
      label: 'Groq (cloud)',
      model: GROQ_MODEL,
      chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
    };
  }

  return {
    id: 'ollama',
    label: 'Local (Ollama)',
    model: OLLAMA_MODEL,
    chatUrl: `${OLLAMA_BASE_URL}/v1/chat/completions`,
  };
}

// Availability probe for the UI. Groq needs a key; Ollama needs to be reachable
// with the configured model pulled. Never throws — returns false on any failure.
export async function checkAvailability(id: ProviderId): Promise<boolean> {
  if (id === 'groq') {
    return Boolean(process.env.GROQ_API_KEY);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!resp.ok) return false;

    const data = await resp.json();
    const models: string[] = (data?.models ?? [])
      .map((m: any) => m?.model || m?.name)
      .filter(Boolean);
    return models.includes(OLLAMA_MODEL);
  } catch {
    return false;
  }
}
