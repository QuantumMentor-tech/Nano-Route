# Nano Route Provider Failure, Error Normalization & Drift Matrix (Step 56)

## 1. Provider Error Classification & Status Mapping

External provider APIs exhibit diverse error formats. Nano Route maps all provider-specific HTTP and JSON error envelopes into a normalized internal error classification hierarchy:

| Provider Error Condition | OpenAI Representation | Anthropic Representation | Gemini Representation | Normalized Nano Route Error | Actionable User Guidance |
|---|---|---|---|:---:|---|
| **Invalid API Key** | HTTP 401 (`invalid_api_key`) | HTTP 401 (`authentication_error`) | HTTP 400/403 (`API_KEY_INVALID`) | `AUTHENTICATION_FAILED` | Prompt user to update key in Settings > Providers. Zero retries. |
| **Rate Limit Exceeded** | HTTP 429 (`rate_limit_exceeded`) | HTTP 429 (`rate_limit_error`) | HTTP 429 (`RESOURCE_EXHAUSTED`) | `RATE_LIMITED` | Back off with jitter; trigger automatic fallback if configured. |
| **Model Deprecated / Invalid** | HTTP 404 (`model_not_found`) | HTTP 404 (`not_found_error`) | HTTP 404 (`NOT_FOUND`) | `INVALID_MODEL` | Mark model as unavailable; prevent routing to model; alert user. |
| **Context Window Exceeded** | HTTP 400 (`context_length_exceeded`) | HTTP 400 (`invalid_request_error`) | HTTP 400 (`INVALID_ARGUMENT`) | `CONTEXT_LIMIT_EXCEEDED` | Request context truncation or suggest model with larger context window. |
| **Server Outage** | HTTP 500 / 503 (`server_error`) | HTTP 500 / 529 (`api_error` / overloaded) | HTTP 500 / 503 (`UNAVAILABLE`) | `SERVICE_UNAVAILABLE` | Retry once; failover to next eligible provider candidate. |

---

## 2. Model Identifier Drift Invariants

1. **Unknown Model IDs**:
   - If an external provider returns an unknown model ID in a response payload, Nano Route attributes telemetry accurately to the received ID while labeling it as unrecognized.
   - Unknown model IDs are **never** added automatically to routable candidates without explicit catalog validation.
2. **Deprecated Models**:
   - Historical messages referencing decommissioned model IDs retain their original strings (`gpt-3.5-turbo`, `claude-2.1`) to preserve historical integrity.
   - Nano Route never rewrites past database records to point to newer models.

