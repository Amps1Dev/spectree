'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage, SessionContext } from '@/lib/types';
import ChatBubble from '@/components/chat-bubble';
import ContextPanel from '@/components/context-panel';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<SessionContext>({ suggestedSteps: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.role === 'assistant') {
              updated[updated.length - 1].content = fullResponse;
            } else {
              updated.push({ role: 'assistant', content: fullResponse });
            }
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error communicating with assistant.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setContext({ suggestedSteps: [] });
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
