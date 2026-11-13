# Nano Route Provider Drift & API Maintenance Runbook (Step 56)

## 1. Scope & Objective

This runbook guides engineers when external provider APIs drift, deprecate models, alter SSE streaming delimiters, or modify token usage reporting schemas.

---

## 2. Drift Diagnostics Flow

```
1. Provider API Failure Reported (User Error / Automated Probe)
   │
   ▼
2. Check Error Normalization (`cmd_classify_error` / Native Logs)
   │
   ├── Is it 401/403? ──> User Key Expired or Revoked. (User action required)
   ├── Is it 429? ──────> Rate Limited. (Verify fallback policy in Settings)
   ├── Is it 404? ──────> Model Decommissioned / ID Renamed by Vendor.
   └── Is it 200 with JSON parsing failure? ──> Response Schema Drift!
   │
   ▼
3. Isolate Provider Adapter in `src-tauri/src/providers/<provider>/`
   │
   ├── Verify Request Schema in `request.rs`
   ├── Verify Response Envelope in `response.rs`
   └── Verify SSE Parsing in `streaming.rs`
   │
   ▼
4. Implement Adapter Contract Fix
   │
   ├── Update Unit & Fixture Contract Tests in `tests.rs`
   ├── Verify Normalized Output mapping to `ProviderResponse` / `StreamDelta`
   └── Confirm Zero Secret Exposure in logs
   │
   ▼
5. Ship Hotfix via Step 52 Secure Update Pipeline
```

---

## 3. Provider-Specific Quirks & Delimiters

- **Anthropic**: Requires explicit `anthropic-version: 2023-06-01` header. SSE stream terminates with `message_stop` event rather than `data: [DONE]`.
- **Gemini**: Requires API key either in header `x-goog-api-key` or as query param `key`. Responses wrap candidates in `candidates[0].content.parts[0].text`.
- **OpenAI**: Requires `Authorization: Bearer <KEY>`. SSE stream terminates with `data: [DONE]`.
- **Groq & DeepSeek & Mistral**: Adhere to OpenAI-compatible endpoints (`/v1/chat/completions`) with provider-specific token usage nuances.

