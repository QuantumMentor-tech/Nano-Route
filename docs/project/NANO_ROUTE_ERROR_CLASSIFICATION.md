# NANO ROUTE — STEP 36: ERROR CLASSIFICATION & NORMALIZED FAILURE HANDLING

## Overview & Architectural Scope

Step 36 establishes the authoritative error taxonomy, failure classification, and normalized failure delivery layer for the Nano Route desktop AI orchestration platform.

### Strict Scope Boundary
> **Rule: Step 36 classifies errors. It does NOT decide what to do about them.**
- **No Automatic Retries:** Step 36 does not execute retry loops, backoff timers, or retry counts (reserved for Step 38).
- **No Automatic Failover:** Step 36 does not switch providers, reroute, or execute fallback models (reserved for Step 37).
- **No Quota Enforcement:** Step 36 does not modify budget or token limits (reserved for Step 39).
- **No Mutation of History:** Historical messages and past telemetry records remain immutable.

---

## Canonical Error Taxonomy

Errors across all layers (native Rust core, Tokio async runtime, network transport, provider APIs, SQLite persistence, and React frontend) are classified into provider-neutral, semantic categories defined in `src-tauri/src/errors/taxonomy.rs` and mirrored in `src/services/ipc/types.ts`:

### 1. Cooperative Cancellation (Highest Precedence)
- `cancelled` (`CANCELLED`) — Severity: `Info`, Retryability: `NotApplicable`, Failover: `NotApplicable`.

### 2. Configuration & Credentials
- `credential_missing` (`CREDENTIAL_MISSING`) — UserAction: `ConfigureProvider`
- `credential_invalid_configuration` (`CREDENTIAL_INVALID_CONFIGURATION`) — UserAction: `UpdateCredential`
- `provider_disabled` (`PROVIDER_DISABLED`)
- `endpoint_misconfigured` (`ENDPOINT_MISCONFIGURED`)
- `model_configuration_invalid` (`MODEL_CONFIGURATION_INVALID`)
- `unsupported_provider_configuration` (`UNSUPPORTED_PROVIDER_CONFIGURATION`)

### 3. Security, Authentication & Authorization
- `authentication_failed` (`AUTHENTICATION_FAILED`) — Severity: `Error`, UserAction: `UpdateCredential`
- `authorization_failed` (`AUTHORIZATION_FAILED`) — Severity: `Error`, UserAction: `CheckProviderAccess`

### 4. Rate Limiting & Velocity
- `rate_limited` (`RATE_LIMITED`) — Severity: `Warning`, Retryability: `LikelyTransient`, Failover: `PotentiallyEligible`, UserAction: `WaitAndRetryLater`

### 5. Context & Token Limits
- `context_limit_exceeded` (`CONTEXT_LIMIT_EXCEEDED`) — Severity: `Error`, UserAction: `ReduceInput`, Failover: `UsuallyNotEligible`
- `input_too_large` (`INPUT_TOO_LARGE`) — UserAction: `ReduceInput`
- `output_limit_exceeded` (`OUTPUT_LIMIT_EXCEEDED`)

### 6. Request Validity & Capabilities
- `invalid_request` (`INVALID_REQUEST`)
- `unsupported_capability` (`UNSUPPORTED_CAPABILITY`) — UserAction: `ChangeUnsupportedOption`

### 7. Provider & Model Availability
- `model_unavailable` (`MODEL_UNAVAILABLE`) — Retryability: `LikelyPermanent`, Failover: `PotentiallyEligible`
- `provider_unavailable` (`PROVIDER_UNAVAILABLE`) — Retryability: `LikelyTransient`, Failover: `PotentiallyEligible`, UserAction: `ContactProvider`

### 8. Network & Transport
- `network_unreachable` (`NETWORK_UNREACHABLE`) — UserAction: `CheckNetwork`
- `dns_resolution_failed` (`DNS_RESOLUTION_FAILED`) — UserAction: `CheckNetwork`
- `connection_failed` (`CONNECTION_FAILED`)
- `tls_failed` (`TLS_FAILED`)
- `connection_reset` (`CONNECTION_RESET`)
- `transport_closed` (`TRANSPORT_CLOSED`)
- `network_unknown` (`NETWORK_UNKNOWN`)
- `timeout` (`TIMEOUT`) — Severity: `Warning`, Retryability: `LikelyTransient`, Failover: `PotentiallyEligible`, UserAction: `WaitAndRetryLater`

### 9. Stream Lifecycle
- `stream_interrupted` (`STREAM_INTERRUPTED`) — Severity: `Warning`, Retryability: `LikelyTransient`

### 10. Provider Response & Parsing
- `malformed_provider_response` (`MALFORMED_PROVIDER_RESPONSE`)
- `provider_response_parse_failed` (`PROVIDER_RESPONSE_PARSE_FAILED`)
- `unexpected_provider_response` (`UNEXPECTED_PROVIDER_RESPONSE`)

