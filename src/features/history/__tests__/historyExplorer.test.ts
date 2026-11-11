/**
//! Nano Route — Step 41 History Explorer, Search & Conversation Management Tests
//! File: src/features/history/__tests__/historyExplorer.test.ts
//!
//! Validates all History Explorer contracts, search ranking, FTS/punctuation handling,
//! filter composition, local timestamp boundaries, pagination, pin/rename/delete/bulk
//! lifecycle, stale async guards, passive non-execution guarantees, XSS/SQLi safety,
//! and large-dataset bounded performance (2,200+ synthetic sessions).
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __internalGetMockChatStore,
  appendChatMessage,
  createChatSession,
  deleteChatMessage,
  deleteChatSession,
  getChatMessages,
  getChatSession,
  getMockExecutionCount,
  renameChatSession,
  resetChatMockStore,
  setChatSessionPinned,
} from "../../../services/ipc/chat.ts";
import {
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_BULK_DELETE_BATCH,
  MAX_HISTORY_PAGE_SIZE,
  MAX_PREVIEW_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  deleteHistorySessionsBulk,
  extractSafePreview,
  getHistoryFilterOptions,
  listHistorySessions,
  rebuildHistorySearchIndex,
  resetMockHistoryTestHooks,
  searchHistory,
  setMockHistoryTestHooks,
} from "../../../services/ipc/history.ts";
import { IpcError } from "../../../services/ipc/errors.ts";
import {
  parseLocalDateBoundaries,
  resolveDateRangeBounds,
} from "../timestamp.ts";
import { splitHighlightSegments } from "../highlight.ts";

describe("Step 41 History Explorer, Search & Conversation Management", () => {
  beforeEach(() => {
    resetChatMockStore();
    resetMockHistoryTestHooks();
  });

  // Helper to force deterministic timestamps in shared mock store
  function setMockTimestamps(
    sessionId: string,
    createdAt: number,
    updatedAt: number
  ): void {
    const store = __internalGetMockChatStore();
    const session = store.sessions.get(sessionId);
    if (session) {
      session.createdAt = createdAt;
      session.updatedAt = updatedAt;
    }
  }

  function setMockMessageTimestamp(messageId: string, createdAt: number): void {
    const store = __internalGetMockChatStore();
    for (const msgs of store.messages.values()) {
      const target = msgs.find((m) => m.id === messageId);
      if (target) {
        target.createdAt = createdAt;
      }
    }
  }

  // ==========================================================================
  // Scenario A: Empty Database State
  // ==========================================================================
  it("Scenario A: handles completely empty history store gracefully", async () => {
    const page = await listHistorySessions({ limit: 25, offset: 0 });
    assert.equal(page.items.length, 0);
    assert.equal(page.pageInfo.totalCount, 0);
    assert.equal(page.pageInfo.hasMore, false);

    const searchRes = await searchHistory({ query: "anything", limit: 25, offset: 0 });
    assert.equal(searchRes.items.length, 0);
    assert.equal(searchRes.pageInfo.totalCount, 0);

    const options = await getHistoryFilterOptions();
    assert.deepEqual(options.providers, []);
    assert.deepEqual(options.models, []);
  });

  // ==========================================================================
  // Scenario B & C: Title vs Message Match Ranking & Bounded Safe Previews
  // ==========================================================================
  it("Scenarios B & C: prioritizes exact title > partial title > message content and returns safe bounded previews", async () => {
    const msgOnly = await createChatSession({ title: "Weekend planning" });
    await appendChatMessage({
      sessionId: msgOnly.id,
      sender: "assistant",
      content:
        "Before starting any long migration, verify your Rust ownership model cleanly with zero data races across Tokio tasks and channels.",
      metadata: { routedProvider: "openai", routedModel: "gpt-4o" },
    });

    const partialTitle = await createChatSession({
      title: "Learning Rust async runtimes",
    });
    const exactTitle = await createChatSession({ title: "Rust" });

    // Ensure msgOnly has latest updatedAt so only ranking decides order
    setMockTimestamps(exactTitle.id, 1_700_000_001_000, 1_700_000_001_000);
    setMockTimestamps(partialTitle.id, 1_700_000_002_000, 1_700_000_002_000);
    setMockTimestamps(msgOnly.id, 1_700_000_005_000, 1_700_000_005_000);

    const response = await searchHistory({ query: "Rust", limit: 25, offset: 0 });
    assert.equal(response.items.length, 3);
    assert.equal(response.items[0].session.id, exactTitle.id);
    assert.equal(response.items[0].titleMatch, true);
    assert.equal(response.items[1].session.id, partialTitle.id);
    assert.equal(response.items[1].titleMatch, true);
    assert.equal(response.items[2].session.id, msgOnly.id);
    assert.equal(response.items[2].titleMatch, false);
    assert.equal(response.items[2].matchedMessageCount, 1);
    assert.equal(response.items[2].previews.length, 1);

    const preview = response.items[2].previews[0];
    assert.ok(Array.from(preview.previewText).length <= MAX_PREVIEW_CHARS);
    assert.ok(preview.matchStartOffset !== null && preview.matchLength === 4);

    // Standalone safe preview check on long text with Unicode
    const longUnicode =
      "🚀 ".repeat(80) + "TargetKeyword highlighted inside a long paragraph " + "end ".repeat(40);
    const extracted = extractSafePreview(longUnicode, "targetkeyword");
    assert.ok(Array.from(extracted.previewText).length <= MAX_PREVIEW_CHARS);
    assert.ok(extracted.matchStartOffset !== null);
    assert.equal(extracted.matchLength, "targetkeyword".length);
    const segs = splitHighlightSegments(
      extracted.previewText,
      extracted.matchStartOffset,
      extracted.matchLength
    );
    assert.equal(segs.hasMatch, true);
    assert.equal(segs.match.toLowerCase(), "targetkeyword");
  });

  // ==========================================================================
  // Scenario D: Case-Insensitive & Special-Character Punctuation Search
  // ==========================================================================
  it("Scenario D: searches punctuation, slashes, quotes, SQL wildcards, and SQLi safely", async () => {
    const s1 = await createChatSession({ title: "Error 429 troubleshooting" });
    await appendChatMessage({
      sessionId: s1.id,
      sender: "assistant",
      content:
        "Retry-After header parsing for `foo_bar` using async/await and 100% backoff.",
      metadata: { routedProvider: "anthropic", routedModel: "claude-3-5-sonnet" },
    });

    const s2 = await createChatSession({ title: "O'Brien SQL literal check" });
    await appendChatMessage({
      sessionId: s2.id,
      sender: "user",
      content: "Ignore '; DROP TABLE chat_sessions; -- literally.",
    });

    for (const q of ["ERROR 429", "foo_bar", "async/await", "100%", "O'Brien", "DROP TABLE"]) {
      const res = await searchHistory({ query: q });
      assert.ok(res.items.length >= 1, `Expected search match for query: ${q}`);
    }

    // Wildcard `%` must NOT match unrelated sessions
    const pctRes = await searchHistory({ query: "100%" });
    assert.equal(pctRes.items.length, 1);
    assert.equal(pctRes.items[0].session.id, s1.id);

    // SQL injection payload does not throw or corrupt store
    const sqliRes = await searchHistory({ query: "' OR '1'='1" });
    assert.equal(sqliRes.items.length, 0);
  });

  // ==========================================================================
  // Scenario E: Structured Filter Composition & Non-Inference Invariant
  // ==========================================================================
  it("Scenario E: composes filters accurately without inferring missing providers", async () => {
    const emptySession = await createChatSession({ title: "Empty scratch session" });
    setMockTimestamps(emptySession.id, 1_700_000_010_000, 1_700_000_010_000);

    const mixed = await createChatSession({ title: "Architecture Review" });
    await appendChatMessage({
      sessionId: mixed.id,
      sender: "assistant",
      content: "OpenAI design notes",
      metadata: { routedProvider: "openai", routedModel: "gpt-4o" },
    });
    await appendChatMessage({
      sessionId: mixed.id,
      sender: "assistant",
      content: "Anthropic counter-analysis",
      metadata: { routedProvider: "anthropic", routedModel: "claude-3-7-sonnet" },
    });
    await setChatSessionPinned(mixed.id, true);

    const onlyOpenAi = await createChatSession({ title: "Quick prompt" });
    await appendChatMessage({
      sessionId: onlyOpenAi.id,
      sender: "assistant",
      content: "OpenAI quick answer",
      metadata: { routedProvider: "openai", routedModel: "gpt-4o-mini" },
    });

    // Empty session has zero messages and must NEVER be inferred under a provider filter
    const anthropicFiltered = await listHistorySessions({
      filter: { providerId: "anthropic" },
    });
    assert.deepEqual(
      anthropicFiltered.items.map((s) => s.id),
      [mixed.id]
    );

    // Combined filter: openai + pinnedOnly + query
    const combined = await searchHistory({
      query: "design",
      filter: {
        providerId: "openai",
        modelId: "gpt-4o",
        pinnedOnly: true,
      },
    });
    assert.equal(combined.items.length, 1);
    assert.equal(combined.items[0].session.id, mixed.id);

    const filterOpts = await getHistoryFilterOptions();
    assert.deepEqual(filterOpts.providers, ["anthropic", "openai"]);
    assert.deepEqual(filterOpts.models, [
      "claude-3-7-sonnet",
      "gpt-4o",
      "gpt-4o-mini",
    ]);
  });

  // ==========================================================================
  // Scenario F: Timestamp & Timezone Consistency
  // ==========================================================================
  it("Scenario F: resolves local date presets cleanly and rejects inverted custom bounds", async () => {
    const refNow = new Date(2026, 4, 15, 14, 30, 0, 0).getTime();
    const todayBounds = resolveDateRangeBounds("today", undefined, undefined, refNow);
    const localStart = new Date(2026, 4, 15, 0, 0, 0, 0).getTime();
    const localEnd = new Date(2026, 4, 15, 23, 59, 59, 999).getTime();
    assert.equal(todayBounds.dateFrom, localStart);
    assert.equal(todayBounds.dateTo, localEnd);

    const custom = parseLocalDateBoundaries("2026-02-28");
    assert.ok(custom !== null);
    assert.equal(parseLocalDateBoundaries("2026-02-31"), null);

    // Inverted date range throws INVALID_INPUT
    await assert.rejects(
      () =>
        listHistorySessions({
          filter: { dateFrom: 2_000_000_000, dateTo: 1_000_000_000 },
        }),
      (err: unknown) => err instanceof IpcError && err.code === "INVALID_INPUT"
    );
  });

  // ==========================================================================
  // Scenario G & H: Deterministic Sorting & Bounded Pagination
  // ==========================================================================
  it("Scenarios G & H: sorts deterministically and paginates bounded non-overlapping slices", async () => {
    const createdIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const s = await createChatSession({
        title: `Session #${String(i).padStart(2, "0")}`,
      });
      createdIds.push(s.id);
      setMockTimestamps(
        s.id,
        1_700_000_000_000 + i * 1_000,
        1_700_100_000_000 + (29 - i) * 1_000
      );
    }
    await setChatSessionPinned(createdIds[28], true);

    const pinnedFirst = await listHistorySessions({
      sort: "pinned_first",
      limit: 5,
      offset: 0,
    });
    assert.equal(pinnedFirst.items[0].id, createdIds[28]);
    assert.equal(pinnedFirst.items[0].pinned, true);

    const oldest = await listHistorySessions({
      sort: "oldest",
      limit: 10,
      offset: 0,
    });
    assert.equal(oldest.items[0].id, createdIds[29]);

    const page1 = await listHistorySessions({
      sort: "recently_created",
      limit: DEFAULT_HISTORY_PAGE_SIZE,
      offset: 0,
    });
    const page2 = await listHistorySessions({
      sort: "recently_created",
      limit: DEFAULT_HISTORY_PAGE_SIZE,
      offset: DEFAULT_HISTORY_PAGE_SIZE,
    });

    assert.equal(page1.items.length, 25);
    assert.equal(page1.pageInfo.hasMore, true);
    assert.equal(page1.pageInfo.totalCount, 30);
    assert.equal(page2.items.length, 5);
    assert.equal(page2.pageInfo.hasMore, false);

    const seen = new Set([
      ...page1.items.map((x) => x.id),
      ...page2.items.map((x) => x.id),
    ]);
    assert.equal(seen.size, 30);

    // Clamping oversized limit to MAX_HISTORY_PAGE_SIZE (100)
    const clamped = await listHistorySessions({ limit: 999, offset: 0 });
    assert.equal(clamped.pageInfo.limit, MAX_HISTORY_PAGE_SIZE);
  });

  // ==========================================================================
  // Scenarios I, J, K, L: Pin, Rename, Single-Message Delete, Full-Session Delete
  // ==========================================================================
  it("Scenarios I–L: persists pin, rename, single-message delete, and session delete cleanly", async () => {
    const s = await createChatSession({ title: "Initial Title" });
    const m1 = await appendChatMessage({
      sessionId: s.id,
      sender: "user",
      content: "Keep this important question forever.",
    });
    const m2 = await appendChatMessage({
      sessionId: s.id,
      sender: "assistant",
      content: "Ephemeral secret token xyz-delete-me",
      metadata: { routedProvider: "groq", routedModel: "llama-3.3-70b" },
    });

    // Pin should preserve updatedAt
    const beforePinUpdatedAt = (await getChatSession(s.id))!.updatedAt;
    const pinnedSession = await setChatSessionPinned(s.id, true);
    assert.equal(pinnedSession.pinned, true);
    assert.equal(pinnedSession.updatedAt, beforePinUpdatedAt);

    // Empty/whitespace rename rejected
    await assert.rejects(() => renameChatSession(s.id, "   \t  "));

    // Valid rename updates searchability immediately
    await renameChatSession(s.id, "Production Triage Log");
    const byNewTitle = await searchHistory({ query: "Triage" });
    assert.equal(byNewTitle.items.length, 1);
    assert.equal(byNewTitle.items[0].session.pinned, true);

    // Single message delete removes only m2 from messages & search index
    const deletedMsg = await deleteChatMessage(m2.id);
    assert.equal(deletedMsg, true);
    const remaining = await getChatMessages({ sessionId: s.id });
    assert.deepEqual(
      remaining.map((m) => m.id),
      [m1.id]
    );
    const removedSearch = await searchHistory({ query: "xyz-delete-me" });
    assert.equal(removedSearch.items.length, 0);
    const keptSearch = await searchHistory({ query: "important question" });
    assert.equal(keptSearch.items.length, 1);

    // Full session delete removes session and remaining child messages
    const deletedSess = await deleteChatSession(s.id);
    assert.equal(deletedSess, true);
    assert.equal(await getChatSession(s.id), null);
    await assert.rejects(
      () => getChatMessages({ sessionId: s.id }),
      (err: unknown) => err instanceof IpcError && err.code === "NOT_FOUND"
    );
    assert.equal((await listHistorySessions()).items.length, 0);
  });

  // ==========================================================================
  // Scenario M: Controlled Bulk Delete & Batch Limit Enforcement
  // ==========================================================================
  it("Scenario M: executes bulk delete atomically, reports missing IDs, and enforces batch cap", async () => {
    const s1 = await createChatSession({ title: "Delete One" });
    const s2 = await createChatSession({ title: "Delete Two" });
    const s3 = await createChatSession({ title: "Keep Three" });

    const res = await deleteHistorySessionsBulk([s1.id, s2.id, "non-existent-id"]);
    assert.equal(res.requestedCount, 3);
    assert.equal(res.deletedCount, 2);
    assert.deepEqual(res.deletedSessionIds, [s1.id, s2.id]);
    assert.deepEqual(res.missingSessionIds, ["non-existent-id"]);

    const remaining = await listHistorySessions();
    assert.deepEqual(
      remaining.items.map((s) => s.id),
      [s3.id]
    );

    // Batch cap enforcement (> 100)
    const oversized = Array.from(
      { length: MAX_BULK_DELETE_BATCH + 1 },
      (_, i) => `id_${i}`
    );
    await assert.rejects(
      () => deleteHistorySessionsBulk(oversized),
      (err: unknown) => err instanceof IpcError && err.code === "INVALID_INPUT"
    );

    // Injected transactional failure leaves survivor intact
    setMockHistoryTestHooks({ errorTarget: "delete" });
    await assert.rejects(() => deleteHistorySessionsBulk([s3.id]));
    resetMockHistoryTestHooks();
    assert.equal((await listHistorySessions()).items.length, 1);
  });

  // ==========================================================================
  // Scenario N: Async Stale-Response Ordering Guard Simulation
  // ==========================================================================
  it("Scenario N: preserves queryId tags so stale slow searches never overwrite faster latest queries", async () => {
    await createChatSession({ title: "React frontend styling" });
    await createChatSession({ title: "Rust backend engine" });

    setMockHistoryTestHooks({
      perQueryDelayMs: (q) => (q === "react" ? 45 : 5),
    });

    const pSlow = searchHistory({ query: "react", queryId: "q_1" });
    const pFast = searchHistory({ query: "rust", queryId: "q_2" });

    const completionOrder: string[] = [];
    void pSlow.then((r) => completionOrder.push(r.queryId!));
    void pFast.then((r) => completionOrder.push(r.queryId!));

    const [slowRes, fastRes] = await Promise.all([pSlow, pFast]);
    assert.equal(completionOrder[0], "q_2");
    assert.equal(completionOrder[1], "q_1");
    assert.equal(fastRes.items[0].session.title, "Rust backend engine");
    assert.equal(slowRes.items[0].session.title, "React frontend styling");
  });

  // ==========================================================================
  // Scenario O: Passive History Invariant & Legacy/Deprecated Provider Inspection
  // ==========================================================================
  it("Scenario O: inspects deprecated providers and triggers ZERO SLM/routing executions", async () => {
    const execCountBefore = getMockExecutionCount();

    const legacy = await createChatSession({ title: "Legacy 2024 session" });
    const legacyMsg = await appendChatMessage({
      sessionId: legacy.id,
      sender: "assistant",
      content: "Historical response from deprecated provider",
      metadata: {
        routedProvider: "deprecated-legacy-provider",
        routedModel: "sunset-model-v0",
      },
    });
    setMockMessageTimestamp(legacyMsg.id, 1_700_000_000_000);

    // Run full gamut of History Explorer operations
    await listHistorySessions({ limit: 25, offset: 0 });
    const searchRes = await searchHistory({ query: "deprecated" });
    assert.equal(searchRes.items[0].session.providersUsed[0], "deprecated-legacy-provider");
    assert.equal(searchRes.items[0].session.modelsUsed[0], "sunset-model-v0");

    const filterOpts = await getHistoryFilterOptions();
    assert.ok(filterOpts.providers.includes("deprecated-legacy-provider"));
    assert.ok(filterOpts.models.includes("sunset-model-v0"));

    await getChatSession(legacy.id);
    await getChatMessages({ sessionId: legacy.id });
    await rebuildHistorySearchIndex();

    // Critical invariant: ZERO SLM, routing scoring, health check, or provider executions occurred
    assert.equal(getMockExecutionCount(), execCountBefore);
  });

  // ==========================================================================
  // Scenario P: XSS Highlight Safety, Query Cap, & 2,200-Session Performance
  // ==========================================================================
  it("Scenario P: sanitizes highlights safely, enforces query cap, and searches 2,200+ sessions quickly", async () => {
    // XSS / Unicode highlight safety
    const xss = '<script>alert("xss")</script> 🚀 Rust';
    const segs = splitHighlightSegments(xss, 32, 4);
    assert.equal(segs.hasMatch, true);
    assert.equal(segs.match, "Rust");
    assert.ok(segs.before.startsWith("<script>"));

    // Out-of-bounds offsets degrade safely
    const safeOob = splitHighlightSegments("hello", 99, 5);
    assert.equal(safeOob.hasMatch, false);
    assert.equal(safeOob.before, "hello");

    // Oversized query (> 512 chars) rejected
    const oversizedQuery = "a".repeat(MAX_SEARCH_QUERY_CHARS + 1);
    await assert.rejects(
      () => searchHistory({ query: oversizedQuery }),
      (err: unknown) => err instanceof IpcError && err.code === "INVALID_INPUT"
    );

    // Populate 2,200 sessions + 4,400 messages directly via shared mock store for speed
    const store = __internalGetMockChatStore();
    const baseTime = 1_700_000_000_000;
    for (let i = 0; i < 2200; i++) {
      const sid = `perf_sess_${i}`;
      store.sessions.set(sid, {
        id: sid,
        title:
          i === 1875
            ? "Needle Title Target Session"
            : `Benchmark Conversation ${i}`,
        createdAt: baseTime + i,
        updatedAt: baseTime + i,
        pinned: i % 500 === 0,
      });
      store.messages.set(sid, [
        {
          id: `perf_u_${i}`,
          sessionId: sid,
          sender: "user",
          content: `Benchmark prompt ${i}`,
          metadata: {
            routedProvider: null,
            routedModel: null,
            routingReason: null,
            slmConfidenceScore: null,
            promptTokens: 5,
            completionTokens: 0,
            latencyMs: 0,
            costUsd: 0,
            failoverUsed: null,
            failoverFromProvider: null,
            failoverFromModel: null,
            failoverReason: null,
          },
          createdAt: baseTime + i,
        },
        {
          id: `perf_a_${i}`,
          sessionId: sid,
          sender: "assistant",
          content:
            i === 420
              ? "Deep archive response with UniquePerfKeyword123 marker."
              : `Standard response payload ${i}`,
          metadata: {
            routedProvider: i % 2 === 0 ? "openai" : "anthropic",
            routedModel: i % 2 === 0 ? "gpt-4o" : "claude-3-5-sonnet",
            routingReason: "Benchmark fixture",
            slmConfidenceScore: 0.9,
            promptTokens: 5,
            completionTokens: 12,
            latencyMs: 120,
            costUsd: 0,
            failoverUsed: false,
            failoverFromProvider: null,
            failoverFromModel: null,
            failoverReason: null,
          },
          createdAt: baseTime + i + 1,
        },
      ]);
    }

    const t0 = performance.now();
    const boundedList = await listHistorySessions({ limit: 25, offset: 0 });
    const tListMs = performance.now() - t0;

    assert.equal(boundedList.items.length, 25);
    assert.equal(boundedList.pageInfo.totalCount, 2200);
    assert.equal(boundedList.pageInfo.hasMore, true);
    assert.ok(tListMs < 500, `Bounded listing took ${tListMs.toFixed(1)}ms`);

    const t1 = performance.now();
    const fastSearch = await searchHistory({
      query: "UniquePerfKeyword123",
      limit: 25,
      offset: 0,
    });
    const tSearchMs = performance.now() - t1;

    assert.equal(fastSearch.items.length, 1);
    assert.equal(fastSearch.items[0].session.id, "perf_sess_420");
    assert.ok(tSearchMs < 500, `2200-session search took ${tSearchMs.toFixed(1)}ms`);
  });
});
