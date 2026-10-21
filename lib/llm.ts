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
    const cfg = resolveProvider(id);
    if (!cfg.apiKey || /your[-_]|placeholder/i.test(cfg.apiKey)) return false;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(5000), cache: 'no-store',
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.data?.some((model: { id: string }) => model.id === cfg.model) ?? false;
    } catch { return false; }
  }

  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
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

export class ProviderError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Shared provider errors and bounded requests for both chat and reports. */
export async function requestCompletion(provider: string | undefined, body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const cfg = resolveProvider(provider);
  if (cfg.id === 'groq' && (!cfg.apiKey || /your[-_]|placeholder/i.test(cfg.apiKey))) {
    throw new ProviderError('Set GROQ_API_KEY or select Local (Ollama). Local scans do not require a model provider.', 503);
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error('Provider timeout')), 120_000);
  const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
  try {
    const response = await fetch(cfg.chatUrl, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ ...body, model: cfg.model }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const raw = typeof data?.error?.message === 'string' ? data.error.message : typeof data?.error === 'string' ? data.error : '';
      const detail = (cfg.apiKey ? raw.split(cfg.apiKey).join('[redacted]') : raw).slice(0, 400);
      const hint = cfg.id === 'ollama' ? ` Check Ollama and the installed model (${cfg.model}).` : ' Check the API key, model access, and quota.';
      throw new ProviderError(`${cfg.label} request failed (${response.status}).${hint}${detail ? ` ${detail}` : ''}`, response.status === 429 ? 429 : 502);
    }
    if (!response.body) { cleanup(); return response; }
    const reader = response.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const { done, value } = await reader.read();
          if (done) { cleanup(); output.close(); }
          else output.enqueue(value);
        } catch (error) { cleanup(); output.error(error); }
      },
      async cancel() { controller.abort(); cleanup(); await reader.cancel().catch(() => {}); },
    });
    return new Response(stream, { status: response.status, headers: response.headers });
  } catch (error) {
    cleanup();
    if (error instanceof ProviderError) throw error;
    if (signal.aborted) throw new ProviderError('Request cancelled.', 499);
    if (controller.signal.aborted) throw new ProviderError(`${cfg.label} timed out after 120 seconds.`, 504);
    const hint = cfg.id === 'ollama' ? 'Start Ollama and check OLLAMA_BASE_URL.' : 'Check internet access or select Local (Ollama).';
    throw new ProviderError(`Cannot reach ${cfg.label}. ${hint} Local scanning is still available.`, 503);
  }
}
