# Nano Route — Privacy & Security Architecture Integration
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Security Architecture Foundations

Nano Route ensures privacy through structural security design:

1. **Windows Data Protection API (DPAPI)**:
   - Provider API keys are encrypted at rest using DPAPI `CryptProtectData`.
   - The encryption key is tied to the logged-in Windows user account and hardware entropy.
   - Other users or unprivileged processes cannot decrypt stored API keys.

2. **Tauri IPC Isolation**:
   - Web frontend runs in a sandboxed WebView2 window.
   - IPC commands use strict parameter typing and deserialization bounds.
   - Commands requesting sensitive operations (like wiping data or deleting credentials) require explicit confirmation flags.

3. **In-Flight Memory Safety**:
   - Plaintext API keys exist in Rust process memory only during active HTTP request construction and are dropped immediately after dispatch.
   - Keys are never copied into the JavaScript runtime or cached in frontend state.

---

## 2. Invariant Protections

| Invariant | Enforcement Mechanism | Verification Suite |
| :--- | :--- | :--- |
| **No Plaintext Keys in DB** | Rust backend schema & DPAPI vault | `test_credential_dpapi_isolation` |
| **No Keys in Logs** | Redacting logging layer & IPC serializer | `test_logging_secret_exclusion` |
| **No Keys in Exports** | Export engine filter pipeline | `test_export_excludes_secrets` |
| **No Prompts in Telemetry** | Strict telemetry schema | `test_telemetry_zero_content` |
| **Local-First Boundary** | Offline mode check & Request preflight | `privacyCenter.test.ts` |

