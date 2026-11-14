# Nano Route — Data Export Test Matrix & Verification

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_TEST_MATRIX.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Verification Document**  

---

## 1. Test Suite Summary

The User Data Export & Privacy Portability framework is verified across three testing tiers:
1. **Isolated Subsystem Unit Tests (`dataExport.test.ts`):** 12 tests verifying export catalog descriptors, formula injection neutralization, leak scanning, selective category serialization, and non-destructive read invariants.
2. **Regression & Parity Suites (`resetFramework.test.ts`, `sessionContinuity.test.ts`, `workspaceProfiles.test.ts`):** Ensuring zero regressions across Reset, Session, and Profile contexts.
3. **Comprehensive Global Integration Suite (`npm test`):** 846 tests passing across 395 test suites with zero failures.

---

## 2. Test Execution Matrix

| Test Suite / Case | Target Behavior | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :---: |
| **Catalog Taxonomy** | Verify all 5 categories defined in catalog | 5 distinct categories with complete metadata | **PASS** |
| **Data Classifications** | Validate accurate risk classifications | `USER_CONTENT`, `USER_CONFIGURATION`, `ANALYTICS_DATA`, `METADATA_ONLY` | **PASS** |
| **Inventory Exclusions** | Explicitly document unexportable DPAPI secrets | Marked `SECRET`, `isExportable: false` | **PASS** |
| **CSV Formula Injection** | Sanitize cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` | Prefixed with single quote `'` | **PASS** |
| **CSV Plain Text** | Safe plain text and numbers unaltered | Preserved without modifications | **PASS** |
| **CSV Quoting** | Escape commas, quotes, and newlines | Quoted and doubled according to RFC 4180 | **PASS** |
| **CSV Header Generation** | Format objects into valid CSV with headers | RFC 4180 compliant formatted table | **PASS** |
| **Secret Leak Scanner** | Detect forbidden secret keys in JSON | `hasLeak: true`, matches identified keys | **PASS** |
| **Clean Payload Scan** | Validate clean export passes leak scanning | `hasLeak: false`, 0 keys matched | **PASS** |
| **Preferences & Profiles**| Export preferences and custom profiles | Allowlisted properties exported; 0 credentials | **PASS** |
| **Chat & CSV Tables** | Export chat sessions and messages as CSV | Generates `sessions.csv` and `messages.csv` | **PASS** |
| **Non-Destructive Invariant** | Verify source database is untouched | 0 records deleted, 0 timestamps altered | **PASS** |
| **TypeScript Typecheck** | Full project compilation (`tsc --noEmit`) | 0 errors across 100% of files | **PASS** |
| **Vite Production Build** | Complete client production build | Production build succeeds cleanly | **PASS** |

---

## 3. Test Execution Verification Commands

```powershell
# 1. Data Export isolated unit test suite
node --experimental-strip-types --test src/features/export/__tests__/dataExport.test.ts

# 2. Global application test suite
npm test

# 3. TypeScript strict compiler check
npm run typecheck

# 4. Production bundle build
npm run build
```

