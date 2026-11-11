/**
//! Nano Route — Chat Session & Message Persistence IPC Boundary
//! File: src/services/ipc/chat.ts
//!
//! Responsibility:
//! - Strongly-typed frontend API for chat sessions, messages, and conversation threads.
//! - Input validation, correlation ID generation, and sanitized error normalization.
//! - Seamless in-memory fallback for browser dev mode and automated test environments.
*/

import { Channel } from "@tauri-apps/api/core";
import { isTauriContext, safeInvoke, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  IPC_COMMANDS,
  type AppendChatMessageRequest,
  type ChatConversation,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatSession,
  type ChatSubmissionRequest,
  type ChatSubmissionResult,
  type CreateChatSessionRequest,
  type GetChatMessagesRequest,
  type ListChatSessionsRequest,
  type ChatManualRouteOverrideDto,
  type MessageSender,
  type ChatStreamEvent,
  type ChatStreamStartedEvent,
  type ChatStreamDeltaEvent,
  type ChatStreamUsageEvent,
  type ChatStreamCompletedEvent,
  type ChatStreamFailedEvent,
  type ChatStreamCancelledEvent,
  type ChatStreamFailoverEvent,
  type ChatStreamRetryEvent,
  type RoutingExplanationDto,
  type ExecutionLifecycleState,
  type TerminationReasonDto,
  type CancellationResultDto,
  type ExecutionStateDto,
  type ErrorCategory,
  type ErrorSeverity,
  type RetryabilityHint,
  type FailoverHint,
  type UserAction,
  type ClassificationProvenance,
  type ErrorEnvelope,
  type ContextStatus,
  type TokenCountProvenance,
  type ContextCheckResultDto,
  type QuotaScope,
  type QuotaSnapshotDto,
  type PreflightReasonCode,
  type ExecutionPreflightDto,
} from "./types.ts";

// ============================================================================
// Browser In-Memory Mock Store (enables development without running Tauri native core)
// ============================================================================

interface MockActiveExecution {
  executionId: string;
  sessionId: string;
  requestId: string;
  state: ExecutionLifecycleState;
  startedAtMs: number;
  endedAtMs?: number;
  cancellationToken: { isCancelled: boolean };
  providerId?: string;
  modelId?: string;
  streamId?: string;
}

const mockSessions = new Map<string, ChatSession>();
const mockMessages = new Map<string, ChatMessage[]>();
const mockExplanations = new Map<string, RoutingExplanationDto>();
const mockExecutions = new Map<string, MockActiveExecution>();
let mockCounter = 1;

export function setMockRoutingExplanation(
  messageId: string,
  explanation: RoutingExplanationDto
): void {
  mockExplanations.set(messageId, explanation);
}

export function clearMockRoutingExplanations(): void {
  mockExplanations.clear();
}

export function getMockExecutionCount(): number {
  return mockExecutions.size;
}

export function getActiveMockExecutionCount(): number {
  let count = 0;
  for (const exec of mockExecutions.values()) {
    if (
      exec.state === "created" ||
      exec.state === "validating" ||
      exec.state === "routing" ||
      exec.state === "route_resolved" ||
      exec.state === "executing" ||
      exec.state === "streaming" ||
      exec.state === "cancelling" ||
      exec.state === "recovering"
    ) {
      count++;
    }
  }
  return count;
}

export function resetChatMockStore(): void {
  mockSessions.clear();
  mockMessages.clear();
  mockExplanations.clear();
  mockExecutions.clear();
  mockCounter = 1;
}

/**
 * Shared authoritative mock store accessor for Step 41 History Explorer simulation.
 * Keeps browser dev / unit tests backed by the single authoritative chat mock store.
 */
