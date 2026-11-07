/**
//! Nano Route — Chat Session & Message Persistence IPC Boundary
//! File: src/services/ipc/chat.ts
//!
//! Responsibility:
//! - Strongly-typed frontend API for chat sessions, messages, and conversation threads.
//! - Input validation, correlation ID generation, and sanitized error normalization.
//! - Seamless in-memory fallback for browser dev mode and automated test environments.
*/

import { isTauriContext, safeInvoke, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  IPC_COMMANDS,
  type AppendChatMessageRequest,
  type ChatConversation,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatSession,
  type CreateChatSessionRequest,
  type GetChatMessagesRequest,
  type ListChatSessionsRequest,
  type MessageSender,
} from "./types.ts";

// ============================================================================
// Browser In-Memory Mock Store (enables development without running Tauri native core)
// ============================================================================

const mockSessions = new Map<string, ChatSession>();
const mockMessages = new Map<string, ChatMessage[]>();
let mockCounter = 1;

export function resetChatMockStore(): void {
  mockSessions.clear();
  mockMessages.clear();
  mockCounter = 1;
}

function normalizeMetadata(input?: Partial<ChatMessageMetadata>): ChatMessageMetadata {
  return {
    routedProvider: input?.routedProvider ?? null,
    routedModel: input?.routedModel ?? null,
    routingReason: input?.routingReason ?? null,
    slmConfidenceScore: input?.slmConfidenceScore ?? null,
    promptTokens: input?.promptTokens ?? 0,
    completionTokens: input?.completionTokens ?? 0,
    latencyMs: input?.latencyMs ?? 0,
    costUsd: input?.costUsd ?? 0.0,
  };
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

function validateSessionId(sessionId: string): string {
  const trimmed = sessionId?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Session ID cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }
  return trimmed;
}

function validateMessageId(messageId: string): string {
  const trimmed = messageId?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Message ID cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }
  return trimmed;
}

function validateSender(sender: string): MessageSender {
  const lower = sender?.trim().toLowerCase();
  if (lower !== "user" && lower !== "assistant" && lower !== "system") {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Invalid sender '${sender}'. Permitted values are 'user', 'assistant', 'system'`,
      retryable: false,
      userActionRequired: true,
    });
  }
  return lower as MessageSender;
}

function validateContent(content: string): string {
  const trimmed = content?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Message content cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }
  return trimmed;
}

function validateTitle(title: string): string {
  const trimmed = title?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Session title cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }
  if (trimmed.length > 255) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Session title exceeds maximum allowed length of 255 characters",
      retryable: false,
      userActionRequired: true,
    });
  }
  return trimmed;
}

// ============================================================================
// Chat Persistence Public API
// ============================================================================

/**
 * Creates a new persistent chat session.
 */
export async function createChatSession(
  request: CreateChatSessionRequest = {}
): Promise<ChatSession> {
  const title = request.title?.trim() || "New Conversation";
  if (title.length > 255) {
    validateTitle(title);
  }

  if (!isTauriContext()) {
    const now = Date.now();
    const session: ChatSession = {
      id: `mock_sess_${now}_${mockCounter++}`,
      title,
      createdAt: now,
      updatedAt: now,
      pinned: !!request.pinned,
    };
    mockSessions.set(session.id, session);
    mockMessages.set(session.id, []);
    return session;
  }

  return await safeInvoke<ChatSession>(
    IPC_COMMANDS.CREATE_CHAT_SESSION,
    {
      title: request.title?.trim() || null,
      pinned: request.pinned ?? null,
    },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves a chat session by ID.
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const validId = validateSessionId(sessionId);

  if (!isTauriContext()) {
    return mockSessions.get(validId) ?? null;
  }

  return await safeInvoke<ChatSession | null>(
    IPC_COMMANDS.GET_CHAT_SESSION,
    { sessionId: validId },
    { requestId: generateRequestId() }
  );
}

/**
 * Lists recent chat sessions with pagination.
 */
export async function listChatSessions(
  request: ListChatSessionsRequest = {}
): Promise<ChatSession[]> {
  const limit = request.limit ?? 50;
  const offset = request.offset ?? 0;

  if (!isTauriContext()) {
    const sessions = Array.from(mockSessions.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.id.localeCompare(a.id);
    });
    return sessions.slice(offset, offset + limit);
  }

  return await safeInvoke<ChatSession[]>(
    IPC_COMMANDS.LIST_CHAT_SESSIONS,
    { limit, offset },
    { requestId: generateRequestId() }
  );
}

/**
 * Renames a chat session.
 */
export async function renameChatSession(
  sessionId: string,
  title: string
): Promise<ChatSession> {
  const validId = validateSessionId(sessionId);
  const validTitle = validateTitle(title);

  if (!isTauriContext()) {
    const existing = mockSessions.get(validId);
    if (!existing) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Session '${validId}' not found`,
        retryable: false,
        userActionRequired: true,
      });
    }
    const updated: ChatSession = {
      ...existing,
      title: validTitle,
      updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
    };
    mockSessions.set(validId, updated);
    return updated;
  }

  return await safeInvoke<ChatSession>(
    IPC_COMMANDS.RENAME_CHAT_SESSION,
    { sessionId: validId, title: validTitle },
    { requestId: generateRequestId() }
  );
}

