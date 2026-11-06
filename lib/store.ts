import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const STORE_PATH =
  process.env.SPECTRE_STORE_PATH || path.join(process.cwd(), 'data', 'store.json');

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ScanTool = 'nmap' | 'nikto';

export interface EngagementTarget {
  ip: string;
  label?: string;
  notes?: string;
}

export interface Vulnerability {
  id: string;
  engagementId: string;
  target: string;
  severity: Severity;
  service: string;
  port?: string;
  description: string;
  remediation: string;
  tool: ScanTool | 'manual';
  timestamp: string;
}

export interface ScanRecord {
  id: string;
  engagementId: string;
  target: string;
  tool: ScanTool;
  output: string;
  timestamp: string;
  vulnerabilities: Vulnerability[];
}

export interface EngagementRecord {
  id: string;
  targets: EngagementTarget[];
  tools: ScanTool[];
  createdAt: string;
}

interface Store {
  scans: ScanRecord[];
  vulnerabilities: Vulnerability[];
  engagements: EngagementRecord[];
}

const EMPTY_STORE: Store = {
  scans: [],
  vulnerabilities: [],
  engagements: [],
};

function normalizeStore(value: Partial<Store> | null): Store {
  const scans = value?.scans;
  const vulnerabilities = value?.vulnerabilities;
  const engagements = value?.engagements;

  return {
    scans: Array.isArray(scans) ? scans : [],
    vulnerabilities: Array.isArray(vulnerabilities) ? vulnerabilities : [],
    engagements: Array.isArray(engagements) ? engagements : [],
  };
}

function ensureStoreDirectory() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

function readStore(): Store {
  try {
    ensureStoreDirectory();
    if (!fs.existsSync(STORE_PATH)) return { ...EMPTY_STORE };
    return normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')));
  } catch (error) {
    console.error('Failed to read SPECTRE store:', error);
    return { ...EMPTY_STORE };
  }
}

function writeStore(store: Store) {
  ensureStoreDirectory();
  const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(temporaryPath, STORE_PATH);
}

export function saveEngagement(engagement: EngagementRecord): void {
  const store = readStore();
  store.engagements = [
    engagement,
    ...store.engagements.filter((item) => item.id !== engagement.id),
  ];
  writeStore(store);
}

export function getEngagements(): EngagementRecord[] {
  return readStore().engagements;
}

export function saveScan(scan: ScanRecord): void {
  const store = readStore();
  store.scans.unshift(scan);

  const existingIds = new Set(store.vulnerabilities.map((finding) => finding.id));
  for (const vulnerability of scan.vulnerabilities) {
    if (!existingIds.has(vulnerability.id)) {
      store.vulnerabilities.unshift({
        ...vulnerability,
        engagementId: scan.engagementId,
      });
      existingIds.add(vulnerability.id);
    }
  }

  writeStore(store);
}

export function getVulnerabilities(): Vulnerability[] {
  return readStore().vulnerabilities;
}

export function getScans(): ScanRecord[] {
  return readStore().scans;
}

export function parseNmapOutput(
  output: string,
  target: string,
  engagementId: string,
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  for (const line of output.split('\n')) {
    const portMatch = line.match(/^(\d+)\/(tcp|udp)\s+open\s+(\S+)\s*(.*)?$/);
    if (!portMatch) continue;

    const [, port, protocol, service, rawVersion] = portMatch;
    const version = rawVersion?.trim() || '';

    vulnerabilities.push({
      id: randomUUID(),
      engagementId,
      target,
      severity: getNmapSeverity(port, version),
      service: version ? `${service} (${version})` : service,
      port: `${port}/${protocol}`,
      description: getNmapDescription(port, service, version),
      remediation: getNmapRemediation(port, service),
      tool: 'nmap',
      timestamp: new Date().toISOString(),
    });
  }

  return vulnerabilities;
}

export function parseNiktoOutput(
  output: string,
  target: string,
  engagementId: string,
): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  for (const line of output.split('\n')) {
    if (!line.startsWith('+ ') && !line.startsWith('- ')) continue;
    const finding = line.replace(/^[+-]\s+/, '').trim();

    if (
      !finding ||
      /^(Target|Start Time|End Time|\d+ host)/i.test(finding)
    ) {
      continue;
    }

    const severity: Severity = /critical|rce|injection|remote code|exec/i.test(
      finding,
    )
      ? 'HIGH'
      : /warning|outdated|version|server:/i.test(finding)
        ? 'MEDIUM'
        : 'LOW';

    vulnerabilities.push({
      id: randomUUID(),
      engagementId,
      target,
      severity,
      service: 'HTTP',
      description: finding,
      remediation: getNiktoRemediation(finding),
      tool: 'nikto',
      timestamp: new Date().toISOString(),
    });
  }

  return vulnerabilities;
}

