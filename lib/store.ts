import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

export interface Vulnerability {
  id: string;
  target: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  service: string;
  port?: string;
  description: string;
  remediation: string;
  tool: 'nmap' | 'nikto' | 'manual';
  timestamp: string;
}

export interface ScanRecord {
  id: string;
  target: string;
  tool: 'nmap' | 'nikto';
  output: string;
  timestamp: string;
  vulnerabilities: Vulnerability[];
}

interface Store {
  scans: ScanRecord[];
  vulnerabilities: Vulnerability[];
}

function readStore(): Store {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify({ scans: [], vulnerabilities: [] }));
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return { scans: [], vulnerabilities: [] };
  }
}

function writeStore(data: Store): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function saveScan(scan: ScanRecord): void {
  const store = readStore();
  store.scans.unshift(scan); // newest first
  // merge vulnerabilities, avoid duplicates by id
  const existingIds = new Set(store.vulnerabilities.map((v) => v.id));
  for (const v of scan.vulnerabilities) {
    if (!existingIds.has(v.id)) store.vulnerabilities.unshift(v);
  }
  writeStore(store);
}

export function getVulnerabilities(): Vulnerability[] {
  return readStore().vulnerabilities;
}

export function getScans(): ScanRecord[] {
  return readStore().scans;
}

export function clearVulnerabilities(): void {
  const store = readStore();
  store.vulnerabilities = [];
  writeStore(store);
}

// Parse nmap output into structured vulnerabilities
export function parseNmapOutput(output: string, target: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match open port lines: "80/tcp   open  http    Apache httpd 2.4.7"
    const portMatch = line.match(/^(\d+)\/(tcp|udp)\s+open\s+(\S+)\s*(.*)?$/);
    if (!portMatch) continue;

    const [, port, proto, service, version] = portMatch;
    const serviceLabel = version ? `${service} (${version.trim()})` : service;

    // Severity heuristics based on service/port
    const severity = getSeverity(port, service, version || '');

    vulns.push({
      id: `nmap-${target}-${port}-${Date.now()}`,
      target,
      severity,
      service: serviceLabel,
      port: `${port}/${proto}`,
      description: getDescription(port, service, version || ''),
      remediation: getRemediation(port, service),
      tool: 'nmap',
      timestamp: new Date().toISOString(),
    });
  }

  return vulns;
}

// Parse nikto output into vulnerabilities
export function parseNiktoOutput(output: string, target: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.startsWith('+ ') && !line.startsWith('- ')) continue;
    const clean = line.replace(/^[+-]\s+/, '').trim();
    if (!clean || clean.startsWith('Target') || clean.startsWith('Start Time')) continue;

    const severity: Vulnerability['severity'] =
      /critical|rce|injection|exec/i.test(clean) ? 'HIGH' :
      /warning|outdated|version|server:/i.test(clean) ? 'MEDIUM' : 'LOW';

    vulns.push({
      id: `nikto-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      target,
      severity,
      service: 'HTTP',
      description: clean,
      remediation: getNiktoRemediation(clean),
      tool: 'nikto',
      timestamp: new Date().toISOString(),
    });
  }

  return vulns;
}

function getSeverity(port: string, service: string, version: string): Vulnerability['severity'] {
  const highRiskPorts = ['21', '23', '445', '1433', '3306', '5432', '6379', '27017'];
  const mediumPorts = ['22', '25', '53', '110', '143', '3389', '5900'];
  if (highRiskPorts.includes(port)) return 'HIGH';
  if (mediumPorts.includes(port)) return 'MEDIUM';
  if (/old|vuln|outdated/i.test(version)) return 'HIGH';
  if (port === '80' || port === '8080') return 'MEDIUM';
  if (port === '443') return 'LOW';
  return 'INFO';
}

function getDescription(port: string, service: string, version: string): string {
  const descriptions: Record<string, string> = {
    '21': `FTP service detected${version ? ` running ${version}` : ''}. FTP transmits credentials in cleartext and may allow anonymous login.`,
    '22': `SSH service detected${version ? ` (${version})` : ''}. Verify key-based auth is enforced and root login is disabled.`,
    '23': `Telnet service detected. Transmits all data including credentials in cleartext. Should be disabled.`,
    '80': `HTTP web server detected${version ? ` (${version})` : ''}. Service accessible without encryption.`,
    '443': `HTTPS web server detected${version ? ` (${version})` : ''}. Verify TLS version and certificate validity.`,
    '445': `SMB/CIFS service detected. Commonly exploited for lateral movement and ransomware delivery.`,
    '3306': `MySQL database exposed${version ? ` (${version})` : ''}. Database should not be directly accessible from the network.`,
    '5432': `PostgreSQL database exposed. Database should not be directly accessible from the network.`,
    '3389': `RDP service detected. High-value target for brute force and credential attacks.`,
    '6379': `Redis service detected. Often runs without authentication, allowing unauthenticated data access.`,
  };
  return descriptions[port] || `${service} service detected on port ${port}${version ? ` (${version})` : ''}.`;
}

function getRemediation(port: string, service: string): string {
  const remediations: Record<string, string> = {
    '21': 'Disable FTP if not required. If needed, migrate to SFTP or FTPS. Disable anonymous login.',
    '22': 'Enforce key-based authentication. Disable root login. Restrict access by IP if possible.',
    '23': 'Disable Telnet immediately. Replace with SSH for remote administration.',
    '80': 'Redirect HTTP to HTTPS. Implement TLS with a valid certificate.',
    '443': 'Ensure TLS 1.2+ is enforced. Disable TLS 1.0/1.1 and weak ciphers.',
    '445': 'Restrict SMB to internal use only. Apply latest patches (EternalBlue). Disable SMBv1.',
    '3306': 'Bind MySQL to localhost only. Use firewall rules to block external access.',
    '5432': 'Bind PostgreSQL to localhost only. Enforce strong passwords and TLS connections.',
    '3389': 'Enable Network Level Authentication. Restrict RDP to VPN or specific IPs.',
    '6379': 'Enable Redis AUTH. Bind to localhost. Never expose Redis directly to the internet.',
  };
  return remediations[port] || `Review whether ${service} on port ${port} needs to be publicly accessible. Apply vendor patches and restrict access where possible.`;
}

function getNiktoRemediation(finding: string): string {
  if (/x-frame-options/i.test(finding)) return 'Add X-Frame-Options: DENY or SAMEORIGIN header to prevent clickjacking.';
  if (/x-content-type/i.test(finding)) return 'Add X-Content-Type-Options: nosniff header.';
  if (/server:/i.test(finding)) return 'Remove or obscure the Server header to avoid fingerprinting.';
  if (/outdated|old version/i.test(finding)) return 'Update the software to the latest stable version.';
  if (/directory index/i.test(finding)) return 'Disable directory listing in web server configuration.';
  if (/cookie/i.test(finding)) return 'Set HttpOnly and Secure flags on all cookies.';
  return 'Review the finding and apply vendor-recommended security hardening.';
}
