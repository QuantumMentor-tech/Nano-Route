# NANO ROUTE — ADDITIONAL CLOUD PROVIDER INTEGRATIONS
## Google Gemini, DeepSeek, Groq & Mistral Architecture Specification

**Document Version:** 1.0.0  
**Phase:** 5 (Provider Layer)  
**Step:** 24 of 90  
**Status:** Implemented & Verified  
**Stack:** Rust Core + Tauri v2 + TypeScript/React + Windows DPAPI Storage  

---

## 1. Overview & Architecture Rationale

Step 24 completes the multi-cloud provider layer for Nano Route by implementing four additional cloud AI providers behind the canonical `ProviderClient` trait:

1. **Google Gemini (`gemini`):** Native Google DeepMind Generate Content REST API.
2. **DeepSeek (`deepseek`):** OpenAI-compatible chat completions endpoint optimized for coding and mathematical reasoning.
3. **Groq (`groq`):** Ultra-high-speed hardware LPU inference serving open-weights models.
4. **Mistral AI (`mistral`):** Native European open-weights and frontier reasoning models.

These integrations complement the previously implemented **OpenAI** (Step 22) and **Anthropic** (Step 23) adapters.

```text
                               ┌────────────────────────────────┐
                               │     ProviderClient (Trait)     │
                               └────────────────┬───────────────┘
                                                │
         ┌───────────────┬──────────────────────┼──────────────────────┬───────────────┐
         │               │                      │                      │               │
  ┌──────▼──────┐ ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐ ┌──────▼──────┐
  │   OpenAI    │ │  Anthropic  │        │    Gemini   │        │   Shared    │ │  Local SLM  │
  │  (Step 22)  │ │  (Step 23)  │        │  (Step 24)  │        │ Chat Engine │ │  (Step 26+) │
  └─────────────┘ └─────────────┘        └──────┬──────┘        └──────┬──────┘ └─────────────┘
                                                │                      │
                                         Native Gemini          ┌──────┴──────┬─────────────┐
                                         GenerateContent        │             │             │
                                                          ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
                                                          │ DeepSeek  │ │   Groq    │ │  Mistral  │
                                                          └───────────┘ └───────────┘ └───────────┘
```

---

## 2. Google Gemini Native Integration (`gemini`)

### 2.1 Native Wire Protocol Isolation
Unlike OpenAI-compatible endpoints, Google's Gemini API has fundamental architectural differences:
- **Endpoints:**
  - Non-streaming: `POST /v1beta/models/{model}:generateContent`
  - Streaming: `POST /v1beta/models/{model}:streamGenerateContent?alt=sse`
- **Authentication:** `x-goog-api-key: <KEY>` request header (or query parameter, but header is prioritized for security to avoid URL leakages).
- **Message Framing:**
  - Standard conversation turns use `contents: [{ role: "user" | "model", parts: [{ text: string }] }]`.
  - Roles strictly map to `"user"` and `"model"` (not `"assistant"`).
  - System instructions are **not** conversational turns; they are isolated in the top-level `systemInstruction: { parts: [{ text: string }] }` object.
- **Generation Parameters:** Nested under `generationConfig` (`temperature`, `maxOutputTokens`, `topP`).
- **Response Format:** Text chunks are nested in `candidates[0].content.parts[].text`. Token counts are located in `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`).
- **Secret Scrubbing:** Regex matches Google API keys (`AIza[0-9A-Za-z-_]{35}`) in logs and error strings.

### 2.2 Streaming SSE Architecture
Gemini streaming SSE returns JSON objects directly per SSE `data:` event, terminating when `finishReason` is reported. Each chunk's text is extracted without stripping formatting or whitespace, ensuring exact multi-turn output fidelity.

---

## 3. Shared Compatible Chat Engine (`shared::compatible_chat`)

### 3.1 Architectural Motivation
DeepSeek, Groq, and Mistral all follow standard Chat Completions JSON message structures (`{ role, content }`) and SSE `data: {...}` lines terminating with `data: [DONE]`.