export function __internalGetMockChatStore(): {
  sessions: Map<string, ChatSession>;
  messages: Map<string, ChatMessage[]>;
} {
  return {
    sessions: mockSessions,
    messages: mockMessages,
  };
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
    failoverUsed: input?.failoverUsed ?? null,
    failoverFromProvider: input?.failoverFromProvider ?? null,
    failoverFromModel: input?.failoverFromModel ?? null,
    failoverReason: input?.failoverReason ?? null,
    failoverAttempts: input?.failoverAttempts ?? null,
    retryCount: input?.retryCount ?? null,
    totalAttempts: input?.totalAttempts ?? null,
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

/**
 * Submits a user prompt through the complete routing pipeline and non-streaming provider execution.
 */
export async function submitChatPrompt(
  request: ChatSubmissionRequest
): Promise<ChatSubmissionResult> {
  const validSessionId = validateSessionId(request.sessionId);
  const validPrompt = validateContent(request.prompt);
  const requestId = request.requestId || generateRequestId();

  if (validPrompt.length > 32768) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Prompt exceeds maximum allowed length of 32,768 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!isTauriContext()) {
    const session = mockSessions.get(validSessionId);
    if (!session) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Target chat session '${validSessionId}' does not exist`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const sessionMessages = mockMessages.get(validSessionId) || [];
    let lastTime = 0;
    for (const m of sessionMessages) {
      if (m.createdAt > lastTime) {
        lastTime = m.createdAt;
      }
    }
    const userTime = Math.max(Date.now(), lastTime + 1);
    const assistantTime = userTime + 1;

    // 1. Persist User Message
    const userMessage: ChatMessage = {
      id: `mock_msg_${userTime}_${mockCounter++}`,
      sessionId: validSessionId,
      sender: "user",
      content: validPrompt,
      metadata: normalizeMetadata(),
      createdAt: userTime,
    };

    sessionMessages.push(userMessage);
    mockMessages.set(validSessionId, sessionMessages);

    // 2. Evaluate Routing or Manual Override
    let routedProvider = "deepseek";
    let routedModel = "deepseek-chat";
    let selectionMode = "automatic";
    let routingReason = "Highest policy-valid score among eligible candidates";

    if (request.manualOverride) {
      const ovr: ChatManualRouteOverrideDto = request.manualOverride;
      const providerId = (ovr.providerId || "").trim();
      const modelId = (ovr.modelId || "").trim();
      if (providerId === "invalid" || modelId === "unknown" || !providerId || !modelId) {
        throw new IpcError({
          code: "INVALID_INPUT",
          category: "InvalidInput",
          message: `Manual override rejected: Model '${modelId}' under provider '${providerId}' is not available`,
          retryable: false,
          userActionRequired: true,
        });
      }
      routedProvider = providerId;
      routedModel = modelId;
      selectionMode = "manual_override";
      routingReason = "Manual override selected and validated";
    }

    const executionId = request.executionId || `mock_exec_${userTime}_${mockCounter++}`;
    const cancellationToken = { isCancelled: false };
    const execRecord: MockActiveExecution = {
      executionId,
      sessionId: validSessionId,
      requestId,
      state: "executing",
      startedAtMs: userTime,
      cancellationToken,
      providerId: routedProvider,
      modelId: routedModel,
    };
    mockExecutions.set(executionId, execRecord);

    if (cancellationToken.isCancelled || validPrompt.includes("__CANCEL_SUBMIT__")) {
      execRecord.state = "cancelled";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "EXECUTION_CANCELLED",
        category: "Internal",
        message: "Chat execution was cancelled before completion",
        retryable: false,
      });
    }

    if (validPrompt.includes("__FAILOVER_EXHAUSTED__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "FAILOVER_EXHAUSTED",
        category: "Internal",
        message: "All routing candidates failed. Failover exhausted.",
        retryable: false,
        userActionRequired: true,
      });
    }

    // Step 39: Context, Quota & Availability Preflight Hooks
    if (validPrompt.includes("__ALL_CANDIDATES_CONTEXT_BLOCKED__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "CONTEXT_LIMIT_EXCEEDED",
        category: "InvalidInput",
        message: "Context limit exceeded: prompt and history exceed all candidate models' context windows",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__LOCAL_BUDGET_EXCEEDED__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "LOCAL_BUDGET_EXCEEDED",
        category: "ServiceUnavailable",
        message: "Provider spend ($50.00) exceeds local monthly budget limit ($50.00)",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__PROVIDER_QUOTA_EXHAUSTED__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "PROVIDER_QUOTA_EXHAUSTED",
        category: "ServiceUnavailable",
        message: "Provider quota has been exhausted for this billing period",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__ENDPOINT_MISCONFIGURED__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "ENDPOINT_MISCONFIGURED",
        category: "InvalidInput",
        message: "Endpoint URL must specify 'http://' or 'https://' protocol",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__PROVIDER_UNAVAILABLE__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "PROVIDER_UNAVAILABLE",
        category: "ServiceUnavailable",
        message: "Candidate provider is disabled or unavailable",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__CREDENTIAL_MISSING__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "CREDENTIAL_MISSING",
        category: "InvalidInput",
        message: "No configured credential found in DPAPI vault for provider",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__BUDGET_RESERVATION_RACE__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "LOCAL_BUDGET_EXCEEDED",
        category: "ServiceUnavailable",
        message: "Concurrent budget allocation exceeded limit",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__PERSISTENCE_FAILURE__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "DATABASE_WRITE_FAILED",
        category: "Internal",
        message: "Failed to persist assistant message to SQLite: disk I/O error",
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__FULL_EXHAUSTION__")) {
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "FAILOVER_EXHAUSTED",
        category: "Internal",
        message: "All candidates exhausted: Candidate A retries exhausted, B unavailable, C quota-blocked, D context-blocked",
        retryable: false,
        userActionRequired: true,
      });
    }

    let failoverUsed = false;
    let failoverFromProvider: string | null = null;
    let failoverFromModel: string | null = null;
    let failoverReason: string | null = null;
    let failoverAttempts: number | null = null;

    if (validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__")) {
      failoverUsed = true;
      failoverFromProvider = routedProvider;
      failoverFromModel = routedModel;
      failoverReason = "Primary candidate context limit exceeded (128k required > 32k capacity)";
      failoverAttempts = 1; // Zero physical attempts to primary!
      routedProvider = "anthropic";
      routedModel = "claude-3-5-sonnet-20241022";
      selectionMode = "fallback";
      routingReason = `${routingReason} (Preflight failed over from ${failoverFromProvider}/${failoverFromModel} due to context)`;
    }

    if (
      validPrompt.includes("__FAILOVER_TEST__") ||
      validPrompt.includes("__FAILOVER_SUCCESS__") ||
      validPrompt.includes("__PARTIAL_BEFORE_FAILOVER__")
    ) {
      if (selectionMode === "manual_override") {
        execRecord.state = "failed";
        execRecord.endedAtMs = Date.now();
        throw new IpcError({
          code: "PROVIDER_RATE_LIMIT",
          category: "ServiceUnavailable",
          message: "Rate limit reached for requests (429)",
          retryable: true,
          userActionRequired: true,
        });
      }
      failoverUsed = true;
      failoverFromProvider = routedProvider;
      failoverFromModel = routedModel;
      failoverReason = "Provider returned 429 Too Many Requests";
      failoverAttempts = 2;
      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";
      routingReason = `${routingReason} (Failed over from ${failoverFromProvider}/${failoverFromModel})`;
    }

    let retryCount: number | null = null;
    let totalAttempts: number | null = 1;

    if (validPrompt.includes("__RETRY_THEN_SUCCEED__") || validPrompt.includes("__RETRY_TEST__")) {
      retryCount = 1;
      totalAttempts = 2;
    }

    if (validPrompt.includes("__RATE_LIMIT_REPEATED_THEN_FAILOVER__")) {
      retryCount = 2;
      totalAttempts = 3;
      failoverUsed = true;
      failoverFromProvider = routedProvider;
      failoverFromModel = routedModel;
      failoverReason = "Candidate retries exhausted (429 RateLimit); failing over";
      failoverAttempts = 2;
      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";
    }

    if (validPrompt.includes("__AMBIGUOUS_TIMEOUT_NO_RETRY__")) {
      retryCount = 0;
      totalAttempts = 2;
      failoverUsed = true;
      failoverFromProvider = routedProvider;
      failoverFromModel = routedModel;
      failoverReason = "Ambiguous timeout after transmission; deferred to failover to prevent duplicate billing";
      failoverAttempts = 2;
      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";
    }

    // 3. Persist Assistant Message
    const latencyMs = failoverUsed ? 215 : (retryCount ? 230 : 115);
    const promptTokens = Math.max(1, Math.round(validPrompt.length / 4));
    const completionTokens = 42;
    const costUsd = validPrompt.includes("__UNKNOWN_PRICING_SUCCESS__")
      ? 0.0
      : failoverUsed
      ? 0.00025
      : retryCount
      ? 0.0003
      : 0.00015;

    const assistantMessage: ChatMessage = {
      id: `mock_msg_${assistantTime}_${mockCounter++}`,
      sessionId: validSessionId,
      sender: "assistant",
      content: `Response from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`,
      metadata: {
        routedProvider,
        routedModel,
        routingReason,
        slmConfidenceScore: 0.95,
        promptTokens,
        completionTokens,
        latencyMs,
        costUsd,
        failoverUsed: failoverUsed ? true : null,
        failoverFromProvider,
        failoverFromModel,
        failoverReason,
        failoverAttempts,
        retryCount,
        totalAttempts,
      },
      createdAt: assistantTime,
    };

    sessionMessages.push(assistantMessage);
    mockMessages.set(validSessionId, sessionMessages);
    session.updatedAt = assistantTime;

    execRecord.state = "completed";
    execRecord.endedAtMs = assistantTime;

    return {
      requestId,
      executionId,
      sessionId: validSessionId,
      userMessage,
      assistantMessage,
      routedProvider,
      routedModel,
      selectionMode,
      routingReason,
      slmConfidence: 0.95,
      latencyMs,
      promptTokens,
      completionTokens,
      costUsd,
      status: "completed",
    };
  }

  return await safeInvoke<ChatSubmissionResult>(
    IPC_COMMANDS.SUBMIT_CHAT_PROMPT,
    { request: { ...request, sessionId: validSessionId, prompt: validPrompt, requestId } },
    { requestId }
  );
}

function splitTextIntoMockChunks(text: string): string[] {
  const chunkSize = 16;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Streams a user prompt through the complete routing pipeline and live provider execution.
 *
 * Enforces:
 * - Emits typed ChatStreamEvents to onEvent callback in strict monotonic sequence order.
 * - Handles browser in-memory simulation for offline testing with chunk fragmentation.
 * - In Tauri context, attaches channel handler BEFORE command invocation (Rule 27).
 * - Resolves with final persisted ChatMessage on successful completion, or null if cancelled.
 * - Rejects with IpcError on failure (and does NOT persist assistant message).
 */
export async function streamChatPrompt(
  request: ChatSubmissionRequest,
  onEvent: (event: ChatStreamEvent) => void
): Promise<ChatMessage | null> {
  const validSessionId = validateSessionId(request.sessionId);
  const validPrompt = validateContent(request.prompt);
  const requestId = request.requestId || generateRequestId();

  if (validPrompt.length > 32768) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Prompt exceeds maximum allowed length of 32,768 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!isTauriContext()) {
    const session = mockSessions.get(validSessionId);
    if (!session) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Target chat session '${validSessionId}' does not exist`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const sessionMessages = mockMessages.get(validSessionId) || [];
    let lastTime = 0;
    for (const m of sessionMessages) {
      if (m.createdAt > lastTime) {
        lastTime = m.createdAt;
      }
    }
    const userTime = Math.max(Date.now(), lastTime + 1);
    const assistantTime = userTime + 1;
    const streamId = `strm_${userTime}_${mockCounter++}`;

    // 1. Persist User Message (Authoritative SQLite record before provider execution)
    const userMessage: ChatMessage = {
      id: `mock_msg_${userTime}_${mockCounter++}`,
      sessionId: validSessionId,
      sender: "user",
      content: validPrompt,
      metadata: normalizeMetadata(),
      createdAt: userTime,
    };

    sessionMessages.push(userMessage);
    mockMessages.set(validSessionId, sessionMessages);

    // 2. Evaluate Routing or Manual Override
    let routedProvider = "deepseek";
    let routedModel = "deepseek-chat";
    let selectionMode = "automatic";
    let routingReason = "Highest policy-valid score among eligible candidates";

    if (request.manualOverride) {
      const ovr: ChatManualRouteOverrideDto = request.manualOverride;
      const providerId = (ovr.providerId || "").trim();
      const modelId = (ovr.modelId || "").trim();
      if (providerId === "invalid" || modelId === "unknown" || !providerId || !modelId) {
        const failEvent: ChatStreamFailedEvent = {
          type: "failed",
          streamId,
          sequence: 0,
          code: "INVALID_OVERRIDE",
          message: `Manual override rejected: Model '${modelId}' under provider '${providerId}' is not available`,
          isRetryable: false,
        };
        onEvent(failEvent);
        throw new IpcError({
          code: "INVALID_INPUT",
          category: "InvalidInput",
          message: failEvent.message,
          retryable: false,
          userActionRequired: true,
        });
      }
      routedProvider = providerId;
      routedModel = modelId;
      selectionMode = "manual_override";
      routingReason = "Manual override selected and validated";
    }

    const executionId = request.executionId || `mock_exec_${userTime}_${mockCounter++}`;
    const cancellationToken = { isCancelled: false };
    const execRecord: MockActiveExecution = {
      executionId,
      sessionId: validSessionId,
      requestId,
      state: "streaming",
      startedAtMs: userTime,
      cancellationToken,
      providerId: routedProvider,
      modelId: routedModel,
      streamId,
    };
    mockExecutions.set(executionId, execRecord);

    let seq = 0;

    // Step 39: Context, Quota & Availability Preflight Validation
    if (validPrompt.includes("__ALL_CANDIDATES_CONTEXT_BLOCKED__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "CONTEXT_LIMIT_EXCEEDED",
        message: "Context limit exceeded: prompt and history exceed all candidate models' context windows",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "CONTEXT_LIMIT_EXCEEDED",
        category: "InvalidInput",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__LOCAL_BUDGET_EXCEEDED__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "LOCAL_BUDGET_EXCEEDED",
        message: "Provider spend exceeds local monthly budget limit",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "LOCAL_BUDGET_EXCEEDED",
        category: "ServiceUnavailable",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__PROVIDER_QUOTA_EXHAUSTED__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "PROVIDER_QUOTA_EXHAUSTED",
        message: "Provider quota has been exhausted for this billing period",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "PROVIDER_QUOTA_EXHAUSTED",
        category: "ServiceUnavailable",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__ENDPOINT_MISCONFIGURED__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "ENDPOINT_MISCONFIGURED",
        message: "Endpoint URL must specify 'http://' or 'https://' protocol",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "ENDPOINT_MISCONFIGURED",
        category: "InvalidInput",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__PERSISTENCE_FAILURE__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "DATABASE_WRITE_FAILED",
        message: "Failed to persist assistant message to SQLite: disk I/O error",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "DATABASE_WRITE_FAILED",
        category: "Internal",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__FULL_EXHAUSTION__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "FAILOVER_EXHAUSTED",
        message: "All candidates exhausted: Candidate A retries exhausted, B unavailable, C quota-blocked, D context-blocked",
        isRetryable: false,
      };
      onEvent(failEvent);
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      throw new IpcError({
        code: "FAILOVER_EXHAUSTED",
        category: "Internal",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__")) {
      routedProvider = "anthropic";
      routedModel = "claude-3-5-sonnet-20241022";
      selectionMode = "fallback";
      routingReason = "Fallback candidate selected: primary context limit exceeded";
    }

    // 3. Emit Started Event (Sequence 0)
    const startedEvent: ChatStreamStartedEvent = {
      type: "started",
      streamId,
      sequence: seq++,
      requestId,
      sessionId: validSessionId,
      userMessageId: userMessage.id,
      providerId: routedProvider,
      modelId: routedModel,
      selectionMode,
      routingReason,
      slmConfidence: 0.95,
      timestampMs: userTime,
      executionId,
    };
    onEvent(startedEvent);

    // Step 38: Transient Network / RateLimit Retry Hook
    if (validPrompt.includes("__RETRY_THEN_SUCCEED__") || validPrompt.includes("__RETRY_TEST__")) {
      const retryEvent: ChatStreamRetryEvent = {
        type: "retry",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 1,
        maxRetries: 2,
        delayMs: 100,
        providerId: routedProvider,
        modelId: routedModel,
        reason: "Transient connection reset before transmission",
        timestampMs: Date.now(),
        executionId,
      };
      onEvent(retryEvent);

      if (validPrompt.includes("__RETRY_BUDGET_BLOCKED__")) {
        const fbStreamId = `${streamId}_retry_budget_fb`;
        const failoverEvent: ChatStreamFailoverEvent = {
          type: "failover",
          streamId,
          newStreamId: fbStreamId,
          sequence: seq++,
          attempt: 1,
          fromProvider: routedProvider,
          fromModel: routedModel,
          toProvider: "openai",
          toModel: "gpt-4o-mini",
          reason: "Retry blocked by local budget ceiling; falling over to secondary route",
          timestampMs: Date.now(),
        };
        onEvent(failoverEvent);
        routedProvider = "openai";
        routedModel = "gpt-4o-mini";
        selectionMode = "fallback";
      }

      if (validPrompt.includes("__RETRY_CANCEL__")) {
        execRecord.state = "cancelled";
        execRecord.endedAtMs = Date.now();
        const cancelEvent: ChatStreamCancelledEvent = {
          type: "cancelled",
          streamId,
          sequence: seq++,
          executionId,
          reason: "user_cancelled",
          partialText: undefined,
          timestampMs: Date.now(),
        };
        onEvent(cancelEvent);
        return null;
      }

      // Fresh stream for retry attempt on same model
      const retryStreamId = `strm_retry_${userTime}_${mockCounter++}`;
      let retrySeq = 0;
      onEvent({
        type: "started",
        streamId: retryStreamId,
        sequence: retrySeq++,
        requestId,
        sessionId: validSessionId,
        userMessageId: userMessage.id,
        providerId: routedProvider,
        modelId: routedModel,
        selectionMode,
        routingReason,
        slmConfidence: 0.95,
        timestampMs: Date.now(),
        executionId,
      });

      const retryResponseText = `Response after retry from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`;
      const retryChunks = splitTextIntoMockChunks(retryResponseText);
      for (const chunk of retryChunks) {
        onEvent({
          type: "delta",
          streamId: retryStreamId,
          sequence: retrySeq++,
          text: chunk,
        });
      }

      const pTok = Math.max(1, Math.round(validPrompt.length / 4));
      const cTok = Math.max(1, Math.round(retryResponseText.length / 4));
      onEvent({
        type: "usage",
        streamId: retryStreamId,
        sequence: retrySeq++,
        promptTokens: pTok,
        completionTokens: cTok,
      });

      const retryAssistantMsg: ChatMessage = {
        id: `mock_msg_${assistantTime}_${mockCounter++}`,
        sessionId: validSessionId,
        sender: "assistant",
        content: retryResponseText,
        metadata: {
          routedProvider,
          routedModel,
          routingReason,
          slmConfidenceScore: 0.95,
          promptTokens: pTok,
          completionTokens: cTok,
          latencyMs: 230,
          costUsd: 0.0003,
          retryCount: 1,
          totalAttempts: 2,
          failoverUsed: false,
        },
        createdAt: assistantTime,
      };

      sessionMessages.push(retryAssistantMsg);
      mockMessages.set(validSessionId, sessionMessages);
      session.updatedAt = assistantTime;
      execRecord.state = "completed";
      execRecord.endedAtMs = assistantTime;

      onEvent({
        type: "completed",
        streamId: retryStreamId,
        sequence: retrySeq++,
        finishReason: "stop",
        latencyMs: 230,
        promptTokens: pTok,
        completionTokens: cTok,
        costUsd: 0.0003,
        assistantMessage: retryAssistantMsg,
      });

      return retryAssistantMsg;
    }

    // Step 38: Stream Tokens Emitted Mid-stream -> Unsafe for same model retry -> Defers to Failover!
    if (validPrompt.includes("__STREAM_TOKEN_EMITTED_NO_RETRY__")) {
      onEvent({
        type: "delta",
        streamId,
        sequence: seq++,
        text: "Partial stream token output from primary model...",
      });

      const fbStreamId = `strm_fallback_${userTime}_${mockCounter++}`;
      onEvent({
        type: "failover",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 2,
        fromProvider: routedProvider,
        fromModel: routedModel,
        toProvider: "openai",
        toModel: "gpt-4o-mini",
        reason: "Stream interrupted after output tokens emitted; same-model replay unsafe",
        newStreamId: fbStreamId,
        timestampMs: Date.now(),
        executionId,
      });

      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";

      let fbSeq = 0;
      onEvent({
        type: "started",
        streamId: fbStreamId,
        sequence: fbSeq++,
        requestId,
        sessionId: validSessionId,
        userMessageId: userMessage.id,
        providerId: routedProvider,
        modelId: routedModel,
        selectionMode,
        routingReason: "Fallback candidate selected after stream token emission failure",
        slmConfidence: 0.95,
        timestampMs: Date.now(),
        executionId,
      });

      const fbResponseText = `Fallback response from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`;
      const fbChunks = splitTextIntoMockChunks(fbResponseText);
      for (const chunk of fbChunks) {
        onEvent({
          type: "delta",
          streamId: fbStreamId,
          sequence: fbSeq++,
          text: chunk,
        });
      }

      const pTok = Math.max(1, Math.round(validPrompt.length / 4));
      const cTok = Math.max(1, Math.round(fbResponseText.length / 4));
      onEvent({
        type: "usage",
        streamId: fbStreamId,
        sequence: fbSeq++,
        promptTokens: pTok,
        completionTokens: cTok,
      });

      const fbMsg: ChatMessage = {
        id: `mock_msg_${assistantTime}_${mockCounter++}`,
        sessionId: validSessionId,
        sender: "assistant",
        content: fbResponseText,
        metadata: {
          routedProvider,
          routedModel,
          routingReason: "Fallback candidate selected after stream token emission failure",
          slmConfidenceScore: 0.95,
          promptTokens: pTok,
          completionTokens: cTok,
          latencyMs: 250,
          costUsd: 0.0003,
          failoverUsed: true,
          failoverFromProvider: "deepseek",
          failoverFromModel: "deepseek-chat",
          failoverReason: "Stream interrupted after output tokens emitted; same-model replay unsafe",
          failoverAttempts: 2,
          retryCount: 0,
          totalAttempts: 2,
        },
        createdAt: assistantTime,
      };

      sessionMessages.push(fbMsg);
      mockMessages.set(validSessionId, sessionMessages);
      session.updatedAt = assistantTime;
      execRecord.state = "completed";
      execRecord.endedAtMs = assistantTime;

      onEvent({
        type: "completed",
        streamId: fbStreamId,
        sequence: fbSeq++,
        finishReason: "stop",
        latencyMs: 250,
        promptTokens: pTok,
        completionTokens: cTok,
        costUsd: 0.0003,
        assistantMessage: fbMsg,
      });

      return fbMsg;
    }

    // Step 38: Repeated 429 Rate Limits -> Retries Exhausted -> Step 37 Failover
    if (validPrompt.includes("__RATE_LIMIT_REPEATED_THEN_FAILOVER__")) {
      onEvent({
        type: "retry",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 1,
        maxRetries: 2,
        delayMs: 100,
        providerId: routedProvider,
        modelId: routedModel,
        reason: "Rate limit reached (429); backoff retry 1",
        timestampMs: Date.now(),
        executionId,
      });
      onEvent({
        type: "retry",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 2,
        maxRetries: 2,
        delayMs: 200,
        providerId: routedProvider,
        modelId: routedModel,
        reason: "Rate limit reached (429); backoff retry 2",
        timestampMs: Date.now(),
        executionId,
      });

      const fbStreamId = `strm_fallback_${userTime}_${mockCounter++}`;
      onEvent({
        type: "failover",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 3,
        fromProvider: routedProvider,
        fromModel: routedModel,
        toProvider: "openai",
        toModel: "gpt-4o-mini",
        reason: "Primary candidate retries exhausted (429); failing over",
        newStreamId: fbStreamId,
        timestampMs: Date.now(),
        executionId,
      });

      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";

      let fbSeq = 0;
      onEvent({
        type: "started",
        streamId: fbStreamId,
        sequence: fbSeq++,
        requestId,
        sessionId: validSessionId,
        userMessageId: userMessage.id,
        providerId: routedProvider,
        modelId: routedModel,
        selectionMode,
        routingReason: "Fallback candidate selected after primary retry exhaustion",
        slmConfidence: 0.95,
        timestampMs: Date.now(),
        executionId,
      });

      const fbResponseText = `Fallback response from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`;
      const fbChunks = splitTextIntoMockChunks(fbResponseText);
      for (const chunk of fbChunks) {
        onEvent({
          type: "delta",
          streamId: fbStreamId,
          sequence: fbSeq++,
          text: chunk,
        });
      }

      const pTok = Math.max(1, Math.round(validPrompt.length / 4));
      const cTok = Math.max(1, Math.round(fbResponseText.length / 4));
      onEvent({
        type: "usage",
        streamId: fbStreamId,
        sequence: fbSeq++,
        promptTokens: pTok,
        completionTokens: cTok,
      });

      const fbMsg: ChatMessage = {
        id: `mock_msg_${assistantTime}_${mockCounter++}`,
        sessionId: validSessionId,
        sender: "assistant",
        content: fbResponseText,
        metadata: {
          routedProvider,
          routedModel,
          routingReason: "Fallback candidate selected after primary retry exhaustion",
          slmConfidenceScore: 0.95,
          promptTokens: pTok,
          completionTokens: cTok,
          latencyMs: 350,
          costUsd: 0.0004,
          failoverUsed: true,
          failoverFromProvider: "deepseek",
          failoverFromModel: "deepseek-chat",
          failoverReason: "Primary candidate retries exhausted (429); failing over",
          failoverAttempts: 3,
          retryCount: 2,
          totalAttempts: 3,
        },
        createdAt: assistantTime,
      };

      sessionMessages.push(fbMsg);
      mockMessages.set(validSessionId, sessionMessages);
      session.updatedAt = assistantTime;
      execRecord.state = "completed";
      execRecord.endedAtMs = assistantTime;

      onEvent({
        type: "completed",
        streamId: fbStreamId,
        sequence: fbSeq++,
        finishReason: "stop",
        latencyMs: 350,
        promptTokens: pTok,
        completionTokens: cTok,
        costUsd: 0.0004,
        assistantMessage: fbMsg,
      });

      return fbMsg;
    }

    if (validPrompt.includes("__FAILOVER_EXHAUSTED__")) {
      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: "FAILOVER_EXHAUSTED",
        message: "All routing candidates failed. Failover exhausted.",
        isRetryable: false,
      };
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      onEvent(failEvent);
      throw new IpcError({
        code: "FAILOVER_EXHAUSTED",
        category: "Internal",
        message: failEvent.message,
        retryable: false,
        userActionRequired: true,
      });
    }

    if (
      validPrompt.includes("__FAILOVER_TEST__") ||
      validPrompt.includes("__FAILOVER_SUCCESS__") ||
      validPrompt.includes("__PARTIAL_BEFORE_FAILOVER__")
    ) {
      if (selectionMode === "manual_override") {
        const failEvent: ChatStreamFailedEvent = {
          type: "failed",
          streamId,
          sequence: seq++,
          code: "PROVIDER_RATE_LIMIT",
          message: "Rate limit reached for requests (429)",
          isRetryable: true,
        };
        execRecord.state = "failed";
        execRecord.endedAtMs = Date.now();
        onEvent(failEvent);
        throw new IpcError({
          code: "PROVIDER_RATE_LIMIT",
          category: "ServiceUnavailable",
          message: failEvent.message,
          retryable: true,
          userActionRequired: true,
        });
      }

      // If requested, emit partial primary text before failover to test discard contract
      if (validPrompt.includes("__PARTIAL_BEFORE_FAILOVER__")) {
        onEvent({
          type: "delta",
          streamId,
          sequence: seq++,
          text: "Partial text from primary model before failing...",
        });
      }

      const fbStreamId = `strm_fallback_${userTime}_${mockCounter++}`;
      const failoverEvent: ChatStreamFailoverEvent = {
        type: "failover",
        streamId,
        sequence: seq++,
        logicalRequestId: requestId,
        attempt: 2,
        fromProvider: routedProvider,
        fromModel: routedModel,
        toProvider: "openai",
        toModel: "gpt-4o-mini",
        reason: "Primary provider rate limit exceeded (429)",
        newStreamId: fbStreamId,
        timestampMs: Date.now(),
        executionId,
      };
      onEvent(failoverEvent);

      if (validPrompt.includes("__FAILOVER_CANCEL__")) {
        execRecord.state = "cancelled";
        execRecord.endedAtMs = Date.now();
        const cancelEvent: ChatStreamCancelledEvent = {
          type: "cancelled",
          streamId: fbStreamId,
          sequence: 0,
          executionId,
          reason: "user_cancelled",
          partialText: undefined,
          timestampMs: Date.now(),
        };
        onEvent(cancelEvent);
        return null;
      }

      routedProvider = "openai";
      routedModel = "gpt-4o-mini";
      selectionMode = "fallback";

      let fbSeq = 0;
      const startedFbEvent: ChatStreamStartedEvent = {
        type: "started",
        streamId: fbStreamId,
        sequence: fbSeq++,
        requestId,
        sessionId: validSessionId,
        userMessageId: userMessage.id,
        providerId: routedProvider,
        modelId: routedModel,
        selectionMode,
        routingReason: "Fallback candidate selected after primary failure",
        slmConfidence: 0.95,
        timestampMs: Date.now(),
        executionId,
      };
      onEvent(startedFbEvent);

      const fbResponseText = `Fallback response from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`;
      const fbChunks = splitTextIntoMockChunks(fbResponseText);
      for (const chunk of fbChunks) {
        onEvent({
          type: "delta",
          streamId: fbStreamId,
          sequence: fbSeq++,
          text: chunk,
        });
      }

      const fbPromptTokens = Math.max(1, Math.round(validPrompt.length / 4));
      const fbCompletionTokens = Math.max(1, Math.round(fbResponseText.length / 4));
      onEvent({
        type: "usage",
        streamId: fbStreamId,
        sequence: fbSeq++,
        promptTokens: fbPromptTokens,
        completionTokens: fbCompletionTokens,
      });

      const fbLatencyMs = 210;
      const fbCostUsd = 0.00025;
      const fbAssistantMessage: ChatMessage = {
        id: `mock_msg_${assistantTime}_${mockCounter++}`,
        sessionId: validSessionId,
        sender: "assistant",
        content: fbResponseText,
        metadata: {
          routedProvider,
          routedModel,
          routingReason: "Fallback candidate selected after primary failure",
          slmConfidenceScore: 0.95,
          promptTokens: fbPromptTokens,
          completionTokens: fbCompletionTokens,
          latencyMs: fbLatencyMs,
          costUsd: fbCostUsd,
          failoverUsed: true,
          failoverFromProvider: "deepseek",
          failoverFromModel: "deepseek-chat",
          failoverReason: "Primary provider rate limit exceeded (429)",
          failoverAttempts: 2,
        },
        createdAt: assistantTime,
      };

      sessionMessages.push(fbAssistantMessage);
      mockMessages.set(validSessionId, sessionMessages);
      session.updatedAt = assistantTime;
      execRecord.state = "completed";
      execRecord.endedAtMs = assistantTime;

      onEvent({
        type: "completed",
        streamId: fbStreamId,
        sequence: fbSeq++,
        finishReason: "stop",
        latencyMs: fbLatencyMs,
        promptTokens: fbPromptTokens,
        completionTokens: fbCompletionTokens,
        costUsd: fbCostUsd,
        assistantMessage: fbAssistantMessage,
      });

      return fbAssistantMessage;
    }

    // Simulated Provider Failure test hook (Step 33 + Step 36 error envelopes)
    if (
      validPrompt.includes("__FAIL_STREAM__") ||
      validPrompt.includes("__FAIL_AUTH__") ||
      validPrompt.includes("__FAIL_RATELIMIT__") ||
      validPrompt.includes("__FAIL_CONTEXT__")
    ) {
      let rawMsg = "Injected stream provider failure";
      let simulatedStatus: number | undefined = undefined;
      if (validPrompt.includes("__FAIL_AUTH__")) {
        rawMsg = "Incorrect API key provided: sk-proj-1234567890abcdef";
        simulatedStatus = 401;
      } else if (validPrompt.includes("__FAIL_RATELIMIT__")) {
        rawMsg = "Rate limit reached for requests: 429 Too Many Requests";
        simulatedStatus = 429;
      } else if (validPrompt.includes("__FAIL_CONTEXT__")) {
        rawMsg =
          "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.";
        simulatedStatus = 400;
      }

      const envelope = createMockErrorEnvelope({
        errorMessage: rawMsg,
        httpStatus: simulatedStatus,
        providerId: routedProvider,
        modelId: routedModel,
        executionId,
      });

      const failEvent: ChatStreamFailedEvent = {
        type: "failed",
        streamId,
        sequence: seq++,
        code: validPrompt.includes("__FAIL_STREAM__")
          ? "STREAM_PROVIDER_ERROR"
          : envelope.errorCode,
        message: envelope.userMessage,
        isRetryable: validPrompt.includes("__FAIL_STREAM__")
          ? false
          : envelope.retryabilityHint === "likely_transient",
        error: envelope,
      };
      execRecord.state = "failed";
      execRecord.endedAtMs = Date.now();
      onEvent(failEvent);
      throw new IpcError({
        code: envelope.errorCode,
        category: "Internal",
        message: failEvent.message,
        retryable: failEvent.isRetryable,
        userActionRequired: envelope.userAction !== "none",
      });
    }

    // 4. Emit Incremental Deltas
    const responseText = `Response from **${routedProvider}** (${routedModel}) for query:\n\n${validPrompt}`;
    const chunks = splitTextIntoMockChunks(responseText);
    let chunkIndex = 0;
    let accumulatedDeltaText = "";

    for (const chunk of chunks) {
      if (validPrompt.includes("__ASYNC_STREAM__")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      if (
        cancellationToken.isCancelled ||
        validPrompt.includes("__CANCEL_STREAM__") ||
        (validPrompt.includes("__CANCEL_MID_STREAM__") && chunkIndex >= 2)
      ) {
        execRecord.state = "cancelled";
        execRecord.endedAtMs = Date.now();
        const cancelEvent: ChatStreamCancelledEvent = {
          type: "cancelled",
          streamId,
          sequence: seq++,
          executionId,
          reason: cancellationToken.isCancelled ? "session_changed" : "user_cancelled",
          partialText: accumulatedDeltaText,
          timestampMs: Date.now(),
        };
        onEvent(cancelEvent);
        return null;
      }

      chunkIndex++;
      accumulatedDeltaText += chunk;
      const deltaEvent: ChatStreamDeltaEvent = {
        type: "delta",
        streamId,
        sequence: seq++,
        text: chunk,
      };
      onEvent(deltaEvent);
    }

    // 5. Emit Usage Notification
    const promptTokens = Math.max(1, Math.round(validPrompt.length / 4));
    const completionTokens = Math.max(1, Math.round(responseText.length / 4));
    const usageEvent: ChatStreamUsageEvent = {
      type: "usage",
      streamId,
      sequence: seq++,
      promptTokens,
      completionTokens,
    };
    onEvent(usageEvent);

    // 6. Persist Assistant Message to SQLite (EXACTLY ONCE upon successful completion)
    const latencyMs = 115;
    const costUsd = validPrompt.includes("__UNKNOWN_PRICING_SUCCESS__")
      ? 0.0
      : validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__")
      ? 0.00025
      : 0.00015;

    const assistantMessage: ChatMessage = {
      id: `mock_msg_${assistantTime}_${mockCounter++}`,
      sessionId: validSessionId,
      sender: "assistant",
      content: responseText,
      metadata: {
        routedProvider,
        routedModel,
        routingReason,
        slmConfidenceScore: 0.95,
        promptTokens,
        completionTokens,
        latencyMs,
        costUsd,
        failoverUsed: validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__") ? true : undefined,
        failoverFromProvider: validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__") ? "deepseek" : undefined,
        failoverFromModel: validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__") ? "deepseek-chat" : undefined,
        failoverAttempts: validPrompt.includes("__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__") ? 1 : undefined,
      },
      createdAt: assistantTime,
    };

    sessionMessages.push(assistantMessage);
    mockMessages.set(validSessionId, sessionMessages);
    session.updatedAt = assistantTime;

    execRecord.state = "completed";
    execRecord.endedAtMs = assistantTime;

    // 7. Emit Terminal Completed Event
    const completedEvent: ChatStreamCompletedEvent = {
      type: "completed",
      streamId,
      sequence: seq++,
      finishReason: "stop",
      latencyMs,
      promptTokens,
      completionTokens,
      costUsd,
      assistantMessage,
    };
    onEvent(completedEvent);

    return assistantMessage;
  }

  // Native Tauri IPC Execution Path
  const channel = new Channel<ChatStreamEvent>();

  return new Promise<ChatMessage | null>((resolve, reject) => {
    let highestSequence = -1;

    // MANDATORY RULE 27: Handler attached BEFORE command invocation
    channel.onmessage = (event: ChatStreamEvent) => {
      if (typeof event === "object" && event !== null && "sequence" in event) {
        if (event.sequence < highestSequence) {
          console.warn(
            `[Streaming IPC] Out-of-order sequence ${event.sequence} (expected >= ${highestSequence})`
          );
          return;
        }
        highestSequence = event.sequence;
      }

      try {
        onEvent(event);
      } catch (listenerErr) {
        console.error("[Streaming IPC] Error in stream event callback", listenerErr);
      }

      if (event.type === "completed") {
        resolve(event.assistantMessage);
      } else if (event.type === "cancelled") {
        resolve(null);
      } else if (event.type === "failed") {
        reject(
          new IpcError({
            code: event.code,
            category: "Internal",
            message: event.message,
            retryable: event.isRetryable,
          })
        );
      }
    };

    safeInvoke(IPC_COMMANDS.STREAM_CHAT_PROMPT, {
      request: { ...request, sessionId: validSessionId, prompt: validPrompt, requestId },
      channel,
    }).catch((err) => {
      reject(err);
    });
  });
}

// ============================================================================
// Step 35: Recovery & Execution Lifecycle Control API
// ============================================================================

/**
 * Cancels an active chat execution by stable execution ID.
 */
export async function cancelChatExecution(
  executionId: string,
  reason: TerminationReasonDto = "user_cancelled"
): Promise<CancellationResultDto> {
  const trimmed = executionId?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Execution ID cannot be empty",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!isTauriContext()) {
    const exec = mockExecutions.get(trimmed);
    if (!exec) {
      throw new IpcError({
        code: "EXECUTION_NOT_FOUND",
        category: "InvalidInput",
        message: `Execution '${trimmed}' not found or already cleaned up`,
        retryable: false,
      });
    }

    const prevState = exec.state;
    exec.cancellationToken.isCancelled = true;
    exec.state = "cancelled";
    exec.endedAtMs = exec.endedAtMs ?? Date.now();

    return {
      executionId: trimmed,
      previousState: prevState,
      state: "cancelled",
      cancelled: true,
      reason,
      durationMs: exec.endedAtMs - exec.startedAtMs,
      message:
        prevState === "cancelled" || prevState === "completed" || prevState === "failed"
          ? `Execution is already in a terminal state ('${prevState}')`
          : "Execution successfully cancelled",
    };
  }

  return safeInvoke<CancellationResultDto>(IPC_COMMANDS.CANCEL_CHAT_EXECUTION, {
    executionId: trimmed,
    reason,
  });
}

/**
 * Cancels an active chat execution for a specific session ID, if any is running.
 */
export async function cancelSessionChat(
  sessionId: string,
  reason: TerminationReasonDto = "session_changed"
): Promise<CancellationResultDto | null> {
  const trimmed = validateSessionId(sessionId);

  if (!isTauriContext()) {
    for (const exec of mockExecutions.values()) {
      if (
        exec.sessionId === trimmed &&
        (exec.state === "streaming" ||
          exec.state === "executing" ||
          exec.state === "routing" ||
          exec.state === "created" ||
          exec.state === "validating")
      ) {
        return cancelChatExecution(exec.executionId, reason);
      }
    }
    return null;
  }

  return safeInvoke<CancellationResultDto | null>(IPC_COMMANDS.CANCEL_SESSION_CHAT, {
    sessionId: trimmed,
    reason,
  });
}

/**
 * Retrieves the current execution lifecycle state by execution ID.
 */
export async function getExecutionState(
  executionId: string
): Promise<ExecutionStateDto | null> {
  const trimmed = executionId?.trim();
  if (!trimmed) return null;

  if (!isTauriContext()) {
    const exec = mockExecutions.get(trimmed);
    if (!exec) return null;
    const now = Date.now();
    const durationMs = (exec.endedAtMs ?? now) - exec.startedAtMs;
    const isTerminal =
      exec.state === "completed" || exec.state === "cancelled" || exec.state === "failed";
    const isActive = !isTerminal;
    return {
      executionId: exec.executionId,
      requestId: exec.requestId,
      sessionId: exec.sessionId,
      state: exec.state,
      providerId: exec.providerId,
      modelId: exec.modelId,
      streamId: exec.streamId,
      startedAtMs: exec.startedAtMs,
      endedAtMs: exec.endedAtMs,
      durationMs,
      isActive,
      isTerminal,
      canCancel: isActive && exec.state !== "cancelling",
      terminationReason: exec.state === "cancelled" ? "user_cancelled" : undefined,
    };
  }

  return safeInvoke<ExecutionStateDto | null>(IPC_COMMANDS.GET_EXECUTION_STATE, {
    executionId: trimmed,
  });
}

// ============================================================================
// Step 34: Routing Explanation API
// ============================================================================

/**
 * Retrieves the comprehensive routing explanation for a specific assistant message.
 * Explains on-device SLM task classification, 11-dimension candidate scores,
 * policy constraints, and runner-up alternative selection margins.
 * Strictly read-only: never reruns SLM inference or scoring!
 */
export async function getRoutingExplanation(
  messageId: string,
  sessionId?: string
): Promise<RoutingExplanationDto> {
  const validMessageId = validateMessageId(messageId);
  const trimmedSessionId = sessionId?.trim() || null;

  if (!isTauriContext()) {
    // 1. Check explicit mock overrides for testing
    if (mockExplanations.has(validMessageId)) {
      const expl = mockExplanations.get(validMessageId)!;
      if (trimmedSessionId && expl.sessionId && expl.sessionId !== trimmedSessionId) {
        throw new IpcError({
          code: "INVALID_INPUT",
          category: "InvalidInput",
          message: `Message '${validMessageId}' does not belong to session '${trimmedSessionId}'`,
          retryable: false,
        });
      }
      return expl;
    }

    // 2. Search message in mock store
    let targetMessage: ChatMessage | null = null;
    let targetSessionId = trimmedSessionId;

    for (const [sId, msgs] of mockMessages.entries()) {
      const found = msgs.find((m) => m.id === validMessageId);
      if (found) {
        targetMessage = found;
        if (!targetSessionId) {
          targetSessionId = sId;
        } else if (targetSessionId !== sId) {
          throw new IpcError({
            code: "INVALID_INPUT",
            category: "InvalidInput",
            message: `Message '${validMessageId}' does not belong to session '${trimmedSessionId}'`,
            retryable: false,
          });
        }
        break;
      }
    }

    if (!targetMessage) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Message '${validMessageId}' was not found`,
        retryable: false,
      });
    }

    if (targetMessage.sender !== "assistant") {
      throw new IpcError({
        code: "INVALID_INPUT",
        category: "InvalidInput",
        message: `Message '${validMessageId}' is a '${targetMessage.sender}' message. Routing explanations are only available for assistant messages.`,
        retryable: false,
      });
    }

    const pId = targetMessage.metadata?.routedProvider || "openai";
    const mId = targetMessage.metadata?.routedModel || "gpt-4o";
    const reason =
      targetMessage.metadata?.routingReason ||
      "Selected by routing policy based on task requirements";
    const slmConf = targetMessage.metadata?.slmConfidenceScore ?? 0.85;

    return {
      schemaVersion: "1.0",
      scoringAlgorithmVersion: "1.0",
      policyVersion: "1.0",
      classifierVersion: "slm-intent-v1",
      messageId: validMessageId,
      sessionId: targetSessionId,
      selectionMode: "automatic",
      summary: `Selected ${mId} (${pId}) based on local task analysis and candidate scoring.`,
      decisionReason: reason,
      isHistorical: false,
      selectedRoute: {
        providerId: pId,
        providerName: pId.charAt(0).toUpperCase() + pId.slice(1),
        modelId: mId,
        modelName: mId,
        isLocal: false,
        contextWindow: 128000,
      },
      taskSummary: {
        primaryIntent: "Coding",
        intentLabel: "Coding & Software Engineering",
        intentConfidence: slmConf,
        complexity: "High",
        complexityLabel: "High (Multi-step reasoning / code)",
        complexityScore: 0.82,
        domains: ["Coding", "Architecture"],
        requiredCapabilities: [
          { capability: "code_generation", label: "Code Generation", isMatchedBySelectedModel: true },
          { capability: "complex_reasoning", label: "Complex Reasoning", isMatchedBySelectedModel: true },
        ],
        isAmbiguous: false,
        ambiguityLevel: "low",
        completeness: "complete",
      },
      scoreBreakdown: {
        overallScore: 0.88,
        dimensions: [
          { key: "intent_match", label: "Intent & Capability Match", score: 0.95, weightPercent: 25, weightedContribution: 0.2375, explanation: "Matches all required coding capabilities", status: "Optimal" },
          { key: "quality", label: "Model Intelligence & Quality", score: 0.90, weightPercent: 20, weightedContribution: 0.18, explanation: "High reasoning tier", status: "High" },
          { key: "latency", label: "Latency & Speed", score: 0.80, weightPercent: 15, weightedContribution: 0.12, explanation: "Historical latency within target threshold", status: "Good" },
          { key: "cost", label: "Cost & Token Efficiency", score: 0.75, weightPercent: 15, weightedContribution: 0.1125, explanation: "Competitive pricing tier", status: "Moderate" },
          { key: "context_window", label: "Context Window Fit", score: 0.95, weightPercent: 10, weightedContribution: 0.095, explanation: "Ample context headroom", status: "Optimal" },
          { key: "health", label: "Provider Health & Availability", score: 1.0, weightPercent: 10, weightedContribution: 0.10, explanation: "Operational with healthy probe status", status: "Healthy" },
          { key: "preference", label: "User Preference Alignment", score: 0.70, weightPercent: 5, weightedContribution: 0.035, explanation: "Aligns with balanced preference profile", status: "Neutral" },
        ],
        adjustments: [],
      },
      confidenceSummary: {
        slmConfidence: slmConf,
        slmConfidenceLevel: slmConf >= 0.8 ? "High" : slmConf >= 0.5 ? "Medium" : "Low",
        routingFit: 0.88,
        selectionMargin: 0.12,
        description: "Confidence reflects local SLM intent classification certainty (not output correctness) combined with normalized candidate suitability score.",
      },
      selectionMargin: {
        margin: 0.12,
        runnerUpModel: "claude-3-5-sonnet-20241022",
        runnerUpScore: 0.76,
        description: "Clear margin (0.12) over closest runner-up candidate.",
      },
      alternatives: [
        { rank: 1, providerId: pId, providerName: pId, modelId: mId, displayName: mId, score: 0.88, isEligible: true, ineligibilityReason: null, status: "Selected" },
        { rank: 2, providerId: "anthropic", providerName: "Anthropic", modelId: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet", score: 0.76, isEligible: true, ineligibilityReason: null, status: "Eligible" },
        { rank: 3, providerId: "deepseek", providerName: "DeepSeek", modelId: "deepseek-chat", displayName: "DeepSeek V3", score: 0.72, isEligible: true, ineligibilityReason: null, status: "Eligible" },
      ],
      policyFactors: [
        { factor: "preference_mode", label: "Preference Mode", description: "Balanced performance and cost optimization" },
        { factor: "credential_status", label: "Credential Check", description: "Valid DPAPI stored credentials verified" },
      ],
      evidence: [
        { source: "slm_classifier", label: "SLM Intent Classifier", detail: "Evaluated prompt intent on-device via local ONNX runtime" },
        { source: "scoring_engine", label: "Routing Scoring Engine", detail: "Computed multi-factor fitness across 11 dimensions" },
        { source: "policy_engine", label: "Routing Policy Engine", detail: "Enforced threshold filters and preference rules" },
      ],
      generatedAtMs: Date.now(),
    };
  }

  return safeInvoke<RoutingExplanationDto>(IPC_COMMANDS.GET_ROUTING_EXPLANATION, {
    messageId: validMessageId,
    sessionId: trimmedSessionId,
  });
}

// ============================================================================
// Step 36: Error Classification & Normalized Failure Handling API
// ============================================================================

export interface ClassifyErrorParams {
  errorMessage: string;
  httpStatus?: number;
  providerId?: string;
  modelId?: string;
  executionId?: string;
}

/**
 * Creates a mock normalized ErrorEnvelope for browser dev mode and unit tests.
 */
export function createMockErrorEnvelope(params: ClassifyErrorParams): ErrorEnvelope {
  const rawMsg = (params.errorMessage || "").trim();
  const lower = rawMsg.toLowerCase();
  const status = params.httpStatus;

  let category: ErrorCategory = "unknown";
  let errorCode = "UNKNOWN_ERROR";
  let severity: ErrorSeverity = "error";
  let retryability: RetryabilityHint = "unknown";
  let failover: FailoverHint = "unknown";
  let userAction: UserAction = "none";
  let provenance: ClassificationProvenance = "fallback_unknown";

  if (lower.includes("cancel") || lower.includes("abort")) {
    category = "cancelled";
    errorCode = "CANCELLED";
    severity = "info";
    retryability = "not_applicable";
    failover = "not_applicable";
    userAction = "none";
    provenance = "cancellation";
  } else if (
    status === 401 ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("api key not valid") ||
    lower.includes("authentication")
  ) {
    category = "authentication_failed";
    errorCode = "AUTHENTICATION_FAILED";
    severity = "error";
    retryability = "user_action_required";
    failover = "unknown";
    userAction = "update_credential";
    provenance = status ? "http_status" : "provider_specific";
  } else if (
    status === 403 ||
    lower.includes("forbidden") ||
    lower.includes("permission denied") ||
    lower.includes("does not have access")
  ) {
    category = "authorization_failed";
    errorCode = "AUTHORIZATION_FAILED";
    severity = "error";
    retryability = "user_action_required";
    failover = "unknown";
    userAction = "check_provider_access";
    provenance = status ? "http_status" : "provider_specific";
  } else if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("resource exhausted") ||
    lower.includes("quota")
  ) {
    category = "rate_limited";
    errorCode = "RATE_LIMITED";
    severity = "warning";
    retryability = "likely_transient";
    failover = "potentially_eligible";
    userAction = "wait_and_retry_later";
    provenance = status ? "http_status" : "provider_specific";
  } else if (
    lower.includes("maximum context length") ||
    lower.includes("context_length_exceeded") ||
    lower.includes("prompt is too long") ||
    lower.includes("token limit") ||
    lower.includes("tokens")
  ) {
    category = "context_limit_exceeded";
    errorCode = "CONTEXT_LIMIT_EXCEEDED";
    severity = "error";
    retryability = "user_action_required";
    failover = "usually_not_eligible";
    userAction = "reduce_input";
    provenance = "provider_specific";
  } else if (
    status === 408 ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline exceeded")
  ) {
    category = "timeout";
    errorCode = "TIMEOUT";
    severity = "warning";
    retryability = "likely_transient";
    failover = "potentially_eligible";
    userAction = "wait_and_retry_later";
    provenance = status ? "http_status" : "transport";
  } else if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    lower.includes("service unavailable") ||
    lower.includes("provider unavailable") ||
    lower.includes("overloaded")
  ) {
    category = "provider_unavailable";
    errorCode = "PROVIDER_UNAVAILABLE";
    severity = "warning";
    retryability = "likely_transient";
    failover = "potentially_eligible";
    userAction = "contact_provider";
    provenance = status ? "http_status" : "provider_specific";
  } else if (
    lower.includes("not found") ||
    lower.includes("does not exist") ||
    lower.includes("model unavailable")
  ) {
    category = "model_unavailable";
    errorCode = "MODEL_UNAVAILABLE";
    severity = "error";
    retryability = "likely_permanent";
    failover = "potentially_eligible";
    userAction = "none";
    provenance = status ? "http_status" : "provider_specific";
  } else if (
    lower.includes("stream interrupted") ||
    lower.includes("stream error") ||
    lower.includes("stream provider failure") ||
    lower.includes("connection reset")
  ) {
    category = "stream_interrupted";
    errorCode = "STREAM_INTERRUPTED";
    severity = "warning";
    retryability = "likely_transient";
    failover = "potentially_eligible";
    userAction = "none";
    provenance = "stream_protocol";
  } else if (
    lower.includes("database") ||
    lower.includes("sqlite") ||
    lower.includes("persistence")
  ) {
    category = "database_failure";
    errorCode = "DATABASE_FAILURE";
    severity = "error";
    retryability = "likely_permanent";
    failover = "usually_not_eligible";
    userAction = "none";
    provenance = "persistence";
  }

  // Scrub sensitive tokens and local filesystem paths (aligned with src-tauri/src/errors/sanitizer.rs)
  const sanitized = rawMsg
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]{8,}/gi, "$1[REDACTED]")
    .replace(/(?:sk-|AIzaSy|gsk_|ghp_)[A-Za-z0-9_\-]{16,}/gi, "[REDACTED_API_KEY]")
    .replace(/[A-Za-z]:\\[Uu]sers\\[^\s,"';\)]+/gi, "[REDACTED_LOCAL_PATH]")
    .replace(/\/home\/[^\s,"';\)]+/gi, "[REDACTED_LOCAL_PATH]");

  const nowMs = Date.now();
  return {
    errorId: `err_${nowMs}_${Math.random().toString(36).substring(2, 8)}`,
    errorCode,
    category,
    severity,
    userMessage: sanitized || "An unexpected error occurred during request processing.",
    technicalMessage: sanitized || "No diagnostic details provided.",
    executionId: params.executionId,
    providerId: params.providerId,
    modelId: params.modelId,
    httpStatus: status,
    isTerminal: true,
    retryabilityHint: retryability,
    failoverHint: failover,
    userAction,
    provenance,
    schemaVersion: 1,
    occurredAtMs: nowMs,
  };
}

/**
 * Classifies and normalizes an error via native IPC or fallback mock.
 */
export async function classifyError(params: ClassifyErrorParams): Promise<ErrorEnvelope> {
  if (!isTauriContext()) {
    return createMockErrorEnvelope(params);
  }

  return safeInvoke<ErrorEnvelope>(IPC_COMMANDS.CLASSIFY_ERROR, {
    errorMessage: params.errorMessage,
    httpStatus: params.httpStatus ?? null,
    providerId: params.providerId ?? null,
    modelId: params.modelId ?? null,
    executionId: params.executionId ?? null,
  });
}

/**
 * Performs execution preflight validation verifying context headroom,
 * local budget headroom, provider quota, credentials, and endpoint syntax.
 */
export async function checkPreflight(
  providerId: string,
  modelId: string,
  prompt: string,
  sessionId?: string,
  requestedOutputTokens?: number
): Promise<ExecutionPreflightDto> {
  if (isTauriContext()) {
    return safeInvoke<ExecutionPreflightDto>(IPC_COMMANDS.PREFLIGHT_CHECK, {
      providerId,
      modelId,
      prompt,
      sessionId: sessionId ?? null,
      requestedOutputTokens: requestedOutputTokens ?? null,
    });
  }

  // Browser / Mock environment simulation
  const inputTokens = Math.ceil(prompt.length / 3.8);
  const outputTokens = requestedOutputTokens ?? 4096;
  const totalTokens = inputTokens + outputTokens;
  const contextLimit = 128000;
  const headroom = contextLimit - totalTokens;

  return {
    eligible: headroom > 0,
    contextCheck: {
      inputTokens,
      requestedOutputTokens: outputTokens,
      totalRequiredTokens: totalTokens,
      contextWindowLimit: contextLimit,
      maxOutputTokensLimit: 16384,
      safetyMarginTokens: Math.max(Math.ceil(totalTokens * 0.1), 500),
      availableHeadroom: headroom,
      status: headroom > 0 ? (headroom < 1000 ? "near_limit" : "sufficient") : "exceeds_limit",
      provenance: "estimated",
    },
    estimatedCostUsd: (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.60,
  };
}

/**
 * Retrieves the current quota and budget snapshot for a provider.
 */
export async function getQuotaSnapshot(
  providerId: string,
  modelId?: string
): Promise<QuotaSnapshotDto> {
  if (isTauriContext()) {
    return safeInvoke<QuotaSnapshotDto>(IPC_COMMANDS.GET_QUOTA_SNAPSHOT, {
      providerId,
      modelId: modelId ?? null,
    });
  }

  // Browser / Mock environment simulation
  return {
    scope: "provider",
    providerId: providerId.toLowerCase(),
    modelId,
    monthlyBudgetLimit: 50.0,
    currentMonthSpend: 12.5,
    isExhausted: false,
    isStale: false,
    observedAtMs: Date.now(),
  };
}

export type {
  ChatStreamFailoverEvent,
  ChatStreamRetryEvent,
  ContextStatus,
  TokenCountProvenance,
  ContextCheckResultDto,
  QuotaScope,
  QuotaSnapshotDto,
  PreflightReasonCode,
  ExecutionPreflightDto,
};
