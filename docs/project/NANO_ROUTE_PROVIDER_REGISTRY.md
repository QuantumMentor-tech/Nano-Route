# NANO ROUTE — PROVIDER & MODEL REGISTRY FOUNDATION
## Architectural Specification & Canonical Catalog (Step 21)

**Document Version:** 1.0.0  
**Application Architecture Version:** v1.19.0  
**Registry Boundary:** Static, Built-in In-Memory Catalog (`ProviderRegistry`)  
**Security Boundary:** Zero Secret Retention (Plaintext & DPAPI secrets isolated)  
**Target Platform:** Windows 10 / Windows 11 (Desktop First)

---

## 1. Provider & Model Registry Purpose

Nano Route requires an authoritative, centralized, and immutable catalog describing the AI provider and model ecosystem. The Provider & Model Registry acts as the sole factual source of truth for:
- Which providers exist in the application ecosystem (`ProviderId`, display name, description, documentation).
- Which models belong to which provider (`model_id`, display name, context window limits, output limits).
- Which capabilities are supported at the provider infrastructure level and at the model level (streaming, vision, tool calls, structured outputs, code generation, reasoning).
- Implementation readiness (`Planned`, `Implemented`, `Unavailable`) and lifecycle status (`Active`, `Deprecated`, `Disabled`).
- Factual provider defaults (default model recommendation, default base URL).
- Safe provider and model lookups without performing routing or external network requests.

The registry strictly answers **facts** about providers and models. It does **NOT** perform routing decisions, model scoring, fallback execution, provider health monitoring, or credential handling.

---

## 2. Registry Architecture Diagram

```text
                         ┌─────────────────────┐
                         │ Provider Registry   │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          ┌──────────────────┐            ┌─────────────────┐
          │ Provider         │            │ Provider        │
          │ Descriptor       │            │ Descriptor      │
          │ (e.g. OpenAI)    │            │ (e.g. Anthropic)│
          └────────┬─────────┘            └────────┬────────┘
                   │                               │
                   ▼                               ▼
          ┌──────────────────┐            ┌─────────────────┐
          │ Model Registry   │            │ Model Registry  │
          └────────┬─────────┘            └────────┬────────┘
                   │                               │
                   ▼                               ▼
             Model A / B                       Model C / D
          (GPT-4o / o1)                  (Claude 3.5 Sonnet)
                   │                               │
                   └──────────────┬────────────────┘
                                  ▼
                       Future Routing Engine
```

---

## 3. Separation of Concerns Matrix

```text
      Registry                         User Preferences
          │                                   │
          │ static facts                      │ mutable state
          │                                   │
          ▼                                   ▼
 ProviderDescriptor                  ProviderConfiguration
 ModelDescriptor                     is_active
 capabilities                        priority_weight
 default URL                         base_url override
 context limits                      budget metadata
          │                                   │
          └────────────────┬──────────────────┘
                           ▼
                Effective Configuration
                           │
                           ▼
                    Future Provider Client
```

| Subsystem | Responsibility | Storage | Secret? |
| :--- | :--- | :--- | :--- |
| **Provider Registry** | Static facts: what a provider/model is, its capabilities, context limits, and default endpoints. | In-memory built-in Rust structures | **NO** |
| **Provider Preferences** | User customization: whether a provider is enabled (`is_active`), priority weight (`1..10`), custom base URL overrides, and budget limits. | SQLite `api_credentials` metadata | **NO** |
| **Credential Vault** | Cryptographic protection of authentication tokens via Windows DPAPI. | SQLite `api_credentials.encrypted_api_key` | **YES** (DPAPI BLOB) |
| **Provider Client** | Outbound HTTPS/HTTP execution of completions and token streaming. | Ephemeral Tokio tasks | Ephemeral |
| **Routing Engine** | Analysis of user prompts and multi-factor candidate scoring to select the optimal model. | Dynamic execution logic | **NO** |
| **Runtime Health** | Dynamic reachability, latency tracking, and error-rate monitoring. | In-memory ephemeral telemetry | **NO** |

---

## 4. Provider & Model Identity Rules

