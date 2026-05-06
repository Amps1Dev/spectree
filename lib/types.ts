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
