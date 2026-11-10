# NANO ROUTE — PROVIDER HEALTH, RUNTIME AVAILABILITY & CAPABILITY INTELLIGENCE
## Architectural Specification & Integration Reference

**Document Version:** 1.0.0  
**Phase:** 5 (Provider Layer)  
**Step:** 25 of 90  
**Status:** Implemented & Verified  
**Stack:** Rust Core + Tauri v2 + TypeScript/React + SQLite + Windows DPAPI  

---

## 1. Executive Summary & Design Philosophy

Step 25 introduces Nano Route's centralized **Provider Health & Capability Intelligence Layer**.

### The Core Boundary Invariant
Health and capability intelligence are **observability and preflight concepts**, not routing or failover logic.
- **Health answers:** *"What is the current observed operational state of this provider and model?"*
- **Capability answers:** *"Does this provider/model have the verified features to execute this exact request?"*
- **Preflight answers:** *"Is this request locally allowed to be dispatched over the wire, or is there a hard local blocker?"*

Step 25 strictly stops before making routing or reliability decisions:
- **NO** automatic provider selection or ranking.
- **NO** quality scores or health percentages (e.g. `health_score = 92`).
- **NO** automatic retries or exponential backoff (deferred to Step 38).
- **NO** automatic failover or circuit breakers (deferred to Step 37).
- **NO** hidden startup network calls (health starts as `Unknown`).
- **NO** continuous background polling/pinging loops.

```text
                     Provider Registry (Step 21)
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
      Capability Service (Step 25)         Provider Adapters (Steps 22-24)
                 │                                 │
                 │                                 ▼
                 │                         Actual Provider Calls
                 │                                 │
                 │                                 ▼
                 │                          Generic Outcomes
                 │                                 │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
                     Health Manager (Step 25)
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
        Current Runtime State              Safe Snapshots
                 │                                 │
                 ▼                                 ▼
         Preflight Validation              Future UI / Router (Steps 27-40)
```

---

## 2. Source-of-Truth Hierarchy

1. **Step 21 Provider Registry:** Authoritative static metadata, model catalog, and declared feature bounds.
2. **Step 25 Capability Service:** Evaluates effective capabilities by intersecting Registry facts, Adapter implementation capabilities, and Model constraints.
3. **Step 25 Health Manager:** Observes real request outcomes, manages scoped provider/model operational states, normalizes rate limits, and calculates freshness.
4. **Step 25 Preflight Evaluator:** Determines if a proposed request is locally permitted before initiating network I/O.

---

## 3. The 5 Core Architectural Distinctions

To prevent conflation, Nano Route strictly isolates these five concepts:

| Concept | Definition | Example |
|---|---|---|
| **1. Provider Identity** | Unique canonical identifier string | `openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `mistral` |
| **2. Provider Capability** | High-level capabilities advertised by registry | `text_generation`, `streaming`, `tool_calling` |
| **3. Model Capability** | Specific model capabilities and context ceilings | `gpt-4o` (128k context), `claude-3-5-sonnet` (200k context) |
| **4. Configuration Readiness** | Local configuration, DPAPI credential, and enabled flag | `is_configured = true`, `is_active = true`, `base_url_valid = true` |
| **5. Runtime Health** | Observed operational health at a point in time | `ready`, `degraded`, `rate_limited`, `authentication_failed`, `unknown` |

---

## 4. Runtime Health State Machine

### 4.1 State Definitions

```rust
pub enum RuntimeHealthState {
    Unknown,
    Ready,
    Degraded,
    RateLimited,
    AuthenticationFailed,
    AuthorizationFailed,
    ProviderUnavailable,
    EndpointMisconfigured,
    CredentialMissing,
    ProviderDisabled,
    ModelUnavailable,
    RequestRejected,
    ReadyPendingVerification,
    Stale,
}
```

- **`Unknown`:** Initial state at application launch. No request has occurred yet. Unknown is **NOT** a failure and does **NOT** block execution.
- **`Ready`:** Recent request or explicit probe completed successfully.
- **`Degraded`:** Elevated operational problems (timeouts, transient network drops, intermittent 5xx). Provider remains potentially usable.
- **`RateLimited`:** Received HTTP 429. Includes safe `retry_after_at_ms` cooldown timestamp.
- **`ReadyPendingVerification`:** Cooldown timer expired; awaiting positive verification from next real request.
- **`AuthenticationFailed`:** Remote rejected API key (HTTP 401/403). Hard blocker.
- **`AuthorizationFailed`:** Remote rejected permissions for a specific organization/tier.
- **`ProviderUnavailable`:** Remote service outage or unreachable endpoint (HTTP 502/503/504).
- **`EndpointMisconfigured`:** Local base URL or configuration is malformed.
- **`CredentialMissing`:** No API key configured for a cloud provider.
- **`ProviderDisabled`:** User explicitly toggled provider off in preferences.
- **`ModelUnavailable`:** Specific model 404/retired. Provider remains operational!
- **`RequestRejected`:** HTTP 400 Bad Request or context exceeded. Request was invalid, but provider health is **unaffected**.
- **`Stale`:** Observation is older than freshness TTL (default 30 minutes).

### 4.2 Scope Separation: Provider Health vs. Model Health

Model failures do **NOT** automatically propagate to provider-wide failure:
```text
Model A returns 404 (Retired) ──► Model A State = ModelUnavailable
                                 Provider State = Ready (Untouched)
                                 Model B State = Ready (Untouched)
