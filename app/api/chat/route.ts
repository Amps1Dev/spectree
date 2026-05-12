import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// Force Node.js runtime — needed for child_process
export const runtime = 'nodejs';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are SPECTRE, an expert penetration testing assistant embedded in a security dashboard running on Kali Linux.

You have access to TWO real tools that execute directly on this machine:
- run_nmap: runs a real nmap port/service scan against a target IP
- run_nikto: runs a real nikto web vulnerability scan against a target IP

CRITICAL RULES:
- When a user asks you to scan, test, enumerate, or probe a target → USE THE TOOLS. Never simulate or make up output.
- After receiving real tool output → analyze it thoroughly: list open ports, services, versions, CVEs, attack surface.
- Only assist with authorized targets in lab environments.
- Be concise and technical in your analysis.`;

// Tool definitions sent to Groq — it decides when to call these
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_nmap',
      description:
        'Run a real nmap scan against a target IP or hostname. Use when the user asks to scan ports, enumerate services, or discover what is running on a host.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'The IP address or hostname to scan (e.g. 192.168.1.10)',
          },
          profile: {
            type: 'string',
            enum: ['quick', 'service', 'full'],
            description:
              'Scan profile: quick (-T4 -F open ports only), service (-sV -T4 detect versions), full (-sV -A -T4 aggressive). Default: service',
          },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_nikto',
      description:
        'Run a real Nikto web vulnerability scan against a target. Use when the user asks to scan a web server, check HTTP headers, find web vulnerabilities, or audit port 80/443.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'The IP address or hostname of the web server',
          },
        },
        required: ['target'],
      },
    },
  },
];

// ── Tool execution functions ──────────────────────────────────────────────────

function executeNmap(target: string, profile: string = 'service'): Promise<string> {
  const profiles: Record<string, string[]> = {
    quick:   ['-T4', '-F', '--open'],
    service: ['-sV', '-T4', '--open'],
    full:    ['-sV', '-A', '-T4', '--open'],
  };
  const args = [...(profiles[profile] ?? profiles.service), target.trim()];

  return new Promise((resolve) => {
    let output = '';
    let stderr = '';

    const proc = spawn('nmap', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (!output.trim() && code !== 0) {
        resolve(
          `[ERROR] nmap exited with code ${code}.\n${stderr}\n` +
          `Tip: run this to fix permissions:\n  sudo setcap cap_net_raw,cap_net_admin+eip $(which nmap)`
        );
      } else {
        resolve(output || stderr || '[No output from nmap]');
      }
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        resolve('[ERROR] nmap not found. Install with: sudo apt install nmap');
      } else {
        resolve(`[ERROR] ${err.message}`);
      }
    });

    // 3 minute hard timeout
    setTimeout(() => { proc.kill(); resolve('[TIMEOUT] nmap took too long — killed after 3 min.'); }, 180_000);
  });
}

function executeNikto(target: string): Promise<string> {
  return new Promise((resolve) => {
    let output = '';

    const proc = spawn('nikto', ['-h', target.trim(), '-Format', 'txt'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { output += d.toString(); });

    proc.on('close', () => resolve(output || '[No output from nikto]'));

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        resolve('[ERROR] nikto not found. Install with: sudo apt install nikto');
      } else {
        resolve(`[ERROR] ${err.message}`);
      }
    });

    // 5 minute hard timeout
    setTimeout(() => { proc.kill(); resolve('[TIMEOUT] nikto took too long — killed after 5 min.'); }, 300_000);
  });
}

async function dispatchTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === 'run_nmap')  return executeNmap(args.target, args.profile ?? 'service');
  if (name === 'run_nikto') return executeNikto(args.target);
  return `[ERROR] Unknown tool: ${name}`;
}

// ── Groq helpers ─────────────────────────────────────────────────────────────

async function callGroq(messages: object[], stream: boolean, withTools: boolean) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      ...(withTools && { tools: TOOLS, tool_choice: 'auto' }),
      stream,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
}

function streamTokens(body: ReadableStream, encoder: TextEncoder): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const token = JSON.parse(data).choices?.[0]?.delta?.content;
              if (token) controller.enqueue(encoder.encode(token));
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ── Main route handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { messages } = await request.json();
    const encoder = new TextEncoder();

    const conversationMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // ── Step 1: Send to Groq with tools, non-streaming to check for tool calls ──
    const probeRes = await callGroq(conversationMessages, false, true);

    if (!probeRes.ok) {
      const err = await probeRes.text();
      console.error('Groq probe error:', err);
      return NextResponse.json({ error: `Groq error: ${probeRes.status}` }, { status: 500 });
    }

    const probeData = await probeRes.json();
    const choice = probeData.choices?.[0];
    const assistantMsg = choice?.message;

    // ── Step 2: Tool call detected ────────────────────────────────────────────
    if (choice?.finish_reason === 'tool_calls' && assistantMsg?.tool_calls?.length > 0) {
      const toolCall = assistantMsg.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments ?? '{}');
      const toolLabel = toolName === 'run_nmap' ? 'nmap' : 'nikto';

      const stream = new ReadableStream({
        async start(controller) {
          // Tell the user we're actually running the tool
          controller.enqueue(
            encoder.encode(`**Running ${toolLabel} against \`${toolArgs.target}\`...**\n\n`)
          );

          // Execute the real tool on this machine
          const toolResult = await dispatchTool(toolName, toolArgs);

          // Send result back to Groq for analysis, stream the analysis
          const analysisMessages = [
            ...conversationMessages,
            assistantMsg,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult,
            },
          ];

          const analysisRes = await callGroq(analysisMessages, true, false);

          if (!analysisRes.ok || !analysisRes.body) {
            // Fallback: show raw output if analysis fails
            controller.enqueue(encoder.encode('```\n' + toolResult + '\n```'));
            controller.close();
            return;
          }

          // Stream the LLM analysis back to the browser
          const reader = analysisRes.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              for (const line of text.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const token = JSON.parse(data).choices?.[0]?.delta?.content;
                  if (token) controller.enqueue(encoder.encode(token));
                } catch { /* skip */ }
              }
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── Step 3: No tool call — plain streaming response ───────────────────────
    const streamRes = await callGroq(conversationMessages, true, false);

    if (!streamRes.ok || !streamRes.body) {
      return NextResponse.json({ error: 'Groq stream failed' }, { status: 500 });
    }

    return new Response(streamTokens(streamRes.body, encoder), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message ?? 'Unknown error' }, { status: 500 });
  }
}