1. **Provider Identifiers (`ProviderId`):**
   - Canonical, lowercase, ASCII alphanumeric string with hyphens or underscores (`^[a-z0-9_-]{2,32}$`).
   - Constant identifiers: `openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `mistral`, `local`, `custom`.
   - Provider IDs are immutable; display names are separate presentation metadata.
2. **Model Identifiers:**
   - Scoped strictly by provider: `(ProviderId, model_id)`.
   - Different providers may declare identical model names without conflict (e.g., `groq/llama-3.3-70b-versatile` vs `local/llama3.2:3b`).
   - Historical model versions (e.g., `claude-3-5-sonnet-20241022`) are preserved explicitly without loss of version metadata.

---

## 5. Built-in MVP Provider Catalog

| Provider ID | Brand Display Name | Default Base URL | Default Model | Implementation State | Credential Required? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`openai`** | OpenAI | `https://api.openai.com/v1` | `gpt-4o` | Planned | Yes (DPAPI) |
| **`anthropic`** | Anthropic | `https://api.anthropic.com` | `claude-3-5-sonnet-20241022` | Planned | Yes (DPAPI) |
| **`gemini`** | Google Gemini | `https://generativelanguage.googleapis.com` | `gemini-1.5-pro` | Planned | Yes (DPAPI) |
| **`deepseek`** | DeepSeek | `https://api.deepseek.com` | `deepseek-chat` | Planned | Yes (DPAPI) |
| **`groq`** | Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Planned | Yes (DPAPI) |
| **`mistral`** | Mistral AI | `https://api.mistral.ai/v1` | `mistral-large-latest` | Planned | Yes (DPAPI) |
| **`local`** | Local SLM / Ollama | `http://localhost:11434` | `llama3.2:3b` | Planned | **No** (Local inference) |
| **`custom`** | Custom Endpoint | `http://localhost:8000/v1` | None | Planned | **No** (Optional) |

---

## 6. Model Capability Representation

Capabilities are strictly factual and reuse the Step 14 canonical `ProviderCapabilities` system:
- `TextGeneration`: Conversational text generation.
- `Streaming`: Real-time token streaming.
- `Vision` / `ImageInput`: Multimodal visual inputs.
- `ToolCalling`: Function and external tool calling.
- `StructuredOutput`: JSON schema-constrained output.
- `LargeContext`: Context windows exceeding 100,000 tokens.
- `Reasoning`: Extended chain-of-thought logic models (e.g., `o1`, `DeepSeek-R1`).
- `CodeGeneration`: Specialized programming synthesis.
- `SystemMessages`: Support for dedicated developer system instructions.
- `AudioInput`: Native audio processing (e.g., Gemini 1.5).

---

## 7. Registry Invariants & Validation Rules

At startup, `ProviderRegistry::builtin()` runs `validate()`, enforcing:
1. **Uniqueness:** All provider IDs are strictly unique.
2. **Model Uniqueness:** Model IDs within a given provider catalog are strictly unique.
3. **No Orphan Models:** Every registered model must reference an existing registered provider.
4. **Default Model Validity:** If a provider descriptor declares a `default_model_id`, that model must exist in the provider's registered models.
5. **Context Window Bounds:** Every registered model must declare a non-zero `context_window` (`> 0`).
6. **URL Security:** Default base URLs must use `https://` (or `http://localhost` / `http://127.0.0.1` for local endpoints) and must not contain embedded user credentials (`@`).

---

## 8. Effective Configuration Resolution

The registry provides `resolve_effective_provider` and `resolve_all_effective_providers`:
- Reads static provider descriptor and associated models.
- Reads user preferences from Step 20 (`is_active`, `priority_weight`, `base_url` override, `monthly_budget_limit`, `current_month_spend`).
- Reads credential configuration status (`is_credential_configured`).
- Produces `EffectiveProviderDescriptor` for presentation and future router consumption.
- **Zero Secret Exposure:** The effective descriptor never contains plaintext API keys or DPAPI binary ciphertext.

---

## 9. Historical Model Compatibility

When chat sessions or telemetry records reference historical models:
- A model may be removed or deprecated in future application releases.
- Nano Route strictly forbids foreign-key constraints between persistent chat messages and current registry catalogs.
- `resolve_historical_model(provider_id, model_id)` checks the active catalog:
  - If present: returns verified display name and `is_known_in_active_registry = true`.
  - If absent: gracefully returns the raw stored `model_id` with `is_known_in_active_registry = false`.
- Historical conversations continue to render seamlessly without database errors or data loss.

---

## 10. Conclusion

Step 21 establishes the immutable factual foundation for all providers and models in Nano Route. Subsequent steps (Step 22+) can now safely instantiate provider clients, execute local and cloud inference, and implement intelligent SLM routing on top of these verified contracts.

