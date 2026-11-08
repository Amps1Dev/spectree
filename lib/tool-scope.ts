import { accessSync, constants, existsSync, realpathSync, statSync } from 'fs';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { ToolExecutionError } from './tool-errors';

export function requiredText(value: unknown, label: string, maxLength = 2048): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || /[\r\n\0]/.test(value)) {
    throw new ToolExecutionError(`${label} must be a non-empty string (at most ${maxLength} characters)`, 400);
  }
  return value.trim();
}

export function enumValue<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new ToolExecutionError(`${label} must be one of: ${values.join(', ')}`, 400);
  }
  return value;
}

function configuredList(name: string): string[] {
  return (process.env[name] || '').split(',').map((value) => value.trim()).filter(Boolean);
}

// Numeric ranges let a blocklist reject *overlapping* CIDRs, including broad
// scans whose first address alone would otherwise appear harmless.
function ipNumber(address: string): bigint {
  if (isIP(address) === 4) {
    return address.split('.').reduce((result, byte) => (result << BigInt(8)) + BigInt(byte), BigInt(0));
  }
  const mapped = address.replace(/(\d+\.\d+\.\d+\.\d+)$/, (ipv4) => {
    const value = ipNumber(ipv4);
    return `${(value >> BigInt(16)).toString(16)}:${(value & BigInt(65535)).toString(16)}`;
  });
  const [left, right] = mapped.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const words = right !== undefined ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end] : start;
  return words.reduce((result, word) => (result << BigInt(16)) + BigInt(`0x${word}`), BigInt(0));
}

function ipRange(value: string) {
  const [host, prefix] = value.split('/');
  const family = isIP(host);
  if (!family) return null;
  const bits = family === 4 ? 32 : 128;
  const length = prefix === undefined ? bits : Number(prefix);
  if (!Number.isInteger(length) || length < 0 || length > bits) return null;
  const shift = BigInt(bits - length);
  const start = (ipNumber(host) >> shift) << shift;
  return { family, start, end: start + (BigInt(1) << shift) - BigInt(1) };
}

function matches(target: string, rule: string, block = false): boolean {
  const subject = ipRange(target);
  const network = ipRange(rule);
  if (subject && network && subject.family === network.family) {
    return block
      ? subject.start <= network.end && subject.end >= network.start
      : subject.start >= network.start && subject.end <= network.end;
  }
  if (rule.startsWith('*.')) return target.endsWith(rule.slice(1).toLowerCase());
  return target === rule.toLowerCase();
}

const BLOCKED_TARGETS = [
  'localhost', '*.localhost', 'localhost.localdomain',
  '127.0.0.0/8', '0.0.0.0/8', '169.254.0.0/16',
  '::1', '::', '::ffff:127.0.0.0/104', '::ffff:0.0.0.0/104',
  '::ffff:169.254.0.0/112', 'fe80::/10',
];

export function targetHost(value: string): string {
  if (isIP(value)) return value.toLowerCase();
  if (/^[\da-f:.]+\/\d+$/i.test(value)) {
    if (!ipRange(value)) throw new ToolExecutionError('Invalid target CIDR', 400);
    return value.toLowerCase();
  }
  try {
    const parsed = new URL(value.includes('://') ? value : `http://${value}`);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    const host = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (!host || (!isIP(host) && !/^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/.test(host))) throw new Error();
    return host;
  } catch {
    throw new ToolExecutionError('Invalid target hostname, IP address, or HTTP(S) URL', 400);
  }
}

function assertNotBlocked(host: string) {
  const rules = [...BLOCKED_TARGETS, ...configuredList('SPECTRE_TARGET_BLOCKLIST')];
  if (rules.some((rule) => matches(host, rule, true))) {
    throw new ToolExecutionError('Target is blocked by the server blocklist', 403);
  }
}

export function normalizeScanTarget(value: unknown): string {
  const target = requiredText(value, 'Target');
  if (/^[\-]|[\s\\;|`$<>]/.test(target)) throw new ToolExecutionError('Invalid target', 400);
  const host = targetHost(target);
  assertNotBlocked(host);
  const scope = configuredList('SPECTRE_TARGET_SCOPE');
  if (scope.length && !scope.some((rule) => matches(host, rule))) {
    throw new ToolExecutionError('Target is outside SPECTRE_TARGET_SCOPE', 403);
  }
  return target;
}

export async function validateResolvedTarget(target: string): Promise<void> {
  const host = targetHost(normalizeScanTarget(target));
  if (ipRange(host)) return;
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ToolExecutionError(`Cannot resolve target ${host}`, 400);
  }
  for (const { address } of addresses) assertNotBlocked(address);
}

export function webTarget(value: unknown): string {
  const target = normalizeScanTarget(value);
  if (targetHost(target).includes('/')) throw new ToolExecutionError('This tool requires one HTTP(S) host, not a CIDR', 400);
  return target.includes('://') ? target : `https://${isIP(target) === 6 ? `[${target}]` : target}`;
}

export function appTarget(value: unknown): string {
  const target = requiredText(value, 'App identifier or PID', 255);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(target)) {
    throw new ToolExecutionError('Use a package/bundle identifier, process name, or PID', 400);
  }
  const blocked = configuredList('SPECTRE_APP_BLOCKLIST');
  const allowed = configuredList('SPECTRE_APP_SCOPE');
  if (blocked.includes(target) || (allowed.length && !allowed.includes(target))) {
    throw new ToolExecutionError('App is outside the configured app scope or is blocked', 403);
  }
  return target;
}

function inside(path: string, root: string): boolean {
  const fromRoot = relative(root, path);
  return !fromRoot || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot));
}

export function localPath(value: unknown, kind: 'file' | 'directory' | 'output' | 'wordlist', label: string): string {
  const input = requiredText(value, label, 4096);
  if (input.startsWith('-')) throw new ToolExecutionError(`Invalid ${label}`, 400);
  const path = resolve(input);
  let existing = path;
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const canonical = resolve(realpathSync(existing), relative(existing, path));
  const roots = configuredList('SPECTRE_TOOL_ROOTS');
  if (!roots.length) roots.push(process.cwd());
  if (kind === 'wordlist') roots.push('/usr/share/wordlists');
  const allowedRoots = roots.filter(existsSync).map((root) => realpathSync(root));
  const blockedRoots = configuredList('SPECTRE_TOOL_PATH_BLOCKLIST').map((root) => existsSync(root) ? realpathSync(root) : resolve(root));
  if (!allowedRoots.some((root) => inside(canonical, root)) || blockedRoots.some((root) => inside(canonical, root))) {
    throw new ToolExecutionError(`${label} is outside SPECTRE_TOOL_ROOTS or is blocked`, 403);
  }
  if (kind === 'output') {
    if (existsSync(canonical)) throw new ToolExecutionError(`${label} already exists; choose a new output path`, 409);
  } else {
    try {
      const stat = statSync(canonical);
      if (kind === 'directory' ? !stat.isDirectory() : !stat.isFile()) throw new Error();
      accessSync(canonical, constants.R_OK);
    } catch {
      throw new ToolExecutionError(`${label} must be a readable ${kind === 'directory' ? 'directory' : 'file'} on the server`, 400);
    }
  }
  return canonical;
}
