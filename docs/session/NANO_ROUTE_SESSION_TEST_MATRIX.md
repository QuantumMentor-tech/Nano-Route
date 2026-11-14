# Nano Route — Workspace Session Continuity Test Matrix & Verification

**Document Reference:** `docs/session/NANO_ROUTE_SESSION_TEST_MATRIX.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 68  
**Authoritative Verification Document**  

---

## 1. Test Suite Summary

The Workspace Session Continuity subsystem is verified across three layers:
1. **Isolated Subsystem Unit Tests (`sessionContinuity.test.ts`):** 22 tests verifying snapshot serialization, deserialization, route allowlist enforcement, query sanitization, startup precedence evaluation, and 8KB size ceiling.
2. **Regression & Parity Suites (`userPreferences.test.ts`, `workspaceProfiles.test.ts`):** 36 tests ensuring zero regression across preferences and profile contexts.
3. **Comprehensive Global Integration Suite (`npm test`):** 817 tests passing across 384 suites with zero failures.

---

## 2. Test Execution Matrix

| Test Suite / Case | Target Behavior | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :---: |
| **Catalog Taxonomy** | Verify state classification categories | 5 distinct categories enumerated with zero overlap | **PASS** |
| **Sensitive Data Barrier** | Audit DPAPI key classification | Explicitly marked `FORBIDDEN_TO_RESTORE` | **PASS** |
| **Valid Serialization** | Serialize standard snapshot | Valid JSON with format and version 1 | **PASS** |
| **Size Ceiling Enforcement** | Oversized payload (> 8192 bytes) | Serialization fails / throws payload limit error | **PASS** |
| **JSON Corruption Recovery** | Corrupt/malformed JSON string | Deserialization gracefully falls back to null | **PASS** |
| **Envelope Validation** | Wrong format identifier or version | Deserialization rejects invalid envelope | **PASS** |
| **Route Allowlist: Chat** | Allowlisted route `/chat` | Retained as `/chat` | **PASS** |
| **Route Allowlist: Settings**| Allowlisted route `/settings` | Retained as `/settings` | **PASS** |
| **Route Allowlist: Unknown** | Non-allowlisted route `/admin` | Replaced with safe default `/` | **PASS** |
| **Script Injection Attack** | Malicious route `/<script>alert(1)` | Replaced with safe default `/` | **PASS** |
| **Query Sanitization** | Invalid tags in `/help?article=bad<tag>` | Query stripped, safe base `/help` returned | **PASS** |
| **Startup Precedence: DR** | Step 53 Disaster Recovery active | Route resolved to `/` (disaster recovery) | **PASS** |
| **Startup Precedence: Update**| Step 52 Update Rollback active | Route resolved to `/` (update rollback) | **PASS** |
| **Startup Precedence: Onboard**| Step 61 Onboarding incomplete | Route resolved to `/` (mandatory onboarding) | **PASS** |
| **Startup Precedence: Opt-Out**| `restore_previous_session == false` | Resolved to user preference `startup_route` | **PASS** |
| **Startup Precedence: Crash** | `unexpected_exit` on `/settings` | Overridden and redirected to `/` | **PASS** |
| **Startup Precedence: Clean** | `clean_exit` on `/chat` | Successfully restored to `/chat` | **PASS** |
| **TypeScript Typecheck** | Full project compilation (`tsc --noEmit`)| 0 errors across 100% of files | **PASS** |
| **Vite Production Build** | Complete client bundle build | Production build succeeds cleanly | **PASS** |

---

## 3. Test Execution Verification Commands

```powershell
# 1. Session Continuity isolated test suite
node --experimental-strip-types --test src/features/session/__tests__/sessionContinuity.test.ts

# 2. Preference and Profile regression suites
node --experimental-strip-types --test src/features/settings/__tests__/userPreferences.test.ts
node --experimental-strip-types --test src/features/profiles/__tests__/workspaceProfiles.test.ts

# 3. Global project test runner
npm test

# 4. Strict TypeScript compiler check
npm run typecheck

# 5. Production bundle build
npm run build
```

