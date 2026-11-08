'use client';

import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FileText,
  FileUp,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import ChatBubble from '@/components/chat-bubble';
import AgentActivity from '@/components/AgentActivity';
import SpectreSpinner from '@/components/spectre-spinner';
import { useChat } from '@/components/ChatProvider';
import ReportPanel from '@/components/ReportPanel';
import TargetImporter from '@/components/targets/TargetImporter';
import {
  ParsedTarget,
  parseTargetFile,
  parseTargets,
} from '@/components/targets/parseTargets';
import { useOfflineMode } from '@/hooks/useOfflineMode';

export default function ChatPage() {
  const { offline } = useOfflineMode();
  const {
    chats,
    activeChat,
    activeChatId,
    activeRequest,
    hydrated,
    createNewChat,
    selectChat,
    renameChat,
    deleteChat,
    sendMessage,
    cancelRequest,
    appendMessage,
  } = useChat();
  const [input, setInput] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const [importError, setImportError] = useState('');
  const [desktopReportOpen, setDesktopReportOpen] = useState(true);
  const [mobileReportOpen, setMobileReportOpen] = useState(false);
  const [reportEngagementId, setReportEngagementId] = useState<string>();
  const [pendingPaste, setPendingPaste] = useState<{
    text: string;
    targets: ParsedTarget[];
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragDepthRef = useRef(0);
  const requestForActiveChat =
    activeRequest && activeRequest.chatId === activeChatId ? activeRequest : null;

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [activeChat?.messages, requestForActiveChat]);

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || activeRequest) return;
    setInput('');
    void sendMessage(content);
  };

  const stageTargets = (targets: ParsedTarget[], source: string) => {
    if (!activeChatId || targets.length === 0) return;
    appendMessage(
      'assistant',
      `Imported ${targets.length} target${targets.length === 1 ? '' : 's'} from ${source}.`,
      [
        {
          id: globalThis.crypto.randomUUID(),
          type: 'target-engagement',
          status: 'staged',
          data: {
            source,
            targets,
            tools: ['nmap'],
            log: '',
            running: false,
            logOpen: true,
            lineCount: 0,
          },
        },
      ],
      activeChatId,
    );
    setPendingPaste(null);
    setImportError('');
  };

  const loadDroppedFile = async (file?: File) => {
    if (!file) return;
    try {
      const targets = await parseTargetFile(file);
      if (targets.length === 0) throw new Error('No targets were found in the file.');
      stageTargets(targets, file.name);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Unable to parse target file.',
      );
    }
  };

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingFile(true);
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDraggingFile(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFile(false);
    void loadDroppedFile(event.dataTransfer.files?.[0]);
  };

  const onInputPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    const candidateLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    if (candidateLines.length < 2) return;

    const targets = parseTargets(text);
    if (targets.filter((target) => target.valid).length < 2) return;

    event.preventDefault();
    setPendingPaste({ text, targets });
  };

  const keepPasteAsText = () => {
    if (!pendingPaste) return;
    const element = inputRef.current;
    const start = element?.selectionStart ?? input.length;
    const end = element?.selectionEnd ?? input.length;
    setInput(`${input.slice(0, start)}${pendingPaste.text}${input.slice(end)}`);
    setPendingPaste(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const openReportForEngagement = (engagementId: string) => {
    setReportEngagementId(engagementId);
    setDesktopReportOpen(true);
    setMobileReportOpen(true);
  };

  const requestRename = (id: string, currentTitle: string) => {
    const title = window.prompt('Rename chat', currentTitle);
    if (title !== null) renameChat(id, title);
  };

  const requestDelete = (id: string, title: string) => {
    if (window.confirm(`Delete “${title}”? This cannot be undone.`)) {
      deleteChat(id);
    }
  };

  return (
    <div className="flex h-full min-w-0 bg-spectre-bg">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-spectre-border bg-spectre-surface xl:flex">
        <div className="border-b border-spectre-border p-4">
          <button
            type="button"
            onClick={createNewChat}
            className="spectre-btn-primary flex w-full items-center justify-center gap-2"
          >
            <Plus size={16} /> New chat
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {!hydrated && (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-spectre-muted"><SpectreSpinner size={20} label="" />Loading chats…</p>
          )}
          {chats.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <div
                key={chat.id}
                className={`group rounded-lg border transition-colors ${
                  active
                    ? 'border-spectre-accent/60 bg-spectre-accent/10'
                    : 'border-transparent hover:border-spectre-border hover:bg-spectre-card'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectChat(chat.id)}
                  className="flex w-full items-start gap-2 px-3 pb-1 pt-3 text-left"
                >
                  <MessageCircle
                    size={15}
                    className={active ? 'text-spectre-accent' : 'text-spectre-muted'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {chat.title}
                    </span>
                    <span className="block text-[10px] text-spectre-muted">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>
                <div className="flex justify-end gap-1 px-2 pb-2 opacity-60 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => requestRename(chat.id, chat.title)}
                    aria-label={`Rename ${chat.title}`}
                    className="rounded p-1 text-spectre-muted hover:bg-spectre-border/40 hover:text-spectre-text"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(chat.id, chat.title)}
                    aria-label={`Delete ${chat.title}`}
                    className="rounded p-1 text-spectre-muted hover:bg-spectre-danger/10 hover:text-spectre-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section
        className="relative flex min-w-0 flex-1 flex-col border-r border-spectre-border p-3 sm:p-6"
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">AI Assistant</h1>
            <p className="truncate text-sm text-spectre-muted">
              {activeChat?.title || 'New chat'}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setDesktopReportOpen((current) => !current)}
              aria-expanded={desktopReportOpen}
              className="spectre-btn-secondary hidden items-center gap-2 text-sm 2xl:flex"
            >
              <FileText size={16} /> Report
            </button>
            <button
              type="button"
              onClick={() => setMobileReportOpen(true)}
              aria-expanded={mobileReportOpen}
              className="spectre-btn-secondary flex items-center gap-2 text-sm 2xl:hidden"
            >
              <FileText size={16} /> Report
            </button>
          </div>
        </header>

        <div className="mb-4 flex min-w-0 items-center gap-2 xl:hidden">
          <label htmlFor="mobile-chat-history" className="sr-only">Chat history</label>
          <select id="mobile-chat-history" value={activeChatId ?? ''} onChange={(event) => selectChat(event.target.value)} className="spectre-input min-w-0 flex-1" disabled={!hydrated}>
            {!hydrated && <option value="">Loading chats…</option>}
            {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
          </select>
          <button type="button" onClick={createNewChat} className="spectre-btn-primary shrink-0" aria-label="New chat"><Plus size={18} /></button>
        </div>

        {offline && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-lg border border-spectre-offline/60 bg-spectre-offline/10 px-4 py-3 text-sm text-spectre-muted"
          >
            <WifiOff size={17} className="shrink-0" />
            Offline mode is active. Messages stay local and Groq/tool calls are
            disabled.
          </div>
        )}

        {importError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-spectre-danger/60 bg-spectre-danger/10 px-4 py-3 text-sm text-spectre-danger">
            {importError}
            <button
              type="button"
              onClick={() => setImportError('')}
              aria-label="Dismiss target import error"
              className="rounded p-1 hover:bg-spectre-danger/10"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {activeRequest && !requestForActiveChat && (
          <div className="mb-4 rounded border border-spectre-info/60 bg-spectre-info/10 px-3 py-2 text-xs text-spectre-text">
            SPECTRE is still finishing another chat. You can return to it from
            the history list.
          </div>
        )}

        <div className="mb-6 flex-1 space-y-4 overflow-y-auto">
          {activeChat?.messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-spectre-accent/10">
                  <span className="text-2xl font-bold text-spectre-accent">S</span>
                </div>
                <p className="text-spectre-muted">
                  Start a conversation with SPECTRE
                </p>
              </div>
            </div>
          )}

          {activeChat?.messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              chatId={activeChatId ?? activeChat.id}
              onGenerateReport={openReportForEngagement}
            />
          ))}
          {requestForActiveChat &&
            activeChat?.messages[activeChat.messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <AgentActivity
                  toolName={requestForActiveChat.toolName}
                  target={requestForActiveChat.target}
                  lineCount={requestForActiveChat.lineCount}
                  lastActivityAt={requestForActiveChat.lastActivityAt}
                  startedAt={requestForActiveChat.startedAt}
                  onCancel={cancelRequest}
                />
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>

        {pendingPaste && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-spectre-info/60 bg-spectre-info/10 px-4 py-3 text-sm">
            <span>
              Detected {pendingPaste.targets.length} targets — Import as targets?
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => stageTargets(pendingPaste.targets, 'clipboard')}
                className="spectre-btn-primary px-3 py-1 text-xs"
              >
                Import
              </button>
              <button
                type="button"
                onClick={keepPasteAsText}
                className="spectre-btn-secondary px-3 py-1 text-xs"
              >
                Keep as text
              </button>
            </span>
          </div>
        )}

        <form onSubmit={submitMessage} className="flex items-end gap-2">
          <TargetImporter
            disabled={Boolean(activeRequest) || !activeChatId}
            onImport={stageTargets}
          />
          <textarea
            ref={inputRef}
            aria-label="Message to SPECTRE"
            placeholder="Ask about a scan, request recommendations, plan attack vectors..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPaste={onInputPaste}
            onKeyDown={onInputKeyDown}
            disabled={Boolean(activeRequest)}
            rows={1}
            className="spectre-input max-h-40 min-h-10 min-w-0 flex-1 resize-y"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={Boolean(activeRequest) || !input.trim()}
            className="spectre-btn-primary"
          >
            <Send size={20} />
          </button>
        </form>

        {draggingFile && (
          <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-spectre-accent bg-spectre-bg/95">
            <div className="text-center text-spectre-accent">
              <FileUp className="mx-auto mb-3" size={36} />
              <p className="font-semibold">Drop targets file here</p>
              <p className="text-xs text-spectre-muted">.txt, .csv, or .docx</p>
            </div>
          </div>
        )}
      </section>

      {desktopReportOpen && (
        <aside className="hidden w-[380px] shrink-0 border-l border-spectre-border 2xl:block">
          <ReportPanel
            requestedEngagementId={reportEngagementId}
            onClose={() => setDesktopReportOpen(false)}
          />
        </aside>
      )}

      {mobileReportOpen && (
        <div className="fixed inset-0 z-50 2xl:hidden">
          <button
            type="button"
            aria-label="Close report panel"
            onClick={() => setMobileReportOpen(false)}
            className="absolute inset-0 h-full w-full bg-spectre-overlay/60"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(92vw,380px)] border-l border-spectre-border shadow-2xl">
            <ReportPanel
              requestedEngagementId={reportEngagementId}
              onClose={() => setMobileReportOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
