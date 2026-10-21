// Run after npm run build. With --offline, run inside a loopback-only network namespace.
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const offline = process.argv.includes('--offline');
const base = 'http://127.0.0.1:3101';
const target = process.env.SPECTREE_TEST_TARGET || '127.0.0.1';
let server;
const fixture = http.createServer((_, response) => response.end('Spectree local scan fixture'));

async function main() {
  if (offline) {
    assert.equal(execFileSync('ip', ['route'], { encoding: 'utf8' }).trim(), '', 'Offline namespace must have no routes');
    await assert.rejects(fetch('https://api.groq.com/openai/v1/models', { signal: AbortSignal.timeout(2000) }));
    console.log('PASS: no network route; cloud endpoint unreachable');
  }
  fixture.listen(18080, target);
  await once(fixture, 'listening');
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout.on('data', (d) => { logs += d; });
  server.stderr.on('data', (d) => { logs += d; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/tools`)).ok) { ready = true; break; } } catch {}
    await delay(200);
  }
  assert.ok(ready, `Server failed to start: ${logs}`);
  for (const host of new Set([target, 'localhost', '::1'])) {
    const response = await fetch(`${base}/api/tools/nmap`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ target: host, profile: 'Quick', ports: '18080' }), signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200);
    const events = (await response.text()).trim().split('\n').map(JSON.parse);
    const output = events.filter((e) => e.type === 'output').map((e) => e.text).join('');
    assert.equal(events.at(-1).ok, true, output);
    assert.match(output, /Nmap done: 1 IP address \(1 host up\)/);
    if (host === target) assert.match(output, /18080\/tcp open/);
    console.log(`PASS: real nmap scan of ${host}; ${host === target ? 'fixture port 18080 open' : 'host up'}`);
  }
  const invalid = await fetch(`${base}/api/tools/nmap`, { method: 'POST', body: '{"target":"--iflist"}' });
  assert.equal(invalid.status, 400);
  if (offline) {
    const providers = await (await fetch(`${base}/api/providers`)).json();
    assert.ok(providers.providers.every((p) => !p.available));
    const chat = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', messages: [{ role: 'user', content: 'OK' }] }) });
    assert.equal(chat.status, 503);
    console.log('PASS: scans succeeded with both cloud and local LLM unavailable');
  }
  for (const path of ['/', '/tools', '/chat', '/reports']) assert.equal((await fetch(base + path)).status, 200);
  console.log('PASS: all pages and validation endpoint');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fixture.close();
  if (server) { const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited; }
});
