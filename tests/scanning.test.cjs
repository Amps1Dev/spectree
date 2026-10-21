require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executeTool } = require('../lib/tool-execution.ts');
const { readScanStream } = require('../lib/scan-stream.ts');
const { validateTarget, getTool } = require('../lib/tools.ts');
const { POST } = require('../app/api/tools/[tool]/route.ts');
const { NextRequest } = require('next/server');

const opts = (code, extras = {}) => ({
  bin: process.execPath, args: ['-e', code], name: 'Fixture', secrets: [],
  timeoutMs: 5000, structured: true, signal: new AbortController().signal,
  cleanup: async () => {}, ...extras,
});

test('local and LAN targets are valid; malformed addresses and flag targets are rejected', () => {
  for (const host of ['127.0.0.1', 'localhost', '10.59.9.27', '::1', '::ffff:127.0.0.1']) assert.equal(validateTarget('host', host), null, host);
  for (const host of ['--iflist', '127.0.0.1 --script x', '999.2.3.4', '::::', 'localhost:99999', 'host-', 'a;id']) assert.ok(validateTarget('host', host), host);
  for (const net of ['192.168.1.0/24', '::1/128']) assert.equal(validateTarget('network', net), null);
  for (const net of ['127.0.0.1/33', '::1/129', 'localhost/24']) assert.ok(validateTarget('network', net));
  assert.equal(validateTarget('url', 'http://[::1]:8080/path?a=1&b=2'), null);
  assert.ok(validateTarget('url', 'file://localhost/etc/passwd'));
  assert.ok(validateTarget('url', 'http://localhost:99999'));
  assert.ok(validateTarget('domain', '::1'));
});

test('nmap skips reverse DNS and supports IPv6 and selected ports', () => {
  const args = getTool('nmap').buildArgs({ target: '::1', profile: 'Quick', ports: '8080' });
  assert.ok(args.includes('-n')); assert.ok(args.includes('-6')); assert.ok(args.includes('-sT'));
  assert.ok(!args.includes('-F')); assert.equal(args[args.indexOf('-p') + 1], '8080');
});

test('API reports invalid inputs with HTTP errors before executing a tool', async () => {
  for (const [tool, body, status] of [
    ['missing', '{}', 404], ['nmap', '{', 400], ['nmap', '[]', 400], ['nmap', 'null', 400],
    ['nmap', '{"target":"   "}', 400], ['nmap', '{"target":"--iflist"}', 400],
    ['nmap', '{"target":"127.0.0.1","profile":"bogus"}', 400],
    ['nmap', '{"target":"127.0.0.1","ports":"65536"}', 400],
    ['nmap', '{"target":"127.0.0.1","ports":"80-1"}', 400],
    ['sslscan', '{"target":"127.0.0.1","port":0}', 400],
  ]) {
    const response = await POST(new NextRequest('http://localhost/api/tools/' + tool, { method: 'POST', body }), { params: { tool } });
    assert.equal(response.status, status, body);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('successful output survives byte boundaries and cleanup runs once', async () => {
  let cleaned = 0; let text = '';
  const stream = executeTool(opts("process.stdout.write('Local ✓')", { cleanup: async () => { cleaned++; } }));
  await readScanStream(new Response(stream), (chunk) => { text += chunk; });
  assert.ok(text.endsWith('Local ✓'));  assert.equal(cleaned, 1);
});

test('nonzero exits surface as failures and never run follow-up commands', async () => {
  let output = '';
  await assert.rejects(readScanStream(new Response(executeTool(opts('process.exit(7)', { followArgs: ['-e', "console.log('SHOULD_NOT_RUN')"] }))), (chunk) => { output += chunk; }), /code 7/);
  assert.ok(!output.includes('SHOULD_NOT_RUN'));
});

test('spawn errors finish and clean up exactly once', async () => {
  let cleaned = 0;
  await assert.rejects(readScanStream(new Response(executeTool(opts('', { bin: '/does-not-exist/spectree', cleanup: async () => { cleaned++; } }))), () => {}), /exited/);
  assert.equal(cleaned, 1);
});

test('timeout terminates a process that ignores SIGTERM', async () => {
  const start = Date.now();
  await assert.rejects(readScanStream(new Response(executeTool(opts("process.on('SIGTERM', () => {}); setInterval(() => {}, 100)", { timeoutMs: 300 }))), () => {}), /Timed out/);
  assert.ok(Date.now() - start < 4000);
});

test('reader cancellation kills the child and skips follow-up execution', async () => {
  let finished;
  const cleaned = new Promise((resolve) => { finished = resolve; });
  const stream = executeTool(opts('process.stdout.write(String(process.pid)); setInterval(() => {}, 100)', { cleanup: async () => finished(), followArgs: ['-e', "throw Error('unexpected follow-up')"] }));
  const reader = stream.getReader();
  await reader.read(); // command echo
  const { value } = await reader.read();
  const pid = Number(JSON.parse(new TextDecoder().decode(value)).text.trim());
  assert.ok(pid > 0);
  await reader.cancel();
  await Promise.race([cleaned, new Promise((_, reject) => setTimeout(() => reject(Error('cleanup timed out')), 3000).unref())]);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('a truncated scan stream is an error, not a completed scan', async () => {
  await assert.rejects(readScanStream(new Response('{"type":"output","text":"partial"}\n'), () => {}), /before a result/);
});
