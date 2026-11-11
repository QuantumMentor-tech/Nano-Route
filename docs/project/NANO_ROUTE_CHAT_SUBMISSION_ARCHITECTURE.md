# Nano Route — Prompt Submission, Routing Pipeline & Provider Execution Architecture

**Roadmap Phase**: Phase 7, Chat Experience  
**Step**: 32 of 90  
**Title**: Prompt Submission, Routing Pipeline & Provider Execution  
**Status**: COMPLETE  
**Primary Stack**: Tauri v2, Rust (Tokio), React 18, TypeScript 5, SQLite, Windows DPAPI  

---

## 1. Executive Summary

Step 32 establishes the first **end-to-end prompt submission and execution path** for Nano Route, linking the Step 31 Chat Studio workspace directly through native Tauri IPC to:
1. Session and prompt validation
2. SQLite user-message persistence (committed before any network call)
3. Step 27 Intent Classification & Step 28 Task Analysis (on-device local SLM)
4. Step 29 Candidate Scoring & Step 30 Routing Policy (deterministic route selection and validated manual override)
5. Canonical Provider Registry & Provider Resolver
6. Non-streaming provider execution via unified `ProviderClient` adapters (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, Mistral)
7. Response normalization, token usage accounting, and pricing calculations
8. SQLite assistant-message persistence with complete routing metadata (`routed_provider`, `routed_model`, `routing_reason`, `slm_confidence_score`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `cost_usd`)
9. Operational telemetry persistence and sanitized result delivery to the Chat Studio.

---

## 2. End-to-End Submission Lifecycle

```text
User enters prompt in Chat Studio
            ↓
    [Submit Action]
            ↓
  Front-End Validation
  (non-empty, length check, lock composer)
            ↓
  Tauri IPC Boundary
  cmd_submit_chat_prompt(ChatSubmissionRequest)
            ↓
  ChatOrchestrator::submit_prompt
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Validate Request & Double-Submission Session Guard    │
  │ 2. Resolve Target Session in SQLite                      │
  │ 3. Persist User Message (Sender = User) [COMMIT]         │
  │ 4. Run Task Analysis (Step 27 Intent + Step 28 Taxonomies)│
  │ 5. Evaluate Routing Policy & Scoring (Step 29 & 30)      │
  │ 6. Obtain & Revalidate Final Route (Provider & Model)    │
  │ 7. Assemble Context via ConversationContextBuilder        │
  │ 8. Resolve ProviderClient via ProviderResolver           │
  │ 9. Execute Outbound Call (Non-Streaming, Monotonic Timer)│
  │ 10. Normalize Provider Response & Usage Metrics          │
  │ 11. Persist Assistant Message (Sender = Assistant)[COMMIT]│
  │ 12. Record Operational Telemetry Event                   │
  └──────────────────────────────────────────────────────────┘
            ↓
  ChatSubmissionResult Returned across IPC
            ↓
  Chat Studio Timeline Reconciled (Stale-Session Protected)
            ↓
  Composer Unlocked & Active Turn Rendered
```

---

## 3. Core Architectural Modules

### 3.1 `ChatOrchestrator` (`src-tauri/src/services/chat_orchestrator.rs`)
Central native application service governing the complete request sequence.
- **Session Double-Submission Protection**: Employs an internal `active_sessions` thread-safe lock (`HashSet<String>`) guarded by an RAII `ScopeGuard` to reject concurrent submissions targeting the same active session.
- **Transaction Safety**: Decouples database transactions from network I/O. User prompts are persisted and committed immediately before routing; assistant messages are persisted and committed only after a verified provider response is received.

### 3.2 `ProviderResolver` (`src-tauri/src/providers/resolver.rs`)
Thread-safe client factory and registry mapping canonical `ProviderId` strings to concrete `Arc<dyn ProviderClient + Send + Sync>` instances.
- Backed by the DPAPI `CredentialVaultService` to supply transient plaintext credentials exclusively within native adapter transport boundaries.
- Supports runtime client registration (`register_client`) for deterministic offline mock testing.

### 3.3 `ConversationContextBuilder` (`src-tauri/src/services/context_builder.rs`)
Prepares conversational history for model execution:
- Loads previous session turns from `ChatService` in chronological order.
- Maps internal `MessageSender` roles (`User`, `Assistant`, `System`) to canonical `MessageRole` provider contracts.
- Strictly strips internal metadata artifacts (such as routing reasons, confidence scores, and token costs) to prevent prompt leakage.
- Validates conservative token estimation against the selected model's `context_window` capacity.

---

## 4. Key Security & Privacy Invariants

1. **Zero Credential Exposure**: API keys are encrypted at rest using Windows DPAPI (`CryptProtectData`) and decrypted transiently within native adapters. No credentials, Authorization headers, or secret tokens are ever returned to the frontend, persisted to chat records, or emitted in diagnostic logs.
2. **Local Routing Privacy**: Intent classification, task analysis, scoring, and policy evaluation run 100% on-device using the native SLM runtime and Rust core. Prompts are never sent to third-party routing or classification services.
3. **Frontend Routing Authority Prevention**: The presentation client cannot arbitrarily force provider or model execution. Manual overrides must pass Step 30 `ManualOverrideEvaluator` rules (validating catalog registration, provider activation, capability compatibility, and context bounds) before execution is permitted.
4. **Log Redaction**: Outbound requests and telemetry records only persist non-secret operational metadata (`requestId`, `sessionId`, `providerId`, `modelId`, `latencyMs`, `tokens`, `costUsd`). Raw prompt text and raw assistant response bodies are never recorded in telemetry.

---

## 5. Failure Semantics & Resilience

- **Provider Failure Invariant**: If the selected provider encounters network dropouts, rate limits, or API errors, the user message remains durably persisted in SQLite. No fake assistant response is fabricated, and typed error information is safely delivered to the frontend.
- **Assistant Persistence Failure**: If provider execution succeeds but SQLite assistant insertion fails, the provider call is **never** automatically repeated (preventing duplicate billable requests). A persistence failure is returned to the client with technical diagnostics logged securely.
- **Session Switching Isolation**: If the user switches to Session B while a prompt in Session A is actively executing, the result is committed to Session A's database thread. The frontend verifies `activeSessionIdRef.current === originatingSessionId` before modifying the timeline, guaranteeing that Session B remains completely uncontaminated.

---

## 6. Verification & Test Coverage

- **Automated Test Suites**: 301 passing tests across 152 suites (`node:test`).
- **TypeScript Typecheck**: 0 errors (`tsc --noEmit`).
- **Vite Production Build**: Verified production asset build in 6.47s.
- **Logo Size Invariant**: `Nano Route Neon Tech Logo.png` strictly preserved at **670,255 bytes**.

---

## 7. Roadmap Handoff

### Step 33 Handoff (End-to-End Streaming Chat Execution):
- Replace `execute` (non-streaming) with `execute_stream` through `StreamCoordinator`.
- Stream token deltas over Tauri Channels without rewriting session validation, context assembly, routing policy, or final assistant persistence.

### Step 35 Handoff (Automatic Recovery & User Cancellation):
- Expose cancellation tokens from `TaskContext` through user-initiated cancellation controls.
- Implement multi-attempt failover using `RoutingDecision.fallback_candidates`.

### Explicit Non-Goals for Step 32:
- No token-by-token streaming UI or simulated interval animations.
- No automatic provider failover cascades or retries.
- No user cancellation of in-flight network requests.
- No tool/function calling execution or multi-modal attachments.
- No local GGUF response generation.

