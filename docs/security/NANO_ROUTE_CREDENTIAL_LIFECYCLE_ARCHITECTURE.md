# Nano Route — Credential Lifecycle Architecture

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Secure Credential Lifecycle, API-Key Rotation, Secret Validation, Compromise Response & Credential Hygiene  
**Subsystems:** Windows DPAPI, SQLite Vault, React Frontend, Provider Subsystem  

---

## 1. Executive Summary

Nano Route orchestrates AI model inferences across local on-device SLMs and multiple cloud frontier providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, Mistral). While local SLM inference requires zero credentials, cloud provider interactions require secret API keys.

Nano Route enforces a zero-trust, local-first credential security model. Provider credentials are encrypted exclusively via the Windows Data Protection API (DPAPI) and tied cryptographically to the executing Windows user logon context. Plaintext credentials never touch persistent logs, telemetry events, chat message histories, diagnostic reports, support exports, workspace preference profiles, or UI notifications.

This document defines the overarching architectural principles governing credential storage, in-memory lifetime minimization, IPC boundaries, and zero-prompt validation.

---

## 2. Core Architectural Principles

```
  +-------------------------------------------------------------------------+
  |                          Frontend React Client                          |
  |  - Ephemeral Password Input                                             |
  |  - Instant Memory Cleansing upon Submit                                 |
  |  - Zero Key Display (No "Reveal / View Key" button)                     |
  |  - Presence vs Validity Indication                                      |
  +-----------------------------------+-------------------------------------+
                                      |
                                      | IPC Command: cmd_save_provider_credential
                                      | (One-way transmission of plaintext secret)
                                      v
  +-------------------------------------------------------------------------+
  |                          Rust Native Core                               |
  |  - Input Validation & Length Verification                               |
  |  - Windows DPAPI CryptProtectData Encryption                            |
  |  - Zero Plaintext Log Emission                                          |
  |  - Wipe ephemeral byte buffers immediately                              |
  +-----------------+-----------------------------------+-------------------+
                    |                                   |
                    v                                   v
  +-----------------------------------+  +----------------------------------+
  |          SQLite Vault             |  |      Safe IPC Status Return      |
  |  - Encrypted Ciphertext Blob      |  |  - ProviderCredentialStatus DTO  |
  |  - Configuration Flags (Active)   |  |  - Zero Secret Material          |
  |  - Updated Timestamp              |  |  - Validation Metadata           |
  +-----------------------------------+  +----------------------------------+
```

### 2.1 Cryptographic Storage via Windows DPAPI
- Provider API keys are protected using Windows DPAPI (`CryptProtectData` with user-scope logon derivation).
- Decryption (`CryptUnprotectData`) occurs strictly inside the native Rust core on-demand during an active outbound HTTP request.
- Decrypted keys are held in memory only for the duration of the outbound request and wiped from heap buffers.

### 2.2 IPC Boundary Invariants
- The Tauri IPC boundary permits plaintext API keys in only one direction: from frontend input field to Rust native core (`cmd_save_provider_credential`).
- No IPC command ever returns a plaintext API key, decrypted key, or DPAPI cipher blob to the frontend.
- Credential status queries return `ProviderCredentialStatus` or `ProviderCredentialLifecycleDto`, exposing solely operational metadata (`isConfigured`, `isActive`, `priorityWeight`, `baseUrl`, `updatedAt`, `validationStatus`).

### 2.3 Presence vs Validity Distinction
A critical security failure in desktop AI applications is conflating credential *presence* with credential *validity*:
- **Presence (`CONFIGURED`):** Indicates that an encrypted DPAPI blob exists locally in the SQLite store.
- **Validity (`VALID` / `INVALID` / `REVOKED`):** Indicates whether the remote provider API currently accepts the key.
Nano Route strictly separates these concepts in both the state machine and the UI. A key may be present while being unverified, invalid, or expired.

---

## 3. Zero-Prompt Validation Guarantees

Validating that an API key is functional must never sacrifice user privacy:
1. **No User Content Transmission:** Credential verification NEVER submits user prompts, conversational history, or synthetic chat messages.
2. **Metadata Endpoint Probing:** Verification relies on non-metered, zero-cost provider discovery endpoints (e.g., `GET /v1/models` for OpenAI/Groq, `GET /v1/models` for Gemini).
3. **No Continuous Background Polling:** Verification runs strictly on-demand (e.g., immediately post-rotation or upon explicit user click). Nano Route never runs periodic background polling loops against remote provider authentication endpoints.

---

## 4. Subsystem Isolation & Leak Prevention Matrix

| Subsystem | Plaintext Secret Permitted? | Ciphertext Permitted? | Protection Mechanism |
| :--- | :--- | :--- | :--- |
| **Settings UI Input** | Yes (transient in-memory during typing) | No | Cleared immediately on submit; `autoComplete="off"` |
| **Frontend State Store** | **STRICTLY FORBIDDEN** | No | Only non-secret `ProviderCredentialStatus` held in state |
| **IPC Responses** | **STRICTLY FORBIDDEN** | No | IPC DTOs omit all secret fields |
| **SQLite Database** | **STRICTLY FORBIDDEN** | Yes | Stored only as DPAPI encrypted BLOB |
| **Telemetry Records** | **STRICTLY FORBIDDEN** | **FORBIDDEN** | Schema stores only token counts, cost, and latency |
| **Chat Session DB** | **STRICTLY FORBIDDEN** | **FORBIDDEN** | User messages contain zero authentication headers |
| **Diagnostic Reports** | **STRICTLY FORBIDDEN** | **FORBIDDEN** | Strict regex redaction and key filtering |
| **Data Exports** | **STRICTLY FORBIDDEN** | **FORBIDDEN** | Allowlist serialization + post-export leak scanner |
| **Workspace Profiles** | **STRICTLY FORBIDDEN** | **FORBIDDEN** | Profile JSON includes only visual/routing preferences |
| **Desktop Notifications**| **STRICTLY FORBIDDEN** | **FORBIDDEN** | `sanitizeNotificationText` scrubs all API tokens |

---

## 5. Architectural Compliance Verification

Compliance with this architecture is verified continuously via:
1. Native Rust unit tests ensuring DPAPI ciphertext integrity and memory wiping.
2. Node.js unit tests asserting zero secret leakage across exports, diagnostics, profiles, and notifications.
3. Automated synthetic token scanners (`scanForSecretLeaks`, regex pattern matchers) validating data payloads prior to file emission or serialization.

