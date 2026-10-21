'use client';

import { useEffect, useRef, useState } from 'react';
import { recordActivity, recordScanRun } from '@/lib/local-store';
import { readScanStream } from '@/lib/scan-stream';

export type ScanStatus = 'idle' | 'running' | 'complete' | 'error' | 'cancelled';

export function useScan() {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const active = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  useEffect(() => {
    if (status !== 'running') return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => { outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight }); }, [output]);

  const run = async (tool: string, values: Record<string, string>, name: string) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setStatus('running'); setError(''); setOutput(''); setElapsed(0);
    try {
      const response = await fetch(`/api/tools/${tool}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify(values), signal: controller.signal,
      });
      if (response.ok) recordScanRun();
      await readScanStream(response, (text) => {
        if (active.current === controller) setOutput((previous) => previous + text);
      });
      if (active.current !== controller || controller.signal.aborted) return;
      setStatus('complete');
      recordActivity({ action: `Completed ${name}`, tool, target: values.target || values.domain || undefined });
    } catch (err) {
      if (active.current !== controller) return;
      if (controller.signal.aborted) setStatus('cancelled');
      else {
        const message = err instanceof Error ? err.message : 'Scan failed.';
        setStatus('error'); setError(message);
        recordActivity({ action: `${name} failed`, tool, target: values.target || values.domain || undefined });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  const cancel = () => {
    active.current?.abort();
    // Release immediately; stale callbacks cannot affect the next scan.
    active.current = null;
    setStatus('cancelled');
  };
  return { status, output, error, elapsed, outputRef, run, cancel };
}
