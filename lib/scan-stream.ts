export type ScanEvent =
  | { type: 'output'; text: string }
  | { type: 'result'; ok: boolean; exitCode: number | null; error?: string };

/** A failed process or truncated connection must not look successful. */
export async function readScanStream(response: Response, onOutput: (text: string) => void): Promise<void> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `Scan request failed (${response.status})`);
  }
  if (!response.body) throw new Error('The scan returned no response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result: Extract<ScanEvent, { type: 'result' }> | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event: ScanEvent = JSON.parse(line);
    if (event.type === 'output') onOutput(event.text);
    if (event.type === 'result') result = event;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      lines.forEach(consume);
      if (done) break;
    }
    consume(pending);
    if (!result) throw new Error('Scan connection ended before a result was received.');
    if (!result.ok) throw new Error(result.error || `Scan exited with code ${result.exitCode}.`);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
