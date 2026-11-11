# Nano Route — History Explorer, Search & Conversation Management

**Step:** 41  
**Status:** Implemented  
**Module Boundaries:**
- Rust Migration: `src-tauri/src/storage/migrations/006_history_search_indexes.sql`
- Rust Domain: `src-tauri/src/domain/history.rs`
- Rust Repository: `src-tauri/src/storage/repositories/history_repo.rs`
- Rust Service: `src-tauri/src/services/history.rs`
- Rust Tauri Commands: `src-tauri/src/commands/history.rs`
- Frontend IPC: `src/services/ipc/history.ts`, `src/services/ipc/types.ts`
- Frontend History Feature: `src/features/history/*`
- Page Host: `src/pages/HistoryPage.tsx`

---

## 1. Architectural Invariant: Passive History vs. Live Orchestration

The History Explorer is strictly a **passive historical record**. Opening, browsing, searching, filtering, sorting, pinning, renaming, or deleting conversations in History Explorer **never** triggers:

- Local SLM classification or task analysis (`local_slm`)
- Routing scoring engine or routing policy resolution
- Provider client execution, retries, failovers, or streaming
- Live provider health checks or outbound network traffic

Explicit continuation occurs **only** when the user selects **Continue in Chat Studio**, which navigates to `/chat?sessionId=...` (and optional `&focusMessageId=...`). New prompts typed in Chat Studio enter the established Step 32/33 submission pipeline normally.

---

## 2. SQLite Storage & FTS5 Architecture (Migration `006`)

`006_history_search_indexes.sql` extends `chat_sessions` and `chat_messages` without duplicating session/message truth:

### 2.1 Composite Query Indexes
- `idx_chat_sessions_pinned_updated(pinned DESC, updated_at DESC, id DESC)`
- `idx_chat_sessions_created_at(created_at DESC, id DESC)`
- `idx_chat_messages_provider_session_created(routed_provider, session_id, created_at DESC)`
- `idx_chat_messages_model_session_created(routed_model, session_id, created_at DESC)`
- `idx_chat_messages_created_at(created_at DESC)`

All timestamps across SQLite and TypeScript follow Unix epoch milliseconds (`i64`).

### 2.2 FTS5 Index & Atomic Trigger Lifecycle
- Virtual table: `history_search_fts(entry_type UNINDEXED, session_id UNINDEXED, message_id UNINDEXED, text, tokenize = 'unicode61')`.
- Initial migration executes a single idempotent backfill from `chat_sessions` and `chat_messages`.
- Synchronized atomically via triggers:
  - `trg_fts_session_insert`
  - `trg_fts_session_update_title`
  - `trg_fts_session_delete` (explicitly purges both `'session'` and all child `'message'` FTS entries for `OLD.id`, avoiding reliance on `PRAGMA recursive_triggers` during `ON DELETE CASCADE`)
  - `trg_fts_message_insert`
  - `trg_fts_message_delete`

### 2.3 Safe Query Building & Fallback Path
`HistoryRepository::search` builds parameterized double-quoted FTS5 prefix terms when tokens are FTS-friendly and transparently falls back to parameterized SQL `LIKE ... ESCAPE '\'` when queries consist solely of punctuation/operators or if FTS5 rejects a query expression (`HistorySearchEngine::SqlIndexedFallback`).

---

## 3. Domain & Pagination Contracts

- Bounded paging: `limit` clamped to `1..=100` (default `25`), non-negative `offset`.
- Single-query aggregate session listing (`LEFT JOIN chat_messages` + `GROUP_CONCAT`) eliminates N+1 queries.
- Search prioritization: exact title matches (`rank 0`) → partial title matches (`rank 1`) → message content matches (`rank 2`), broken by deterministic pin/updated_at tie-breakers.
- Maximum `3` bounded message match previews per session (`<= 160` Unicode codepoints) with exact character offsets for plain-text React `<mark>` highlighting (`splitHighlightSegments` in `src/features/history/highlight.ts`).

---

## 4. Controlled Mutations & Lifecycle Integrity

- **Pin / Unpin (`set_chat_session_pinned`)**: Updates `pinned` without mutating `updated_at`.
- **Rename (`rename_chat_session`)**: Rejects empty/whitespace-only titles; updates `title`, `updated_at`, and FTS5 entry.
- **Single-Message Delete (`delete_chat_message`)**: Deletes a single message while keeping remaining messages intact and updating FTS5 via `trg_fts_message_delete`.
- **Full-Session Delete (`delete_chat_session`)**: Deletes session, cascades to messages, and removes all FTS5 rows.
- **Bulk Delete (`cmd_delete_history_sessions_bulk`)**: Runs under `TransactionBehavior::Immediate`, capped at `100` IDs per call, returning `{ requestedCount, deletedCount, deletedSessionIds, missingSessionIds }`. Always gated by explicit `ConfirmDialog` labels in UI (never `"OK"`).

---

## 5. Privacy, Security & Performance Guarantees

- **Zero HTML/XSS Injection**: Highlighting renders JSX slices (`splitHighlightSegments` + `<SafeHighlightedText />`) — zero `dangerouslySetInnerHTML`.
- **Zero SQL Injection**: All filters, `LIKE` patterns (`%`, `_`, `\`), and FTS5 tokens are parameterized.
- **Zero Sensitive Content Logging**: Search query strings and raw conversation contents are never emitted to application logs or telemetry pipelines.
- **Stale Async Guard**: `useHistoryExplorer` maintains monotonic request/conversation sequence counters (`listQuerySeqRef`, `conversationSeqRef`) plus `220ms` search debouncing so slower stale responses never overwrite newer results.
- **Telemetry Phase Boundary**: Analytics/telemetry dashboards (Steps 42–45) remain explicitly out of scope and untouched.

