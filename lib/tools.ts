// Central registry of the pentest tools SpecTree can run.
//
// Each entry is pure data + two small pure functions (buildArgs / follow) that
// map user-supplied field values to a process argv. The dynamic API route
// (app/api/tools/[tool]/route.ts) and the metadata route (app/api/tools/route.ts)
// both read from here. Dedicated tool routes and chat share the typed
// executors below, including scope validation and cancellable streaming.
//
// Safety: the executor always spawns with shell:false, so every value produced
// by buildArgs becomes a literal argv entry and can never be interpreted by a
// shell. Keep it that way — never assemble a shell string from these.

import { accessSync, constants, mkdirSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { basename, dirname, extname, join } from 'path';
import { ToolExecutionError } from './tool-errors';
import { appTarget, enumValue, localPath, normalizeScanTarget, requiredText, targetHost, validateResolvedTarget, webTarget } from './tool-scope';

export { ToolExecutionError } from './tool-errors';
export { normalizeScanTarget } from './tool-scope';

export type FieldType = 'text' | 'textarea' | 'select' | 'password' | 'number';

export interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  default?: string;
  required?: boolean;
  /** Options for a `select` field. */
  options?: { label: string; value: string }[];
  /** If true, the value is written to a temp file and the arg receives its path. */
  asFile?: boolean;
}

export type ToolCategory =
  | 'Network & Web'
  | 'Mobile'
  | 'Reverse Engineering'
  | 'Credential & Protocol Auditing';

export interface ToolDef {
  /** URL slug + stable id, e.g. 'wpscan'. */
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** Binary candidates; the first one found on the host wins. */
  bins: string[];
  /** Optional binary override or required REST service environment variables. */
  envName?: string;
  apiConfig?: string[];
  /** Display-only representation of the command that will run. */
  commandHint: string;
  /** Shown when the binary is missing. */
  installHint?: string;
  /** Reject empty / localhost / 127.0.0.1 as a target (network tools). */
  blocksLocalhost?: boolean;
  /** Hard kill after this many ms. Defaults to 180_000. */
  timeoutMs?: number;
  fields: ToolField[];
  /** Params (field name -> value, asFile fields already replaced by a path) -> argv. */
  buildArgs: (p: Record<string, string>) => string[];
  /** Optional second invocation whose output is appended (e.g. `john --show`). */
  follow?: (p: Record<string, string>) => string[] | null;
}

// nmap scan profiles — copied verbatim from the original nmap route so migrated
// behaviour is identical.
const NMAP_PROFILE_FLAGS: Record<string, string> = {
  Quick: '-T4 -F',
  Service: '-sV -T4',
  Full: '-sV -A -T4',
};

