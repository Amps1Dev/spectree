require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chatTextStream } = require('../lib/chat-stream.ts');
const { POST: chat } = require('../app/api/chat/route.ts');
const { POST: report } = require('../app/api/report/route.ts');
const { NextRequest } = require('next/server');
const { requestCompletion } = require('../lib/llm.ts');

const request = (body) => new NextRequest('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });

test('provider SSE preserves fragmented JSON, CRLF, and multibyte tokens', async () => {
  const sse = ': heartbeat\r\n\r\ndata: {"choices":[{"delta":{"content":"Local ✓"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" ready"}}]}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(sse);
  const source = new ReadableStream({ start(c) { for (const b of bytes) c.enqueue(Uint8Array.of(b)); c.close(); } });
  assert.equal(await new Response(source.pipeThrough(chatTextStream())).text(), 'Local ✓ ready');
});

test('truncated provider streams are errors', async () => {
  await assert.rejects(new Response(new Response('data: {"choices":[]}\n\n').body.pipeThrough(chatTextStream())).text(), /before completion/);
});

test('chat and report reject malformed request shapes', async () => {
  for (const handler of [chat, report]) {
    for (const body of [null, [], {}, { provider: 'invalid' }]) assert.equal((await handler(request(body))).status, 400);
  }
});

test('provider errors are actionable and successful chat uses a plain-text response', async (t) => {
  t.mock.method(global, 'fetch', async () => Response.json({ error: { message: 'Model unavailable' } }, { status: 404 }));
  const response = await chat(request({ provider: 'ollama', messages: [{ role: 'user', content: 'Hello' }] }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Model unavailable/);
  global.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n');
  const ok = await chat(request({ messages: [{ role: 'user', content: 'Hello' }] }));
  assert.match(ok.headers.get('content-type'), /text\/plain/);
  assert.equal(await ok.text(), 'OK');
});

test('network failure explains how to restore local AI without blocking scans', async (t) => {
  t.mock.method(global, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(requestCompletion('ollama', {}, new AbortController().signal), (error) => error.status === 503 && /Start Ollama/.test(error.message));
});

test('report API normalizes fenced JSON and severity', async (t) => {
  t.mock.method(global, 'fetch', async () => Response.json({ choices: [{ message: { content: '```json\n{"summary":"Local report","findings":[{"name":"Open service","risk":"critical"}]}\n```' } }] }));
  const response = await report(request({ engagementName: 'Local', targetIp: '127.0.0.1', findings: 'Open test port' }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.executiveSummary, 'Local report'); assert.equal(data.findings[0].severity, 'HIGH');
});
