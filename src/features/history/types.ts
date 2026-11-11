/**
//! Nano Route — History Explorer Type Definitions
//! File: src/features/history/types.ts
//!
//! Typed frontend domain contracts for History Explorer, search, filtering,
//! pagination, passive conversation inspection, and safe deletion controls.
*/

import type {
  BulkDeleteResult,
  ChatMessage,
  ChatMessageMetadata,
  ChatSession,
  HistoryFilter,
  HistoryFilterOptions,
  HistoryMatchType,
  HistoryMessageMatchPreview,
  HistoryPage,
  HistoryPageInfo,
  HistoryPagination,
  HistorySearchEngine,
  HistorySearchRequest,
  HistorySearchResponse,
  HistorySearchResult,
  HistorySessionDto,
  HistorySortMode,
  MessageSender,
} from "../../services/ipc/types.ts";

export type {
  BulkDeleteResult,
  ChatMessage,
  ChatMessageMetadata,
  ChatSession,
  HistoryFilter,
  HistoryFilterOptions,
  HistoryMatchType,
  HistoryMessageMatchPreview,
  HistoryPage,
  HistoryPageInfo,
  HistoryPagination,
  HistorySearchEngine,
  HistorySearchRequest,
  HistorySearchResponse,
  HistorySearchResult,
  HistorySessionDto,
  HistorySortMode,
  MessageSender,
};

export type HistorySession = HistorySessionDto;
export type HistoryMessage = ChatMessage;
export type HistorySearchQuery = HistorySearchRequest;

export type HistoryDatePreset =
  | "all"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export type HistoryViewStatus =
  | "loading"
  | "ready"
  | "searching"
  | "error"
  | "empty";

export interface HistoryErrorState {
  operation: "load" | "search" | "conversation" | "mutate";
  message: string;
  retryAction?: () => void | Promise<void>;
}

