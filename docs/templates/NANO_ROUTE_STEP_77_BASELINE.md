# Nano Route — Step 77 Pre-Implementation Audit & Baseline

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 77 — Prompt Templates, Request Presets, Composer State & Safe Prompt Composition  
**Audit Date:** 2026-11-14  

---

## 1. Existing System Architecture Audit

### 1.1 Chat Composer & Message Draft Pipeline
- **Components**: `src/features/chat/components/Composer.tsx`, `ChatStudio.tsx`, `useChatStudio.ts`.
- **Draft State**: Held in React state within `Composer.tsx` (`text`, `initialValue`, dynamic autosizing `MIN_HEIGHT = 44`, `MAX_HEIGHT = 160`, bounded `DEFAULT_MAX_LENGTH = 16000`).
- **Submission Orchestration**: `submitPrompt(rawPrompt, manualOverride)` in `useChatStudio.ts` prepares the execution ID, evaluates Step 76 Context Preflight, and initiates Server-Sent Events streaming via `streamChatPrompt`.
- **Context Preview**: Context Indicator sits in the Composer footer bar alongside shortcuts reminder and character counter, opening `ContextReviewModal` on click.

### 1.2 Persistence Architecture
- **Native Core**: SQLite 3 database operating under Write-Ahead Logging (WAL) mode with foreign keys enabled (`src-tauri/src/storage/`).
- **Migrations**: Synchronously versioned and embedded via `include_str!` in `src-tauri/src/storage/migrations/runner.rs` (`001_database_foundation.sql` through `006_history_search_indexes.sql`).
- **Frontend IPC Bridge**: `src/services/ipc/` provides typed client invocations (`safeInvoke`) with mock fallbacks enabling automated unit testing and browser dev mode.

### 1.3 Context-Preflight & Token Estimation (Step 76)
- **Token Estimation**: Fast offline heuristic ($\lceil\text{chars} / 3.8\rceil + 4\text{ framing tokens}$) with memory-bounded caching (`MAX_CACHE_SIZE = 5000`).
- **Model Registry Authority**: Step 21/56 catalog defines authoritative limits (`contextWindow`, `maxInputTokens`, `maxOutputTokens`).
- **Enforcement**: Run directly in `submitPrompt` prior to network transmission. Blocks oversized prompts (`INPUT_TOKEN_LIMIT`, `CONTEXT_LIMIT_EXCEEDED`, `OUTPUT_TOKEN_LIMIT`).
- **Invariant**: Context reduction never deletes SQLite chat history.

### 1.4 Budget Guardrails & Financial Ledger (Step 75)
- **Preflight Evaluation**: Shares canonical token counts with Context Preflight. Evaluates local monthly limits (`HARD_LIMIT`, `SOFT_LIMIT`, `WARN_ONLY`, `OFF`).
- **Ledger Authority**: Step 43 cost ledger stores exact nano-USD costs once streaming completes.

### 1.5 Command Palette (Step 65)
- **Registry**: `src/features/commands/registry.ts` exposes centralized command descriptors with keyboard navigation, fuzzy keyword matching, and context-aware availability.

### 1.6 User Preferences (Step 66) & Workspace Profiles (Step 67)
- **Preferences**: Key-value settings stored in `app_settings` table and exposed via `usePreferences` context.
- **Portability**: User preferences are exportable and importable without secret leakage.

### 1.7 Data Portability & Privacy (Step 70 & 71)
- **Export Engine**: `src/features/export/` provides selective packages (`chat_history`, `user_preferences`, `telemetry_logs`, `audit_diagnostics`) with strict secret redaction.
- **Import Engine**: `src/features/import/` validates package manifest, schema versions, and conflict resolutions (`SKIP`, `OVERWRITE`, `KEEP_BOTH`).

---

## 2. Planned Integration Points for Step 77

```
Template / Preset Selection
           │
           ▼
Variable Extraction & Resolution Modal (Prompt for {{variable}} inputs)
           │
           ▼
Composed Draft Insertion into Composer
           │
           ▼
User Review / Manual Edit in Composer
           │
           ▼
Step 76 Context Preflight (Token estimation, limits check)
           │
           ▼
Step 75 Budget Preflight (Local spend evaluation)
           │
           ▼
Step 29/30 Routing & Provider Execution Pipeline
```

1. **Storage**: Implement `007_prompt_templates.sql` schema with SQLite tables `prompt_templates` and `request_presets`. Provide a full frontend service with IPC / mock fallback in `src/services/ipc/templates.ts`.
2. **Template Variable System**: Parse `{{variable_name}}` patterns deterministically. Prompt the user for missing variables via an accessible modal, then inject the resolved prompt into the Composer draft.
3. **Template Browser & Editor**: Dedicated drawer or modal providing category filtering, search, favorite toggling, creation, editing, cloning, and deletion.
4. **Composer Integration**: Add a dedicated template button (sparkles/layers icon) in the Composer footer bar alongside the Context Indicator and character counter.
5. **Command Palette Integration**: Register `Create Template`, `Insert Template`, and `Open Templates` in `src/features/commands/registry.ts`.
6. **Data Portability**: Add template JSON export and import with strict untrusted data validation and Step 71 conflict resolution.
7. **Zero Bypasses**: Templates must never bypass Step 76 context preflight, Step 75 budget controls, or Step 29 routing policies.

---

## 3. Explicit Non-Goals & Boundaries

- NO arbitrary scripting, macros, or code execution in templates.
- NO automated prompt submission upon template selection (user review is mandatory).
- NO credential or secret storage in templates.
- NO cloud synchronization or remote template repositories.
- NO automatic AI prompt optimization or rewriting.
- NO deletion or alteration of SQLite chat history.
- NO bypass of context windows or local budget caps.

---

## 4. Potential Regression Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| Variable parser injection or crash | Strict ASCII identifier regex `^[a-zA-Z0-9_-]{1,64}$`, bounded recursion, zero `eval`. |
| Unresolved placeholders reaching provider | Preflight placeholder validation warns user before insertion into composer. |
| Oversized template blowing context window | Composed draft flows into Step 76 preflight naturally before transmission. |
| Stale state during rapid template editing | Immutable state updates, optimistic UI with deterministic ID mapping. |
| Malicious imported template payload | Schema validation, length caps (name <= 100 chars, content <= 32k chars), sanitized serialization. |

