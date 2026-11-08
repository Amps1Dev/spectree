// Subprocess adapter for tools whose supported automation interface is REST.
// Only server configuration supplies service endpoints and credentials. stdout
// is JSON Lines: progress events followed by one structured result.
const { readFile, stat } = require('node:fs/promises');
const { basename } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const [tool, ...args] = process.argv.slice(2);
const controller = new AbortController();
let stopRemote;
let complete = false;
const pollMs = Math.min(30_000, Math.max(100, Number(process.env.SPECTRE_API_POLL_MS) || 2500));
const dynamicSeconds = Math.min(300, Math.max(1, Number(process.env.SPECTRE_MOBSF_DYNAMIC_SECONDS) || 30));
const secretNames = ['SPECTRE_MOBSF_API_KEY', 'SPECTRE_BURP_API_KEY', 'SPECTRE_NESSUS_ACCESS_KEY', 'SPECTRE_NESSUS_SECRET_KEY'];

function redact(value) {
  let text = String(value);
  for (const name of secretNames) {
    const secret = process.env[name];
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text;
}

function emit(type, data) {
  process.stdout.write(`${redact(JSON.stringify({ type, tool, ...data }))}\n`);
}

process.stdout.on('error', () => controller.abort());
process.once('SIGTERM', () => controller.abort());
process.once('SIGINT', () => controller.abort());

function environment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function apiClient(base, headers = {}) {
  const url = new URL(base.endsWith('/') ? base : `${base}/`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid service URL');
  return async (path, { method = 'GET', json, form, body, cleanup = false, allowError = false } = {}) => {
    const requestHeaders = { ...headers };
    if (json !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = new URLSearchParams(form);
    }
    // Never forward API keys across a redirect. A configured local service is
    // independent of the scan target's scope and may legitimately use loopback.
    const response = await fetch(new URL(path.replace(/^\//, ''), url), {
      method, headers: requestHeaders, body, redirect: 'error',
      signal: cleanup ? AbortSignal.timeout(1800) : AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]),
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error(`Service returned non-JSON data (HTTP ${response.status})`); }
    }
    if ((!response.ok || data.error || data.status === 'failed') && !allowError) {
      throw new Error(`Service request failed (HTTP ${response.status}): ${redact(data.error || data.message || data.status || 'unknown error')}`);
    }
    return { data, headers: response.headers, status: response.status };
  };
}

async function wait() {
  await delay(pollMs, undefined, { signal: controller.signal });
}

async function mobsf() {
  const [filePath, mode] = args;
  if (!['static', 'dynamic'].includes(mode)) throw new Error('Invalid MobSF analysis mode');
  const api = apiClient(environment('SPECTRE_MOBSF_URL'), { Authorization: environment('SPECTRE_MOBSF_API_KEY') });
  if ((await stat(filePath)).size > 200 * 1024 * 1024) throw new Error('APK/IPA exceeds the 200 MB upload limit');
  const upload = new FormData();
  upload.set('file', new Blob([await readFile(filePath)], { type: 'application/octet-stream' }), basename(filePath));
  emit('progress', { stage: 'Uploading app for analysis' });
  const { data: uploaded } = await api('api/v1/upload', { method: 'POST', body: upload });
  const hash = uploaded.hash;
  if (!/^[a-f0-9]{32}$/i.test(hash || '')) throw new Error('MobSF upload did not return a valid hash');
  emit('progress', { stage: 'Running static analysis', hash });
  await api('api/v1/scan', {
    method: 'POST',
    form: { hash, file_name: uploaded.file_name || basename(filePath), scan_type: uploaded.scan_type || (filePath.toLowerCase().endsWith('.ipa') ? 'ipa' : 'apk'), re_scan: '0' },
  });
  let report;
  // MobSF may enqueue the scan when asynchronous analysis is enabled.
  for (;;) {
    const result = await api('api/v1/report_json', { method: 'POST', form: { hash }, allowError: true });
    if (result.status === 200 && !result.data.error) { report = result.data; break; }
    if (!/not (found|ready|available|generated|completed)|in progress/i.test(String(result.data.error || ''))) {
      throw new Error(`MobSF report unavailable (HTTP ${result.status}): ${result.data.error || 'unknown error'}`);
    }
    emit('progress', { stage: 'Waiting for static analysis', hash });
    await wait();
  }
  if (mode === 'static') return { hash, mode, report };

  if (filePath.toLowerCase().endsWith('.ipa')) {
    const device_id = environment('SPECTRE_MOBSF_IOS_DEVICE_ID');
    const bundle_id = report.bundle_id || report.bundleid;
    if (!bundle_id || !/^[a-zA-Z0-9._-]+$/.test(bundle_id)) throw new Error('MobSF static report did not include an iOS bundle ID');
    emit('progress', { stage: 'Preparing iOS dynamic analysis', bundle_id });
    await api('api/v1/ios/device_dynamic_analysis', { method: 'POST', form: { device_id } });
    await api('api/v1/ios/device_install_ipa', { method: 'POST', form: { device_id, checksum: hash } });
    await api('api/v1/ios/device_dynamic_analyzer', { method: 'POST', form: { device_id, bundle_id } });
    await api('api/v1/ios/device_instrument', {
      method: 'POST',
      form: { device_id, bundle_id, default_hooks: '', dump_hooks: '', auxiliary_hooks: '', frida_code: 'send("SPECTRE dynamic analysis started");' },
    });
    emit('progress', { stage: 'Observing instrumented iOS app', seconds: dynamicSeconds });
    await delay(dynamicSeconds * 1000, undefined, { signal: controller.signal });
    await api('api/v1/ios/device_download_app_data', { method: 'POST', form: { device_id, bundle_id } });
    const { data } = await api('api/v1/ios/device_report_json', { method: 'POST', form: { device_id, bundle_id } });
    return { hash, mode, platform: 'ios', staticReport: report, report: data };
  }

  emit('progress', { stage: 'Starting Android dynamic analysis', hash });
  // Install cleanup before launching, in case cancellation races the response.
  stopRemote = () => api('api/v1/dynamic/stop_analysis', { method: 'POST', form: { hash }, cleanup: true });
  await api('api/v1/dynamic/start_analysis', { method: 'POST', form: { hash } });
  emit('progress', { stage: 'Observing Android app', seconds: dynamicSeconds });
  await delay(dynamicSeconds * 1000, undefined, { signal: controller.signal });
  await api('api/v1/dynamic/stop_analysis', { method: 'POST', form: { hash } });
  stopRemote = undefined;
  const { data } = await api('api/v1/dynamic/report_json', { method: 'POST', form: { hash } });
  return { hash, mode, platform: 'android', staticReport: report, report: data };
}

async function burp() {
  const [target] = args;
  const key = environment('SPECTRE_BURP_API_KEY');
  const api = apiClient(`${environment('SPECTRE_BURP_URL').replace(/\/$/, '')}/${encodeURIComponent(key)}/v0.1/`);
  emit('progress', { stage: 'Starting Burp crawl and audit', target });
  const created = await api('scan', {
    method: 'POST',
    json: { urls: [target], scope: { include: [{ rule: new URL(target).origin }], exclude: [] } },
  });
  const location = created.headers.get('location');
  const id = String(created.data.task_id ?? location?.split('/').filter(Boolean).pop() ?? '');
  if (!/^[\w-]+$/.test(id)) throw new Error('Burp did not return a scan task ID');
  stopRemote = () => api(`scan/${id}`, { method: 'PATCH', json: { scan_status: 'paused' }, cleanup: true });
  for (;;) {
    const { data } = await api(`scan/${id}`);
    emit('progress', { stage: data.scan_status || 'running', scanId: id, metrics: data.scan_metrics });
    if (data.scan_status === 'succeeded') { stopRemote = undefined; return { scanId: id, ...data }; }
    if (['failed', 'cancelled', 'paused'].includes(data.scan_status)) throw new Error(`Burp scan ${data.scan_status}`);
    await wait();
  }
}

async function nessus() {
  const [target, policyId] = args;
  const api = apiClient(environment('SPECTRE_NESSUS_URL'), {
    'X-ApiKeys': `accessKey=${environment('SPECTRE_NESSUS_ACCESS_KEY')}; secretKey=${environment('SPECTRE_NESSUS_SECRET_KEY')}`,
  });
  let template = process.env.SPECTRE_NESSUS_TEMPLATE_UUID;
  if (!template) {
    const { data } = await api('editor/scan/templates');
    template = data.templates?.find((item) => item.name === 'basic')?.uuid;
    if (!template) throw new Error('No basic Nessus scan template found; set SPECTRE_NESSUS_TEMPLATE_UUID');
  }
  emit('progress', { stage: 'Creating Nessus scan', target, policyId });
  const { data: created } = await api('scans', {
    method: 'POST',
    json: { uuid: template, settings: { name: `SPECTRE ${target} ${new Date().toISOString()}`, text_targets: target, policy_id: Number(policyId), enabled: false, launch: 'ON_DEMAND' } },
  });
  const id = created.scan?.id;
  if (!Number.isSafeInteger(id)) throw new Error('Nessus did not return a scan ID');
  stopRemote = () => api(`scans/${id}/stop`, { method: 'POST', json: {}, cleanup: true });
  await api(`scans/${id}/launch`, { method: 'POST', json: {} });
  for (;;) {
    const { data } = await api(`scans/${id}`);
    const status = data.info?.status;
    emit('progress', { stage: status || 'running', scanId: id });
    if (['completed', 'empty'].includes(status)) { stopRemote = undefined; return { scanId: id, ...data }; }
    if (['canceled', 'cancelled', 'aborted', 'stopped', 'paused'].includes(status)) throw new Error(`Nessus scan ${status}`);
    await wait();
  }
}

async function main() {
  const runners = { mobsf, burp, nessus };
  if (!Object.hasOwn(runners, tool)) throw new Error('Unknown REST tool');
  try {
    const data = await runners[tool]();
    complete = true;
    emit('result', { data });
  } finally {
    if (!complete && stopRemote) {
      try {
        await stopRemote();
        emit('progress', { stage: 'Remote scan stopped or paused' });
      } catch (error) {
        emit('progress', { stage: 'Remote cancellation could not be confirmed', detail: redact(error.message) });
      }
    }
  }
}

main().catch((error) => {
  emit('error', { message: controller.signal.aborted ? 'Tool was cancelled' : redact(error.message) });
  process.exitCode = 1;
});
