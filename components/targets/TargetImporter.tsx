'use client';

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FileText, FolderOpen, Plus, Upload, X } from 'lucide-react';
import {
  ParsedTarget,
  parseTargetFile,
  parseTargets,
} from '@/components/targets/parseTargets';

interface TargetImporterProps {
  disabled?: boolean;
  onImport: (targets: ParsedTarget[], source: string) => void;
}

export default function TargetImporter({
  disabled = false,
  onImport,
}: TargetImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const chooseFile = () => {
    setMenuOpen(false);
    inputRef.current?.click();
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const targets = await parseTargetFile(file);
      if (targets.length === 0) throw new Error('No targets were found in the file.');
      setError('');
      onImport(targets, file.name);
    } catch (fileError) {
      setError(
        fileError instanceof Error ? fileError.message : 'Unable to parse file.',
      );
    }
  };

  const parsedPaste = parseTargets(pasteValue);
  const invalidCount = parsedPaste.filter((target) => !target.valid).length;

  const confirmPaste = () => {
    if (parsedPaste.length === 0) return;
    onImport(parsedPaste, 'pasted targets');
    setPasteValue('');
    setPasteOpen(false);
    setError('');
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.csv,.docx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={importFile}
          className="hidden"
        />
        <button
          type="button"
          aria-label="Attach targets"
          aria-expanded={menuOpen}
          disabled={disabled}
          onClick={() => setMenuOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-spectre-border bg-spectre-card text-spectre-muted hover:border-spectre-accent hover:text-spectre-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={20} />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-lg border border-spectre-border bg-spectre-card p-1 shadow-xl">
            <button
              type="button"
              onClick={chooseFile}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-spectre-text hover:bg-spectre-accent/10"
            >
              <Upload size={16} className="text-spectre-accent" />
              Upload targets file
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPasteOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-spectre-text hover:bg-spectre-accent/10"
            >
              <FileText size={16} className="text-spectre-accent" />
              Paste targets
            </button>
            <button
              type="button"
              onClick={chooseFile}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-spectre-text hover:bg-spectre-accent/10"
            >
              <FolderOpen size={16} className="text-spectre-accent" />
              Browse files
            </button>
          </div>
        )}

        {error && (
          <p className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded border border-spectre-danger/60 bg-spectre-card px-3 py-2 text-xs text-spectre-danger shadow-lg">
            {error}
          </p>
        )}
      </div>

      {pasteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-spectre-overlay/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paste-targets-title"
        >
          <div className="w-full max-w-2xl rounded-xl border border-spectre-border bg-spectre-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="paste-targets-title" className="text-lg font-semibold">
                  Paste targets
                </h2>
                <p className="text-sm text-spectre-muted">
                  One target per line, or target,label,notes CSV rows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                aria-label="Close paste targets dialog"
                className="rounded p-1 text-spectre-muted hover:bg-spectre-border/40 hover:text-spectre-text"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              autoFocus
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              rows={11}
              placeholder={'192.0.2.10,Web server,Production\nexample.test\n2001:db8::1'}
              className="spectre-input w-full resize-y font-mono"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-spectre-muted">
                {parsedPaste.length} detected
                {invalidCount > 0 ? ` · ${invalidCount} invalid` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPasteOpen(false)}
                  className="spectre-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPaste}
                  disabled={parsedPaste.length === 0}
                  className="spectre-btn-primary"
                >
                  Stage targets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