export const TOOLS: ToolDef[] = [
  {
    id: 'nmap',
    name: 'Nmap',
    description: 'Network port and service scanner.',
    category: 'Network & Web',
    bins: ['nmap'],
    envName: 'SPECTRE_NMAP_BIN',
    commandHint: 'nmap <profile-flags> <target>',
    installHint: 'sudo apt install nmap',
    blocksLocalhost: true,
    timeoutMs: 300_000,
    fields: [
      { name: 'target', label: 'Target', type: 'text', placeholder: 'IP or hostname', required: true },
      {
        name: 'profile',
        label: 'Profile',
        type: 'select',
        default: 'Quick',
        options: [
          { label: 'Quick (-T4 -F)', value: 'Quick' },
          { label: 'Service Detection (-sV -T4)', value: 'Service' },
          { label: 'Full (-sV -A -T4)', value: 'Full' },
        ],
      },
    ],
    buildArgs: (p) => {
      const flags = NMAP_PROFILE_FLAGS[p.profile] || NMAP_PROFILE_FLAGS.Quick;
      return flags.split(' ').concat([p.target]);
    },
  },
  {
    id: 'nikto',
    name: 'Nikto',
    description: 'Web server vulnerability scanner.',
    category: 'Network & Web',
    bins: ['nikto'],
    envName: 'SPECTRE_NIKTO_BIN',
    commandHint: 'nikto -h <target>',
    installHint: 'sudo apt install nikto',
    blocksLocalhost: true,
    fields: [
      { name: 'target', label: 'Target URL / host', type: 'text', placeholder: 'http://target', required: true },
    ],
    buildArgs: (p) => ['-h', p.target],
  },
  {
    id: 'wpscan',
    name: 'WPScan',
    description: 'WordPress vulnerability and user enumeration.',
    category: 'Network & Web',
    bins: ['wpscan'],
    commandHint: 'wpscan --url <target> --enumerate vp,u',
    installHint: 'sudo apt install wpscan',
    blocksLocalhost: true,
    timeoutMs: 300_000,
    fields: [
      { name: 'target', label: 'Target URL', type: 'text', placeholder: 'https://blog.example.com', required: true },
      { name: 'enumerate', label: 'Enumerate', type: 'text', default: 'vp,u' },
      { name: 'apiToken', label: 'WPVulnDB API token (optional)', type: 'password', placeholder: 'optional' },
    ],
    buildArgs: (p) => {
      const args = ['--url', p.target, '--enumerate', p.enumerate || 'vp,u'];
      if (p.apiToken) args.push('--api-token', p.apiToken);
      return args;
    },
  },
  {
    id: 'theharvester',
    name: 'theHarvester',
    description: 'OSINT email, subdomain and host gathering.',
    category: 'Network & Web',
    bins: ['theHarvester', 'theharvester'],
    commandHint: 'theHarvester -d <domain> -b google,bing,linkedin',
    installHint: 'sudo apt install theharvester',
    timeoutMs: 300_000,
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'example.com', required: true },
      { name: 'sources', label: 'Sources', type: 'text', default: 'google,bing,linkedin' },
    ],
    buildArgs: (p) => ['-d', p.domain, '-b', p.sources || 'google,bing,linkedin'],
  },
  {
    id: 'enum4linux',
    name: 'enum4linux',
    description: 'Enumerate SMB shares, users and policies on Windows/Samba.',
    category: 'Credential & Protocol Auditing',
    bins: ['enum4linux', 'enum4linux-ng'],
    commandHint: 'enum4linux -a <target>',
    installHint: 'sudo apt install enum4linux',
    blocksLocalhost: true,
    timeoutMs: 300_000,
    fields: [
      { name: 'target', label: 'Target', type: 'text', placeholder: 'IP or hostname', required: true },
    ],
    buildArgs: (p) => ['-a', p.target],
  },
  {
    id: 'dnsrecon',
    name: 'dnsrecon',
    description: 'DNS enumeration: standard records, zone transfer, brute force.',
    category: 'Network & Web',
    bins: ['dnsrecon'],
    commandHint: 'dnsrecon -d <domain> -t std,axfr,brute',
    installHint: 'sudo apt install dnsrecon',
    timeoutMs: 300_000,
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'example.com', required: true },
      { name: 'types', label: 'Scan types', type: 'text', default: 'std,axfr,brute' },
      {
        name: 'wordlist',
        label: 'Brute wordlist (-D, optional)',
        type: 'text',
        placeholder: '/usr/share/wordlists/dnsmap.txt',
      },
    ],
    buildArgs: (p) => {
      const args = ['-d', p.domain, '-t', p.types || 'std,axfr,brute'];
      if (p.wordlist) args.push('-D', p.wordlist);
      return args;
    },
  },
  {
    id: 'searchsploit',
    name: 'SearchSploit',
    description: 'Search the local Exploit-DB archive.',
    category: 'Network & Web',
    bins: ['searchsploit'],
    commandHint: 'searchsploit <service> <version>',
    installHint: 'sudo apt install exploitdb',
    timeoutMs: 60_000,
    fields: [
      { name: 'service', label: 'Service / product', type: 'text', placeholder: 'apache', required: true },
      { name: 'version', label: 'Version (optional)', type: 'text', placeholder: '2.4.49' },
    ],
    buildArgs: (p) => (p.version ? [p.service, p.version] : [p.service]),
  },
  {
    id: 'masscan',
    name: 'Masscan',
    description: 'Very fast Internet-scale port scanner (needs root).',
    category: 'Network & Web',
    bins: ['masscan'],
    commandHint: 'masscan <target> -p<ports> --rate=<rate>',
    installHint: 'sudo apt install masscan',
    blocksLocalhost: true,
    timeoutMs: 600_000,
    fields: [
      { name: 'target', label: 'Target', type: 'text', placeholder: 'IP or CIDR', required: true },
      { name: 'ports', label: 'Ports', type: 'text', default: '1-65535' },
      { name: 'rate', label: 'Rate (pkts/s)', type: 'number', default: '10000' },
    ],
    buildArgs: (p) => [p.target, '-p' + (p.ports || '1-65535'), '--rate=' + (p.rate || '10000')],
  },
  {
    id: 'john',
    name: 'John the Ripper',
    description: 'Crack password hashes with a wordlist. Paste hashes below.',
    category: 'Credential & Protocol Auditing',
    bins: ['john'],
    commandHint: 'john --wordlist=<wordlist> <hashfile>',
    installHint: 'sudo apt install john',
    timeoutMs: 600_000,
    fields: [
      {
        name: 'hashes',
        label: 'Hashes (one per line)',
        type: 'textarea',
        placeholder: 'user:$1$...  or  5f4dcc3b5aa765d61d8327deb882cf99',
        required: true,
        asFile: true,
      },
      {
        name: 'wordlist',
        label: 'Wordlist',
        type: 'text',
        default: '/usr/share/wordlists/rockyou.txt',
      },
      { name: 'format', label: 'Format (optional)', type: 'text', placeholder: 'raw-md5, nt, sha512crypt…' },
    ],
    buildArgs: (p) => {
      const args = ['--wordlist=' + (p.wordlist || '/usr/share/wordlists/rockyou.txt')];
      if (p.format) args.push('--format=' + p.format);
      args.push(p.hashes); // temp file path
      return args;
    },
    // Print any recovered credentials after the cracking run finishes. Carry
    // the same --format through, which john needs to display --show reliably.
    follow: (p) => {
      const args = ['--show'];
      if (p.format) args.push('--format=' + p.format);
      args.push(p.hashes);
      return args;
    },
  },
  {
    id: 'lynis',
    name: 'Lynis',
    description: 'Audit the security posture of this host (root recommended).',
    category: 'Network & Web',
    bins: ['lynis'],
    commandHint: 'lynis audit system',
    installHint: 'sudo apt install lynis',
    timeoutMs: 600_000,
    fields: [],
    buildArgs: () => ['audit', 'system'],
  },
  {
    id: 'sslscan',
    name: 'sslscan',
    description: 'Inspect a TLS service: protocols, ciphers and certificate.',
    category: 'Network & Web',
    bins: ['sslscan'],
    commandHint: 'sslscan <target>:443',
    installHint: 'sudo apt install sslscan',
    blocksLocalhost: true,
    fields: [
      { name: 'target', label: 'Target', type: 'text', placeholder: 'host or IP', required: true },
      { name: 'port', label: 'Port', type: 'number', default: '443' },
    ],
    buildArgs: (p) => [`${p.target}:${p.port || '443'}`],
  },
  {
    id: 'crackmapexec',
    name: 'CrackMapExec (NetExec)',
    description: 'SMB enumeration / credential check. Lists shares.',
    category: 'Credential & Protocol Auditing',
    bins: ['netexec', 'nxc', 'crackmapexec'],
    commandHint: 'nxc smb <target> -u <user> -p <pass> --shares',
    installHint: 'pipx install netexec',
    blocksLocalhost: true,
    timeoutMs: 300_000,
    fields: [
      { name: 'target', label: 'Target', type: 'text', placeholder: 'IP / CIDR / hostname', required: true },
      { name: 'username', label: 'Username', type: 'text', placeholder: 'administrator' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'password or hash' },
    ],
    buildArgs: (p) => ['smb', p.target, '-u', p.username || '', '-p', p.password || '', '--shares'],
  },
  {
    id: 'mobsf', name: 'MobSF', category: 'Mobile',
    description: 'Static APK/IPA analysis and dynamic analysis on a configured Android or iOS device.',
    bins: [process.execPath], apiConfig: ['SPECTRE_MOBSF_URL', 'SPECTRE_MOBSF_API_KEY'],
    commandHint: 'MobSF REST API · upload → analyse → JSON report',
    installHint: 'Configure SPECTRE_MOBSF_URL and SPECTRE_MOBSF_API_KEY',
    timeoutMs: 900_000,
    fields: [
      { name: 'filePath', label: 'APK / IPA path on server', type: 'text', required: true, placeholder: 'data/mobile/app.apk' },
      { name: 'mode', label: 'Analysis mode', type: 'select', default: 'static', options: [{ label: 'Static', value: 'static' }, { label: 'Dynamic (configured device)', value: 'dynamic' }] },
    ],
    buildArgs: (p) => [apiRunnerPath(), 'mobsf', p.filePath, p.mode],
  },
  {
    id: 'drozer', name: 'Drozer', category: 'Mobile',
    description: 'Inspect Android attack surfaces through a connected Drozer agent.',
    bins: ['drozer'], envName: 'SPECTRE_DROZER_BIN', blocksLocalhost: true,
    commandHint: 'drozer console connect --server <target> --command "run <module>"',
    installHint: 'pipx install drozer',
    fields: [
      { name: 'target', label: 'Drozer agent host', type: 'text', required: true, placeholder: '192.0.2.20:31415' },
      { name: 'module', label: 'Module', type: 'text', required: true, default: 'app.package.list' },
    ],
    buildArgs: (p) => ['console', 'connect', '--server', p.target, '--command', `run ${p.module}`],
  },
  {
    id: 'frida', name: 'Frida', category: 'Mobile',
    description: 'Run an instrumentation script against a running app on a USB-connected device.',
    bins: ['frida'], envName: 'SPECTRE_FRIDA_BIN',
    commandHint: 'frida -U -n <target> -l <script> -q -t 30',
    installHint: 'pipx install frida-tools',
    fields: [
      { name: 'target', label: 'App process name / PID', type: 'text', required: true, placeholder: 'com.example.app' },
      { name: 'script', label: 'JavaScript path on server', type: 'text', required: true, placeholder: 'data/mobile/inspect.js' },
    ],
    buildArgs: (p) => ['-U', /^\d+$/.test(p.target) ? '-p' : '-n', p.target, '-l', p.script, '-q', '-t', '30'],
  },
  {
    id: 'objection', name: 'Objection', category: 'Mobile',
    description: 'Explore a running mobile app with Frida, including SSL pinning and root detection checks.',
    bins: ['objection'], envName: 'SPECTRE_OBJECTION_BIN',
    commandHint: 'objection -n <target> run <command>', installHint: 'pipx install objection',
    fields: [
      { name: 'target', label: 'App bundle / package', type: 'text', required: true, placeholder: 'com.example.app' },
      { name: 'command', label: 'Objection command', type: 'text', required: true, default: 'env' },
    ],
    buildArgs: (p) => ['-n', p.target, 'run', p.command],
  },
  {
    id: 'jadx', name: 'JADX', category: 'Reverse Engineering',
    description: 'Decompile Android bytecode into Java source in a new output directory.',
    bins: ['jadx'], envName: 'SPECTRE_JADX_BIN', timeoutMs: 600_000,
    commandHint: 'jadx -d <outputDir> <apkPath>', installHint: 'sudo apt install jadx',
    fields: [
      { name: 'apkPath', label: 'APK path on server', type: 'text', required: true, placeholder: 'data/mobile/app.apk' },
      { name: 'outputDir', label: 'New output directory', type: 'text', required: true, placeholder: 'data/mobile/app-source' },
    ],
    buildArgs: (p) => ['-d', p.outputDir, p.apkPath],
  },
  {
    id: 'apktool', name: 'APKTool', category: 'Reverse Engineering',
    description: 'Decode APK manifests and resources, or rebuild a decoded project.',
    bins: ['apktool'], envName: 'SPECTRE_APKTOOL_BIN', timeoutMs: 600_000,
    commandHint: 'apktool decode|build <apkPath> -o <new output>', installHint: 'sudo apt install apktool',
    fields: [
      { name: 'apkPath', label: 'APK / decoded directory on server', type: 'text', required: true, placeholder: 'data/mobile/app.apk' },
      { name: 'mode', label: 'Operation', type: 'select', default: 'decode', options: [{ label: 'Decode APK', value: 'decode' }, { label: 'Build decoded directory', value: 'build' }] },
    ],
    buildArgs: (p) => [p.mode, p.apkPath, '-o', p.outputPath],
  },
  {
    id: 'ghidra', name: 'Ghidra (headless)', category: 'Reverse Engineering',
    description: 'Analyse a native binary and run a local Ghidra post-analysis script.',
    bins: ['analyzeHeadless'], envName: 'SPECTRE_GHIDRA_BIN', timeoutMs: 900_000,
    commandHint: 'analyzeHeadless <projectDir> spectre -import <binary> -postScript <script>',
    installHint: 'Set SPECTRE_GHIDRA_BIN to Ghidra support/analyzeHeadless',
    fields: [
      { name: 'binaryPath', label: 'Native binary path on server', type: 'text', required: true, placeholder: 'data/mobile/libnative.so' },
      { name: 'scriptPath', label: 'Ghidra script path on server', type: 'text', required: true, placeholder: 'data/mobile/Export.java' },
    ],
    buildArgs: (p) => [p.projectDir, 'spectre', '-import', p.binaryPath, '-scriptPath', dirname(p.scriptPath), '-postScript', basename(p.scriptPath), '-analysisTimeoutPerFile', '600'],
  },
  {
    id: 'burp', name: 'Burp Suite', category: 'Network & Web',
    description: 'Crawl and actively scan a web application through Burp Suite Professional’s REST API.',
    bins: [process.execPath], apiConfig: ['SPECTRE_BURP_URL', 'SPECTRE_BURP_API_KEY'], blocksLocalhost: true,
    commandHint: 'Burp REST API · start scan → stream progress → issues',
    installHint: 'Enable Burp REST API; set SPECTRE_BURP_URL and SPECTRE_BURP_API_KEY', timeoutMs: 1_800_000,
    fields: [{ name: 'target', label: 'Target URL', type: 'text', required: true, placeholder: 'https://example.test' }],
    buildArgs: (p) => [apiRunnerPath(), 'burp', p.target],
  },
  {
    id: 'nessus', name: 'Nessus', category: 'Network & Web',
    description: 'Run a vulnerability scan with an existing Nessus policy and stream its status.',
    bins: [process.execPath], apiConfig: ['SPECTRE_NESSUS_URL', 'SPECTRE_NESSUS_ACCESS_KEY', 'SPECTRE_NESSUS_SECRET_KEY'], blocksLocalhost: true,
    commandHint: 'Nessus REST API · policy → scan → findings',
    installHint: 'Configure SPECTRE_NESSUS_URL, SPECTRE_NESSUS_ACCESS_KEY and SPECTRE_NESSUS_SECRET_KEY', timeoutMs: 1_800_000,
    fields: [
      { name: 'target', label: 'Target host', type: 'text', required: true, placeholder: '192.0.2.10' },
      { name: 'policyId', label: 'Existing policy ID', type: 'number', required: true },
    ],
    buildArgs: (p) => [apiRunnerPath(), 'nessus', p.target, p.policyId],
  },
  {
    id: 'nuclei', name: 'Nuclei', category: 'Network & Web',
    description: 'Scan with Nuclei templates and return JSON Lines findings.',
    bins: ['nuclei'], envName: 'SPECTRE_NUCLEI_BIN', blocksLocalhost: true, timeoutMs: 600_000,
    commandHint: 'nuclei -u <target> -t <templates> -jsonl -rl 10', installHint: 'sudo apt install nuclei',
    fields: [
      { name: 'target', label: 'Target URL', type: 'text', required: true, placeholder: 'https://example.test' },
      { name: 'templates', label: 'Template paths (comma-separated, optional)', type: 'text', placeholder: 'data/templates/headers.yaml' },
    ],
    buildArgs: (p) => ['-u', p.target, ...p.templates.split(',').filter(Boolean).flatMap((template) => ['-t', template]), '-jsonl', '-no-color', '-disable-update-check', '-rate-limit', '10'],
  },
  {
    id: 'credential-audit', name: 'Credential Auditing (Hydra)', category: 'Credential & Protocol Auditing',
    description: 'Audit one account using a password wordlist, service-specific ports and two workers.',
    bins: ['hydra'], envName: 'SPECTRE_HYDRA_BIN', blocksLocalhost: true, timeoutMs: 600_000,
    commandHint: 'hydra -l <user> -P <wordlist> -t 2 -W 3 -f <host> <service>', installHint: 'sudo apt install hydra',
    fields: [
      { name: 'target', label: 'Username@host (optional :port)', type: 'text', required: true, placeholder: 'auditor@192.0.2.10' },
      { name: 'service', label: 'Service', type: 'select', default: 'ssh', options: ['ssh', 'ftp', 'smb', 'rdp', 'http-get', 'https-get', 'mysql', 'postgres'].map((value) => ({ label: value, value })) },
      { name: 'wordlist', label: 'Password wordlist on server', type: 'text', required: true, placeholder: '/usr/share/wordlists/passwords.txt' },
    ],
    buildArgs: (p) => ['-I', '-l', p.username, '-P', p.wordlist, '-t', '2', '-W', '3', '-f', '-s', p.port, p.host, p.service, ...(['http-get', 'https-get'].includes(p.service) ? ['/'] : [])],
  },
  {
    id: 'protocol-audit', name: 'Protocol Auditing (Enum4linux-ng)', category: 'Credential & Protocol Auditing',
    description: 'Enumerate SMB, NetBIOS and Active Directory information with Enum4linux-ng.',
    bins: ['enum4linux-ng', 'enum4linux-ng.py'], envName: 'SPECTRE_ENUM4LINUX_NG_BIN', blocksLocalhost: true, timeoutMs: 300_000,
    commandHint: 'enum4linux-ng -A <target>', installHint: 'sudo apt install enum4linux-ng',
    fields: [{ name: 'target', label: 'Target host', type: 'text', required: true, placeholder: '192.0.2.10' }],
    buildArgs: (p) => ['-A', p.target],
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

// Directories to search in addition to $PATH. Node inherits the launcher's PATH,
// which under a desktop/systemd context often omits sbin — where john lives.
const EXTRA_DIRS = ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin'];

function isExecutableFile(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the first available binary from `bins` to an absolute path, searching
 * $PATH plus common sbin dirs. Returns null when none are installed.
 */
export function resolveBin(bins: string[]): string | null {
  const fromPath = (process.env.PATH || '').split(':').filter(Boolean);
  const dirs = Array.from(new Set([...fromPath, ...EXTRA_DIRS]));

  for (const bin of bins) {
    if (bin.includes('/')) {
      if (isExecutableFile(bin)) return bin;
      continue;
    }
    for (const dir of dirs) {
      const full = join(dir, bin);
      if (isExecutableFile(full)) return full;
    }
  }
  return null;
}

export interface ToolExecutionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onOutput?: (chunk: string) => void;
  cwd?: string;
}

export interface ToolExecutionResult {
  output: string;
  exitCode: number | null;
  data?: unknown;
  artifacts?: string[];
}

function configuredBinary(envName: string, fallback: string): string | null {
  const configured = process.env[envName]?.trim();
  return resolveBin(configured ? [configured] : [fallback]);
}

function apiRunnerPath() {
  return join(process.cwd(), 'scripts', 'spectre-api-tool.cjs');
}

export function toolBinary(tool: ToolDef): string | null {
  const configured = tool.envName && process.env[tool.envName]?.trim();
  return resolveBin(configured ? [configured] : tool.bins);
}

export function isToolAvailable(tool: ToolDef): boolean {
  return Boolean(toolBinary(tool)) && (tool.apiConfig || []).every((key) => Boolean(process.env[key]?.trim()));
}

function requireTool(id: string): { tool: ToolDef; bin: string } {
  const tool = getTool(id)!;
  const missing = (tool.apiConfig || []).filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new ToolExecutionError(`Configure ${missing.join(', ')} to use ${tool.name}`, 503);
  const bin = toolBinary(tool);
  if (!bin) throw new ToolExecutionError(`${tool.name} is not installed on this host`, 503);
  return { tool, bin };
}

function executeSpawn(
  bin: string,
  args: string[],
  label: string,
  options: ToolExecutionOptions,
): Promise<ToolExecutionResult> {
  if (options.signal?.aborted) {
    throw new ToolExecutionError(`${label} was cancelled`, 499);
  }
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    let timedOut = false;
    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let abort = () => {};

    const emit = (chunk: string) => {
      output += chunk;
      // Bound retained output while continuing to stream every chunk.
      if (output.length > 8_000_000) output = output.slice(-8_000_000);
      options.onOutput?.(chunk);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      options.signal?.removeEventListener('abort', abort);
    };
    const fail = (error: ToolExecutionError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(bin, args, { shell: false, cwd: options.cwd, detached: process.platform !== 'win32' });
    } catch (error) {
      fail(
        new ToolExecutionError(
          error instanceof Error ? error.message : `Failed to start ${label}`,
          500,
          output,
        ),
      );
      return;
    }

    const timeoutMs = options.timeoutMs ?? 180_000;
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        // The process may have finished between cancellation and delivery.
      }
    };
    const terminate = () => {
      kill('SIGTERM');
      if (!killTimer) killTimer = setTimeout(() => kill('SIGKILL'), 3000);
    };
    timer = setTimeout(() => {
      timedOut = true;
      emit(`\n${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.\n`);
      terminate();
    }, timeoutMs);

    abort = () => {
      aborted = true;
      terminate();
    };

    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });

    child.stdin.on('error', () => {});
    child.stdin.end();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', emit);
    child.stderr.on('data', emit);
    child.on('error', (error) => {
      emit(`Error: ${error.message}\n`);
      fail(new ToolExecutionError(error.message, 500, output));
    });
    child.on('close', (code) => {
      if (settled) return;
      cleanup();

      if (aborted) {
        fail(new ToolExecutionError(`${label} was cancelled`, 499, output));
        return;
      }
      if (timedOut) {
        fail(new ToolExecutionError(`${label} timed out`, 504, output));
        return;
      }
      if (code !== 0) {
        fail(new ToolExecutionError(`${label} exited with code ${code}`, 502, output));
        return;
      }

      settled = true;
      resolve({ output, exitCode: code });
    });
  });
}

