import { spawn, ChildProcess } from 'child_process';
import type { ScanEvent } from './scan-stream';

interface ExecutionOptions {
  bin: string;
  args: string[];
  followArgs?: string[] | null;
  name: string;
  secrets: string[];
  timeoutMs: number;
  signal: AbortSignal;
  structured: boolean;
  cleanup: () => Promise<void>;
}

export function executeTool(options: ExecutionOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let child: ChildProcess | undefined;
  let cancelled = false;
  let timedOut = false;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (!child?.pid) return;
    try {
      // Tools may spawn helpers; stop the whole process group on POSIX.
      if (process.platform !== 'win32') process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch { /* The process has already exited. */ }
  };
  const stop = () => {
    kill('SIGTERM');
    if (!killTimer) killTimer = setTimeout(() => kill('SIGKILL'), 1000);
  };
  const abort = () => { cancelled = true; stop(); };

  return new ReadableStream({
    start(controller) {
      const emit = (event: ScanEvent) => {
        if (cancelled || closed) return;
        const text = options.structured ? `${JSON.stringify(event)}\n`
          : event.type === 'output' ? event.text
          : `\n[${event.ok ? 'Scan complete' : event.error}]\n`;
        try { controller.enqueue(encoder.encode(text)); } catch { abort(); }
      };
      const run = (args: string[]): Promise<number | null> => new Promise((resolve) => {
        if (cancelled || timedOut) return resolve(null);
        const label = options.bin.split('/').pop();
        emit({ type: 'output', text: `$ ${label} ${args.map((a) => options.secrets.includes(a) ? '****' : a).join(' ')}\n\n` });
        child = spawn(options.bin, args, { shell: false, detached: process.platform !== 'win32' });
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (text: string) => emit({ type: 'output', text }));
        child.stderr?.on('data', (text: string) => emit({ type: 'output', text }));
        child.once('error', (error) => emit({ type: 'output', text: `${error.message}\n` }));
        // 'close' follows 'error'; resolving here prevents duplicate follow-up runs.
        child.once('close', (code) => resolve(code));
      });
      options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal.aborted) abort();
      timer = setTimeout(() => { timedOut = true; stop(); }, options.timeoutMs);
      void (async () => {
        try {
          let exitCode = await run(options.args);
          if (exitCode === 0 && !cancelled && !timedOut && options.followArgs?.length) exitCode = await run(options.followArgs);
          const error = timedOut ? `Timed out after ${Math.round(options.timeoutMs / 1000)}s.`
            : exitCode !== 0 ? `${options.name} exited with code ${exitCode ?? 'unknown'}.` : undefined;
          emit({ type: 'result', ok: !error, exitCode, error });
        } catch (error) {
          emit({ type: 'result', ok: false, exitCode: null, error: error instanceof Error ? error.message : 'Unable to run tool.' });
        } finally {
          clearTimeout(timer);
          if (cancelled || timedOut) kill('SIGKILL');
          clearTimeout(killTimer);
          options.signal.removeEventListener('abort', abort);
          await options.cleanup();
          closed = true;
          try { controller.close(); } catch { /* Reader already cancelled. */ }
        }
      })();
    },
    cancel() { abort(); },
  });
}