Rather than duplicating HTTP transport, SSE chunk parsing, and error mapping across three modules, Nano Route uses a policy-driven **`CompatibleChatExecutor`**:
- Defined by the `ChatCompletionPolicy` trait:
  - `provider_id() -> ProviderId`
  - `build_url(base_url, model, stream) -> String`
  - `build_headers(api_key) -> HeaderMap`
  - `map_http_error(status, body, headers) -> ProviderError`
  - `scrub_secrets(text) -> String`
  - `default_model() -> &'static str`

### 3.2 Pluggable Mock Transport
All compatible clients accept an optional `Arc<dyn CompatibleChatTransport>`, allowing 100% deterministic, offline testing of non-streaming execution, SSE chunk ordering, cancellation, and error handling without hitting live endpoints.

---

## 4. DeepSeek Integration (`deepseek`)

- **Default Endpoint:** `https://api.deepseek.com`
- **Catalog Models:** `deepseek-chat` (V3), `deepseek-reasoner` (R1)
- **Authentication:** `Authorization: Bearer <KEY>`
- **Specialized Behavior:**
  - Transparent reasoning tokens support.
  - Large context window (64k).
  - High token economy for math and code generation.
  - Error mapping handles DeepSeek's balance-exhausted status codes (402 Payment Required / insufficient balance mapped to `quota_exceeded`).

---

## 5. Groq Integration (`groq`)

- **Default Endpoint:** `https://api.groq.com/openai/v1`
- **Catalog Models:** `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
- **Authentication:** `Authorization: Bearer <KEY>`
- **Hardware Acceleration:** Sub-second time-to-first-token (TTFT) and high token generation speed on Groq LPUs.
- **Rate-Limit Handling:**
  - Extracts `retry-after` header and maps 429 status code with retryable flag.
  - Redacts `gsk_[a-zA-Z0-9]{20,}` secret tokens.

---

## 6. Mistral AI Integration (`mistral`)

- **Default Endpoint:** `https://api.mistral.ai/v1`
- **Catalog Models:** `mistral-large-latest`, `mistral-small-latest`, `codestral-latest`
- **Authentication:** `Authorization: Bearer <KEY>`
- **Content Flexibility:**
  - Supports string and structured text content blocks.
  - Codestral context window up to 256,000 tokens for massive codebase analysis.
  - Redacts Mistral API keys from logs and errors.

---

## 7. Security & Credential Isolation Guarantees

1. **DPAPI Boundary:** All provider credentials remain encrypted at rest via the Windows Data Protection API (DPAPI) in `CredentialVaultService`.
2. **Ephemeral Decryption:** Keys are loaded in Rust memory strictly at request invocation time.
3. **Zero Plaintext Leakage:**
   - Plaintext API keys never cross IPC to React or TypeScript.
   - Keys are never persisted in SQLite or plain configuration files.
   - All outgoing logs and incoming error messages are scrubbed with provider-specific regex filters (`AIza...`, `gsk_...`, Bearer tokens).

---

## 8. Verification & Test Suite Summary

- **Rust Native Tests:**
  - `src-tauri/src/providers/gemini/tests.rs`: Request serialization, systemInstruction extraction, response parsing, error mapping, and streaming SSE chunk extraction.
  - `src-tauri/src/providers/deepseek/tests.rs`: DeepSeek client non-streaming and streaming tests.
  - `src-tauri/src/providers/groq/tests.rs`: Groq client non-streaming and streaming tests.
  - `src-tauri/src/providers/mistral/tests.rs`: Mistral client non-streaming and streaming tests.
  - `src-tauri/src/providers/shared/compatible_chat.rs`: SSE parsing, whitespace preservation, and executor error handling.
- **Frontend Contract Tests:**
  - `src/services/ipc/__tests__/additional_providers.test.ts`: 11 assertions covering wire serialization, SSE handling, error mapping, concurrent multi-provider streams, and DPAPI key safety.
- **Full Suite Status:** 216 tests passed across 104 suites with 0 failures (`npm run validate` passing cleanly).
- **Logo Invariant:** `Nano Route Neon Tech Logo.png` verified at exactly 670,255 bytes.

---

## 9. Next Steps (Roadmap)

- **Step 25:** Provider Health & Capability Monitoring (active pinging, latency tracking, capability verification).
- **Step 26+:** Local SLM Runtime & Inference Engine.
- **Step 27+:** Intelligent Model Router & Optimization Engine.