export function executeNmap(
  targetValue: unknown,
  profileValue: unknown = 'Quick',
  options: ToolExecutionOptions = {},
): Promise<ToolExecutionResult> {
  const target = targetHost(normalizeScanTarget(targetValue));
  const profile = String(profileValue || 'Quick');
  const bin = configuredBinary('SPECTRE_NMAP_BIN', 'nmap');

  if (!bin) {
    throw new ToolExecutionError('Nmap is not installed on this host', 503);
  }

  const flags = NMAP_PROFILE_FLAGS[profile] || NMAP_PROFILE_FLAGS.Quick;
  return validateResolvedTarget(target).then(() => executeSpawn(bin, [...(target.includes(':') ? ['-6'] : []), ...flags.split(' '), target], 'Nmap', {
    ...options,
    timeoutMs: options.timeoutMs ?? 300_000,
  }));
}

export function executeNikto(
  targetValue: unknown,
  options: ToolExecutionOptions = {},
): Promise<ToolExecutionResult> {
  const target = normalizeScanTarget(targetValue);
  const bin = configuredBinary('SPECTRE_NIKTO_BIN', 'nikto');

  if (!bin) {
    throw new ToolExecutionError('Nikto is not installed on this host', 503);
  }

  return validateResolvedTarget(target).then(() => executeSpawn(bin, ['-h', target], 'Nikto', options));
}

