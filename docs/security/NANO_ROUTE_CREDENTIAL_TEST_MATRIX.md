# Nano Route — Credential Lifecycle Test Matrix

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Verification Scenarios, Secret-Leak Invariants & QA Automation  
**Test Suite:** `src/features/credentials/__tests__/credentialLifecycle.test.ts`  

---

## 1. Test Suite Coverage Summary

The Step 74 test suite executes 20 comprehensive automated tests spanning 6 critical domains:

| Category | Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **State Resolution** | Null credential in vault | Status `NOT_CONFIGURED`, `isConfigured: false` | **PASS** |
| **State Resolution** | Unvalidated key in vault | Status `CONFIGURED`, `isActive: true` | **PASS** |
| **State Resolution** | Key deactivated locally | Status `DISABLED`, `isActive: false` | **PASS** |
| **State Resolution** | Credential age $> 90$ days | Status `EXPIRING_OR_STALE`, `isStale: true` | **PASS** |
| **Zero-Prompt Probe** | Upstream returns 200 OK | Status `VALID`, non-metered, 0 prompt tokens | **PASS** |
| **Zero-Prompt Probe** | Upstream returns 401 Unauth | Status `INVALID`, clear error message | **PASS** |
| **Zero-Prompt Probe** | Upstream returns 403 Forbidden | Status `REVOKED_OR_REJECTED` | **PASS** |
| **Key Rotation** | Rotate existing key | DPAPI replaced, immediate validation executed | **PASS** |
| **Key Rotation** | Output DTO inspection | Zero plaintext key in return structures | **PASS** |
| **Compromise Response**| Emergency local purge | Key purged from vault, remote link provided | **PASS** |
| **Compromise Response**| Emergency local disable | Key deactivated in vault, remote link provided | **PASS** |
| **Endpoint Security** | Secure HTTPS endpoint | Validated: `isValid: true`, `isTlsEnforced: true` | **PASS** |
| **Endpoint Security** | HTTP localhost endpoint | Validated: `isValid: true`, `isLocalhost: true` | **PASS** |
| **Endpoint Security** | Plain HTTP remote endpoint | Rejected: `isValid: false`, TLS required | **PASS** |
| **Endpoint Security** | Embedded userinfo (`@`) | Rejected: `isValid: false`, auth forbidden | **PASS** |
| **Endpoint Security** | Query parameter secret | Rejected: `isValid: false`, query token leaked | **PASS** |
| **Secret Leak Test** | Diagnostic report generation | Zero synthetic tokens in report payload | **PASS** |
| **Secret Leak Test** | User data export JSON | Zero synthetic tokens in export package | **PASS** |
| **Secret Leak Test** | Workspace profile JSON | Zero credentials or keys in profile JSON | **PASS** |
| **Secret Leak Test** | Notification text sanitizer | Synthetic key scrubbed with `[REDACTED_SECRET]` | **PASS** |

---

## 2. Regression & Cross-System Verification

All 410 test suites (896+ automated tests) in the Nano Route codebase pass cleanly with zero regressions:
- Settings and Provider Management Panel.
- Disaster Recovery and Database Health.
- Intelligent Routing and Local SLM Inferences.
- Telemetry, Token Cost, and Privacy Audits.

