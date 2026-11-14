# Nano Route — Reset Framework Test Matrix & Verification

**Document Reference:** `docs/reset/NANO_ROUTE_RESET_TEST_MATRIX.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 69  
**Authoritative Verification Document**  

---

## 1. Test Suite Summary

The Application Reset and Factory Defaults framework is validated across three comprehensive testing tiers:
1. **Isolated Subsystem Unit Tests (`resetFramework.test.ts`):** 17 tests verifying taxonomy completeness, safety classifications, precondition gating, typed tokens, pre-reset backups, and post-reset state verification.
2. **Regression & Parity Suites (`userPreferences.test.ts`, `workspaceProfiles.test.ts`, `sessionContinuity.test.ts`):** Ensuring zero regressions across Preferences, Profiles, and Session subsystems.
3. **Comprehensive Global Integration Suite (`npm test`):** 834 tests passing across 390 test suites with zero failures.

---

## 2. Test Execution Matrix

| Test Suite / Case | Target Behavior | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :---: |
| **Catalog Taxonomy** | Verify all 8 operations defined in `RESET_CATALOG` | 8 distinct operations with complete metadata | **PASS** |
| **Safety Classification** | Validate accurate risk classifications | Non-destructive, configuration, sensitive, data, irreversible | **PASS** |
| **Confirmation Tokens** | Verify typed tokens on high-impact actions | Required tokens: `"RESET CONFIG"`, `"DELETE"`, `"FACTORY RESET"` | **PASS** |
| **Backup Offering** | Verify backup offering logic | Destructive operations offer pre-reset backup | **PASS** |
| **Precondition: Idle** | Check preconditions on idle app | `canProceed: true` | **PASS** |
| **Precondition: Streaming** | Check preconditions during active prompt stream | Reset blocked with descriptive error message | **PASS** |
| **Accidental Safety** | Reject unconfirmed request (`confirmed: false`) | Throws confirmation error | **PASS** |
| **Token Safety** | Reject mismatched confirmation token | Throws mismatch exception | **PASS** |
| **Parameter Validation** | Require `providerId` for `REMOVE_PROVIDER_CREDENTIAL` | Throws missing parameter error | **PASS** |
| **Execution: Preferences** | Execute `RESET_PREFERENCES` | Reverts presentation tokens to defaults | **PASS** |
| **Execution: Workspace** | Execute `RESET_WORKSPACE` | Reverts active profile to default, clears custom profiles | **PASS** |
| **Execution: Session** | Execute `RESET_SESSION_STATE` | Erases snapshot, sets `clean_exit` | **PASS** |
| **Execution: Credential** | Execute `REMOVE_PROVIDER_CREDENTIAL` | Removes specified DPAPI secret, preserves others | **PASS** |
| **Execution: App Config** | Execute `RESET_APPLICATION_CONFIGURATION` | Reverts routing policy & retention, creates backup | **PASS** |
| **Execution: Data Cleanup**| Execute `CLEAR_SELECTED_USER_DATA` | Selectively deletes history records | **PASS** |
| **Execution: Local Wipe** | Execute `FULL_LOCAL_DATA_RESET` | Wipes conversations & telemetry, preserves credentials | **PASS** |
| **Execution: Factory Reset**| Execute `FACTORY_RESET` | Wipes all data & DPAPI keys, resets onboarding | **PASS** |
| **TypeScript Typecheck** | Full project compilation (`tsc --noEmit`) | 0 errors across 100% of files | **PASS** |
| **Vite Production Build** | Complete client production build | Production build succeeds cleanly | **PASS** |

---

## 3. Test Execution Verification Commands

```powershell
# 1. Reset Framework isolated unit test suite
node --experimental-strip-types --test src/features/reset/__tests__/resetFramework.test.ts

# 2. Global application test suite
npm test

# 3. TypeScript strict compiler check
npm run typecheck

# 4. Production bundle build
npm run build
```

