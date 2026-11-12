/**
//! Nano Route — History Explorer, Search & Conversation Management IPC Service
//! File: src/services/ipc/history.ts
//!
//! Typed frontend-to-Rust IPC wrapper for historical conversation listing,
//! local lexical/FTS5 search, filter option discovery, and transactional bulk delete.
//! Preserves strict separation from live SLM/routing/provider execution pipelines.
*/

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import { __internalGetMockChatStore } from "./chat.ts";
import { __internalDeleteMockTelemetryBySession } from "./telemetry.ts";
import {
  IPC_COMMANDS,
  type BulkDeleteResult,
  type ChatMessage,
  type ChatSession,
  type HistoryFilter,
  type HistoryFilterOptions,
  type HistoryMatchType,
  type HistoryMessageMatchPreview,
  type HistoryPage,
  type HistorySearchRequest,
  type HistorySearchResponse,
  type HistorySearchResult,
  type HistorySessionDto,
  type HistorySortMode,
} from "./types.ts";

export const DEFAULT_HISTORY_PAGE_SIZE = 25;
export const MAX_HISTORY_PAGE_SIZE = 100;
export const MAX_SEARCH_QUERY_CHARS = 512;
export const MAX_BULK_DELETE_BATCH = 100;
export const MAX_PREVIEW_CHARS = 160;
export const MAX_PREVIEWS_PER_SESSION = 3;

// ============================================================================
// Mock Testing Controls (Browser / Node Automated Test Mode Only)
// ============================================================================

export type MockHistoryErrorTarget = "list" | "search" | "delete" | null;

let mockHistoryDelayMs = 0;
let mockHistoryErrorTarget: MockHistoryErrorTarget = null;
let mockPerQueryDelayMs: ((query: string) => number) | null = null;

export function setMockHistoryTestHooks(options: {
  delayMs?: number;
  errorTarget?: MockHistoryErrorTarget;
  perQueryDelayMs?: ((query: string) => number) | null;
}): void {
  if (options.delayMs !== undefined) mockHistoryDelayMs = Math.max(0, options.delayMs);
  if (options.errorTarget !== undefined) mockHistoryErrorTarget = options.errorTarget;
  if (options.perQueryDelayMs !== undefined) mockPerQueryDelayMs = options.perQueryDelayMs;
}

export function resetMockHistoryTestHooks(): void {
  mockHistoryDelayMs = 0;
  mockHistoryErrorTarget = null;
  mockPerQueryDelayMs = null;
}

// ============================================================================
// Validation & Safe Text Helpers
// ============================================================================

function clampLimit(limit?: number | null): number {
  const raw = limit ?? DEFAULT_HISTORY_PAGE_SIZE;
  if (!Number.isFinite(raw)) return DEFAULT_HISTORY_PAGE_SIZE;
  return Math.min(MAX_HISTORY_PAGE_SIZE, Math.max(1, Math.floor(raw)));
}

