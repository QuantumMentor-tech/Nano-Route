/**
//! Nano Route — History Explorer State Hook
//! File: src/features/history/useHistoryExplorer.ts
//!
//! Coordinates local history browsing, debounced lexical search, filtering,
//! deterministic sorting, bounded pagination, stale-response cancellation,
//! single/bulk deletions, and passive conversation preview loading.
//! Never touches SLM, routing engine, or provider adapters.
*/

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  listHistorySessions,
  searchHistory,
  getHistoryFilterOptions,
  deleteHistorySessionsBulk,
  DEFAULT_HISTORY_PAGE_SIZE,
} from "../../services/ipc/history";
import {
  getChatConversation,
  renameChatSession,
  setChatSessionPinned,
  deleteChatSession,
  deleteChatMessage,
} from "../../services/ipc/chat";
import { resolveDateRangeBounds } from "./timestamp";
import type {
  BulkDeleteResult,
  ChatMessage,
  ChatSession,
  HistoryDatePreset,
  HistoryErrorState,
  HistoryFilter,
  HistoryFilterOptions,
  HistoryPageInfo,
  HistorySearchEngine,
  HistorySearchResult,
  HistorySessionDto,
  HistorySortMode,
  HistoryViewStatus,
} from "./types";

export interface UseHistoryExplorerOptions {
  pageSize?: number;
  debounceMs?: number;
  initialProviderFilter?: string;
  initialModelFilter?: string;
}

