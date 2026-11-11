/**
//! Nano Route — Chat Studio Type Definitions
//! File: src/features/chat/types.ts
//!
//! Strongly-typed interfaces for Chat Studio UI state, messages, sessions,
//! composer input, and strictly-decoupled prompt submission intents.
*/

import type {
  ChatMessage,
  ChatMessageMetadata,
  ChatSession,
  ChatSubmissionRequest,
  ChatSubmissionResult,
  ChatManualRouteOverrideDto,
  MessageSender,
  ChatStreamEvent,
  ChatStreamStartedEvent,
  ChatStreamDeltaEvent,
  ChatStreamUsageEvent,
  ChatStreamCompletedEvent,
  ChatStreamFailedEvent,
  ChatStreamCancelledEvent,
  ChatStreamFailoverEvent,
  ChatStreamRetryEvent,
  ChatStreamEventType,
  ExecutionLifecycleState,
  TerminationReasonDto,
  CancellationResultDto,
  ExecutionStateDto,
  RecoveryContextDto,
  ErrorCategory,
  ErrorSeverity,
  RetryabilityHint,
  FailoverHint,
  UserAction,
  ClassificationProvenance,
  ErrorEnvelope,
} from "../../services/ipc/types.ts";

export type {
  ChatMessage,
  ChatMessageMetadata,
  ChatSession,
  ChatSubmissionRequest,
  ChatSubmissionResult,
  ChatManualRouteOverrideDto,
  MessageSender,
  ChatStreamEvent,
  ChatStreamStartedEvent,
  ChatStreamDeltaEvent,
  ChatStreamUsageEvent,
  ChatStreamCompletedEvent,
  ChatStreamFailedEvent,
  ChatStreamCancelledEvent,
  ChatStreamFailoverEvent,
  ChatStreamRetryEvent,
  ChatStreamEventType,
  ExecutionLifecycleState,
  TerminationReasonDto,
  CancellationResultDto,
  ExecutionStateDto,
  RecoveryContextDto,
  ErrorCategory,
  ErrorSeverity,
  RetryabilityHint,
  FailoverHint,
  UserAction,
  ClassificationProvenance,
  ErrorEnvelope,
};

/**
 * Typed prompt submission intent emitted when a user submits a prompt in Chat Studio.
 * Strictly decoupled: does not invoke routing or provider execution directly.
 */
export interface SubmitPromptIntent {
  sessionId: string;
  prompt: string;
  timestamp: number;
}

/**
 * State of the message composer input field.
 */
export interface ComposerState {
  text: string;
  isSubmitting: boolean;
  charCount: number;
  isValid: boolean;
  validationError: string | null;
}

/**
 * Error state for chat studio operations.
 */
export interface ChatError {
  message: string;
  category: "session" | "message" | "composer" | "network" | ErrorCategory;
  envelope?: ErrorEnvelope;
  retryAction?: () => void | Promise<void>;
}

/**
 * Overall Chat Studio view state.
 */
export interface ChatStudioState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  error: ChatError | null;
  isSidebarOpen: boolean;
  searchFilter: string;
}

