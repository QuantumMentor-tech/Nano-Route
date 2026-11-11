# NANO ROUTE — RETRY, TIMEOUT & RATE-LIMIT CONTROL ENGINE ARCHITECTURE
**Document Version:** 1.0.0 (Step 38)  
**System Classification:** Desktop Core Subsystem  
**Runtime:** Tauri v2 Native Core (Rust) + React TypeScript Frontend  

---

## 1. Executive Summary

Step 38 introduces the **Retry, Timeout & Rate-Limit Control Engine** for Nano Route. This subsystem establishes a controlled, bounded, cancellation-aware policy for retrying eligible failures on the **same provider/model candidate** before handing off to Step 37 automatic failover across different candidates.

The governing invariant of Step 38 is:

> **A retry is a new physical provider attempt within the same logical request, and it is permitted only when the system can prove that another attempt is safe, policy-allowed, and within deadlines. Retry safety is strictly prioritized over retry success.**

---

## 2. Core Architectural Distinction

```text
RETRY (Step 38)
  → Repeat the same provider and model candidate

FAILOVER (Step 37)
  → Advance to a different eligible provider/model from Step 30 fallback candidates

REROUTE (Step 30)
  → Run SLM routing analysis and policy to generate a new routing plan
```

### Precedence Model
```text
Logical Request
       ↓
Primary Provider Attempt
       ↓
Error Classification (Step 36)
       ↓
Cancellation Check (Step 35)
       ↓
Retry Safety & Policy Evaluation (Step 38)
       ├── Permitted & Safe → Bounded Backoff / Retry-After → Same Candidate Attempt
       │                                                             │
       │                                                             ├── Succeeded → End
       │                                                             └── Failed → Re-evaluate Retry
       └── Denied / Exhausted / Unsafe
              ↓
       Failover Policy & Candidate Validation (Step 37)
              ├── Eligible Fallback → Attempt Fallback Candidate
              └── No Fallback / Exhausted → Final Canonical Failure Envelope
```

---

## 3. Retry Safety Classification

To prevent accidental duplicate billing or ghost executions, Step 38 introduces a formal `RetrySafety` model:

| Safety Category | Definition | Default Action |
|---|---|---|
| `DefinitelySafe` | Request was rejected locally or failed before any bytes reached upstream provider (e.g. transport setup, DNS failure). | Retry permitted with bounded backoff. |
| `ConditionallySafe` | Provider adapter guarantees verified idempotency mechanisms or duplicate request deduplication. | Retry permitted under strict idempotency key contract. |
| `Ambiguous` | Request was transmitted over the wire, but local outcome is unknown (e.g. timeout after send, TCP reset after transmission). | **No same-model retry.** Defer to Step 37 failover or final error. |
| `Unsafe` | Provider response tokens have already been emitted (`tokens_emitted > 0`). Repeating the request would duplicate billing and output. | **No same-model retry.** Defer to Step 37 failover with tokens discarded. |
| `NotApplicable` | User cancellation, malformed request syntax, or permanent authentication/authorization rejection. | **No retry.** |

---

## 4. Request Transmission State Tracking

To compute safety deterministically, each physical attempt tracks `RequestTransmissionState`:

- `NotSent`: Request queued locally; zero network I/O begun.
- `Sending`: Request body currently streaming over socket.
- `SentUnknownOutcome`: Request transmitted; response headers/status pending.
- `ResponsePending`: Upstream connection acknowledged; awaiting first byte.
- `ResponseStarted`: First byte/stream delta received (`tokens_emitted > 0`).
- `ResponseCompleted`: Terminal provider response received.
- `LocallyCancelledBeforeSend`: Cancelled by user before network I/O.
- `LocallyCancelledAfterSend`: Cancelled by user after request transmission.
- `FailedBeforeSend`: Network/DNS failure occurred before data transmission.
- `FailedAfterSend`: Network interruption occurred after data transmission.

---

## 5. Centralized Error Policy Matrix