export function useHistoryExplorer(options: UseHistoryExplorerOptions = {}) {
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE));
  const debounceMs = options.debounceMs ?? 220;

  // Query, filter & sort controls
  const [searchInput, setSearchInputState] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [sortMode, setSortMode] = useState<HistorySortMode>("pinned_first");
  const [providerFilter, setProviderFilter] = useState<string>(
    options.initialProviderFilter ?? ""
  );
  const [modelFilter, setModelFilter] = useState<string>(
    options.initialModelFilter ?? ""
  );
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(false);
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");

  // Collection state
  const [sessions, setSessions] = useState<HistorySessionDto[]>([]);
  const [searchResults, setSearchResults] = useState<HistorySearchResult[]>([]);
  const [searchEngineUsed, setSearchEngineUsed] = useState<HistorySearchEngine | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<HistoryFilterOptions>({
    providers: [],
    models: [],
  });
  const [pageInfo, setPageInfo] = useState<HistoryPageInfo>({
    limit: pageSize,
    offset: 0,
    totalCount: null,
    totalCountIsExact: true,
    hasMore: false,
  });

  // View lifecycle state
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<HistoryErrorState | null>(null);

  // Passive conversation inspection state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState<boolean>(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  // Controlled bulk selection
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // Stale-request tracking (monotonically increasing sequence IDs)
  const isMountedRef = useRef<boolean>(true);
  const listQuerySeqRef = useRef<number>(0);
  const conversationSeqRef = useRef<number>(0);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Debounce search input safely without blocking typing
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, debounceMs]);

  const activeFilter = useMemo<HistoryFilter>(() => {
    const bounds = resolveDateRangeBounds(datePreset, customDateFrom, customDateTo);
    return {
      providerId: providerFilter || null,
      modelId: modelFilter || null,
      pinnedOnly: pinnedOnly ? true : null,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
    };
  }, [providerFilter, modelFilter, pinnedOnly, datePreset, customDateFrom, customDateTo]);

  const hasActiveFilters = Boolean(
    providerFilter || modelFilter || pinnedOnly || datePreset !== "all"
  );
  const isSearchMode = debouncedQuery.length > 0;

  const refreshFilterOptions = useCallback(async () => {
    try {
      const opts = await getHistoryFilterOptions();
      if (isMountedRef.current) {
        setFilterOptions(opts);
      }
    } catch {
      // Non-fatal metadata discovery failure
    }
  }, []);

  /**
   * Fetches page 0 (or appended page) of either filtered browse sessions or local search results.
   * Rejects stale responses from previous queries/filters/pages cleanly.
   */
  const executeQuery = useCallback(
    async (offset: number, append: boolean) => {
      const seq = ++listQuerySeqRef.current;
      const queryId = `hq_${seq}`;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingList(true);
      }
      setError(null);

      try {
        if (isSearchMode) {
          const response = await searchHistory({
            query: debouncedQuery,
            filter: activeFilter,
            sort: sortMode,
            limit: pageSize,
            offset,
            queryId,
          });

          if (!isMountedRef.current || seq !== listQuerySeqRef.current) {
            return;
          }

          setSearchEngineUsed(response.searchEngineUsed);
          setSearchDurationMs(response.durationMs);
          setPageInfo(response.pageInfo);
          setSearchResults((prev) =>
            append ? [...prev, ...response.items] : response.items
          );
          setSessions((prev) => {
            const nextSessions = response.items.map((r) => r.session);
            return append ? [...prev, ...nextSessions] : nextSessions;
          });
        } else {
          const page = await listHistorySessions({
            filter: activeFilter,
            sort: sortMode,
            limit: pageSize,
            offset,
            queryId,
          });

          if (!isMountedRef.current || seq !== listQuerySeqRef.current) {
            return;
          }

          setSearchEngineUsed(null);
          setSearchDurationMs(null);
          setSearchResults([]);
          setPageInfo(page.pageInfo);
          setSessions((prev) => (append ? [...prev, ...page.items] : page.items));
        }
      } catch (err) {
        if (!isMountedRef.current || seq !== listQuerySeqRef.current) {
          return;
        }
        // Preserve existing list state on recoverable search/load failure (Section 65)
        setError({
          operation: isSearchMode ? "search" : "load",
          message:
            err instanceof Error
              ? err.message
              : isSearchMode
              ? "Failed to search local history"
              : "Failed to load conversation history",
          retryAction: () => executeQuery(offset, append),
        });
      } finally {
        if (isMountedRef.current && seq === listQuerySeqRef.current) {
          setIsLoadingList(false);
          setIsLoadingMore(false);
        }
      }
    },
    [isSearchMode, debouncedQuery, activeFilter, sortMode, pageSize]
  );

  // Trigger initial load and reload page 0 whenever query, filters, or sort change
  useEffect(() => {
    void executeQuery(0, false);
    void refreshFilterOptions();
  }, [executeQuery, refreshFilterOptions]);

  const loadNextPage = useCallback(async () => {
    if (isLoadingList || isLoadingMore || !pageInfo.hasMore) return;
    const nextOffset = pageInfo.offset + pageInfo.limit;
    await executeQuery(nextOffset, true);
  }, [isLoadingList, isLoadingMore, pageInfo, executeQuery]);

  /**
   * Opens a historical conversation passively (read-only SQLite fetch).
   * Cancels/ignores stale loads when rapidly switching between sessions.
   */
  const selectConversation = useCallback(
    async (sessionId: string, matchedMsgId: string | null = null) => {
      const seq = ++conversationSeqRef.current;
      setActiveSessionId(sessionId);
      setFocusMessageId(matchedMsgId);
      setIsLoadingConversation(true);
      setConversationError(null);
      setActiveMessages([]);

      try {
        const conv = await getChatConversation(sessionId);
        if (!isMountedRef.current || seq !== conversationSeqRef.current) {
          return;
        }
        setActiveSession(conv.session);
        setActiveMessages(conv.messages);
      } catch (err) {
        if (!isMountedRef.current || seq !== conversationSeqRef.current) {
          return;
        }
        setActiveSession(null);
        setActiveMessages([]);
        setConversationError(
          err instanceof Error ? err.message : "Conversation could not be loaded"
        );
      } finally {
        if (isMountedRef.current && seq === conversationSeqRef.current) {
          setIsLoadingConversation(false);
        }
      }
    },
    []
  );

  const clearSelection = useCallback(() => {
    conversationSeqRef.current++;
    setActiveSessionId(null);
    setActiveSession(null);
    setActiveMessages([]);
    setFocusMessageId(null);
    setConversationError(null);
  }, []);

  const setSearchInput = useCallback((val: string) => {
    setSearchInputState(val);
    if (!val.trim()) {
      setDebouncedQuery("");
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInputState("");
    setDebouncedQuery("");
  }, []);

  const resetFilters = useCallback(() => {
    setProviderFilter("");
    setModelFilter("");
    setPinnedOnly(false);
    setDatePreset("all");
    setCustomDateFrom("");
    setCustomDateTo("");
  }, []);

  const pinSession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      try {
        const updated = await setChatSessionPinned(sessionId, pinned);
        if (!isMountedRef.current) return updated;

        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, pinned: updated.pinned } : s))
        );
        setSearchResults((prev) =>
          prev.map((r) =>
            r.session.id === sessionId
              ? { ...r, session: { ...r.session, pinned: updated.pinned } }
              : r
          )
        );
        if (activeSessionIdRef.current === sessionId) {
          setActiveSession(updated);
        }
        if (sortMode === "pinned_first" || pinnedOnly) {
          void executeQuery(0, false);
        }
        return updated;
      } catch (err) {
        if (isMountedRef.current) {
          setError({
            operation: "mutate",
            message: err instanceof Error ? err.message : "Failed to update pinned state",
          });
        }
        throw err;
      }
    },
    [sortMode, pinnedOnly, executeQuery]
  );

  const renameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      try {
        const updated = await renameChatSession(sessionId, newTitle);
        if (!isMountedRef.current) return updated;

        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, title: updated.title, updatedAt: updated.updatedAt }
              : s
          )
        );
        if (activeSessionIdRef.current === sessionId) {
          setActiveSession(updated);
        }
        void executeQuery(0, false);
        return updated;
      } catch (err) {
        if (isMountedRef.current) {
          setError({
            operation: "mutate",
            message: err instanceof Error ? err.message : "Failed to rename conversation",
          });
        }
        throw err;
      }
    },
    [executeQuery]
  );

  const deleteSingleMessage = useCallback(
    async (messageId: string, owningSessionId: string) => {
      try {
        const deleted = await deleteChatMessage(messageId);
        if (!isMountedRef.current) return deleted;

        if (deleted) {
          if (activeSessionIdRef.current === owningSessionId) {
            setActiveMessages((prev) => prev.filter((m) => m.id !== messageId));
          }
          void executeQuery(0, false);
          void refreshFilterOptions();
        }
        return deleted;
      } catch (err) {
        if (isMountedRef.current) {
          setError({
            operation: "mutate",
            message: err instanceof Error ? err.message : "Failed to delete message",
          });
        }
        throw err;
      }
    },
    [executeQuery, refreshFilterOptions]
  );

  const deleteSingleSession = useCallback(
    async (sessionId: string) => {
      try {
        const deleted = await deleteChatSession(sessionId);
        if (!isMountedRef.current) return deleted;

        setSelectedSessionIds((prev) => {
          if (!prev.has(sessionId)) return prev;
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });

        if (activeSessionIdRef.current === sessionId) {
          clearSelection();
        }

        await executeQuery(0, false);
        await refreshFilterOptions();
        return deleted;
      } catch (err) {
        if (isMountedRef.current) {
          setError({
            operation: "mutate",
            message: err instanceof Error ? err.message : "Failed to delete conversation",
          });
        }
        // Reload authoritative data so UI cannot drift from DB
        void executeQuery(0, false);
        throw err;
      }
    },
    [clearSelection, executeQuery, refreshFilterOptions]
  );

  const toggleBulkSelection = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedSessionIds(new Set(sessions.map((s) => s.id)));
  }, [sessions]);

  const clearBulkSelection = useCallback(() => {
    setSelectedSessionIds(new Set());
  }, []);

  const deleteSelectedBulk = useCallback(async (): Promise<BulkDeleteResult | null> => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0) return null;

    try {
      const result = await deleteHistorySessionsBulk(ids);
      if (!isMountedRef.current) return result;

      setSelectedSessionIds(new Set());
      if (activeSessionIdRef.current && result.deletedSessionIds.includes(activeSessionIdRef.current)) {
        clearSelection();
      }
      await executeQuery(0, false);
      await refreshFilterOptions();
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          operation: "mutate",
          message:
            err instanceof Error ? err.message : "Failed to delete selected conversations",
        });
      }
      // Reload authoritative database state on transaction rollback
      void executeQuery(0, false);
      throw err;
    }
  }, [selectedSessionIds, clearSelection, executeQuery, refreshFilterOptions]);

  const viewStatus: HistoryViewStatus = useMemo(() => {
    if (isLoadingList && sessions.length === 0) {
      return isSearchMode ? "searching" : "loading";
    }
    if (error && sessions.length === 0) return "error";
    if (sessions.length === 0) return "empty";
    return "ready";
  }, [isLoadingList, isSearchMode, sessions.length, error]);

  return {
    // Query & filter controls
    searchInput,
    debouncedQuery,
    isSearchMode,
    sortMode,
    providerFilter,
    modelFilter,
    pinnedOnly,
    datePreset,
    customDateFrom,
    customDateTo,
    hasActiveFilters,
    filterOptions,

    // Results & pagination
    sessions,
    searchResults,
    searchEngineUsed,
    searchDurationMs,
    pageInfo,
    viewStatus,
    isLoadingList,
    isLoadingMore,
    error,
    clearError: () => setError(null),

    // Passive conversation inspector
    activeSessionId,
    activeSession,
    activeMessages,
    focusMessageId,
    isLoadingConversation,
    conversationError,

    // Bulk selection
    selectedSessionIds,

    // Actions
    setSearchInput,
    clearSearch,
    setSortMode,
    setProviderFilter,
    setModelFilter,
    setPinnedOnly,
    setDatePreset,
    setCustomDateFrom,
    setCustomDateTo,
    resetFilters,
    loadNextPage,
    refreshHistory: () => executeQuery(0, false),
    selectConversation,
    clearSelection,
    pinSession,
    renameSession,
    deleteSingleMessage,
    deleteSingleSession,
    toggleBulkSelection,
    selectAllVisible,
    clearBulkSelection,
    deleteSelectedBulk,
  };
}