function clampOffset(offset?: number | null): number {
  const raw = offset ?? 0;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

function validateHistoryFilter(filter?: HistoryFilter | null): HistoryFilter {
  if (!filter) return {};

  const query = filter.query ?? null;
  if (query && Array.from(query).length > MAX_SEARCH_QUERY_CHARS) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Search query exceeds maximum permitted length of ${MAX_SEARCH_QUERY_CHARS} characters`,
      retryable: false,
      userActionRequired: true,
    });
  }

  const providerId = filter.providerId?.trim() || null;
  const modelId = filter.modelId?.trim() || null;

  if (providerId && providerId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Provider filter exceeds maximum length",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (modelId && modelId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Model filter exceeds maximum length",
      retryable: false,
      userActionRequired: true,
    });
  }

  const dateFrom = filter.dateFrom ?? null;
  const dateTo = filter.dateTo ?? null;
  if (dateFrom !== null && dateTo !== null && dateFrom > dateTo) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Date range start cannot be after date range end",
      retryable: false,
      userActionRequired: true,
    });
  }

  return {
    query,
    providerId,
    modelId,
    pinnedOnly: filter.pinnedOnly ?? null,
    dateFrom,
    dateTo,
  };
}

/**
 * Extracts a bounded plain-text snippet around the first case-insensitive match
 * on Unicode codepoint boundaries (`Array.from`), never generating HTML.
 */
export function extractSafePreview(
  content: string,
  query: string
): {
  previewText: string;
  matchStartOffset: number | null;
  matchLength: number | null;
} {
  const chars = Array.from(content);
  if (chars.length === 0) {
    return { previewText: "", matchStartOffset: null, matchLength: null };
  }

  const trimmedQuery = query.trim();
  const findCharMatch = (needle: string): { pos: number; len: number } | null => {
    const cleanNeedle = needle.trim();
    if (!cleanNeedle) return null;
    const lowerHay = content.toLowerCase();
    const lowerNeedle = cleanNeedle.toLowerCase();
    const codeUnitIdx = lowerHay.indexOf(lowerNeedle);
    if (codeUnitIdx === -1) return null;

    // Convert UTF-16 code unit offset into Unicode scalar offset
    const prefixScalars = Array.from(content.slice(0, codeUnitIdx)).length;
    const matchScalars = Array.from(content.slice(codeUnitIdx, codeUnitIdx + cleanNeedle.length)).length;
    return { pos: prefixScalars, len: matchScalars };
  };

  let found = findCharMatch(trimmedQuery);
  if (!found && trimmedQuery.includes(" ")) {
    for (const token of trimmedQuery.split(/\s+/)) {
      found = findCharMatch(token);
      if (found) break;
    }
  }

  if (chars.length <= MAX_PREVIEW_CHARS) {
    return {
      previewText: content,
      matchStartOffset: found ? found.pos : null,
      matchLength: found ? found.len : null,
    };
  }

  const windowStart = found ? Math.max(0, found.pos - 48) : 0;
  const hasPrefix = windowStart > 0;
  const prefixLen = hasPrefix ? 3 : 0;
  const provisionalEnd = Math.min(chars.length, windowStart + MAX_PREVIEW_CHARS - prefixLen);
  const hasSuffix = provisionalEnd < chars.length;
  const suffixLen = hasSuffix ? 3 : 0;
  const windowEnd = Math.min(
    chars.length,
    windowStart + Math.max(1, MAX_PREVIEW_CHARS - prefixLen - suffixLen)
  );

  const snippet =
    (hasPrefix ? "..." : "") +
    chars.slice(windowStart, windowEnd).join("") +
    (hasSuffix ? "..." : "");

  if (found && found.pos >= windowStart && found.pos < windowEnd) {
    const matchStartOffset = prefixLen + (found.pos - windowStart);
    const matchLength = Math.min(found.len, windowEnd - found.pos);
    return { previewText: snippet, matchStartOffset, matchLength };
  }

  return { previewText: snippet, matchStartOffset: null, matchLength: null };
}

// ============================================================================
// Mock Store Query Engine (Mirrors HistoryRepository Semantics)
// ============================================================================

function toHistorySessionDto(
  session: ChatSession,
  messages: ChatMessage[]
): HistorySessionDto {
  const providersSet = new Set<string>();
  const modelsSet = new Set<string>();

  for (const m of messages) {
    const p = m.metadata?.routedProvider?.trim();
    const mdl = m.metadata?.routedModel?.trim();
    if (p) providersSet.add(p);
    if (mdl) modelsSet.add(mdl);
  }

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    pinned: session.pinned,
    messageCount: messages.length,
    providersUsed: Array.from(providersSet).sort((a, b) => a.localeCompare(b)),
    modelsUsed: Array.from(modelsSet).sort((a, b) => a.localeCompare(b)),
  };
}

function sessionMatchesFilters(
  session: ChatSession,
  messages: ChatMessage[],
  filter: HistoryFilter
): boolean {
  if (filter.pinnedOnly && !session.pinned) return false;
  if (filter.dateFrom !== null && filter.dateFrom !== undefined && session.updatedAt < filter.dateFrom) {
    return false;
  }
  if (filter.dateTo !== null && filter.dateTo !== undefined && session.updatedAt > filter.dateTo) {
    return false;
  }
  if (filter.providerId) {
    const target = filter.providerId.toLowerCase();
    const hasProvider = messages.some(
      (m) => m.metadata?.routedProvider?.trim().toLowerCase() === target
    );
    if (!hasProvider) return false;
  }
  if (filter.modelId) {
    const target = filter.modelId.toLowerCase();
    const hasModel = messages.some(
      (m) => m.metadata?.routedModel?.trim().toLowerCase() === target
    );
    if (!hasModel) return false;
  }
  return true;
}

function compareSessions(
  a: HistorySessionDto,
  b: HistorySessionDto,
  sort: HistorySortMode
): number {
  switch (sort) {
    case "oldest":
      if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
      return a.id.localeCompare(b.id);
    case "recently_created":
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.id.localeCompare(a.id);
    case "oldest_created":
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id.localeCompare(b.id);
    case "pinned_first":
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.id.localeCompare(a.id);
    case "most_recent":
    default:
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.id.localeCompare(a.id);
  }
}

function matchesSearchTokens(haystack: string, query: string): boolean {
  const lowerHay = haystack.toLowerCase();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  if (lowerHay.includes(trimmed)) return true;

  // Multi-word natural search: all whitespace tokens must appear
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((t) => lowerHay.includes(t));
  }
  return false;
}

// ============================================================================
// Public Typed IPC API
// ============================================================================

/**
 * Lists paginated historical conversations with aggregate message counts and filters.
 */
export async function listHistorySessions(params: {
  filter?: HistoryFilter | null;
  sort?: HistorySortMode | null;
  limit?: number | null;
  offset?: number | null;
  queryId?: string | null;
} = {}): Promise<HistoryPage> {
  const validFilter = validateHistoryFilter(params.filter);
  const sort: HistorySortMode = params.sort ?? "pinned_first";
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  if (!isTauriContext()) {
    if (mockHistoryDelayMs > 0) {
      await new Promise((r) => setTimeout(r, mockHistoryDelayMs));
    }
    if (mockHistoryErrorTarget === "list") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Failed to read local conversation history",
        retryable: true,
      });
    }

    const store = __internalGetMockChatStore();
    const matched: HistorySessionDto[] = [];

    for (const session of store.sessions.values()) {
      const msgs = store.messages.get(session.id) || [];
      if (sessionMatchesFilters(session, msgs, validFilter)) {
        matched.push(toHistorySessionDto(session, msgs));
      }
    }

    matched.sort((a, b) => compareSessions(a, b, sort));
    const slice = matched.slice(offset, offset + limit);

    return {
      items: slice,
      pageInfo: {
        limit,
        offset,
        totalCount: matched.length,
        totalCountIsExact: true,
        hasMore: offset + slice.length < matched.length,
      },
      queryId: params.queryId ?? null,
    };
  }

  return await safeInvoke<HistoryPage>(
    IPC_COMMANDS.LIST_HISTORY_SESSIONS,
    {
      filter: validFilter,
      sort,
      limit,
      offset,
      queryId: params.queryId ?? null,
    },
    { requestId: generateRequestId() }
  );
}

/**
 * Executes local deterministic lexical/FTS5 search across session titles and messages.
 */
export async function searchHistory(
  request: HistorySearchRequest
): Promise<HistorySearchResponse> {
  const validFilter = validateHistoryFilter(request.filter);
  const rawQuery = request.query ?? validFilter.query ?? "";
  if (Array.from(rawQuery).length > MAX_SEARCH_QUERY_CHARS) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Search query exceeds maximum permitted length of ${MAX_SEARCH_QUERY_CHARS} characters`,
      retryable: false,
      userActionRequired: true,
    });
  }

  const trimmedQuery = rawQuery.trim();
  const sort: HistorySortMode = request.sort ?? "most_recent";
  const limit = clampLimit(request.limit);
  const offset = clampOffset(request.offset);

  if (!isTauriContext()) {
    const startMs = Date.now();
    const extraDelay = mockPerQueryDelayMs ? mockPerQueryDelayMs(trimmedQuery) : mockHistoryDelayMs;
    if (extraDelay > 0) {
      await new Promise((r) => setTimeout(r, extraDelay));
    }

    if (mockHistoryErrorTarget === "search") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Local search encountered an unexpected error",
        retryable: true,
      });
    }

    const store = __internalGetMockChatStore();
    if (!trimmedQuery) {
      const page = await listHistorySessions({
        filter: validFilter,
        sort,
        limit,
        offset,
        queryId: request.queryId ?? null,
      });
      return {
        queryId: request.queryId ?? null,
        items: page.items.map((session) => ({
          session,
          matchTypes: [],
          titleMatch: false,
          titleMatchStart: null,
          titleMatchLength: null,
          matchedMessageCount: 0,
          matchedMessageIds: [],
          previews: [],
        })),
        pageInfo: page.pageInfo,
        searchEngineUsed: "fts5",
        durationMs: Math.max(0, Date.now() - startMs),
      };
    }

    const results: Array<{ rank: number; item: HistorySearchResult }> = [];
    for (const session of store.sessions.values()) {
      const msgs = store.messages.get(session.id) || [];
      if (!sessionMatchesFilters(session, msgs, validFilter)) continue;

      const titleMatch = matchesSearchTokens(session.title, trimmedQuery);
      const matchingMsgs = [...msgs]
        .filter((m) => matchesSearchTokens(m.content, trimmedQuery))
        .sort((a, b) => {
          if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
          return b.id.localeCompare(a.id);
        });

      if (!titleMatch && matchingMsgs.length === 0) continue;

      const exactTitle = session.title.trim().toLowerCase() === trimmedQuery.toLowerCase();
      const rank = exactTitle ? 0 : titleMatch ? 1 : 2;

      const titlePreview = titleMatch ? extractSafePreview(session.title, trimmedQuery) : null;
      const matchTypes: HistoryMatchType[] = [];
      if (titleMatch) matchTypes.push("session_title");
      if (matchingMsgs.length > 0) matchTypes.push("message_content");

      const previews: HistoryMessageMatchPreview[] = matchingMsgs
        .slice(0, MAX_PREVIEWS_PER_SESSION)
        .map((m) => {
          const ex = extractSafePreview(m.content, trimmedQuery);
          return {
            messageId: m.id,
            sessionId: m.sessionId,
            sender: m.sender,
            matchType: "message_content",
            previewText: ex.previewText,
            matchStartOffset: ex.matchStartOffset,
            matchLength: ex.matchLength,
            routedProvider: m.metadata?.routedProvider ?? null,
            routedModel: m.metadata?.routedModel ?? null,
            createdAt: m.createdAt,
          };
        });

      results.push({
        rank,
        item: {
          session: toHistorySessionDto(session, msgs),
          matchTypes,
          titleMatch,
          titleMatchStart: titlePreview?.matchStartOffset ?? null,
          titleMatchLength: titlePreview?.matchLength ?? null,
          matchedMessageCount: matchingMsgs.length,
          matchedMessageIds: matchingMsgs.slice(0, 20).map((m) => m.id),
          previews,
        },
      });
    }

    results.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return compareSessions(a.item.session, b.item.session, sort);
    });

    const sliced = results.slice(offset, offset + limit).map((r) => r.item);
    return {
      queryId: request.queryId ?? null,
      items: sliced,
      pageInfo: {
        limit,
        offset,
        totalCount: results.length,
        totalCountIsExact: true,
        hasMore: offset + sliced.length < results.length,
      },
      searchEngineUsed: "fts5",
      durationMs: Math.max(0, Date.now() - startMs),
    };
  }

  return await safeInvoke<HistorySearchResponse>(
    IPC_COMMANDS.SEARCH_HISTORY,
    {
      request: {
        query: trimmedQuery,
        filter: validFilter,
        sort,
        limit,
        offset,
        queryId: request.queryId ?? null,
      },
    },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves distinct historical provider and model identifiers persisted in chat_messages.
 * Never depends on live registry availability.
 */
export async function getHistoryFilterOptions(): Promise<HistoryFilterOptions> {
  if (!isTauriContext()) {
    const store = __internalGetMockChatStore();
    const providers = new Set<string>();
    const models = new Set<string>();

    for (const msgs of store.messages.values()) {
      for (const m of msgs) {
        const p = m.metadata?.routedProvider?.trim();
        const mdl = m.metadata?.routedModel?.trim();
        if (p) providers.add(p);
        if (mdl) models.add(mdl);
      }
    }

    return {
      providers: Array.from(providers).sort((a, b) => a.localeCompare(b)),
      models: Array.from(models).sort((a, b) => a.localeCompare(b)),
    };
  }

  return await safeInvoke<HistoryFilterOptions>(
    IPC_COMMANDS.GET_HISTORY_FILTER_OPTIONS,
    {},
    { requestId: generateRequestId() }
  );
}

/**
 * Atomically deletes a bounded batch of sessions, cascading to messages and search index.
 */
export async function deleteHistorySessionsBulk(
  sessionIds: string[]
): Promise<BulkDeleteResult> {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "At least one session ID must be selected for bulk deletion",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (sessionIds.length > MAX_BULK_DELETE_BATCH) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Bulk delete exceeds maximum allowed batch size of ${MAX_BULK_DELETE_BATCH} sessions`,
      retryable: false,
      userActionRequired: true,
    });
  }

  const sanitizedIds: string[] = [];
  const seen = new Set<string>();
  for (const rawId of sessionIds) {
    const trimmed = rawId?.trim();
    if (!trimmed) {
      throw new IpcError({
        code: "INVALID_INPUT",
        category: "InvalidInput",
        message: "Bulk delete list contains an empty session ID",
        retryable: false,
        userActionRequired: true,
      });
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      sanitizedIds.push(trimmed);
    }
  }

  if (!isTauriContext()) {
    if (mockHistoryErrorTarget === "delete") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Failed to execute bulk conversation delete transaction",
        retryable: false,
      });
    }

    const store = __internalGetMockChatStore();
    const deletedSessionIds: string[] = [];
    const missingSessionIds: string[] = [];

    for (const sid of sanitizedIds) {
      if (store.sessions.delete(sid)) {
        store.messages.delete(sid);
        __internalDeleteMockTelemetryBySession(sid);
        deletedSessionIds.push(sid);
      } else {
        missingSessionIds.push(sid);
      }
    }

    return {
      requestedCount: sanitizedIds.length,
      deletedCount: deletedSessionIds.length,
      deletedSessionIds,
      missingSessionIds,
    };
  }

  return await safeInvoke<BulkDeleteResult>(
    IPC_COMMANDS.DELETE_HISTORY_SESSIONS_BULK,
    { sessionIds: sanitizedIds },
    { requestId: generateRequestId() }
  );
}

/**
 * Triggers a deterministic local search index rebuild from authoritative SQLite tables.
 */
export async function rebuildHistorySearchIndex(): Promise<number> {
  if (!isTauriContext()) {
    const store = __internalGetMockChatStore();
    let count = store.sessions.size;
    for (const msgs of store.messages.values()) {
      count += msgs.length;
    }
    return count;
  }

  return await safeInvoke<number>(
    IPC_COMMANDS.REBUILD_HISTORY_SEARCH_INDEX,
    {},
    { requestId: generateRequestId() }
  );
}
