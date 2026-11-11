/**
//! Nano Route — Chat Studio State Hook
//! File: src/features/chat/useChatStudio.ts
//!
//! Encapsulates session navigation, message persistence, stale-request protection,
//! and prompt submission orchestration.
*/

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  getChatMessages,
  renameChatSession,
  setChatSessionPinned,
  deleteChatSession,
  deleteChatMessage,
  submitChatPrompt,
  streamChatPrompt,
  cancelChatExecution,
  cancelSessionChat,
} from "../../services/ipc/chat";
import type {
  ChatError,
  ChatMessage,
  ChatSession,
  ChatSubmissionResult,
  ChatManualRouteOverrideDto,
  SubmitPromptIntent,
  ChatStreamEvent,
  TerminationReasonDto,
  ErrorEnvelope,
} from "./types";

export interface UseChatStudioOptions {
  initialSessionId?: string | null;
  onSubmitPromptIntent?: (intent: SubmitPromptIntent) => void;
  autoSelectFirstSession?: boolean;
  enableStreaming?: boolean;
}

export function useChatStudio(options: UseChatStudioOptions = {}) {
  const {
    initialSessionId = null,
    onSubmitPromptIntent,
    autoSelectFirstSession = true,
    enableStreaming = true,
  } = options;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);

  // Stale-request tracking: protects against race conditions when rapidly switching sessions
  const messageRequestSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const activeExecutionIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (activeExecutionIdRef.current) {
        cancelChatExecution(activeExecutionIdRef.current, "view_disposed").catch(() => {});
        activeExecutionIdRef.current = null;
      }
    };
  }, []);

  /**
   * Loads the full list of persistent chat sessions.
   */
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const fetched = await listChatSessions({ limit: 100 });
      if (!isMountedRef.current) return;

      let resolvedList = fetched;
      const targetInitialId = activeSessionIdRef.current || initialSessionId;

      if (
        targetInitialId &&
        !fetched.some((s) => s.id === targetInitialId)
      ) {
        try {
          const explicit = await getChatSession(targetInitialId);
          if (!isMountedRef.current) return;
          if (explicit) {
            resolvedList = [explicit, ...fetched];
          }
        } catch {
          // Ignore lookup error for deleted/missing session ID and fall back cleanly
        }
      }

      setSessions(resolvedList);

      // Auto-select target or first session if none selected
      if (resolvedList.length > 0 && autoSelectFirstSession) {
        setActiveSessionId((prev) => {
          if (prev && resolvedList.some((s) => s.id === prev)) {
            return prev;
          }
          if (initialSessionId && resolvedList.some((s) => s.id === initialSessionId)) {
            return initialSessionId;
          }
          return resolvedList[0].id;
        });
      }
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError({
        category: "session",
        message: err instanceof Error ? err.message : "Failed to load chat sessions",
        retryAction: loadSessions,
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoadingSessions(false);
      }
    }
  }, [autoSelectFirstSession, initialSessionId]);

  // Initial load
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  /**
   * Loads messages for a given session with stale-response protection.
   */
  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    const seq = ++messageRequestSeqRef.current;
    setIsLoadingMessages(true);
    setError(null);

    try {
      const fetched = await getChatMessages({ sessionId });
      // Only commit if this is still the active, newest request
      if (isMountedRef.current && seq === messageRequestSeqRef.current) {
        setMessages(fetched);
      }
    } catch (err) {
      if (isMountedRef.current && seq === messageRequestSeqRef.current) {
        setError({
          category: "message",
          message: err instanceof Error ? err.message : "Failed to load conversation messages",
          retryAction: () => loadMessagesForSession(sessionId),
        });
      }
    } finally {
      if (isMountedRef.current && seq === messageRequestSeqRef.current) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  // When activeSessionId changes, fetch messages
  useEffect(() => {
    if (activeSessionId) {
      void loadMessagesForSession(activeSessionId);
    } else {
      setMessages([]);
      setIsLoadingMessages(false);
    }
  }, [activeSessionId, loadMessagesForSession]);

  /**
   * Cooperatively cancels the currently active execution.
   */
  const cancelCurrentExecution = useCallback(
    async (reason: TerminationReasonDto = "user_cancelled") => {
      const activeExecId = activeExecutionIdRef.current;
      const currentSession = activeSessionIdRef.current;

      if (!activeExecId && !isSubmitting) return;

      setIsCancelling(true);
      try {
        if (activeExecId) {
          await cancelChatExecution(activeExecId, reason);
        } else if (currentSession) {
          await cancelSessionChat(currentSession, reason);
        }
      } catch (err) {
        console.warn("[ChatStudio] Error while cancelling execution:", err);
      } finally {
        activeExecutionIdRef.current = null;
        if (isMountedRef.current) {
          setActiveExecutionId(null);
          setIsSubmitting(false);
          setIsCancelling(false);
        }
      }
    },
    [isSubmitting]
  );

  /**
   * Selects an active conversation session.
   * Cancels any active execution in the previous session to ensure isolation.
   */
  const selectSession = useCallback((sessionId: string) => {
    if (activeExecutionIdRef.current) {
      cancelChatExecution(activeExecutionIdRef.current, "session_changed").catch(() => {});
      activeExecutionIdRef.current = null;
      setActiveExecutionId(null);
      setIsSubmitting(false);
      setIsCancelling(false);
    }
    setActiveSessionId(sessionId);
  }, []);

  /**
   * Creates a new chat session and selects it.
   */
  const createSession = useCallback(async (title?: string) => {
    if (activeExecutionIdRef.current) {
      cancelChatExecution(activeExecutionIdRef.current, "session_changed").catch(() => {});
      activeExecutionIdRef.current = null;
      setActiveExecutionId(null);
      setIsSubmitting(false);
      setIsCancelling(false);
    }
    setError(null);
    try {
      const newSession = await createChatSession({
        title: title || "New Conversation",
      });
      if (!isMountedRef.current) return newSession;

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      return newSession;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          category: "session",
          message: err instanceof Error ? err.message : "Failed to create conversation",
        });
      }
      throw err;
    }
  }, []);

  /**
   * Renames a conversation session.
   */
  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    setError(null);
    try {
      const updated = await renameChatSession(sessionId, newTitle);
      if (!isMountedRef.current) return updated;

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
      return updated;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          category: "session",
          message: err instanceof Error ? err.message : "Failed to rename conversation",
        });
      }
      throw err;
    }
  }, []);

  /**
   * Toggles the pinned flag of a conversation session.
   */
  const togglePinSession = useCallback(async (sessionId: string, pinned: boolean) => {
    setError(null);
    try {
      const updated = await setChatSessionPinned(sessionId, pinned);
      if (!isMountedRef.current) return updated;

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
      return updated;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          category: "session",
          message: err instanceof Error ? err.message : "Failed to update pinned state",
        });
      }
      throw err;
    }
  }, []);

  /**
   * Deletes a conversation session, cascading to its messages.
   */
  const deleteSession = useCallback(
    async (sessionId: string) => {
      setError(null);
      try {
        await deleteChatSession(sessionId);
        if (!isMountedRef.current) return;

        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== sessionId);
          if (activeSessionId === sessionId) {
            const nextActive = next.length > 0 ? next[0].id : null;
            setActiveSessionId(nextActive);
          }
          return next;
        });
      } catch (err) {
        if (isMountedRef.current) {
          setError({
            category: "session",
            message: err instanceof Error ? err.message : "Failed to delete conversation",
          });
        }
        throw err;
      }
    },
    [activeSessionId]
  );

  /**
   * Deletes an individual message safely without disturbing neighboring messages.
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    setError(null);
    try {
      const removed = await deleteChatMessage(messageId);
      if (isMountedRef.current && removed) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      return removed;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          category: "message",
          message: err instanceof Error ? err.message : "Failed to delete message",
        });
      }
      throw err;
    }
  }, []);

  /**
   * Submits a user prompt through the complete routing and execution pipeline:
   * 1. Validates prompt.
   * 2. Auto-creates session if none active.
   * 3. Dispatches prompt to backend/mock submission orchestrator.
   * 4. Updates session messages safely with stale-session protection.
   * 5. Emits typed SubmitPromptIntent if callback provided.
   */
  const submitPrompt = useCallback(
    async (rawPrompt: string, manualOverride?: ChatManualRouteOverrideDto) => {
      const prompt = rawPrompt.trim();
      if (!prompt) return;

      setIsSubmitting(true);
      setError(null);
      const streamErrorRef: { current?: ErrorEnvelope } = {};

      try {
        let currentSessionId = activeSessionId;

        // Auto-create session if none active
        if (!currentSessionId) {
          const titleSnippet =
            prompt.length > 36 ? `${prompt.slice(0, 36).trim()}...` : prompt;
          const newSession = await createChatSession({ title: titleSnippet });
          currentSessionId = newSession.id;
          if (isMountedRef.current) {
            setSessions((prev) => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
            activeSessionIdRef.current = newSession.id;
          }
        }

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setActiveExecutionId(executionId);
        activeExecutionIdRef.current = executionId;

        if (enableStreaming) {
          let userMessage: ChatMessage | null = null;
          let transientAssistantId: string | null = null;
          let routedProvider = "deepseek";
          let routedModel = "deepseek-chat";
          let selectionMode = "automatic";
          let routingReason = "";
          let slmConfidence: number | null = 0.95;

          const assistantMessage = await streamChatPrompt(
            {
              sessionId: currentSessionId,
              prompt,
              manualOverride,
              executionId,
            },
            (event: ChatStreamEvent) => {
              if (event.type === "started") {
                if (event.executionId) {
                  activeExecutionIdRef.current = event.executionId;
                  if (isMountedRef.current) {
                    setActiveExecutionId(event.executionId);
                  }
                }
                routedProvider = event.providerId;
                routedModel = event.modelId;
                selectionMode = event.selectionMode;
                routingReason = event.routingReason;
                slmConfidence = event.slmConfidence;
                transientAssistantId = `transient_${event.streamId}`;

                userMessage = {
                  id: event.userMessageId,
                  sessionId: currentSessionId!,
                  sender: "user",
                  content: prompt,
                  metadata: {
                    promptTokens: 0,
                    completionTokens: 0,
                    latencyMs: 0,
                    costUsd: 0,
                  },
                  createdAt: event.timestampMs,
                };

                const transientAssistant: ChatMessage = {
                  id: transientAssistantId,
                  sessionId: currentSessionId!,
                  sender: "assistant",
                  content: "",
                  isStreaming: true,
                  metadata: {
                    routedProvider,
                    routedModel,
                    routingReason,
                    slmConfidenceScore: slmConfidence,
                    promptTokens: 0,
                    completionTokens: 0,
                    latencyMs: 0,
                    costUsd: 0,
                  },
                  createdAt: event.timestampMs + 1,
                };

                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId) {
                  setMessages((prev) => {
                    const withoutDups = prev.filter(
                      (m) => m.id !== userMessage!.id && m.id !== transientAssistantId && !m.id.startsWith("transient_")
                    );
                    return [...withoutDups, userMessage!, transientAssistant];
                  });
                }
              } else if (event.type === "failover") {
                routedProvider = event.toProvider;
                routedModel = event.toModel;
                selectionMode = "fallback";
                // Discard partial text from failed attempt and update transient message metadata
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId && transientAssistantId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId || m.id.startsWith("transient_")
                        ? {
                            ...m,
                            content: "",
                            metadata: {
                              ...m.metadata,
                              routedProvider: event.toProvider,
                              routedModel: event.toModel,
                              failoverUsed: true,
                              failoverFromProvider: event.fromProvider,
                              failoverFromModel: event.fromModel,
                              failoverReason: event.reason,
                              failoverAttempts: event.attempt,
                            },
                          }
                        : m
                    )
                  );
                }
              } else if (event.type === "retry") {
                // Clear transient partial content and record retry count
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId && transientAssistantId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId || m.id.startsWith("transient_")
                        ? {
                            ...m,
                            content: "",
                            metadata: {
                              ...m.metadata,
                              retryCount: event.attempt,
                            },
                          }
                        : m
                    )
                  );
                }
              } else if (event.type === "delta") {
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId && transientAssistantId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId
                        ? { ...m, content: m.content + event.text }
                        : m
                    )
                  );
                }
              } else if (event.type === "completed") {
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId
                        ? { ...event.assistantMessage, isStreaming: false }
                        : m
                    )
                  );
                }
              } else if (event.type === "cancelled") {
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId && transientAssistantId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId
                        ? {
                            ...m,
                            isStreaming: false,
                            isCancelled: true,
                            content: event.partialText !== undefined ? event.partialText : m.content,
                          }
                        : m
                    )
                  );
                }
              } else if (event.type === "failed") {
                streamErrorRef.current = event.error;
                if (isMountedRef.current && activeSessionIdRef.current === currentSessionId && transientAssistantId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === transientAssistantId
                        ? {
                            ...m,
                            isStreaming: false,
                            isFailed: true,
                            status: "failed",
                            error: event.error,
                          }
                        : m
                    )
                  );
                }
              }
            }
          );

          // Update session list timestamp if completed
          if (isMountedRef.current && assistantMessage) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === currentSessionId
                  ? { ...s, updatedAt: assistantMessage.createdAt }
                  : s
              )
            );
          }

          const intent: SubmitPromptIntent = {
            sessionId: currentSessionId,
            prompt,
            timestamp: userMessage ? (userMessage as ChatMessage).createdAt : Date.now(),
          };
          if (onSubmitPromptIntent) {
            onSubmitPromptIntent(intent);
          }

          const latencyMs = assistantMessage?.metadata?.latencyMs ?? 0;
          const promptTokens = assistantMessage?.metadata?.promptTokens ?? 0;
          const completionTokens = assistantMessage?.metadata?.completionTokens ?? 0;
          const costUsd = assistantMessage?.metadata?.costUsd ?? 0;

          const finalAssistantMsg: ChatMessage = assistantMessage || {
            id: transientAssistantId || `cancelled_${Date.now()}`,
            sessionId: currentSessionId,
            sender: "assistant",
            content: "",
            isCancelled: true,
            metadata: {
              routedProvider,
              routedModel,
              routingReason,
              slmConfidenceScore: slmConfidence,
              promptTokens,
              completionTokens,
              latencyMs,
              costUsd,
            },
            createdAt: Date.now(),
          };

          const result: ChatSubmissionResult = {
            requestId: "",
            executionId,
            sessionId: currentSessionId,
            userMessage: userMessage || {
              id: `user_${Date.now()}`,
              sessionId: currentSessionId,
              sender: "user",
              content: prompt,
              metadata: {
                promptTokens: 0,
                completionTokens: 0,
                latencyMs: 0,
                costUsd: 0,
              },
              createdAt: Date.now(),
            },
            assistantMessage: finalAssistantMsg,
            routedProvider,
            routedModel,
            selectionMode,
            routingReason,
            slmConfidence,
            latencyMs,
            promptTokens,
            completionTokens,
            costUsd,
            status: assistantMessage ? "completed" : "cancelled",
          };

          return result;
        }

        // Call the complete end-to-end non-streaming execution pipeline
        const result: ChatSubmissionResult = await submitChatPrompt({
          sessionId: currentSessionId,
          prompt,
          manualOverride,
          executionId,
        });

        // Only update UI timeline if the active session has not changed during execution
        if (isMountedRef.current && activeSessionIdRef.current === currentSessionId) {
          setMessages((prev) => {
            const withoutDups = prev.filter(
              (m) => m.id !== result.userMessage.id && m.id !== result.assistantMessage.id
            );
            return [...withoutDups, result.userMessage, result.assistantMessage];
          });
        }

        // Always update session list timestamp
        if (isMountedRef.current) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, updatedAt: result.assistantMessage.createdAt }
                : s
            )
          );
        }

        // Emit typed prompt intent callback if supplied
        const intent: SubmitPromptIntent = {
          sessionId: currentSessionId,
          prompt,
          timestamp: result.userMessage.createdAt,
        };
        if (onSubmitPromptIntent) {
          onSubmitPromptIntent(intent);
        }

        return result;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          // If cancelled during non-streaming, do not treat as fatal composer crash
          const isCancelled =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "EXECUTION_CANCELLED";

          if (!isCancelled) {
            setError({
              category: streamErrorRef.current?.category || "composer",
              message:
                streamErrorRef.current?.userMessage ||
                (err instanceof Error ? err.message : "Failed to execute prompt request"),
              envelope: streamErrorRef.current,
            });
          }
          // Refresh messages for current session to ensure persisted user message is visible
          if (activeSessionIdRef.current) {
            void loadMessagesForSession(activeSessionIdRef.current);
          }
        }
        throw err;
      } finally {
        activeExecutionIdRef.current = null;
        if (isMountedRef.current) {
          setActiveExecutionId(null);
          setIsSubmitting(false);
          setIsCancelling(false);
        }
      }
    },
    [activeSessionId, enableStreaming, loadMessagesForSession, onSubmitPromptIntent]
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isSubmitting,
    isCancelling,
    activeExecutionId,
    cancelCurrentExecution,
    error,
    clearError: () => setError(null),
    loadSessions,
    selectSession,
    createSession,
    renameSession,
    togglePinSession,
    deleteSession,
    deleteMessage,
    submitPrompt,
  };
}

