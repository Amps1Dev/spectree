import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';

const RESPONSE_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_nmap',
      description:
        'Run a real Nmap scan against an authorized target and return the command output.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Authorized hostname or IP address to scan.',
          },
          profile: {
            type: 'string',
            enum: ['Quick', 'Service', 'Full'],
            description: 'Scan profile. Use Quick unless the user asks for deeper detection.',
          },
        },
        required: ['target'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_nikto',
      description:
        'Run a real Nikto web-server vulnerability scan against an authorized target and return the command output.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Authorized URL, hostname, or IP address to scan.',
          },
        },
        required: ['target'],
        additionalProperties: false,
      },
    },
  },
] as const;

type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

function textResponse(content: string, status = 200) {
  return new Response(content, { status, headers: RESPONSE_HEADERS });
}

async function groqCompletion(
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, ...body }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Groq error:', detail);
    throw new Error(`Groq API error: ${response.status}`);
  }

  return response;
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function executeToolCall(call: ToolCall, request: NextRequest) {
  const routeByName: Record<string, string> = {
    run_nmap: '/api/tools/nmap',
    run_nikto: '/api/tools/nikto',
  };
  const route = routeByName[call.function.name];

  if (!route) return `Unknown tool: ${call.function.name}`;

  const toolResponse = await fetch(new URL(route, request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parseToolArguments(call.function.arguments)),
    cache: 'no-store',
    signal: request.signal,
  });
  const output = await toolResponse.text();

  if (!toolResponse.ok) {
    return `Tool request failed (${toolResponse.status}): ${output}`;
  }

  const maxToolOutput = 60_000;
  return output.length > maxToolOutput
    ? `${output.slice(0, maxToolOutput)}\n\n[Tool output truncated]`
    : output;
}

function groqTextStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';

  const emitLine = (
    line: string,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) => {
    if (!line.startsWith('data: ')) return;
    const data = line.slice(6).trim();
    if (!data || data === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);
      const token = parsed.choices?.[0]?.delta?.content;
      if (token) controller.enqueue(encoder.encode(token));
    } catch {
      // Ignore a complete malformed provider event without breaking the stream.
    }
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) emitLine(line.trimEnd(), controller);
    },
    flush(controller) {
      buffered += decoder.decode();
      if (buffered) emitLine(buffered.trimEnd(), controller);
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.offline === true) {
      return textResponse(
        'Offline mode is active. This message was not sent to Groq, and no scan tools were invoked. Switch to ONLINE mode to use the assistant.',
      );
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 },
      );
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const formattedMessages: ChatMessage[] = messages
      .filter(
        (message: unknown) =>
          Boolean(message) &&
          typeof message === 'object' &&
          ['user', 'assistant'].includes(
            String((message as { role?: unknown }).role),
          ) &&
          typeof (message as { content?: unknown }).content === 'string',
      )
      .map((message: { role: 'user' | 'assistant'; content: string }) => ({
        role: message.role,
        content: message.content,
      }));

    if (formattedMessages.length === 0) {
      return NextResponse.json(
        { error: 'A non-empty messages array is required' },
        { status: 400 },
      );
    }

    const conversation: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are SPECTRE, an expert penetration testing assistant. Help the user enumerate authorized targets, interpret real scan results, identify vulnerabilities, and plan remediation. When the user explicitly asks to scan a target, call run_nmap or run_nikto instead of inventing scan output. Never claim a tool ran unless a tool result is present. Be concise and technical.',
      },
      ...formattedMessages,
    ];

    const planningResponse = await groqCompletion(
      {
        messages: conversation,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: false,
        temperature: 0.2,
        max_tokens: 2048,
      },
      request.signal,
    );
    const planningPayload = await planningResponse.json();
    const assistantMessage = planningPayload.choices?.[0]?.message;
    const toolCalls: ToolCall[] = Array.isArray(assistantMessage?.tool_calls)
      ? assistantMessage.tool_calls
      : [];

    if (toolCalls.length === 0) {
      return textResponse(
        assistantMessage?.content || 'The model returned an empty response.',
      );
    }

    const toolResults = await Promise.all(
      toolCalls.map(async (call) => ({
        role: 'tool' as const,
        tool_call_id: call.id,
        content: await executeToolCall(call, request),
      })),
    );

    const finalResponse = await groqCompletion(
      {
        messages: [
          ...conversation,
          {
            role: 'assistant',
            content: assistantMessage?.content ?? null,
            tool_calls: toolCalls,
          },
          ...toolResults,
        ],
        stream: true,
        temperature: 0.4,
        max_tokens: 2048,
      },
      request.signal,
    );

    if (!finalResponse.body) {
      return NextResponse.json({ error: 'No response body' }, { status: 502 });
    }

    return new Response(finalResponse.body.pipeThrough(groqTextStream()), {
      headers: RESPONSE_HEADERS,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process chat request',
      },
      { status: 502 },
    );
  }
}
