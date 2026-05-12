'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, Shield, Info,
  RefreshCw, Trash2, Download, ChevronDown, ChevronRight,
  Target, Wrench, Clock
} from 'lucide-react';

interface Vulnerability {
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

const SEVERITY_CONFIG = {
  HIGH:   { color: 'text-[#e53935]', bg: 'bg-[#e53935]/10', border: 'border-[#e53935]/30', icon: ShieldAlert, label: 'HIGH' },
  MEDIUM: { color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/30', icon: Shield,      label: 'MEDIUM' },
  LOW:    { color: 'text-[#00c853]', bg: 'bg-[#00c853]/10', border: 'border-[#00c853]/30', icon: ShieldCheck,  label: 'LOW' },
  INFO:   { color: 'text-[#6b7280]', bg: 'bg-[#6b7280]/10', border: 'border-[#6b7280]/30', icon: Info,         label: 'INFO' },
};

function SeverityBadge({ severity }: { severity: Vulnerability['severity'] }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold font-mono ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {severity}
    </span>
  );
}

function VulnCard({ vuln, expanded, onToggle }: {
  vuln: Vulnerability;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = SEVERITY_CONFIG[vuln.severity];
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${expanded ? `border-l-2 ${cfg.border} border-[#1f1f1f]` : 'border-[#1f1f1f] hover:border-[#2f2f2f]'} bg-[#0d0d0d]`}>
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon size={16} className={cfg.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={vuln.severity} />
            <span className="text-white text-sm font-medium truncate">{vuln.service}</span>
            {vuln.port && (
              <span className="text-[#6b7280] text-xs font-mono">:{vuln.port}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[#6b7280] text-xs flex items-center gap-1">
              <Target size={10} />
              {vuln.target}
            </span>
            <span className="text-[#6b7280] text-xs flex items-center gap-1">
              <Wrench size={10} />
              {vuln.tool}
            </span>
            <span className="text-[#6b7280] text-xs flex items-center gap-1">
              <Clock size={10} />
              {new Date(vuln.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-[#6b7280] flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[#6b7280] flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#1f1f1f] px-4 py-4 space-y-4">
          <div>
            <p className="text-[#6b7280] text-xs font-medium uppercase tracking-wider mb-1.5">Finding</p>
            <p className="text-[#c9d1d9] text-sm leading-relaxed">{vuln.description}</p>
          </div>
          <div>
            <p className="text-[#6b7280] text-xs font-medium uppercase tracking-wider mb-1.5">Remediation</p>
            <div className="bg-[#080808] border border-[#00c853]/20 rounded p-3">
              <p className="text-[#00c853] text-sm leading-relaxed">{vuln.remediation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FilterSeverity = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export default function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterSeverity>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchVulns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vulnerabilities');
      const data = await res.json();
      setVulns(data.vulnerabilities ?? []);
    } catch {
      setVulns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVulns(); }, [fetchVulns]);

  const clearAll = async () => {
    if (!confirm('Clear all vulnerabilities? This cannot be undone.')) return;
    setClearing(true);
    await fetch('/api/vulnerabilities', { method: 'DELETE' });
    setVulns([]);
    setClearing(false);
  };

  const exportReport = () => {
    const lines: string[] = [
      'SPECTRE — Vulnerability Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Total findings: ${vulns.length}`,
      '='.repeat(60),
      '',
    ];

    for (const sev of ['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const) {
      const group = vulns.filter((v) => v.severity === sev);
      if (group.length === 0) continue;
      lines.push(`[${sev}] — ${group.length} finding(s)`);
      lines.push('-'.repeat(40));
      for (const v of group) {
        lines.push(`Target   : ${v.target}`);
        lines.push(`Service  : ${v.service}${v.port ? ` (${v.port})` : ''}`);
        lines.push(`Tool     : ${v.tool}`);
        lines.push(`Finding  : ${v.description}`);
        lines.push(`Remedy   : ${v.remediation}`);
        lines.push('');
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spectre-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter === 'ALL' ? vulns : vulns.filter((v) => v.severity === filter);

  const counts = {
    HIGH:   vulns.filter((v) => v.severity === 'HIGH').length,
    MEDIUM: vulns.filter((v) => v.severity === 'MEDIUM').length,
    LOW:    vulns.filter((v) => v.severity === 'LOW').length,
    INFO:   vulns.filter((v) => v.severity === 'INFO').length,
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] flex-shrink-0">
        <div>
          <h1 className="text-white font-semibold">Vulnerabilities</h1>
          <p className="text-[#6b7280] text-xs mt-0.5">
            {vulns.length} total finding{vulns.length !== 1 ? 's' : ''} from scans
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVulns}
            className="flex items-center gap-1.5 text-[#6b7280] hover:text-white text-xs border border-[#1f1f1f] hover:border-[#2f2f2f] rounded px-3 py-1.5 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportReport}
            disabled={vulns.length === 0}
            className="flex items-center gap-1.5 text-[#00c853] text-xs border border-[#00c853]/30 hover:border-[#00c853]/60 bg-[#00c853]/10 hover:bg-[#00c853]/20 rounded px-3 py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            Export Report
          </button>
          <button
            onClick={clearAll}
            disabled={clearing || vulns.length === 0}
            className="flex items-center gap-1.5 text-[#e53935] text-xs border border-[#e53935]/30 hover:border-[#e53935]/60 bg-[#e53935]/10 hover:bg-[#e53935]/20 rounded px-3 py-1.5 transition-all disabled:opacity-40"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Severity summary cards */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 flex-shrink-0">
        {(['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => {
          const cfg = SEVERITY_CONFIG[sev];
          const Icon = cfg.icon;
          return (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? 'ALL' : sev)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                filter === sev
                  ? `${cfg.bg} ${cfg.border}`
                  : 'bg-[#0d0d0d] border-[#1f1f1f] hover:border-[#2f2f2f]'
              }`}
            >
              <Icon size={18} className={cfg.color} />
              <div>
                <p className={`text-lg font-bold font-mono ${cfg.color}`}>{counts[sev]}</p>
                <p className="text-[#6b7280] text-xs">{sev}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 pb-3 flex-shrink-0">
        {(['ALL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as FilterSeverity[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded font-mono transition-all ${
              filter === f
                ? 'bg-[#00c853]/20 text-[#00c853] border border-[#00c853]/30'
                : 'text-[#6b7280] hover:text-white border border-transparent'
            }`}
          >
            {f} {f !== 'ALL' && `(${counts[f as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {/* Vulnerability list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="text-[#00c853] animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShieldCheck size={36} className="text-[#1f1f1f]" />
            <p className="text-[#6b7280] text-sm">
              {vulns.length === 0
                ? 'No findings yet — run a scan from the Tools page'
                : `No ${filter} severity findings`}
            </p>
          </div>
        )}

        {!loading && filtered.map((vuln) => (
          <VulnCard
            key={vuln.id}
            vuln={vuln}
            expanded={expandedId === vuln.id}
            onToggle={() => setExpandedId(expandedId === vuln.id ? null : vuln.id)}
          />
        ))}
      </div>
    </div>
  );
}
