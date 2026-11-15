# Nano Route — Audit Data Classification & Sensitive Data Rules
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Data Classification Scope

Audit event records fall strictly under the `OPERATIONAL` or `SECURITY` classification tiers in the Nano Route Data Sensitivity Framework (Step 88):

- **Event Descriptors**: `INTERNAL` / `OPERATIONAL`
- **Security Checkpoints**: `SECURITY`
- **User Content**: **STRICTLY EXCLUDED**
- **Secrets & API Keys**: **STRICTLY EXCLUDED**

---

## 2. Sensitive Data Exclusion Invariant

The audit subsystem enforces the following absolute constraints:

| Data Type | Allowed in Audit Trail? | Technical Enforcement Mechanism |
| :--- | :--- | :--- |
| **API Keys & Passwords** | ❌ **STRICTLY FORBIDDEN** | RegEx pattern matching (`sk-`, `AIzaSy`, `gsk_`, `ghp_`) + Forbidden key filter |
| **Authorization Headers** | ❌ **STRICTLY FORBIDDEN** | Bearer token sanitizer & header dropping |
| **DPAPI Blobs & Salts** | ❌ **STRICTLY FORBIDDEN** | DPAPI boundaries only record success/failure flags |
| **User Prompt Text** | ❌ **STRICTLY FORBIDDEN** | Forbidden detail keys (`prompt`, `promptText`, `completion`) |
| **Model Response Content** | ❌ **STRICTLY FORBIDDEN** | Response bodies never ingested into audit inputs |
| **File Attachment Data** | ❌ **STRICTLY FORBIDDEN** | Intake events log only file extension & size, never payload bytes |
| **Private Conversation Notes**| ❌ **STRICTLY FORBIDDEN** | Note bodies never entered into audit events |
| **Windows User Account Paths** | ❌ **STRICTLY FORBIDDEN** | Filesystem path sanitizer strips `C:\Users\<user>\` |
| **Keystroke / Click Logs** | ❌ **STRICTLY FORBIDDEN** | No UI event capture hooks implemented |

---

## 3. Safe Metadata Examples

### Permitted Attributes
- `providerId`: `"anthropic"`
- `modelId`: `"claude-3-5-sonnet-20241022"`
- `correlationId`: `"req_12345678"`
- `durationMs`: `420`
- `attemptCount`: `2`
- `statusCode`: `200`
- `reason`: `"RATE_LIMIT_EXCEEDED"`

### Forbidden Attributes
- `prompt`: `"..."`
- `response`: `"..."`
- `apiKey`: `"..."`
- `secret`: `"..."`

