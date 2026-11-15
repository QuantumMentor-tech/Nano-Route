# Nano Route — Audit Trail Redaction & Sanitization Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Automated String Scrubbing

Every string passed into the audit engine (including `summary`, `correlationId`, `providerId`, and metadata values) is processed by `sanitizeAuditString`:

### 1.1 Secret Token Scrubbing
- **Patterns Matched**:
  - `sk-[A-Za-z0-9_-]{8,}` (OpenAI / Anthropic style API keys)
  - `AIza[0-9A-Za-z-_]{30,}` (Google Gemini API keys)
  - `gsk_[A-Za-z0-9_-]{16,}` (Groq API keys)
  - `ghp_[A-Za-z0-9]{30,}` (GitHub personal access tokens)
  - `Bearer\s+[A-Za-z0-9._-]+` (HTTP Authorization headers)
  - `(?:key|secret|password|token)=[^\s&"']+` (URL and query parameters)
- **Replacement String**: `[REDACTED_SECRET]`

### 1.2 Filesystem Path Scrubbing
- **Patterns Matched**:
  - `[A-Za-z]:\\[^\\/:*?"<>|\r\n\t]+` (Windows drive paths)
  - `/(?:Users|home|var|tmp|etc|usr)[^\s"':;]+` (POSIX paths)
- **Replacement String**: `[REDACTED_PATH]`

---

## 2. Structural Metadata Key Filtering

Any object passed into the `details` field is inspected key-by-key:
- If a key matches forbidden terms (`key`, `apiKey`, `secret`, `password`, `token`, `auth`, `authorization`, `bearer`, `cookie`, `prompt`, `response`, `completion`, `attachmentContent`, `noteBody`, `collectionContent`), its value is replaced with `"[REDACTED_SENSITIVE_KEY]"`.
- All other string values are scrubbed via `sanitizeAuditString`.

