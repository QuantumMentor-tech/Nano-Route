# Nano Route — OpenAI Provider Integration Architecture

**Document Version:** 1.0.0  
**Roadmap Step:** Step 22 of 90 (Phase 5: Provider Layer)  
**Status:** Implemented  
**Target Platform:** Windows Desktop (Tauri v2 + Rust + React/TypeScript + SQLite)  

---

## 1. Executive Summary & Role

The **OpenAI Provider Adapter** connects Nano Route's provider-neutral inference abstractions to OpenAI's frontier model infrastructure.

In accordance with Phase 5 architecture, the OpenAI adapter:
- Implements the unified `ProviderClient` Rust trait.
- Exclusively targets the modern **OpenAI Responses API (`/v1/responses`)**, strictly avoiding legacy Assistants, Threads, or Runs APIs.
- Supports both synchronous non-streaming execution and incremental Server-Sent Events (SSE) streaming.
- Preserves absolute DPAPI credential isolation: plaintext API keys are managed exclusively in volatile, zeroized Rust memory (`SecretString`) and never touch React, TypeScript, SQLite, logs, or telemetry.
- Integrates with cooperative cancellation tokens (`TaskContext`) to abort network and streaming operations cleanly.
- Implements a pluggable `OpenAiTransport` layer allowing 100% offline, deterministic unit and integration testing without external network egress.

---

## 2. API Contract: OpenAI Responses API (`/v1/responses`)

Unlike legacy chat completions (`/v1/chat/completions`) or the multi-entity Assistants API, the OpenAI Responses API provides a direct, low-latency, stateless request/response lifecycle optimized for modern reasoning models (`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`).

```text
ProviderRequest (Canonical Nano Route)
       │
       ▼
OpenAiResponsesRequest
  ├── model: "gpt-4o"
  ├── input: [
  │     { role: "developer", content: "..." },
  │     { role: "user",      content: "..." }
  │   ]
  ├── stream: bool
  ├── temperature: f32 (0.0..2.0)
  ├── max_output_tokens: u32
  └── top_p: f32
       │
       ▼
HTTP POST /v1/responses (Transport Layer)
       │
       ├─────────────────────────────────┐
       │ (stream = false)                │ (stream = true)
       ▼                                 ▼
OpenAiResponsesResponse           OpenAiSseParser
  ├── output: [Message Parts]       ├── Event framing (\n\n)
  ├── usage: [Input/Output/Reason]  ├── Delta extraction
  └── status: "completed"           └── Completion: [DONE]
       │                                 │
       ▼                                 ▼
ProviderResponse                  ProviderStreamChunk
```

### 2.1 Role Mapping
- `MessageRole::System` maps to `"developer"` (standardized instruction role for Responses API).
- `MessageRole::User` maps to `"user"`.
- `MessageRole::Assistant` maps to `"assistant"`.
- `MessageRole::Tool` maps to `"tool"`.

### 2.2 Parameter Normalization
- `GenerationParams::max_tokens` maps directly to `max_output_tokens`.
- `GenerationParams::temperature` is mapped if specified (bounded to 0.0..2.0).
- `GenerationParams::top_p` is mapped if specified (bounded to 0.0..1.0).

---

## 3. Streaming Response Engine & SSE Architecture

The streaming subsystem (`OpenAiSseParser`) provides resilient framing over raw chunk buffers:

1. **Buffer Assembly:** Handles arbitrary network chunk boundaries (events split across packets, multiple events in one packet, CRLF vs LF delimiters).
2. **Event Parsing:**
   - `response.output_text.delta`: extracts raw generated text deltas.
   - `response.reasoning_text.delta`: extracts reasoning deltas for `o1` and `o3-mini` models.
   - `response.completed`: extracts final token usage (`input_tokens`, `output_tokens`, `reasoning_tokens`) and termination status.
   - `data: [DONE]`: signals stream termination.
   - Fallback support for standard chat completion streaming envelopes (`choices[0].delta.content`).
3. **Lossless Whitespace Guarantee:** Emits exact UTF-8 character strings preserving indentation, linebreaks, and code blocks without trimming or mutation.
4. **Cooperative Cancellation:** Inspects `context.is_cancelled()` on every chunk iteration. If cancellation is signaled, halts immediately and emits `ProviderError::cancelled`.

---

## 4. Credential Security & DPAPI Vault Invariants

Credential security follows Nano Route's zero-trust desktop security model:

1. **Storage:** Encrypted at rest in SQLite via Windows Data Protection API (`CryptProtectData`).
2. **Access:** Retrieved on-demand through `CredentialVaultService::get_decrypted_credential("openai")`.
3. **Lifecycle:** Wrapped in `SecretString` with volatile zeroization on drop (`std::ptr::write_volatile`).
4. **Redaction:** `SecretString::fmt` is explicitly masked (`SecretString([REDACTED])`). Error sanitization (`scrub_openai_secrets`) strips `sk-...` API key signatures from all error messages and diagnostic logs before IPC delivery.

---

## 5. Error Classification & Mapping

Upstream HTTP responses and error envelopes (`{"error": {...}}`) are translated into canonical `ProviderError` variants:

| HTTP Status | Upstream Condition / Code | Normalized Kind | Retryable |
|---|---|---|---|
| `401` / `403` | Invalid key, missing auth, forbidden | `AuthenticationFailed` | No |
| `429` | `code: "insufficient_quota"` | `QuotaExceeded` | No |
| `429` | Standard rate limit | `RateLimited` | Yes (reads `Retry-After`) |
| `404` | `model_not_found` | `ModelNotFound` | No |
| `400` | `context_length_exceeded` | `ContextLengthExceeded` | No |
| `400` | Schema or parameter failure | `InvalidRequest` | No |
| `500`, `502`, `503` | Upstream outage / server error | `ProviderUnavailable` | Yes |
| `504` | Gateway timeout | `Timeout` | Yes |

---

## 6. Deterministic Testing & Offline Verification

The `OpenAiTransport` trait decouples the client adapter from physical network sockets:
- In production, `DefaultOpenAiTransport` handles HTTP transport.
- In unit and integration test suites, `MockOpenAiTransport` records sent requests, asserts headers and JSON payloads, and returns pre-configured responses or SSE streams without opening network sockets or requiring live OpenAI accounts.

---

## 7. Current Scope vs Roadmap Sequence

- **Step 21:** Provider & Model Registry Foundation *(Completed)*
- **Step 22:** OpenAI Provider Integration *(Completed in this step)*
- **Step 23:** Anthropic Provider Integration *(Upcoming)*
- **Step 24:** Gemini, DeepSeek, Groq, Mistral Integrations *(Upcoming)*

