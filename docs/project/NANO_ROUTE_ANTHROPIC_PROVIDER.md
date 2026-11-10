# Nano Route — Anthropic Provider Integration Architecture

**Document Version:** 1.0.0  
**Roadmap Step:** Step 23 of 90 (Phase 5: Provider Layer)  
**Status:** Implemented  
**Target Platform:** Windows Desktop (Tauri v2 + Rust + React/TypeScript + SQLite)  

---

## 1. Executive Summary & Role

The **Anthropic Provider Adapter** connects Nano Route's provider-neutral inference core to Anthropic's frontier Claude family of models.

In accordance with Phase 5 architecture, the Anthropic adapter:
- Implements the unified `ProviderClient` Rust trait.
- Exclusively targets the current **Anthropic Messages API (`POST /v1/messages`)**.
- Uses native authentication via `x-api-key` and centralized versioning via `anthropic-version: 2023-06-01`.
- Extracts system instructions into Anthropic's top-level `system` parameter while preserving conversational turns in `messages`.
- Supports both synchronous non-streaming execution and incremental Server-Sent Events (SSE) streaming.
- Preserves absolute DPAPI credential isolation: plaintext API keys are managed exclusively in volatile, zeroized Rust memory (`SecretString`) and never touch React, TypeScript, SQLite, logs, or telemetry.
- Integrates with cooperative cancellation tokens (`TaskContext`) to abort network and streaming operations cleanly.
- Implements a pluggable `AnthropicTransport` layer allowing 100% offline, deterministic unit and integration testing without external network egress.

---

## 2. API Contract: Anthropic Messages API (`/v1/messages`)

The Messages API represents Anthropic's authoritative stateless conversational endpoint.

```text
ProviderRequest (Canonical Nano Route)
       │
       ▼
AnthropicMessagesRequest
  ├── model: "claude-3-5-sonnet-20241022"
  ├── max_tokens: u32 (default 4096)
  ├── system: "Top-level instructions..." (extracted from MessageRole::System)
  ├── messages: [
  │     { role: "user",      content: "..." },
  │     { role: "assistant", content: "..." }
  │   ]
  ├── stream: bool
  ├── temperature: Option<f32> (0.0..1.0)
  └── top_p: Option<f32> (0.0..1.0)
       │
       ▼
HTTP POST /v1/messages (Transport Layer)
  ├── Headers:
  │     Content-Type: application/json
  │     x-api-key: <SecretString>
  │     anthropic-version: 2023-06-01
       │
       ├─────────────────────────────────┐
       │ (stream = false)                │ (stream = true)
       ▼                                 ▼
AnthropicMessagesResponse         AnthropicSseParser
  ├── content: [Text Blocks]        ├── Event framing (\n\n)
  ├── usage: [Input/Output/Cache]   ├── Delta extraction: content_block_delta
  └── stop_reason: "end_turn"       └── Completion: message_stop
       │                                 │
       ▼                                 ▼
ProviderResponse                  ProviderStreamChunk
```

### 2.1 System Instruction Mapping
Anthropic requires system instructions to reside in the top-level `system` field rather than within the `messages` turn array:
- All `ChatMessage` instances with `role: MessageRole::System` are concatenated with double newlines and placed into `AnthropicMessagesRequest.system`.
- Only `user` and `assistant` conversational messages are serialized into the `messages` array.

### 2.2 Output Token Limits
- `max_tokens` is mandatory in the Anthropic Messages API.
- If `req.params.max_tokens` is unspecified, the adapter safely defaults to `4096` tokens.

---

## 3. Streaming Response Engine & SSE Architecture

The streaming subsystem (`AnthropicSseParser`) provides resilient framing over raw chunk buffers:

1. **Buffer Assembly:** Buffers incoming bytes and splits on double newlines (`\n\n` or `\r\n\r\n`), tolerating events split across arbitrary network reads.
2. **Event Parsing:**
   - `message_start`: captures initial message metadata and `usage.input_tokens`.
   - `content_block_start`: initializes text block tracking.
   - `content_block_delta`: extracts incremental textual deltas (`delta.text`).
   - `content_block_stop`: closes content block.
   - `message_delta`: captures final `delta.stop_reason` and `usage.output_tokens`.
   - `message_stop`: emits final terminal chunk with accumulated usage and finish reason.
   - `ping`: ignored safely.
   - `error`: maps provider-side streaming errors into `ProviderError`.
3. **Lossless Whitespace Guarantee:** Emits exact UTF-8 character strings preserving indentation, code formatting, and linebreaks without mutation.
4. **Cooperative Cancellation:** Inspects `context.is_cancelled()` on every chunk iteration. If cancellation is signaled, halts immediately and emits `ProviderError::cancelled`.

---

## 4. Credential Security & DPAPI Vault Invariants

Credential security follows Nano Route's zero-trust desktop security model:

1. **Storage:** Encrypted at rest in SQLite via Windows Data Protection API (`CryptProtectData`).
2. **Access:** Retrieved on-demand through `CredentialVaultService::get_decrypted_credential("anthropic")`.
3. **Lifecycle:** Wrapped in `SecretString` with volatile zeroization on drop (`std::ptr::write_volatile`).
4. **Header Construction:** `x-api-key` is formatted directly from transient memory in native Rust.
5. **Redaction:** `SecretString::fmt` is masked (`SecretString([REDACTED])`). Error sanitization (`scrub_anthropic_secrets`) strips `sk-ant-...` key signatures from all error messages and diagnostic logs before IPC delivery.

---

## 5. Error Classification & Mapping

Upstream HTTP responses and error envelopes (`{"type": "error", "error": {...}}`) are translated into canonical `ProviderError` variants:

| HTTP Status | Upstream Type / Condition | Normalized Kind | Retryable |
|---|---|---|---|
| `400` | `invalid_request_error` | `InvalidRequest` | No |
| `401` / `403` | `authentication_error` / `permission_error` | `AuthenticationFailed` | No |
| `404` | `not_found_error` | `ModelNotFound` | No |
| `413` | `request_too_large` | `ContextLengthExceeded` | No |
| `429` | `rate_limit_error` | `RateLimited` | Yes (reads `Retry-After`) |
| `529` | `overloaded_error` | `ProviderUnavailable` | Yes (reads `Retry-After`) |
| `500`, `502`, `503` | `api_error` | `ProviderUnavailable` | Yes |
| `504` | `timeout_error` | `Timeout` | Yes |

---

## 6. Current Scope vs Roadmap Sequence

### 6.1 Implemented in Step 23
- Anthropic provider adapter implementing `ProviderClient`.
- Messages API request and response serialization.
- Top-level `system` prompt extraction.
- Non-streaming text generation.
- Incremental streaming text generation via SSE.
- Usage tracking (`input_tokens`, `output_tokens`, cache metrics).
- Normalized error classification and secret scrubbing.
- Pluggable mock transport for 100% offline testing.
- TaskContext cancellation integration.

### 6.2 Deferred to Future Steps
- Anthropic tool use, MCP, computer use, and web search.
- Multimodal image/vision inputs.
- Provider health monitoring and periodic pings (Step 25).
- Automatic retry and rate-limit backoff (Step 38).
- Multi-provider routing scoring and local SLM inference (Steps 26–30).
- Automatic failover and fallback execution (Step 37).
- Remaining provider adapters: Gemini, DeepSeek, Groq, Mistral (Step 24).

