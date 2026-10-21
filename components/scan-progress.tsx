import { CheckCircle2, Loader2, Radar, XCircle } from 'lucide-react';
import type { ScanStatus } from '@/hooks/use-scan';

export default function ScanProgress({ status, elapsed }: { status: ScanStatus; elapsed: number }) {
  const running = status === 'running';
  const Icon = running ? Loader2 : status === 'complete' ? CheckCircle2 : status === 'error' ? XCircle : Radar;
  const label = running ? 'Scanning locally' : status === 'complete' ? 'Scan complete' : status === 'cancelled' ? 'Scan cancelled' : status === 'error' ? 'Scan failed' : 'Ready to scan';
  return (
    <div className={`rounded-lg border p-3 transition-colors duration-300 ${status === 'error' ? 'border-spectre-danger/40 text-spectre-danger' : running || status === 'complete' ? 'border-spectre-accent/30 text-spectre-accent bg-spectre-accent/5' : 'border-spectre-border text-spectre-muted'}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span role="status" className="flex items-center gap-2"><Icon size={15} className={running ? 'animate-spin' : ''} />{label}</span>
        {status !== 'idle' && <span className="tabular-nums text-spectre-muted">{elapsed}s</span>}
      </div>
      {running && (
        <div role="progressbar" aria-label="Scan in progress" aria-valuetext="Scanning; duration depends on target" className="mt-3 h-1 overflow-hidden rounded-full bg-spectre-border">
          <div className="h-full w-1/3 rounded-full bg-spectre-accent animate-scan-sweep motion-reduce:animate-none" />
        </div>
      )}
    </div>
  );
}
