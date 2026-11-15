# Nano Route — Data Sensitivity & Privacy Classification Framework
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Sensitivity Taxonomy

Nano Route assigns each local store and artifact to an authoritative sensitivity classification tier:

### 1.1 PUBLIC
- **Definition**: Non-confidential application metadata, public documentation, model registry catalogs, and default configurations.
- **Handling**: Safe for display, export, and diagnostics inclusion without redaction.

### 1.2 INTERNAL
- **Definition**: Internal system state, UI layout parameters, cache identifiers, search indexes, window positions.
- **Handling**: Stored locally in SQLite; not shared externally.

### 1.3 USER_CONTENT
- **Definition**: Conversation sessions, messages, prompt templates, composer drafts, bookmarks, and highlights.
- **Handling**: Stored in local SQLite. Transmitted strictly upon explicit user request dispatch. Exportable by the user.

### 1.4 SENSITIVE
- **Definition**: Private message annotations, context collections, attachment payloads, custom provider endpoint URLs.
- **Handling**: High-protection user data. Never transmitted automatically. Stays local until explicitly activated for a specific request.

### 1.5 SECRET
- **Definition**: External AI provider API keys, authorization tokens, authentication salts.
- **Handling**: Protected exclusively by Windows Data Protection API (DPAPI) user-scoped encryption. **Zero plaintext SQLite storage. Strictly excluded from all exports, logs, diagnostics, and telemetry.**

### 1.6 OPERATIONAL
- **Definition**: Execution latency, token counts, model identifiers, error categories, connectivity health states.
- **Handling**: Local SQLite storage only. Zero user content. Eligible for automatic retention cleanup.

---

## 2. Invariant Matrix

| Classification | SQLite Plaintext Allowed? | Exportable? | Telemetry Inclusion? | Network Transmitted? |
| :--- | :--- | :--- | :--- | :--- |
| **PUBLIC** | Yes | Yes | Non-content metadata | No |
| **INTERNAL** | Yes | Yes | Non-content metadata | No |
| **USER_CONTENT** | Yes | Yes | **NO (Zero Content)** | **Only upon explicit Send** |
| **SENSITIVE** | Yes | Yes | **NO (Zero Content)** | **Only if user-injected** |
| **SECRET** | **NO (DPAPI Encrypted)** | **STRICTLY NO** | **STRICTLY NO** | **HTTP Header on Send only** |
| **OPERATIONAL** | Yes | Optional | Non-content metadata | No (Local SQLite only) |

