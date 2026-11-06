'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createConversation,
  createMessage,
  deleteChat as deleteStoredChat,
  readActiveChatId,
  readChats,
  StoredChatMessage,
  StoredConversation,
  StoredToolOutput,
  writeActiveChatId,
  writeChats,
} from '@/lib/chatStore';
import { useOfflineMode } from '@/hooks/useOfflineMode';

export interface ActiveAgentRequest {
  chatId: string;
  startedAt: number;
  toolName?: string;
  target?: string;
  lineCount: number;
  lastActivityAt: number | null;
}

interface ChatContextValue {
  chats: StoredConversation[];
  activeChat: StoredConversation | null;
  activeChatId: string | null;
  activeRequest: ActiveAgentRequest | null;
  hydrated: boolean;
  createNewChat: () => string;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  sendMessage: (content: string, chatId?: string) => Promise<void>;
  cancelRequest: () => void;
  appendMessage: (
    role: StoredChatMessage['role'],
    content: string,
    toolOutputs?: StoredToolOutput[],
    chatId?: string,
  ) => string | null;
  updateMessage: (
    messageId: string,
    updater: (message: StoredChatMessage) => StoredChatMessage,
    chatId?: string,
  ) => void;
  setEngagementId: (engagementId: string | undefined, chatId?: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function inferToolActivity(prompt: string) {
  const toolName = prompt.match(/\b(nmap|nikto)\b/i)?.[1]?.toLowerCase();
  const target = prompt.match(
    /\b(?:on|against|target)\s+((?:https?:\/\/)?[a-z0-9][a-z0-9._:\[\]-]*(?:\/\S*)?)/i,
  )?.[1];
  return { toolName, target };
}

function titleFromMessage(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 52) return normalized || 'New chat';
  return `${normalized.slice(0, 49)}…`;
}

function sortChats(chats: StoredConversation[]) {
  return [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export default function ChatProvider({ children }: { children: ReactNode }) {
  const { offline } = useOfflineMode();
  const [chats, setChats] = useState<StoredConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<ActiveAgentRequest | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);
  const chatsRef = useRef<StoredConversation[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  const requestRef = useRef<{
    chatId: string;
    controller: AbortController;
  } | null>(null);

  useEffect(() => {
    const stored = readChats();
    const initialChats = stored.length > 0 ? stored : [createConversation()];
    const storedActive = readActiveChatId();
    const initialActive = initialChats.some((chat) => chat.id === storedActive)
      ? storedActive
      : initialChats[0].id;

    chatsRef.current = initialChats;
    activeChatIdRef.current = initialActive;
    setChats(initialChats);
    setActiveChatId(initialActive);
    setHydrated(true);
  }, []);

  useEffect(() => {
    chatsRef.current = chats;
    if (!hydrated) return;
    const timer = window.setTimeout(() => writeChats(chats), 300);
    return () => window.clearTimeout(timer);
  }, [chats, hydrated]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    if (hydrated && activeChatId) writeActiveChatId(activeChatId);
  }, [activeChatId, hydrated]);

  useEffect(() => {
    const flush = () => writeChats(chatsRef.current);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  const updateConversation = useCallback(
    (
      id: string,
      updater: (conversation: StoredConversation) => StoredConversation,
    ) => {
      setChats((current) =>
        sortChats(
          current.map((conversation) =>
            conversation.id === id ? updater(conversation) : conversation,
          ),
        ),
      );
    },
    [],
  );

  const createNewChat = useCallback(() => {
    const conversation = createConversation();
    setChats((current) => [conversation, ...current]);
    setActiveChatId(conversation.id);
    return conversation.id;
  }, []);

  const selectChat = useCallback((id: string) => {
    if (chatsRef.current.some((chat) => chat.id === id)) setActiveChatId(id);
  }, []);

  const renameChat = useCallback(
    (id: string, title: string) => {
      const normalized = title.trim();
      if (!normalized) return;
      updateConversation(id, (conversation) => ({
        ...conversation,
        title: normalized,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateConversation],
  );

  const deleteChat = useCallback(
    (id: string) => {
      if (requestRef.current?.chatId === id) requestRef.current.controller.abort();
      const remaining = chatsRef.current.filter((chat) => chat.id !== id);
      const nextChats = remaining.length > 0 ? remaining : [createConversation()];
      deleteStoredChat(id);
      setChats(nextChats);
      if (activeChatIdRef.current === id) setActiveChatId(nextChats[0].id);
    },
    [],
  );

  const appendMessage = useCallback(
    (
      role: StoredChatMessage['role'],
      content: string,
      toolOutputs?: StoredToolOutput[],
      chatId = activeChatIdRef.current ?? undefined,
    ) => {
      if (!chatId) return null;
      const message = createMessage(role, content, toolOutputs);
      updateConversation(chatId, (conversation) => ({
        ...conversation,
        title:
          role === 'user' && conversation.messages.length === 0
            ? titleFromMessage(content)
            : conversation.title,
        updatedAt: message.timestamp,
        messages: [...conversation.messages, message],
      }));
      return message.id;
    },
    [updateConversation],
  );

  const updateMessage = useCallback(
    (
      messageId: string,
      updater: (message: StoredChatMessage) => StoredChatMessage,
      chatId = activeChatIdRef.current ?? undefined,
    ) => {
      if (!chatId) return;
      updateConversation(chatId, (conversation) => ({
        ...conversation,
        updatedAt: new Date().toISOString(),
        messages: conversation.messages.map((message) =>
          message.id === messageId ? updater(message) : message,
        ),
      }));
    },
    [updateConversation],
  );

  const setEngagementId = useCallback(
    (
      engagementId: string | undefined,
      chatId = activeChatIdRef.current ?? undefined,
    ) => {
      if (!chatId) return;
      updateConversation(chatId, (conversation) => ({
        ...conversation,
        engagementId,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateConversation],
  );

  const sendMessage = useCallback(
    async (rawContent: string, requestedChatId?: string) => {
      const content = rawContent.trim();
      const chatId = requestedChatId ?? activeChatIdRef.current;
      if (!content || !chatId || requestRef.current) return;

      const conversation = chatsRef.current.find((chat) => chat.id === chatId);
      if (!conversation) return;

      const userMessage = createMessage('user', content);
      const assistantMessage = createMessage('assistant', '');
      const controller = new AbortController();
      const activity = inferToolActivity(content);
      requestRef.current = { chatId, controller };
      setActiveRequest({
        chatId,
        startedAt: Date.now(),
        toolName: activity.toolName,
        target: activity.target,
        lineCount: 0,
        lastActivityAt: null,
      });

      updateConversation(chatId, (current) => ({
        ...current,
        title:
          current.messages.length === 0
            ? titleFromMessage(content)
            : current.title,
        updatedAt: userMessage.timestamp,
        messages: [...current.messages, userMessage],
      }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...conversation.messages, userMessage].map(
              ({ role, content: messageContent }) => ({
                role,
                content: messageContent,
              }),
            ),
            offline,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error || `Chat request failed (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('The assistant returned no response stream.');
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          const lines = Math.max(1, chunk.split(/\r?\n/).filter(Boolean).length);

          updateConversation(chatId, (current) => {
            const exists = current.messages.some(
              (message) => message.id === assistantMessage.id,
            );
            const updatedAssistant = {
              ...assistantMessage,
              content: fullResponse,
              timestamp: new Date().toISOString(),
            };
            return {
              ...current,
              updatedAt: updatedAssistant.timestamp,
              messages: exists
                ? current.messages.map((message) =>
                    message.id === assistantMessage.id
                      ? updatedAssistant
                      : message,
                  )
                : [...current.messages, updatedAssistant],
            };
          });
          setActiveRequest((current) =>
            current?.chatId === chatId
              ? {
                  ...current,
                  lineCount: current.lineCount + lines,
                  lastActivityAt: Date.now(),
                }
              : current,
          );
        }
      } catch (error) {
        const cancelled =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError');
        const errorMessage = createMessage(
          'assistant',
          cancelled
            ? 'Request cancelled.'
            : error instanceof Error
              ? `Error: ${error.message}`
              : 'Error communicating with assistant.',
        );
        updateConversation(chatId, (current) => ({
          ...current,
          updatedAt: errorMessage.timestamp,
          messages: [...current.messages, errorMessage],
        }));
      } finally {
        if (requestRef.current?.controller === controller) requestRef.current = null;
        setActiveRequest((current) =>
          current?.chatId === chatId ? null : current,
        );
      }
    },
    [offline, updateConversation],
  );

  const cancelRequest = useCallback(() => requestRef.current?.controller.abort(), []);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
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
      updateMessage,
      setEngagementId,
    }),
    [
      activeChat,
      activeChatId,
      activeRequest,
      appendMessage,
      cancelRequest,
      chats,
      createNewChat,
      deleteChat,
      hydrated,
      renameChat,
      selectChat,
      sendMessage,
      setEngagementId,
      updateMessage,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}