```

### 4.3 Request Invalidation Invariant

A client-side invalid request (e.g., malformed temperature, context size exceeded) marks the outcome as `RequestRejected`, but provider health remains operational.

### 4.4 User Cancellation Invariant

User stream cancellations (`ProviderErrorKind::Cancelled`) are classified as `CancelledByUser` and **NEVER** degrade provider health.

---

## 5. Effective Capability Evaluation

Nano Route prevents false capability claims by enforcing capability intersection:

$$\text{Effective Capability} = \text{Registry Capability} \cap \text{Adapter Capability} \cap \text{Model Capability}$$

### Adapter Capabilities Baseline (Steps 22–24)
While remote provider documentation advertises vision, tools, and audio, Nano Route's native provider adapters currently implement:
- `TextGeneration` = true
- `Streaming` = true
- `SystemMessages` = true

Any request demanding unimplemented features (such as `ToolCalling` or `Vision`) is rejected locally during preflight without wasting network bandwidth or API tokens.

---

## 6. Preflight Request Evaluation Pipeline

Before any request hits the network, `PreflightEvaluator::evaluate()` executes this strict 9-stage sequence:

```text
1. Provider Exists in Registry?      ──► No  ──► Blocked(ProviderNotFound)
2. Adapter Implemented?             ──► No  ──► Blocked(AdapterNotImplemented)
3. Provider Enabled in Settings?    ──► No  ──► Blocked(ProviderDisabled)
4. Credential Configured in DPAPI?   ──► No  ──► Blocked(CredentialMissing)
5. Endpoint Base URL Valid?          ──► No  ──► Blocked(EndpointMisconfigured)
6. Model Exists in Registry?        ──► No  ──► Blocked(ModelNotFound)
7. Model Active & Available?        ──► No  ──► Blocked(ModelRetiredOrUnavailable)
8. Effective Capabilities Match?    ──► No  ──► Blocked(CapabilityUnsupported)
9. Definite Runtime Blocker Check:
   - AuthenticationFailed           ──► Yes ──► Blocked(AuthenticationFailed)
   - RateLimited (Cooldown active)  ──► Yes ──► Blocked(RateLimited)
   - ProviderUnavailable            ──► Yes ──► Blocked(ProviderUnavailable)
   - ModelUnavailable               ──► Yes ──► Blocked(ModelRuntimeUnavailable)
   - Unknown / Degraded / Ready     ──► No  ──► ALLOWED
```

**Architectural Law:** Preflight returns `Allowed` or `Blocked(reason)`. It **NEVER** outputs `Use Provider X`.

---

## 7. Passive vs. Explicit Health Checks

### Passive Observations
Normal requests update the Health Manager automatically via `record_request_result()`. This provides zero-overhead, real-time telemetry without extra network traffic.

### Explicit Health Checks
- **Opt-In Only:** Triggered exclusively on demand (e.g., user clicks "Test Connection").
- **Zero Startup Network Traffic:** The application boots completely offline without pinging any remote endpoints.
- **Privacy Guarantee:** Explicit checks never send conversational transcripts or user prompts.

---

## 8. Thread-Safety, Freshness & Out-of-Order Safety

- **Thread-Safety:** Protected by `RwLock<HashMap<ProviderId, InternalProviderHealth>>` and atomic sequence numbering (`AtomicU64`).
- **Out-of-Order Protection:** If an older delayed failure observation arrives after a newer success has already completed, the newer success remains authoritative.
- **Rate-Limit Expiration:** Once a rate-limit cooldown expires, state transitions to `ReadyPendingVerification` rather than falsely claiming verified health without a real request.
- **Staleness TTL:** When `now - last_observed_at_ms > 30 minutes`, reads report `Stale`.

---

## 9. Security & Privacy Guarantees

1. **Zero Secret Persistence:** API keys, encrypted DPAPI ciphertext, and authorization headers never enter health observations, snapshots, or IPC DTOs.
2. **Zero Content Persistence:** User prompts, completion text, and chat session IDs are never attached to health observations.
3. **Regex Scrubbing:** Error messages and diagnostics are scrubbed of provider key patterns (`AIza...`, `gsk_...`, `sk-ant-...`, `sk-...`, Bearer tokens).