function structuredResult(result: ToolExecutionResult): ToolExecutionResult {
  const records: unknown[] = [];
  for (const line of result.output.split('\n')) {
    try { records.push(JSON.parse(line)); } catch { /* Most CLIs also emit human-readable progress. */ }
  }
  const final = records.findLast((record) => Boolean(record) && typeof record === 'object' && (record as { type?: string }).type === 'result') as { data?: unknown } | undefined;
  return { ...result, data: final?.data ?? (records.length ? records : undefined) };
}

function executeRegistered(
  id: string,
  params: Record<string, string>,
  options: ToolExecutionOptions,
  networkTarget?: string,
): Promise<ToolExecutionResult> {
  const { tool, bin } = requireTool(id);
  const run = () => executeSpawn(bin, tool.buildArgs(params), tool.name, {
    ...options,
    timeoutMs: options.timeoutMs ?? tool.timeoutMs ?? 180_000,
  }).then(structuredResult);
  return networkTarget ? validateResolvedTarget(networkTarget).then(run) : run();
}

function withArtifacts(execution: Promise<ToolExecutionResult>, artifacts: string[], options: ToolExecutionOptions) {
  return execution.then((result) => {
    const summary = `\n${JSON.stringify({ artifacts })}\n`;
    options.onOutput?.(summary);
    return { ...result, output: result.output + summary, artifacts };
  });
}

