'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage, SessionContext } from '@/lib/types';
import ChatBubble from '@/components/chat-bubble';
import ContextPanel from '@/components/context-panel';
import { useLLM } from '@/components/llm-context';
import { loadChat, saveChat, clearChat } from '@/lib/local-store';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [context, setContext] = useState<SessionContext>({ suggestedSteps: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { provider } = useLLM();

  // Restore persisted history once, on the client only (avoids an SSR/client
  // hydration mismatch that a lazy localStorage initializer would cause).
  useEffect(() => {
    const saved = loadChat();
    if (saved.length) setMessages(saved);
    setHydrated(true);
  }, []);

  // Persist after each completed exchange — not on every stream token, and not
  // before the initial load has run (which would clobber the store with []).
  useEffect(() => {
    if (!hydrated || loading) return;
    saveChat(messages);
  }, [messages, hydrated, loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError('');
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], provider }),
      });

      if (!response.ok) {
        // Surface the real reason (e.g. provider unreachable, key missing)
        // instead of a blanket "Error communicating with assistant."
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
            } else {
              updated.push({ role: 'assistant', content: fullResponse });
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError(
        err instanceof Error ? err.message : 'Error communicating with assistant.',
      );
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setContext({ suggestedSteps: [] });
    setError('');
    clearChat();
  };

  return (
    <div className="flex h-full">
      <div className="flex-[65%] flex flex-col bg-spectre-bg p-6 border-r border-spectre-border">
        <h1 className="text-3xl font-bold mb-6">AI Assistant</h1>

        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-spectre-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-spectre-accent">S</span>
                </div>
                <p className="text-spectre-muted">Start a conversation with SPECTRE</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatBubble key={idx} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mb-3 p-3 bg-spectre-danger/10 border border-spectre-danger rounded text-spectre-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            placeholder="Ask about a scan, request recommendations, plan attack vectors..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="spectre-input flex-1"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="spectre-btn-primary"
          >
            <Send size={20} />
          </button>
        </form>
      </div>

      <ContextPanel context={context} onClear={clearSession} />
    </div>
  );
}
