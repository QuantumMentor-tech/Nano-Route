# NANO ROUTE — AUTOMATIC FAILOVER & FALLBACK EXECUTION ENGINE ARCHITECTURE
**Document Version:** 1.0.0 (Step 37)  
**System Classification:** Desktop Core Subsystem  
**Runtime:** Tauri v2 Native Core (Rust) + React TypeScript Frontend  

---

## 1. Subsystem Overview

Step 37 introduces the **Automatic Failover & Fallback Execution Engine** for Nano Route. The failover engine builds strictly upon:
- **Step 30:** Routing Policy & Fallback Candidate Selection Contract
- **Step 35:** Execution Lifecycle & Cooperative Cancellation State Machine
- **Step 36:** Canonical Error Classification & Normalized Failure Envelopes

The failover engine provides resilient, deterministic model failover when primary model execution encounters eligible infrastructure, provider, or rate limit failures, without restarting the logical user request or violating user control.

### 1.1 Precedence with Step 38 Retry Engine
When an operational failure occurs, Step 38's Retry Policy evaluates whether the same provider/model can be safely retried (e.g. transient network before send, 429 with valid `Retry-After`). Step 37 failover is evaluated once same-candidate retries are exhausted, disallowed, or deemed unsafe (e.g. ambiguous post-send timeout, stream tokens already emitted).

---

## 2. Core Architectural Guarantees & Invariants

### 2.1 Logical Request Identity Invariant
- A failover is a controlled internal continuation of the original user prompt execution.
- It shares the exact same `logical_request_id` (`request_id`).
- It does **not** create duplicate user messages in SQLite or reset conversation state.

### 2.2 Authoritative Candidate Ordering (Zero Re-Scoring)
- Fallback candidates are consumed directly from Step 30's pre-computed, pre-ranked `fallback_candidates: Vec<FallbackCandidate>` attached to `RoutingDecision`.
- Nano Route **never** performs a second SLM routing pass or dynamic re-scoring during failover.

### 2.3 Strict Manual Override Protection
- When `selection_mode == SelectionMode::ManualOverride` (user explicitly selected a model via Chat Studio), automatic failover is **strictly prohibited**.
- The user's explicit model choice is respected unconditionally. If the chosen model fails, the error envelope is surfaced directly to the user.

### 2.4 Pre-Dispatch Candidate Validation
Before dispatching any candidate from `fallback_candidates`, `CandidateValidator` validates:
1. **Deduplication:** Candidate has not already been attempted within the logical execution (`attempted_candidates`).
2. **Provider Registry:** Provider is active and configured in `ProviderRegistry`.
3. **DPAPI Credential Vault:** Decrypted API key exists and is non-empty in Windows DPAPI storage.
4. **Model Catalog:** Model exists in the provider's registered model catalog.
5. **Context Window Headroom:** Model maximum context length accommodates the prompt token estimate.
6. **Task Capability Matching:** Candidate satisfies all hard capabilities identified during Step 28 task analysis (e.g., Code, Vision, JSON, ToolUse).

### 2.5 Stream Isolation & Token Discarding
- For streaming responses, failover generates a fresh, isolated physical `stream_id` (`strm_<timestamp>_<attempt>`).
- Sequence numbers on the new stream strictly restart at 0 (`ChatStreamEvent::Started`).
- Prior to starting the new stream, a `ChatStreamEvent::Failover` event is emitted on the primary stream.
- The frontend immediately clears transient tokens accumulated from the failed primary stream.
- Incomplete tokens from the failed primary attempt are **never concatenated** with fallback tokens.

### 2.6 Exactly-Once Database Persistence
- SQLite transactions never wrap network operations.
- The user message is persisted before outbound network I/O.
- Exactly **one** assistant message is persisted to SQLite upon successful completion across all attempts.
- Persisted metadata accurately records:
  - `routed_provider = fallback_provider`
  - `routed_model = fallback_model`
  - `failover_used = true`
  - `failover_from_provider = primary_provider`
  - `failover_from_model = primary_model`
  - `failover_reason = classification_envelope.user_message`
  - `failover_attempts = attempt_count`

### 2.7 Cancellation Precedence
- User cancellation takes strict precedence over failover.
- If the cancellation token is tripped during primary execution or while transitioning between fallback candidates, execution halts immediately.
- No further fallback attempts are dispatched.

---

## 3. Data Structures & Contract Types

### Rust (`src-tauri/src/reliability/types.rs`)

```rust
pub enum FailoverFinalStatus {
    PrimarySucceeded,
    FailoverSucceeded,
    FailoverExhausted,
    FailoverDisallowed,
    Cancelled,
}

pub struct FailoverAttempt {
    pub attempt_number: u32,
    pub provider_id: String,
    pub model_id: String,
    pub status: AttemptStatus,
    pub started_at: Instant,
    pub duration_ms: Option<u64>,
}
```

### TypeScript (`src/services/ipc/types.ts`)

```typescript
export interface ChatStreamFailoverEvent {
  type: "failover";
  streamId: string;
  sequence: number;
  logicalRequestId?: string;
  attempt: number;
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  reason: string;
  newStreamId: string;
  timestampMs: number;
  executionId?: string;
}
```

---

## 4. Chat Studio Presentation Integration

When an assistant response was completed via automatic failover:
1. `ModelBadge` reflects the final winning fallback provider and model.
2. A discreet Amber `data-testid="failover-badge"` is displayed next to the model badge:
   - Text: `Fallback from <primaryProvider>`
   - Title: Detailed diagnostic message and failover reason.
3. Why this route? explanation reflects the failover sequence.

