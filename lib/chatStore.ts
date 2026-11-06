export const CHAT_STORAGE_KEY = 'spectre-chats';
export const ACTIVE_CHAT_STORAGE_KEY = 'spectre-active-chat';

export interface StoredToolOutput {
  id: string;
  type: string;
  tool?: string;
  target?: string;
  output?: string;
  status?: string;
  data?: Record<string, unknown>;
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolOutputs?: StoredToolOutput[];
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  engagementId?: string;
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function makeId() {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function normalizeMessage(value: unknown): StoredChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<StoredChatMessage>;
  if (
    typeof message.id !== 'string' ||
    (message.role !== 'user' && message.role !== 'assistant') ||
    typeof message.content !== 'string' ||
    typeof message.timestamp !== 'string'
  ) {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    toolOutputs: Array.isArray(message.toolOutputs)
      ? message.toolOutputs.filter(
          (item): item is StoredToolOutput =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as StoredToolOutput).id === 'string' &&
            typeof (item as StoredToolOutput).type === 'string',
        )
      : undefined,
  };
}

function normalizeConversation(value: unknown): StoredConversation | null {
  if (!value || typeof value !== 'object') return null;
  const conversation = value as Partial<StoredConversation>;
  if (
    typeof conversation.id !== 'string' ||
    typeof conversation.title !== 'string' ||
    typeof conversation.createdAt !== 'string' ||
    typeof conversation.updatedAt !== 'string' ||
    !Array.isArray(conversation.messages)
  ) {
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages
      .map(normalizeMessage)
      .filter((message): message is StoredChatMessage => message !== null),
    engagementId:
      typeof conversation.engagementId === 'string'
        ? conversation.engagementId
        : undefined,
  };
}

export function createConversation(title = 'New chat'): StoredConversation {
  const timestamp = new Date().toISOString();
  return {
    id: makeId(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
}

export function createMessage(
  role: StoredChatMessage['role'],
  content: string,
  toolOutputs?: StoredToolOutput[],
): StoredChatMessage {
  return {
    id: makeId(),
    role,
    content,
    timestamp: new Date().toISOString(),
    toolOutputs,
  };
}

export function readChats(): StoredConversation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeConversation)
      .filter((chat): chat is StoredConversation => chat !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function writeChats(chats: StoredConversation[]): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
    return true;
  } catch {
    return false;
  }
}

export function readActiveChatId(): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveChatId(id: string): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export function deleteChat(id: string): StoredConversation[] {
  const remaining = readChats().filter((chat) => chat.id !== id);
  writeChats(remaining);
  if (readActiveChatId() === id) {
    try {
      window.localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      // Deletion from the in-memory React state still succeeds.
    }
  }
  return remaining;
}
