'use client';

import { useState } from 'react';
import ScanPanel from '@/components/scan-panel';

export default function ToolsPage() {
  const [nmapOutput, setNmapOutput] = useState('');
  const [niktoOutput, setNiktoOutput] = useState('');

  const handleScanOutputUpdate = (tool: 'nmap' | 'nikto', output: string) => {
    if (tool === 'nmap') {
      setNmapOutput(output);
    } else {
      setNiktoOutput(output);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Tool Execution</h1>
        <p className="text-spectre-muted">Run network reconnaissance and vulnerability scans</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScanPanel
          title="Nmap Scanner"
          tool="nmap"
          profiles={[
            { label: 'Quick', value: 'Quick', flags: '-T4 -F' },
            { label: 'Service Detection', value: 'Service', flags: '-sV -T4' },
            { label: 'Full', value: 'Full', flags: '-sV -A -T4' },
          ]}
          onOutput={(output) => handleScanOutputUpdate('nmap', output)}
          currentOutput={nmapOutput}
        />

        <ScanPanel
          title="Nikto Scanner"
          tool="nikto"
          profiles={[
            { label: 'Default', value: 'Default', flags: '' },
          ]}
          onOutput={(output) => handleScanOutputUpdate('nikto', output)}
          currentOutput={niktoOutput}
        />
      </div>
    </div>
  );
}
