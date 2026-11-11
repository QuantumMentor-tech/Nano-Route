# Nano Route — Reliability Testing & Resilience Validation (Step 40)

## 1. Objective & Scope Boundary

Step 40 is the **comprehensive reliability, resilience, concurrency, and regression validation gate** across the Nano Route execution stack (Steps 1 through 39).

Rather than introducing new product features, this milestone stress-tests how the interconnected subsystems interact as one deterministic execution machine:

- **Step 35:** Execution Lifecycle State Machine & Cooperative Cancellation (`ExecutionManager`, `CancellationToken`, single-finalization recovery)
- **Step 36:** Error Classification, Security Sanitization & Normalized `ErrorEnvelope` Handling
- **Step 37:** Automatic Failover & Ranked Fallback Execution with Stream Discard Isolation
- **Step 38:** Retry, Timeout & Rate-Limit Control with Ambiguous Timeout Protection & Cancel-Safe Backoff
- **Step 39:** Context Window Headroom, Local DPAPI Monthly Budget Guard & Provider Availability Preflight

---

## 2. Fault-Injection & Harness Architecture

To make failure modes deterministic, reproducible, and offline-verifiable without live network flakiness, Step 40 combines three validation layers:

1. **Deterministic IPC Mock Simulation Harness (`src/services/ipc/chat.ts`)**
   - Simulates end-to-end prompt submission (`submitChatPrompt`), ordered event streaming (`streamChatPrompt`), active execution registries (`mockExecutions`), cooperative cancellation (`cancelChatExecution`, `cancelSessionChat`), preflight (`checkPreflight`, `getQuotaSnapshot`), and error normalization (`classifyError`).
   - Supports deterministic fault-injection markers for repeatable negative-path validation:
     - `__CANCEL_STREAM__`, `__CANCEL_MID_STREAM__`, `__ASYNC_STREAM__`
     - `__RETRY_TEST__`, `__RETRY_THEN_SUCCEED__`, `__RETRY_BUDGET_BLOCKED__`, `__RETRY_CANCEL__`
     - `__FAILOVER_TEST__`, `__FAILOVER_SUCCESS__`, `__PARTIAL_BEFORE_FAILOVER__`, `__FAILOVER_CANCEL__`, `__FAILOVER_EXHAUSTED__`, `__FULL_EXHAUSTION__`
     - `__ALL_CANDIDATES_CONTEXT_BLOCKED__`, `__CONTEXT_EXCEEDED_PRIMARY_FALLBACK__`
     - `__LOCAL_BUDGET_EXCEEDED__`, `__PROVIDER_QUOTA_EXHAUSTED__`, `__ENDPOINT_MISCONFIGURED__`
     - `__PERSISTENCE_FAILURE__`, `__FAIL_STREAM__`, `__FAIL_AUTH__`, `__FAIL_RATELIMIT__`, `__FAIL_CONTEXT__`, `__UNKNOWN_PRICING_SUCCESS__`

2. **Master Step 40 Resilience Test Suite (`src/features/chat/__tests__/reliabilityResilience.test.ts`)**
   - **30 dedicated tests** across 3 suites covering:
     - **18 Core Execution Scenarios** (normal flow, user cancellation, transient retry, ambiguous post-send timeout non-replay, 429 rate-limit backoff/failover, stream failover discard isolation, context/quota/budget preflight blocks, concurrent budget reservation guard, SQLite write failure no-replay, candidate exhaustion, cancellation during retry/fallback, multi-session isolation, historical routing immutability, restart clean state).
     - **10 Property-Style Safety Invariants** (cancellation never yields assistant persistence, single commit per logical request, preflight no-send invariant, stale event isolation, persistence-failure no-replay, disabled-provider non-dispatch, retry ceiling bound `maxRetries <= 2`, cancel precedence over failover, credential & local path sanitization, historical explanation immutability).
     - **Concurrency & Resource Leak Verification** (burst execution cleanup verifying 0 active execution leaks; cooperative cancellation idempotency under parallel `cancelChatExecution` invocations).

3. **Native Rust Concurrency & Security Static Audit (`src-tauri/src/`)**
   - Static inspection and race/deadlock review of native Rust orchestration, `ExecutionManager`, `sanitizer.rs`, `preflight.rs`, `quota.rs`, and `retry_policy.rs`.

