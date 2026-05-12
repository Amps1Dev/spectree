'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Terminal, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function MarkdownText({ text }: { text: string }) {
  // Lightweight inline markdown — bold, inline code, code blocks
  const html = text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-[#0a0a0a] border border-[#1f1f1f] rounded p-3 my-2 overflow-x-auto text-[#00c853] text-xs font-mono whitespace-pre-wrap">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-[#0a0a0a] text-[#00c853] px-1 rounded font-mono text-sm">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/^###\s(.+)$/gm, '<h3 class="text-[#00c853] font-bold text-sm mt-3 mb-1">$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2 class="text-[#00c853] font-bold text-base mt-4 mb-1">$1</h2>')
    .replace(/^-\s(.+)$/gm, '<li class="ml-4 list-disc text-[#c9d1d9]">$1</li>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="text-sm leading-relaxed text-[#c9d1d9]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanContext, setScanContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: fullResponse };
            return copy;
          });
        }
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `[ERROR] ${error.message ?? 'Failed to reach SPECTRE.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const injectContext = () => {
    if (!scanContext.trim()) return;
    const prompt = `Analyze this scan output and identify all vulnerabilities, risks, and recommended actions:\n\n\`\`\`\n${scanContext}\n\`\`\``;
    setScanContext('');
    sendMessage(prompt);
  };

  const clearSession = () => {
    setMessages([]);
    setScanContext('');
  };

  const suggestions = [
    'How do I enumerate SMB shares on a target?',
    'What does an open port 6379 (Redis) mean for security?',
    'Explain the risks of running an outdated Apache version',
    'What should I look for after an nmap service scan?',
  ];

  return (
    <div className="flex h-full gap-0">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#080808]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00c853]/10 border border-[#00c853]/30 rounded flex items-center justify-center">
              <span className="text-[#00c853] text-sm font-bold font-mono">S</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">SPECTRE Assistant</h1>
              <p className="text-[#6b7280] text-xs">AI-powered penetration testing analysis</p>
            </div>
          </div>
          <button
            onClick={clearSession}
            className="flex items-center gap-1.5 text-[#6b7280] hover:text-[#e53935] text-xs transition-colors px-3 py-1.5 rounded border border-transparent hover:border-[#e53935]/30"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
              <div className="w-14 h-14 bg-[#00c853]/10 border border-[#00c853]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#00c853] text-2xl font-bold font-mono">S</span>
              </div>
              <div className="text-center">
                <p className="text-white font-medium mb-1">SPECTRE ready</p>
                <p className="text-[#6b7280] text-sm">Ask a question or paste scan output for analysis</p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs text-[#6b7280] hover:text-[#00c853] border border-[#1f1f1f] hover:border-[#00c853]/30 rounded px-3 py-2 transition-all bg-[#0d0d0d]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-[#00c853]/10 border border-[#00c853]/30 rounded flex-shrink-0 flex items-center justify-center mt-0.5">
                  <span className="text-[#00c853] text-xs font-bold font-mono">S</span>
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#00c853] text-[#080808] text-sm font-medium'
                    : 'bg-[#111111] border border-[#1f1f1f]'
                }`}
              >
                {msg.role === 'assistant' ? (
                  msg.content === '' ? (
                    <span className="inline-block w-2 h-4 bg-[#00c853] animate-pulse" />
                  ) : (
                    <MarkdownText text={msg.content} />
                  )
                ) : (
                  <span className="text-sm">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-[#00c853]/10 border border-[#00c853]/30 rounded flex-shrink-0 flex items-center justify-center">
                <span className="text-[#00c853] text-xs font-bold font-mono">S</span>
              </div>
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-4 py-3">
                <Loader2 size={14} className="text-[#00c853] animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-[#1f1f1f]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about vulnerabilities, paste scan output for analysis... (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 bg-[#111111] border border-[#1f1f1f] focus:border-[#00c853]/50 rounded-lg px-4 py-3 text-sm text-white placeholder-[#6b7280] resize-none outline-none transition-colors disabled:opacity-50 font-sans max-h-40 overflow-y-auto"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="bg-[#00c853] hover:bg-[#00e676] disabled:bg-[#1f1f1f] disabled:text-[#6b7280] text-[#080808] rounded-lg p-3 transition-colors flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — scan context injector */}
      <div className="w-72 flex-shrink-0 bg-[#0d0d0d] border-l border-[#1f1f1f] flex flex-col">
        <div className="px-4 py-4 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2 mb-1">
            <Terminal size={14} className="text-[#00c853]" />
            <h2 className="text-white text-sm font-semibold">Scan Context</h2>
          </div>
          <p className="text-[#6b7280] text-xs">Paste raw scan output to analyze with AI</p>
        </div>

        <div className="flex-1 flex flex-col gap-3 p-4">
          <textarea
            placeholder="Paste nmap / nikto output here..."
            value={scanContext}
            onChange={(e) => setScanContext(e.target.value)}
            className="flex-1 bg-[#080808] border border-[#1f1f1f] focus:border-[#00c853]/40 rounded px-3 py-2 text-xs text-[#c9d1d9] placeholder-[#6b7280] font-mono resize-none outline-none transition-colors"
          />
          <button
            onClick={injectContext}
            disabled={!scanContext.trim() || loading}
            className="w-full bg-[#00c853]/10 hover:bg-[#00c853]/20 border border-[#00c853]/30 hover:border-[#00c853]/60 text-[#00c853] text-xs font-medium rounded px-3 py-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze with SPECTRE
          </button>
        </div>

        {/* Session stats */}
        <div className="px-4 py-4 border-t border-[#1f1f1f] space-y-2">
          <p className="text-[#6b7280] text-xs font-medium uppercase tracking-wider">Session</p>
          <div className="flex justify-between text-xs">
            <span className="text-[#6b7280]">Messages</span>
            <span className="text-white font-mono">{messages.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#6b7280]">Status</span>
            <span className={`font-mono ${loading ? 'text-[#f59e0b]' : 'text-[#00c853]'}`}>
              {loading ? 'THINKING' : 'READY'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