function newOutput(id: string, extension = ''): string {
  const root = process.env.SPECTRE_TOOL_OUTPUT_DIR || join(process.cwd(), 'data', 'tool-output');
  const output = localPath(join(root, `${id}-${randomUUID()}${extension}`), 'output', 'Output path');
  mkdirSync(dirname(output), { recursive: true });
  return output;
}

export type MobSFMode = 'static' | 'dynamic';
export function executeMobSF(filePath: string, mode: MobSFMode = 'static', options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const file = localPath(filePath, 'file', 'APK / IPA path');
  if (!['.apk', '.ipa'].includes(extname(file).toLowerCase())) throw new ToolExecutionError('MobSF requires an APK or IPA', 400);
  enumValue(mode, ['static', 'dynamic'], 'Mode');
  if (mode === 'dynamic' && file.toLowerCase().endsWith('.ipa') && !process.env.SPECTRE_MOBSF_IOS_DEVICE_ID) {
    throw new ToolExecutionError('Configure SPECTRE_MOBSF_IOS_DEVICE_ID for dynamic IPA analysis', 503);
  }
  return executeRegistered('mobsf', { filePath: file, mode }, options);
}

export function executeDrozer(target: string, module: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = normalizeScanTarget(target);
  if (normalized.includes('://') || normalized.includes('/')) throw new ToolExecutionError('Drozer requires an agent host, optionally with a port', 400);
  const command = requiredText(module, 'Drozer module');
  if (!/^[a-zA-Z][\w.]+(?: +[\w./:@=-]+)*$/.test(command)) throw new ToolExecutionError('Invalid Drozer module or arguments', 400);
  return executeRegistered('drozer', { target: normalized, module: command }, options, normalized);
}

