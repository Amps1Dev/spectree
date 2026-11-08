const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { test, before, after } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  return originalRequire.call(this, id.startsWith('@/') ? path.join(root, id.slice(2)) : id);
};
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const tools = require('../lib/tools.ts');
const scope = require('../lib/tool-scope.ts');
const { NextRequest } = require('next/server');
let fixture;
let server;
const savedEnv = new Map();
const remoteRequests = [];
let burpPolls = 0;
let nessusPolls = 0;
let burpWaits = false;
let reportPolls = 0;

function env(key, value) {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function postRoute(slug, body, signal) {
  return require(`../app/api/tools/${slug}/route.ts`).POST(new NextRequest(`http://spectre.test/api/tools/${slug}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  }));
}

function status(expected) {
  return (error) => error instanceof tools.ToolExecutionError && error.status === expected;
}

before(async () => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'spectre-tools-test-'));
  for (const file of ['app.apk', 'app.ipa', 'inspect with spaces.js', 'native.so', 'Export.java', 'passwords.txt', 'template.yaml']) {
    fs.writeFileSync(path.join(fixture, file), 'fixture, not a real application or credential\n');
  }
  fs.mkdirSync(path.join(fixture, 'decoded'));
  fs.writeFileSync(path.join(fixture, 'decoded', 'apktool.yml'), 'version: 2.9\n');
  const binary = path.join(fixture, 'mock-tool.cjs');
  fs.writeFileSync(binary, `#!/usr/bin/env node
const args = process.argv.slice(2);
console.log(JSON.stringify({ argv: args, pid: process.pid, cwd: process.cwd() }));
if (process.env.SPECTRE_MOCK_MODE === 'fail') {
  process.stderr.write('fixture failure\\n'); process.exitCode = 2;
} else if (process.env.SPECTRE_MOCK_MODE === 'hang') {
  process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);
} else if (process.env.SPECTRE_MOCK_MODE === 'wait') {
  setInterval(() => {}, 1000);
} else {
  setTimeout(() => console.log(JSON.stringify({ finding: 'fixture', severity: 'info' })), 35);
}
`);
  fs.chmodSync(binary, 0o755);
  for (const name of ['NMAP', 'NIKTO', 'DROZER', 'FRIDA', 'OBJECTION', 'JADX', 'APKTOOL', 'GHIDRA', 'NUCLEI', 'HYDRA', 'ENUM4LINUX_NG']) {
    env(`SPECTRE_${name}_BIN`, binary);
  }
  env('SPECTRE_TOOL_ROOTS', fixture);
  env('SPECTRE_TOOL_OUTPUT_DIR', path.join(fixture, 'output'));
  env('SPECTRE_TARGET_SCOPE', '192.0.2.0/24,*.example.test');
  env('SPECTRE_TARGET_BLOCKLIST', '');
  env('SPECTRE_TOOL_PATH_BLOCKLIST', '');
  env('SPECTRE_APP_SCOPE', 'com.example.app,1234');
  env('SPECTRE_APP_BLOCKLIST', '');
  env('SPECTRE_MOCK_MODE', 'ok');
  env('SPECTRE_API_POLL_MS', '100');
  env('SPECTRE_MOBSF_DYNAMIC_SECONDS', '1');
  env('SPECTRE_MOBSF_IOS_DEVICE_ID', 'fixture-ios-device');
  env('SPECTRE_MOBSF_API_KEY', 'mobsf-test-key');
  env('SPECTRE_BURP_API_KEY', 'burp-test-key');
  env('SPECTRE_NESSUS_ACCESS_KEY', 'nessus-access-test');
  env('SPECTRE_NESSUS_SECRET_KEY', 'nessus-secret-test');
  env('SPECTRE_NESSUS_TEMPLATE_UUID', undefined);

  server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const contentType = request.headers['content-type'] || '';
    const body = contentType.includes('application/json') ? JSON.parse(raw || '{}')
      : contentType.includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : raw;
    remoteRequests.push({ url: request.url, method: request.method, headers: request.headers, body });
    const send = (data, code = 200, headers = {}) => {
      response.writeHead(code, { 'Content-Type': 'application/json', ...headers });
      response.end(JSON.stringify(data));
    };
    if (request.url.startsWith('/mobsf/')) {
      if (request.headers.authorization !== 'mobsf-test-key') return send({ error: 'unauthorized' }, 401);
      if (request.url.endsWith('/upload')) return send({ hash: 'a'.repeat(32), file_name: 'app.apk', scan_type: 'apk' });
      if (request.url === '/mobsf/api/v1/report_json') {
        if (reportPolls++ === 0) return send({ error: 'Report not found' }, 500);
        return send({ bundle_id: 'com.example.app', security_score: 82 });
      }
      if (request.url.endsWith('/report_json') || request.url.endsWith('/device_report_json')) return send({ findings: ['fixture dynamic observation'] });
      return send({ status: 'ok' });
    }
    if (request.url.startsWith('/burp/burp-test-key/v0.1/')) {
      if (request.url.endsWith('/scan') && request.method === 'POST') {
        burpPolls = 0;
        return send({}, 201, { Location: '/burp/burp-test-key/v0.1/scan/42' });
      }
      if (request.method === 'PATCH') return send({ scan_status: 'paused' });
      return send({ scan_status: burpWaits || burpPolls++ === 0 ? 'running' : 'succeeded', issue_events: [{ issue: { name: 'Fixture issue', severity: 'low' } }] });
    }
    if (request.url.startsWith('/nessus/')) {
      if (request.headers['x-apikeys'] !== 'accessKey=nessus-access-test; secretKey=nessus-secret-test') return send({ error: 'unauthorized' }, 401);
      if (request.url.endsWith('/editor/scan/templates')) return send({ templates: [{ name: 'basic', uuid: 'fixture-template' }] });
      if (request.url.endsWith('/scans') && request.method === 'POST') { nessusPolls = 0; return send({ scan: { id: 7 } }); }
      if (request.method === 'POST') return send({ scan_uuid: 'fixture-scan' });
      return send({ info: { status: nessusPolls++ === 0 ? 'running' : 'completed' }, vulnerabilities: [{ plugin_id: 1, severity: 1 }] });
    }
    send({ error: `Unexpected fixture request: ${request.url}` }, 404);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  env('SPECTRE_MOBSF_URL', `${base}/mobsf`);
  env('SPECTRE_BURP_URL', `${base}/burp`);
  env('SPECTRE_NESSUS_URL', `${base}/nessus`);
});

after(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

test('network scope rejects loopback aliases, overlapping CIDRs and option injection', () => {
  for (const value of ['localhost', 'https://localhost.:8080/a', '127.4.2.1', '0x7f000001', '2130706433', '[::1]', '[::ffff:127.0.0.1]', '0.0.0.0/0', '192.0.2.0/23', '198.51.100.1', '-oN/tmp/file', '192.0.2.10;whoami']) {
    assert.throws(() => scope.normalizeScanTarget(value), tools.ToolExecutionError, value);
  }
  assert.equal(scope.normalizeScanTarget('https://192.0.2.10/test'), 'https://192.0.2.10/test');
  env('SPECTRE_TARGET_BLOCKLIST', '192.0.2.42');
  assert.throws(() => scope.normalizeScanTarget('192.0.2.0/24'), status(403));
  env('SPECTRE_TARGET_BLOCKLIST', '');
});

test('file scope rejects traversal, symlink escapes, blocked paths and overwrites', () => {
  fs.symlinkSync('/etc/passwd', path.join(fixture, 'escape.apk'));
  assert.throws(() => scope.localPath(path.join(fixture, 'escape.apk'), 'file', 'APK'), status(403));
  assert.throws(() => scope.localPath('/etc/passwd', 'file', 'APK'), status(403));
  assert.throws(() => scope.localPath(path.join(fixture, 'app.apk'), 'output', 'Output'), status(409));
  env('SPECTRE_TOOL_PATH_BLOCKLIST', path.join(fixture, 'app.apk'));
  assert.throws(() => scope.localPath(path.join(fixture, 'app.apk'), 'file', 'APK'), status(403));
  env('SPECTRE_TOOL_PATH_BLOCKLIST', '');
});

test('all CLI adapters spawn real processes with correct arguments and stream before completion', async () => {
  const f = (name) => path.join(fixture, name);
  const cases = [
    [() => tools.executeNmap('192.0.2.10', 'Service'), ['-sV', '-T4', '192.0.2.10']],
    [() => tools.executeNikto('https://192.0.2.10'), ['-h', 'https://192.0.2.10']],
    [() => tools.executeDrozer('192.0.2.10:31415', 'app.package.attacksurface -a com.example.app'), ['console', 'connect', '--server', '192.0.2.10:31415', '--command', 'run app.package.attacksurface -a com.example.app']],
    [() => tools.executeFrida('com.example.app', f('inspect with spaces.js')), ['-U', '-n', 'com.example.app', '-l', f('inspect with spaces.js'), '-q', '-t', '30']],
    [() => tools.executeObjection('com.example.app', 'android sslpinning disable'), ['-n', 'com.example.app', 'run', 'android sslpinning disable']],
    [() => tools.executeJadx(f('app.apk'), f('java-source')), ['-d', f('java-source'), f('app.apk')]],
    [() => tools.executeProtocolAudit('192.0.2.10'), ['-A', '192.0.2.10']],
  ];
  for (const [run, expected] of cases) {
    const result = await run();
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.output.split('\n')[0]).argv, expected);
  }
  let finished = false;
  let streamed = false;
  const result = await tools.executeNuclei('https://192.0.2.10', f('template.yaml'), {
    onOutput(chunk) { assert.equal(finished, false); streamed ||= chunk.includes('argv'); },
  });
  finished = true;
  assert.equal(streamed, true);
  assert.deepEqual(JSON.parse(result.output.split('\n')[0]).argv.slice(0, 4), ['-u', 'https://192.0.2.10', '-t', f('template.yaml')]);
  assert.ok(Array.isArray(result.data));
});

test('reverse engineering returns unique output artifacts for decode, build and Ghidra', async () => {
  const decoded = await tools.executeApktool(path.join(fixture, 'app.apk'), 'decode');
  const built = await tools.executeApktool(path.join(fixture, 'decoded'), 'build');
  const ghidra = await tools.executeGhidraHeadless(path.join(fixture, 'native.so'), path.join(fixture, 'Export.java'));
  assert.equal(JSON.parse(decoded.output.split('\n')[0]).argv[0], 'decode');
  assert.equal(JSON.parse(built.output.split('\n')[0]).argv[0], 'build');
  assert.ok(built.artifacts[0].endsWith('.apk'));
  assert.notEqual(decoded.artifacts[0], built.artifacts[0]);
  const argv = JSON.parse(ghidra.output.split('\n')[0]).argv;
  assert.equal(argv[0], ghidra.artifacts[0]);
  assert.deepEqual(argv.slice(2, 8), ['-import', path.join(fixture, 'native.so'), '-scriptPath', fixture, '-postScript', 'Export.java']);
});

test('credential auditing uses service ports, the explicit account, and a single literal wordlist argument', async () => {
  const wordlist = path.join(fixture, 'passwords;literal.txt');
  fs.writeFileSync(wordlist, 'fixture\n');
  for (const [service, expectedPort] of [['ssh', '22'], ['https-get', '443'], ['smb', '445']]) {
    const result = await tools.executeCredentialAudit('auditor@192.0.2.10', service, wordlist);
    const argv = JSON.parse(result.output.split('\n')[0]).argv;
    assert.equal(argv[argv.indexOf('-P') + 1], wordlist);
    assert.equal(argv[argv.indexOf('-l') + 1], 'auditor');
    assert.equal(argv[argv.indexOf('-s') + 1], expectedPort);
    assert.equal(argv[argv.indexOf('-t') + 1], '2');
  }
  const result = await tools.executeCredentialAudit('auditor@192.0.2.10:2222', 'ssh', wordlist);
  assert.ok(JSON.parse(result.output.split('\n')[0]).argv.includes('2222'));
});

test('malformed modes, app targets, script paths and embedded commands are rejected before spawn', () => {
  assert.throws(() => tools.executeMobSF(path.join(fixture, 'app.apk'), 'invalid'), status(400));
  assert.throws(() => tools.executeApktool(path.join(fixture, 'app.apk'), 'invalid'), status(400));
  assert.throws(() => tools.executeFrida('not.in.scope', path.join(fixture, 'inspect with spaces.js')), status(403));
  assert.throws(() => tools.executeFrida('1234', path.join(fixture, 'app.apk')), status(400));
  assert.throws(() => tools.executeDrozer('192.0.2.10', 'app.package.list; shell'), status(400));
  assert.throws(() => tools.executeObjection('com.example.app', 'env; ls'), status(400));
  assert.throws(() => tools.executeCredentialAudit('auditor@192.0.2.10', 'unsupported', path.join(fixture, 'passwords.txt')), status(400));
  assert.throws(() => tools.executeCredentialAudit('%GG@192.0.2.10', 'ssh', path.join(fixture, 'passwords.txt')), status(400));
  assert.throws(() => tools.executeCredentialAudit('auditor@192.0.2.10:0', 'ssh', path.join(fixture, 'passwords.txt')), status(400));
});

test('nonzero exits preserve output and streaming routes mark failure', async () => {
  env('SPECTRE_MOCK_MODE', 'fail');
  try {
    await assert.rejects(tools.executeProtocolAudit('192.0.2.10'), (error) => status(502)(error) && error.output.includes('fixture failure'));
    const response = await postRoute('protocol-audit', { target: '192.0.2.10' });
    assert.match(await response.text(), /\[SPECTRE_ERROR\].+exited with code 2/);
  } finally { env('SPECTRE_MOCK_MODE', 'ok'); }
});

test('timeouts force-kill an uncooperative child and return 504', { timeout: 7000 }, async () => {
  env('SPECTRE_MOCK_MODE', 'hang');
  const start = Date.now();
  try {
    await assert.rejects(tools.executeProtocolAudit('192.0.2.10', { timeoutMs: 150 }), status(504));
    assert.ok(Date.now() - start < 6000);
  } finally { env('SPECTRE_MOCK_MODE', 'ok'); }
});

test('abort signals stop a running child and pre-aborted calls never spawn', async () => {
  env('SPECTRE_MOCK_MODE', 'wait');
  const controller = new AbortController();
  try {
    await assert.rejects(tools.executeProtocolAudit('192.0.2.10', {
      signal: controller.signal, onOutput() { controller.abort(); },
    }), status(499));
    assert.throws(() => tools.executeObjection('com.example.app', 'env', { signal: controller.signal }), status(499));
  } finally { env('SPECTRE_MOCK_MODE', 'ok'); }
});

test('cancelling a response reader terminates its tool process', async () => {
  env('SPECTRE_MOCK_MODE', 'wait');
  try {
    const response = await postRoute('protocol-audit', { target: '192.0.2.10' });
    const reader = response.body.getReader();
    const first = await reader.read();
    const pid = JSON.parse(new TextDecoder().decode(first.value).trim()).pid;
    await reader.cancel();
    let gone = false;
    for (let i = 0; i < 30; i++) {
      await delay(30);
      try { process.kill(pid, 0); } catch (error) { gone = error.code === 'ESRCH'; }
      if (gone) break;
    }
    assert.equal(gone, true);
  } finally { env('SPECTRE_MOCK_MODE', 'ok'); }
});

test('MobSF subprocess uploads the app, handles asynchronous reports, and returns structured findings', async () => {
  const chunks = [];
  const result = await tools.executeMobSF(path.join(fixture, 'app.apk'), 'static', { onOutput: (chunk) => chunks.push(chunk) });
  assert.equal(result.data.report.security_score, 82);
  assert.ok(chunks.length >= 3);
  assert.equal(result.output.includes('mobsf-test-key'), false);
  const uploaded = remoteRequests.find((request) => request.url.endsWith('/upload'));
  assert.match(uploaded.headers['content-type'], /multipart\/form-data; boundary=/);
  assert.match(uploaded.body, /filename="app.apk"/);
});

test('MobSF dynamic workflows use the Android and iOS device APIs', async () => {
  const android = await tools.executeMobSF(path.join(fixture, 'app.apk'), 'dynamic');
  const ios = await tools.executeMobSF(path.join(fixture, 'app.ipa'), 'dynamic');
  assert.equal(android.data.platform, 'android');
  assert.equal(ios.data.platform, 'ios');
  assert.ok(remoteRequests.some((request) => request.url.endsWith('/dynamic/stop_analysis')));
  const install = remoteRequests.find((request) => request.url.endsWith('/device_install_ipa'));
  assert.equal(install.body.device_id, 'fixture-ios-device');
  assert.equal(install.body.checksum, 'a'.repeat(32));
});

test('Burp and Nessus subprocesses launch, poll, authenticate and return findings', async () => {
  const burp = await tools.executeBurpScan('https://192.0.2.10/path');
  const nessus = await tools.executeNessusScan('192.0.2.10', '77');
  assert.equal(burp.data.scan_status, 'succeeded');
  assert.equal(burp.data.issue_events.length, 1);
  assert.equal(nessus.data.info.status, 'completed');
  assert.equal(nessus.data.vulnerabilities.length, 1);
  const created = remoteRequests.find((request) => request.url === '/nessus/scans');
  assert.equal(created.body.settings.policy_id, 77);
  assert.equal(created.body.settings.text_targets, '192.0.2.10');
  assert.equal(nessus.output.includes('nessus-secret-test'), false);
  const burpCreated = remoteRequests.find((request) => request.url.endsWith('/v0.1/scan'));
  assert.equal(burpCreated.body.scope.include[0].rule, 'https://192.0.2.10');
});

test('cancelling a Burp subprocess requests remote pause before exiting', async () => {
  burpWaits = true;
  const controller = new AbortController();
  try {
    await assert.rejects(tools.executeBurpScan('https://192.0.2.10', {
      signal: controller.signal,
      onOutput(chunk) { if (chunk.includes('"stage":"running"')) controller.abort(); },
    }), status(499));
    assert.ok(remoteRequests.some((request) => request.method === 'PATCH' && request.body.scan_status === 'paused'));
  } finally { burpWaits = false; }
});

test('all twelve routes reject invalid JSON shapes, enforce offline mode, and expose Node runtime', async () => {
  const slugs = ['mobsf', 'drozer', 'frida', 'objection', 'jadx', 'apktool', 'ghidra', 'burp', 'nessus', 'nuclei', 'credential-audit', 'protocol-audit'];
  for (const slug of slugs) {
    const route = require(`../app/api/tools/${slug}/route.ts`);
    assert.equal(route.runtime, 'nodejs');
    assert.equal((await postRoute(slug, [])).status, 400, slug);
    assert.equal((await postRoute(slug, { offline: true })).status, 409, slug);
  }
  assert.equal((await postRoute('burp', { target: 'http://localhost' })).status, 403);
  assert.equal((await postRoute('frida', { target: 'outside.scope', script: path.join(fixture, 'inspect with spaces.js') })).status, 403);
  env('SPECTRE_BURP_API_KEY', undefined);
  assert.equal((await postRoute('burp', { target: 'https://192.0.2.10' })).status, 503);
  env('SPECTRE_BURP_API_KEY', 'burp-test-key');
});

test('tool metadata includes all 24 tools in exactly four sections', async () => {
  const response = await require('../app/api/tools/route.ts').GET();
  const metadata = await response.json();
  assert.equal(metadata.length, 24);
  assert.deepEqual(new Set(metadata.map((tool) => tool.category)), new Set(['Network & Web', 'Mobile', 'Reverse Engineering', 'Credential & Protocol Auditing']));
  assert.ok(metadata.find((tool) => tool.id === 'mobsf').available);
  assert.equal(JSON.stringify(metadata).includes('mobsf-test-key'), false);
});

test('Groq advertises and dispatches all 14 callable functions, then receives their results', async () => {
  env('GROQ_API_KEY', 'fixture-groq-key');
  const originalFetch = global.fetch;
  const called = [];
  let schemas;
  let rounds = 0;
  const expected = ['nmap', 'nikto', 'mobsf', 'drozer', 'frida', 'objection', 'jadx', 'apktool', 'ghidra', 'burp', 'nessus', 'nuclei', 'credential_audit', 'protocol_audit'];
  global.fetch = async (url, options) => {
    if (String(url).includes('api.groq.com')) {
      const payload = JSON.parse(options.body);
      if (rounds++ === 0) {
        schemas = payload.tools;
        return Response.json({ choices: [{ message: { content: null, tool_calls: expected.map((name, index) => ({ id: `call-${index}`, type: 'function', function: { name: `run_${name}`, arguments: '{}' } })) } }] });
      }
      assert.equal(payload.messages.filter((message) => message.role === 'tool').length, 14);
      return new Response('data: {"choices":[{"delta":{"content":"All fixture tools returned."}}]}\n\ndata: [DONE]\n\n');
    }
    called.push(new URL(url).pathname);
    return new Response('Fixture tool output');
  };
  try {
    const chat = require('../app/api/chat/route.ts');
    const response = await chat.POST(new NextRequest('http://spectre.test/api/chat', {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Run the requested fixture tools.' }] }),
    }));
    assert.equal(await response.text(), 'All fixture tools returned.');
    assert.equal(schemas.length, 14);
    assert.deepEqual(schemas.map((schema) => schema.function.name), expected.map((name) => `run_${name}`));
    assert.ok(schemas.every((schema) => schema.type === 'function' && schema.function.parameters.additionalProperties === false));
    assert.deepEqual(new Set(called), new Set(expected.map((name) => `/api/tools/${name.replaceAll('_', '-')}`)));
    const offline = await chat.POST(new NextRequest('http://spectre.test/api/chat', { method: 'POST', body: JSON.stringify({ offline: true }) }));
    assert.match(await offline.text(), /Offline mode/);
    assert.equal(rounds, 2);
  } finally { global.fetch = originalFetch; }
});