function getNmapSeverity(port: string, version: string): Severity {
  const highRiskPorts = ['21', '23', '445', '1433', '3306', '5432', '6379', '27017'];
  const mediumRiskPorts = ['22', '25', '53', '110', '143', '3389', '5900'];

  if (highRiskPorts.includes(port)) return 'HIGH';
  if (mediumRiskPorts.includes(port)) return 'MEDIUM';
  if (/old|vuln|outdated/i.test(version)) return 'HIGH';
  if (port === '80' || port === '8080') return 'MEDIUM';
  if (port === '443') return 'LOW';
  return 'INFO';
}

function getNmapDescription(port: string, service: string, version: string) {
  const descriptions: Record<string, string> = {
    '21': `FTP service detected${version ? ` running ${version}` : ''}. FTP may expose credentials in cleartext or allow anonymous access.`,
    '22': `SSH service detected${version ? ` (${version})` : ''}. Verify key-based authentication and disable direct root login.`,
    '23': 'Telnet service detected. Telnet transmits credentials and session data in cleartext.',
    '80': `HTTP service detected${version ? ` (${version})` : ''}. Traffic is accessible without transport encryption.`,
    '443': `HTTPS service detected${version ? ` (${version})` : ''}. Review the TLS configuration and certificate chain.`,
    '445': 'SMB service detected. Exposed SMB can enable credential theft and lateral movement.',
    '3306': `MySQL service exposed${version ? ` (${version})` : ''}. Database services should normally be network-restricted.`,
    '5432': 'PostgreSQL service exposed. Database access should be limited to trusted application networks.',
    '3389': 'RDP service detected. RDP is a common target for credential and brute-force attacks.',
    '6379': 'Redis service detected. Misconfigured Redis commonly allows unauthenticated data access.',
  };

  return (
    descriptions[port] ||
    `${service} service detected on port ${port}${version ? ` (${version})` : ''}.`
  );
}

function getNmapRemediation(port: string, service: string) {
  const remediations: Record<string, string> = {
    '21': 'Disable FTP or migrate to SFTP/FTPS and disable anonymous authentication.',
    '22': 'Enforce key-based authentication, disable root login, and restrict source networks.',
    '23': 'Disable Telnet and replace it with SSH.',
    '80': 'Redirect HTTP to HTTPS and deploy a valid TLS certificate.',
    '443': 'Require TLS 1.2 or newer and disable weak protocols and cipher suites.',
    '445': 'Restrict SMB to trusted networks, disable SMBv1, and apply current security patches.',
    '3306': 'Bind MySQL to trusted interfaces and restrict access with firewall rules.',
    '5432': 'Restrict PostgreSQL network access and require TLS and strong authentication.',
    '3389': 'Require Network Level Authentication and limit RDP access through a VPN.',
    '6379': 'Enable authentication, bind Redis to trusted interfaces, and block public access.',
  };

  return (
    remediations[port] ||
    `Confirm that ${service} on port ${port} is required, patched, and restricted to trusted clients.`
  );
}

function getNiktoRemediation(finding: string) {
  if (/x-frame-options/i.test(finding)) {
    return 'Add an X-Frame-Options or Content-Security-Policy frame-ancestors directive.';
  }
  if (/x-content-type/i.test(finding)) {
    return 'Add the X-Content-Type-Options: nosniff response header.';
  }
  if (/server:/i.test(finding)) {
    return 'Remove unnecessary server version disclosure from response headers.';
  }
  if (/outdated|old version/i.test(finding)) {
    return 'Upgrade the affected server or component to a supported patched version.';
  }
  if (/directory index/i.test(finding)) {
    return 'Disable directory listing and restrict direct access to sensitive paths.';
  }
  if (/cookie/i.test(finding)) {
    return 'Apply Secure, HttpOnly, and appropriate SameSite attributes to cookies.';
  }
  return 'Review the finding, validate exposure, and apply vendor-recommended hardening.';
}
