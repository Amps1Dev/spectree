export interface ScanResult {
  id: string;
  tool: 'nmap' | 'nikto';
  target: string;
  profile?: string;
  output: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  createdAt: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface Report {
  id: string;
  engagementName: string;
  targetIp: string;
  findings: string;
  reportContent: string;
  createdAt: string;
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface ReportFinding {
  title: string;
  severity: Severity;
  description: string;
  /** Optional extras the model may or may not supply. */
  remediation?: string;
  affected?: string;
}

/** The structured report returned by /api/report and rendered by the UI. */
export interface ReportData {
  executiveSummary: string;
  scope: string;
  findings: ReportFinding[];
  recommendations: string;
  conclusion: string;
}

/** A generated report persisted to localStorage (see lib/local-store.ts). */
export interface SavedReport {
  id: string;
  engagementName: string;
  targetIp: string;
  /** The raw findings/notes the user pasted in. */
  findings: string;
  report: ReportData;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  target?: string;
  tool?: string;
  createdAt: string;
}

export interface SessionContext {
  targetIp?: string;
  suggestedSteps: string[];
}