| Canonical Error (Step 36) | Same-Candidate Retry? | Delay Strategy | Failover Eligible? |
|---|---|---|---|
| `AuthenticationFailed` (401) | **No** (wastes requests) | None | Yes (Step 37) |
| `AuthorizationFailed` (403) | **No** | None | Yes (Step 37) |
| `InvalidRequest` (400) | **No** (identical syntax will fail) | None | No |
| `ContextLimitExceeded` | **No** (prompt too large for model) | None | Yes (larger model) |
| `UnsupportedCapability` | **No** | None | Yes (capable model) |
| `ModelUnavailable` | **No** | None | Yes (Step 37) |
| `RateLimited` (429) | **Yes** (if `Retry-After` <= cap & deadline) | Parsed `Retry-After` or Jittered Backoff | Yes (on exhaustion) |
| `ProviderUnavailable` (502/503) | **Yes** (bounded) | Jittered Exponential Backoff | Yes (on exhaustion) |
| `Timeout` (pre-send) | **Yes** | Backoff | Yes |
| `Timeout` (post-send) | **No** (Ambiguous outcome) | None | Yes (Step 37) |
| `StreamInterrupted` (no tokens) | **Yes** (if pre-output) | Backoff | Yes |
| `StreamInterrupted` (tokens emitted) | **No** (Unsafe) | None | Yes (Step 37) |
| `Cancelled` | **No** | None | No |
| `DatabaseFailure` / `PersistenceFailure` | **No** (never replay provider for DB bug) | None | No |

---

## 6. Timeout Policy & Logical Request Deadlines

To prevent unbounded recovery loops, Step 38 enforces a two-tier timeout architecture:

1. **Logical Request Deadline (`DEFAULT_LOGICAL_DEADLINE_MS = 60_000ms`):**
   - Covers the entire lifecycle of the user prompt across primary attempt, retries, backoff delays, and fallback candidates.
   - Any proposed retry delay must satisfy:
     $$\text{remaining\_deadline} \ge \text{delay\_ms} + \text{min\_execution\_window\_ms}$$
   - If remaining time is insufficient, same-candidate retry is bypassed and execution defers directly to Step 37 failover or terminates.

2. **Per-Attempt Physical Timeout (`DEFAULT_REQUEST_TIMEOUT_MS = 30_000ms`):**
   - Enforces a strict deadline on the active socket/HTTP transaction, clamped by remaining logical deadline.

3. **Stream Idle Inactivity Timeout (`DEFAULT_STREAM_IDLE_TIMEOUT_MS = 20_000ms`):**
   - Monitored between delta chunks. If no token or keepalive arrives for 20 seconds, stream is cancelled and classified as `Timeout`.

---

## 7. Rate-Limit Handling & Bounded Jittered Backoff

- **`Retry-After` Parsing:** Supports delta-seconds (integer and float) and safely clamps to `DEFAULT_MAX_RETRY_DELAY_MS` (15,000ms).
- **Exponential Backoff Formula:**
  $$\text{delay} = \min(\text{base\_delay} \times \text{multiplier}^{\text{attempt}}, \text{max\_delay})$$
  $$\text{jittered\_delay} = \text{delay} \pm (\text{delay} \times \text{jitter\_ratio} \times 0.5)$$
- **Non-blocking Cancellation:** Delay waits are wrapped in `tokio::select!` against Step 35 `CancellationToken`. When the user clicks "Stop", the timer drops immediately without blocking threads or dispatching delayed requests.

---

## 8. Preserved Invariants

1. **No Duplicate Assistant Persistence:** Exactly **one** assistant message is persisted in SQLite upon successful completion, recording `retry_count`, `total_attempts`, and failover provenance.
2. **Zero Plaintext Secret Exposure:** API credentials stored in DPAPI are never serialized into retry events, timers, or telemetry records.
3. **Logo Binary Integrity:** `Nano Route Neon Tech Logo.png` remains locked at exactly **670,255 bytes**.
4. **Step 39 Boundary:** Step 38 contains zero monthly budget controls, billing alerts, or quota trackers.

