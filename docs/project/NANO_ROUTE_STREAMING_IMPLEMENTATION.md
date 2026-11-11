# NANO ROUTE — STEP 33 ARCHITECTURAL IMPLEMENTATION
## Streaming Response Engine & Live Chat Transport

### 1. Architectural Overview & Context
- **Roadmap Phase:** Phase 7, Chat Experience
- **Step:** 33 of 90
- **Step Title:** Streaming Response Engine & Live Chat Transport
- **Target Platform:** Windows Desktop (Windows 10 / 11 x64)
- **Primary Stack:** Tauri v2 + Rust + React 18 / TypeScript + SQLite + Tauri Channels

Step 33 establishes genuine streaming execution from all supported AI providers (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, and Mistral) to the React presentation layer using Tauri v2 Channels (`tauri::ipc::Channel<T>`).

---

### 2. Core Design Principles & Invariants

1. **Rule 27 Channel Enforcement:**
   Channel message handlers are attached on the frontend *before* invoking the native command (`safeInvoke(IPC_COMMANDS.STREAM_CHAT_PROMPT, ...)`). This guarantees zero dropped initial tokens or raced `started` events.

2. **Single SQLite Persistence Boundary:**
   - **User Message:** Persisted to SQLite synchronously *before* outbound provider network streaming begins. This guarantees the user's input is never lost, even if network I/O or provider connectivity fails.
   - **Assistant Message:** Persisted to SQLite **exactly once** upon receipt of provider stream completion (`Completed`). Individual token chunks / deltas are NEVER written to the database.
   - **Failure Boundary:** If provider streaming terminates unexpectedly or fails, partial content remains in presentation state marked incomplete / failed, but is NEVER persisted to SQLite as a successful assistant message.

3. **Monotonic Sequence Delivery:**
   Every event emitted across the channel carries a monotonic, 0-indexed sequence integer (`0: Started`, `1..N: Delta / Usage`, `N+1: Completed / Failed`). Out-of-order or duplicate sequence numbers are detected and discarded.

4. **Multi-Turn Context & Session Isolation:**
   - Active streams are strictly scoped to their originating session.
   - Rapid session switching does not leak streamed chunks into other sessions.
   - Stale responses or background completion reconcile seamlessly with SQLite records upon navigation.

5. **Streaming UX & Accessibility:**
   - Subtle blinking cursor and streaming badge displayed during active response generation.
   - Intelligent auto-scroll anchors the view to the latest incoming tokens unless the user actively scrolls upward.
   - Pure React `SafeMarkdown` handles partial syntax trees and unclosed code fences safely without throwing or rendering raw HTML.

---

### 3. Streaming Event Protocol (`ChatStreamEvent`)

| Event Type | Fields | Timing & Purpose |
|---|---|---|
| `started` | `streamId`, `sequence: 0`, `requestId`, `sessionId`, `userMessageId`, `providerId`, `modelId`, `selectionMode`, `routingReason`, `slmConfidence`, `timestampMs` | Emitted immediately after route selection, before first provider token. Establishes request/stream correlation. |
| `delta` | `streamId`, `sequence: 1..N`, `text` | Incremental UTF-8 textual fragment from provider SSE parser. |
| `usage` | `streamId`, `sequence`, `promptTokens`, `completionTokens` | Emitted when token usage is reported by the upstream provider. |
| `completed` | `streamId`, `sequence`, `finishReason`, `latencyMs`, `promptTokens`, `completionTokens`, `costUsd`, `assistantMessage` | Terminal event emitted after assistant message is successfully committed to SQLite. |
| `failed` | `streamId`, `sequence`, `code`, `message`, `isRetryable` | Terminal event emitted upon unrecoverable provider failure or cancellation. Assistant message is NOT persisted. |

---

### 4. Implementation Details by Component

#### Native Rust Core (`src-tauri/`)
- `providers/client.rs`: Added `execute_stream` default method to `ProviderClient` trait.
- `providers/{openai, anthropic, gemini, deepseek, groq, mistral}/client.rs`: Concrete providers implement `execute_stream` routing directly to their dedicated SSE parsers.
- `services/chat_orchestrator.rs`:
  - Defined `ChatStreamEvent` and `ChatStreamSink`.
  - Implemented `stream_prompt`: pre-flight validation, session concurrency guard with RAII `ScopeGuard`, user message persistence, task analysis, routing policy evaluation, context assembly, provider streaming, single-write SQLite assistant persistence, telemetry recording.
- `commands/chat.rs`: Added `cmd_stream_chat_prompt(request, channel, state)`.
- `commands/mod.rs` & `lib.rs`: Registered `cmd_stream_chat_prompt` in Tauri handler pipeline.

#### Frontend Presentation Layer (`src/`)
- `services/ipc/types.ts`: Added `STREAM_CHAT_PROMPT` command, `ChatMessage` transient flags (`isStreaming`, `isFailed`), and `ChatStreamEvent` types.
- `services/ipc/chat.ts`: Implemented `streamChatPrompt` with Tauri channel attachment and browser in-memory simulation for test environments.
- `features/chat/useChatStudio.ts`: Integrated streaming accumulation into `submitPrompt` with transient message state, deduplication, auto-scroll support, and stale-session isolation.
- `features/chat/components/AssistantMessage.tsx`: Added live streaming indicator, pulsing cursor, and failure alert badge.

---

### 5. Verification Baseline
- **Unit and Contract Tests:** 310 passing tests across 159 suites (`npm test`).
- **Validation Pipeline:** Typecheck (`tsc --noEmit`), unit tests, and production build (`vite build`) 100% green.
- **Brand Asset Invariant:** `Nano Route Neon Tech Logo.png` length verified at exactly 670,255 bytes.