/**
 * Toggles or updates the pinned flag of a chat session.
 */
export async function setChatSessionPinned(
  sessionId: string,
  pinned: boolean
): Promise<ChatSession> {
  const validId = validateSessionId(sessionId);

  if (!isTauriContext()) {
    const existing = mockSessions.get(validId);
    if (!existing) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Session '${validId}' not found`,
        retryable: false,
        userActionRequired: true,
      });
    }
    const updated: ChatSession = {
      ...existing,
      pinned,
    };
    mockSessions.set(validId, updated);
    return updated;
  }

  return await safeInvoke<ChatSession>(
    IPC_COMMANDS.SET_CHAT_SESSION_PINNED,
    { sessionId: validId, pinned },
    { requestId: generateRequestId() }
  );
}

/**
 * Deletes a chat session, cascading deletion to all attached messages.
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const validId = validateSessionId(sessionId);

  if (!isTauriContext()) {
    const existed = mockSessions.delete(validId);
    mockMessages.delete(validId);
    return existed;
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.DELETE_CHAT_SESSION,
    { sessionId: validId },
    { requestId: generateRequestId() }
  );
}

/**
 * Appends a message to a session in an atomic transaction.
 */
export async function appendChatMessage(
  request: AppendChatMessageRequest
): Promise<ChatMessage> {
  const validId = validateSessionId(request.sessionId);
  const validSender = validateSender(request.sender);
  const validContent = validateContent(request.content);
  const normalizedMetadata = normalizeMetadata(request.metadata);

  if (!isTauriContext()) {
    const session = mockSessions.get(validId);
    if (!session) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Session '${validId}' not found`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const now = Date.now();
    const message: ChatMessage = {
      id: `mock_msg_${now}_${mockCounter++}`,
      sessionId: validId,
      sender: validSender,
      content: validContent,
      metadata: normalizedMetadata,
      createdAt: now,
    };

    const sessionMessages = mockMessages.get(validId) || [];
    sessionMessages.push(message);
    mockMessages.set(validId, sessionMessages);

    session.updatedAt = Math.max(now, session.updatedAt + 1);
    return message;
  }

  return await safeInvoke<ChatMessage>(
    IPC_COMMANDS.APPEND_CHAT_MESSAGE,
    {
      sessionId: validId,
      sender: validSender,
      content: validContent,
      metadata: normalizedMetadata,
    },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves ordered messages for a session.
 */
export async function getChatMessages(
  request: GetChatMessagesRequest
): Promise<ChatMessage[]> {
  const validId = validateSessionId(request.sessionId);
  const limit = request.limit ?? 1000;
  const offset = request.offset ?? 0;

  if (!isTauriContext()) {
    const session = mockSessions.get(validId);
    if (!session) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Session '${validId}' not found`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const list = mockMessages.get(validId) || [];
    const sorted = [...list].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id.localeCompare(b.id);
    });
    return sorted.slice(offset, offset + limit);
  }

  return await safeInvoke<ChatMessage[]>(
    IPC_COMMANDS.GET_CHAT_MESSAGES,
    { sessionId: validId, limit, offset },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves a complete conversation thread (session metadata + ordered messages) in a single call.
 */
export async function getChatConversation(
  sessionId: string
): Promise<ChatConversation> {
  const validId = validateSessionId(sessionId);

  if (!isTauriContext()) {
    const session = mockSessions.get(validId);
    if (!session) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Session '${validId}' not found`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const list = mockMessages.get(validId) || [];
    const messages = [...list].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id.localeCompare(b.id);
    });

    return { session, messages };
  }

  return await safeInvoke<ChatConversation>(
    IPC_COMMANDS.GET_CHAT_CONVERSATION,
    { sessionId: validId },
    { requestId: generateRequestId() }
  );
}

/**
 * Deletes an individual chat message.
 */
export async function deleteChatMessage(messageId: string): Promise<boolean> {
  const validId = validateMessageId(messageId);

  if (!isTauriContext()) {
    for (const [sessionId, messages] of mockMessages.entries()) {
      const idx = messages.findIndex((m) => m.id === validId);
      if (idx !== -1) {
        messages.splice(idx, 1);
        mockMessages.set(sessionId, messages);
        return true;
      }
    }
    return false;
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.DELETE_CHAT_MESSAGE,
    { messageId: validId },
    { requestId: generateRequestId() }
  );
}