### 11. Local SLM & ONNX Runtime
- `local_model_unavailable` (`LOCAL_MODEL_UNAVAILABLE`)
- `local_model_load_failed` (`LOCAL_MODEL_LOAD_FAILED`) — Severity: `Critical`
- `local_inference_failed` (`LOCAL_INFERENCE_FAILED`) — Severity: `Critical`
- `local_model_input_invalid` (`LOCAL_MODEL_INPUT_INVALID`)
- `local_model_output_invalid` (`LOCAL_MODEL_OUTPUT_INVALID`)
- `local_model_runtime_unavailable` (`LOCAL_MODEL_RUNTIME_UNAVAILABLE`) — Severity: `Critical`

### 12. Routing System
- `intent_classification_failed` (`INTENT_CLASSIFICATION_FAILED`)
- `task_analysis_failed` (`TASK_ANALYSIS_FAILED`)
- `routing_scoring_failed` (`ROUTING_SCORING_FAILED`)
- `routing_policy_failed` (`ROUTING_POLICY_FAILED`)
- `no_eligible_route` (`NO_ELIGIBLE_ROUTE`)

### 13. Persistence & Storage
- `database_failure` (`DATABASE_FAILURE`) — Severity: `Error`, Retryability: `LikelyPermanent`, Failover: `UsuallyNotEligible`
- `persistence_failure` (`PERSISTENCE_FAILURE`)
- `chat_history_write_failed` (`CHAT_HISTORY_WRITE_FAILED`)
- `telemetry_write_failed` (`TELEMETRY_WRITE_FAILED`)

### 14. Application & Fallback
- `internal_error` (`INTERNAL_ERROR`)
- `unknown` (`UNKNOWN_ERROR`) — Provenance: `FallbackUnknown`

---

## Normalized Error Envelope (`ErrorEnvelope`)

All errors converted across IPC or streamed to the client follow a versioned DTO:

```typescript
export interface ErrorEnvelope {
  errorId: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage: string;
  executionId?: string;
  correlationId?: string;
  providerId?: string;
  modelId?: string;
  providerRequestId?: string;
  providerErrorCode?: string;
  httpStatus?: number;
  retryAfterMs?: number;
  isTerminal: boolean;
  retryabilityHint: RetryabilityHint;
  failoverHint: FailoverHint;
  userAction: UserAction;
  provenance: ClassificationProvenance;
  schemaVersion: number;
  occurredAtMs: number;
}
```

---

## Security & Sanitization Guarantees

The sanitizer (`src-tauri/src/errors/sanitizer.rs` and frontend mock sanitizer in `src/services/ipc/chat.ts`) scrubs sensitive credentials and user environment paths before messages are saved to telemetry, emitted to channels, or shown in the UI:

1. **OpenAI Keys:** `sk-[A-Za-z0-9_-]{16,}` -> `[REDACTED_API_KEY]`
2. **Google Gemini Keys:** `AIzaSy[A-Za-z0-9_-]{16,}` -> `[REDACTED_API_KEY]`
3. **Groq Keys:** `gsk_[A-Za-z0-9_-]{16,}` -> `[REDACTED_API_KEY]`
4. **GitHub / Anthropic Keys:** `ghp_[A-Za-z0-9_-]{16,}` / `x-api-key` -> `[REDACTED_API_KEY]`
5. **Bearer Tokens:** `Bearer [token]` -> `Bearer [REDACTED]`
6. **Windows User Paths:** `C:\Users\<username>\...` -> `C:\Users\[REDACTED]\...`
7. **Unix User Paths:** `/home/<username>/...` -> `/home/[REDACTED]/...`
8. **Length Bounding:** Maximum string length capped at 4,096 characters to prevent log flooding.

---

## Critical Precedence Rules

1. **Cancellation Precedence:** When a user or system cancels an execution, cancellation is prioritized above network reset/abort signals. The error category is strictly `cancelled` with `Info` severity and `none` for user action.
2. **Persistence Failure Isolation:** If a provider stream or response finishes successfully but local SQLite database writes fail, the error is classified strictly as `database_failure` or `chat_history_write_failed`. It is marked `usually_not_eligible` for failover to ensure the cloud LLM is never accidentally re-executed for a purely local disk issue.
3. **Preservation of Unknown Errors:** Unrecognized status codes and messages default to `unknown` with `fallback_unknown` provenance rather than guessing an inaccurate category.

---

## UI Presentation in Chat Studio

- **AssistantMessage:** Renders an accessible `failed-badge` indicating the normalized failure category. Inside the message card, renders a structured error card with sanitized `userMessage`, highlighted `userAction` suggestion, `retryabilityHint`, and an expandable "Show diagnostics" accordion with technical metadata (error code, provider, status, execution ID, sanitized technical message).
- **ChatErrorState:** Actionable banner displays the error category pill, message, suggested user action, and dismiss/retry handlers.

