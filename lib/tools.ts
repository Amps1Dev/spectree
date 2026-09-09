// Central registry of the pentest tools SpecTree can run.
//
// Each entry is pure data + two small pure functions (buildArgs / follow) that
// map user-supplied field values to a process argv. The dynamic API route
// (app/api/tools/[tool]/route.ts) and the metadata route (app/api/tools/route.ts)
// both read from here, so adding a tool means adding one object below — no new
// route or component.
//
// Safety: the executor always spawns with shell:false, so every value produced
// by buildArgs becomes a literal argv entry and can never be interpreted by a
// shell. Keep it that way — never assemble a shell string from these.

import { accessSync, constants, statSync } from 'fs';
import { join } from 'path';

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
  | 'Recon'
  | 'Web'
  | 'Network'
  | 'SMB / AD'
  | 'Credentials'
  | 'Exploits'
  | 'System';

export interface ToolDef {
  /** URL slug + stable id, e.g. 'wpscan'. */
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** Binary candidates; the first one found on the host wins. */
  bins: string[];
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
    category: 'Network',
    bins: ['nmap'],
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
    category: 'Web',
    bins: ['nikto'],
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
    category: 'Web',
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
    category: 'Recon',
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
    category: 'SMB / AD',
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
    category: 'Recon',
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
    category: 'Exploits',
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
    category: 'Network',
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
    category: 'Credentials',
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
    category: 'System',
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
    category: 'Network',
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
    category: 'SMB / AD',
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