---

## 3. Defects Identified & Remediated During Validation

Step 40 validation uncovered and resolved the following real defects:

### Defect 1 — Lock-Order Inversion & TOCTOU Window in Native `ExecutionManager`
- **File:** `src-tauri/src/services/execution/manager.rs`
- **Root Cause:** `create_execution` and `get_active_execution_for_session` acquired `session_to_execution` before `executions`, whereas cleanup and mutation paths acquired `executions` before `session_to_execution` (AB-BA deadlock hazard). Additionally, `create_execution` dropped read locks before reacquiring write locks, opening a check-then-insert TOCTOU race for concurrent same-session submissions.
- **Fix Applied:** Enforced strict canonical lock hierarchy (`executions` -> `session_to_execution` -> `ctx_arc`) and held the write lock pair atomically across the active-session duplicate check and insertion.

### Defect 2 — Local Path Sanitization Gap in Mock Error Envelope
- **Files:** `src/services/ipc/chat.ts`, `src/features/chat/__tests__/errorClassification.test.ts`
- **Root Cause:** `createMockErrorEnvelope` replaced `C:\Users\<name>` with `C:\Users\[REDACTED]`, leaving the `C:\Users\` prefix and trailing subdirectories (`\AppData\...`) exposed—diverging from Rust `src-tauri/src/errors/sanitizer.rs` which scrubs the entire path to `[REDACTED_LOCAL_PATH]`.
- **Fix Applied:** Harmonized `createMockErrorEnvelope` path redaction regex (Windows `:\Users\...` and Unix `/home/...`) to replace full paths with `[REDACTED_LOCAL_PATH]`, and updated `errorClassification.test.ts` to assert alignment with Rust `sanitizer.rs`.

### Defect 3 — Standalone Partial-Stream Failover Trigger Condition
- **File:** `src/services/ipc/chat.ts`
- **Root Cause:** `__PARTIAL_BEFORE_FAILOVER__` was nested inside `__FAILOVER_TEST__`, preventing standalone invocation during streaming failover discard tests.
- **Fix Applied:** Added `__PARTIAL_BEFORE_FAILOVER__` to the outer failover stream branch guard so partial primary deltas are emitted and explicitly isolated on primary stream ID before switching cleanly to `fbStreamId`.

### Defect 4 — Test Hook Alignment for Async Concurrent Cancellation
- **File:** `src/services/ipc/chat.ts`, `src/features/chat/__tests__/reliabilityResilience.test.ts`
- **Root Cause:** Cooperative parallel cancellation test needed `__ASYNC_STREAM__` with an explicit `executionId` and compatible terminal state acknowledgement (`cancelled: true, state: "cancelled"`) preserving Step 35 double-click Stop idempotency guarantees.
- **Fix Applied:** Retained idempotent `cancelled: true` acknowledgement for repeat cancels on cancelled executions (`executionLifecycle.test.ts`) while validating parallel cooperative termination (`reliabilityResilience.test.ts`).

---

## 4. Environment Limitations & Honest Verification Status

In accordance with Step 40 reporting discipline:

- **Verified via Execution (`PASS`):**
  - TypeScript strict type checking (`npm run typecheck` / `tsc --noEmit`): **0 errors**
  - All 31 Node test suites (`npm test` / `node --experimental-strip-types --test`): **416 / 416 tests passing across 218 suites (0 failures)**
  - Vite + TypeScript production frontend bundle (`npm run build` / `tsc && vite build`): **Clean exit 0**
  - Brand asset integrity check (`Nano Route Neon Tech Logo.png`): **670,255 bytes exact match**

- **Not Executed in Current Environment (`NOT RUN`):**
  - **Native Rust compilation and Rust unit/integration test execution (`cargo check`, `cargo test`, `tauri build`):** The Windows workspace environment does not have `cargo` / `rustc` installed in the system `PATH`. Therefore, Rust source changes (including the lock-ordering fix in `src-tauri/src/services/execution/manager.rs`) were verified by careful static code audit and type/contract alignment rather than compiled execution on this host.
  - **Live external provider HTTP/SSE calls:** All retry, 429, failover, timeout, and stream interruption flows were exercised against the deterministic in-memory mock transport rather than live paid API endpoints.

