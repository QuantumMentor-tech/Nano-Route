# Nano Route — Zero-Prompt Credential Validation

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Verification Endpoints, Zero-Prompt Invariants & Non-Metered Probes  
**Subsystems:** Provider Health Service, Native Probe Runner, React Settings UI  

---

## 1. Zero-Prompt Philosophy

Many AI developer tools test credential validity by sending a dummy prompt (e.g. `{"messages": [{"role": "user", "content": "ping"}]}`). This approach suffers from critical flaws:
- **Cost Incurrence:** Consumes token quota and incurs API billing.
- **Privacy Leakage:** Transmits synthetic text across networks, which may be logged or sampled by frontier provider telemetry.
- **Rate-Limit Depletion:** Consumes requests-per-minute (RPM) allocations unnecessarily.

Nano Route enforces a strict **Zero-Prompt Validation Guarantee**:
> **Credential validation NEVER transmits user prompt text, chat history, or synthetic conversational completions.**

---

## 2. Validation Probes & Endpoints

Validation is performed exclusively via metadata discovery endpoints:

| Provider | Metadata Endpoint Used | HTTP Method | Metered / Incurs Cost? |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/models` | `GET` | **No** (Zero Token Cost) |
| **Anthropic** | `/v1/models` | `GET` | **No** (Zero Token Cost) |
| **Google Gemini** | `/v1beta/models` | `GET` | **No** (Zero Token Cost) |
| **Groq** | `/openai/v1/models` | `GET` | **No** (Zero Token Cost) |
| **DeepSeek** | `/v1/models` | `GET` | **No** (Zero Token Cost) |
| **Mistral AI** | `/v1/models` | `GET` | **No** (Zero Token Cost) |

These endpoints authenticate the API key without invoking generative language models or consuming token quotas.

---

## 3. Response Status Interpretation

The zero-prompt probe maps upstream HTTP response codes to authoritative lifecycle states:

```
+--------------------+---------------------------------------------------+
| Upstream Response  | Resolved Lifecycle Status                         |
+--------------------+---------------------------------------------------+
| HTTP 200 OK        | VALID (Key is authentic and active)               |
| HTTP 401 Unauth    | INVALID (Incorrect, expired, or malformed key)    |
| HTTP 403 Forbidden | REVOKED_OR_REJECTED (Revoked, suspended account)  |
| HTTP 429 RateLimit | VALIDATION_UNKNOWN (Reachability confirmed, rate) |
| Connection Timeout | VALIDATION_UNKNOWN (Offline / DNS / Proxy issue)  |
| DPAPI Decrypt Err  | ERROR (Local operating system vault failure)      |
+--------------------+---------------------------------------------------+
```

---

## 4. Execution Rules & Scheduling

- **On-Demand Only:** Validation is triggered exclusively by explicit user intent (e.g. clicking "Check Health") or automatically upon saving a newly rotated key.
- **No Background Loops:** There are no standing background timers or cron jobs pinging remote provider endpoints.
- **Isolated Failure Scope:** If validation fails for a given provider, it is isolated to that provider descriptor; neither other providers nor the local SLM runtime are affected.