export function executeFrida(target: string, script: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const file = localPath(script, 'file', 'Frida script');
  if (!['.js', '.mjs'].includes(extname(file).toLowerCase())) throw new ToolExecutionError('Frida requires a JavaScript file', 400);
  return executeRegistered('frida', { target: appTarget(target), script: file }, options);
}

export function executeObjection(target: string, command: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = requiredText(command, 'Objection command');
  if (/[;&|`$<>!]/.test(normalized) || normalized.startsWith('-')) throw new ToolExecutionError('Use a single Objection command without shell operators', 400);
  return executeRegistered('objection', { target: appTarget(target), command: normalized }, options);
}

export function executeJadx(apkPath: string, outputDir: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const apk = localPath(apkPath, 'file', 'APK path');
  if (extname(apk).toLowerCase() !== '.apk') throw new ToolExecutionError('JADX requires an APK', 400);
  const output = localPath(outputDir, 'output', 'Output directory');
  requireTool('jadx');
  mkdirSync(dirname(output), { recursive: true });
  return withArtifacts(executeRegistered('jadx', { apkPath: apk, outputDir: output }, options), [output], options);
}

export type ApktoolMode = 'decode' | 'build';
export function executeApktool(apkPath: string, mode: ApktoolMode = 'decode', options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  enumValue(mode, ['decode', 'build'], 'Mode');
  const apk = localPath(apkPath, mode === 'build' ? 'directory' : 'file', 'APK / decoded directory');
  if (mode === 'decode' && extname(apk).toLowerCase() !== '.apk') throw new ToolExecutionError('Decode requires an APK file', 400);
  if (mode === 'build') localPath(join(apk, 'apktool.yml'), 'file', 'Decoded APK metadata');
  requireTool('apktool');
  const output = newOutput('apktool', mode === 'build' ? '.apk' : '');
  return withArtifacts(executeRegistered('apktool', { apkPath: apk, mode, outputPath: output }, options), [output], options);
}

export function executeGhidraHeadless(binaryPath: string, scriptPath: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const binary = localPath(binaryPath, 'file', 'Native binary');
  const script = localPath(scriptPath, 'file', 'Ghidra script');
  if (!['.java', '.py'].includes(extname(script).toLowerCase())) throw new ToolExecutionError('Use a Ghidra .java or .py script', 400);
  requireTool('ghidra');
  const projectDir = newOutput('ghidra');
  mkdirSync(projectDir);
  return withArtifacts(executeRegistered('ghidra', { binaryPath: binary, scriptPath: script, projectDir }, options), [projectDir], options);
}

export function executeBurpScan(target: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = webTarget(target);
  return executeRegistered('burp', { target: normalized }, options, normalized);
}

export function executeNessusScan(target: string, policyId: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = targetHost(normalizeScanTarget(target));
  if (normalized.includes('/')) throw new ToolExecutionError('Nessus requires one target host', 400);
  const policy = requiredText(policyId, 'Policy ID', 16);
  if (!/^[1-9]\d*$/.test(policy) || !Number.isSafeInteger(Number(policy))) throw new ToolExecutionError('Policy ID must be a positive integer', 400);
  return executeRegistered('nessus', { target: normalized, policyId: policy }, options, normalized);
}

export function executeNuclei(target: string, templates: string = '', options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = webTarget(target);
  if (typeof templates !== 'string') throw new ToolExecutionError('Templates must be comma-separated paths', 400);
  const paths = templates.split(',').map((path) => path.trim()).filter(Boolean).map((path) => {
    let kind: 'directory' | 'file' = 'file';
    try { if (statSync(path).isDirectory()) kind = 'directory'; } catch { /* localPath reports the validation error. */ }
    return localPath(path, kind, 'Template path');
  });
  return executeRegistered('nuclei', { target: normalized, templates: paths.join(',') }, options, normalized);
}

const SERVICE_PORTS = { ssh: 22, ftp: 21, smb: 445, rdp: 3389, 'http-get': 80, 'https-get': 443, mysql: 3306, postgres: 5432 } as const;
export type AuditService = keyof typeof SERVICE_PORTS;
export function executeCredentialAudit(target: string, service: AuditService, wordlist: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  enumValue(service, Object.keys(SERVICE_PORTS) as AuditService[], 'Service');
  const input = requiredText(target, 'Username@host');
  let parsed: URL;
  try { parsed = new URL(`tcp://${input}`); } catch { throw new ToolExecutionError('Use username@host or username@host:port', 400); }
  if (parsed.password || (parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) throw new ToolExecutionError('Use username@host or username@host:port without a password', 400);
  let username: string;
  try { username = decodeURIComponent(parsed.username) || process.env.SPECTRE_AUDIT_USERNAME || ''; }
  catch { throw new ToolExecutionError('Invalid account encoding', 400); }
  if (!/^[a-zA-Z0-9_.@\\-]{1,128}$/.test(username) || username.startsWith('-')) throw new ToolExecutionError('Supply the account as username@host (or set SPECTRE_AUDIT_USERNAME)', 400);
  const host = normalizeScanTarget(parsed.hostname.replace(/^\[|\]$/g, ''));
  const port = parsed.port || String(SERVICE_PORTS[service]);
  if (Number(port) < 1) throw new ToolExecutionError('Port must be between 1 and 65535', 400);
  const file = localPath(wordlist, 'wordlist', 'Password wordlist');
  return executeRegistered('credential-audit', { host, username, port, service, wordlist: file }, options, host);
}

export function executeProtocolAudit(target: string, options: ToolExecutionOptions = {}): Promise<ToolExecutionResult> {
  const normalized = targetHost(normalizeScanTarget(target));
  if (normalized.includes('/')) throw new ToolExecutionError('Protocol auditing requires one target host', 400);
  return executeRegistered('protocol-audit', { target: normalized }, options, normalized);
}
