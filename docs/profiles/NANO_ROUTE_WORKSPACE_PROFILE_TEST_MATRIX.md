# Nano Route — Workspace Profile Test Matrix & Verification Report

**Document Reference:** `docs/profiles/NANO_ROUTE_WORKSPACE_PROFILE_TEST_MATRIX.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 67  
**Test Harness:** Native Node.js Test Runner (`node:test`, `node:assert/strict`)  
**Test Suite Pass Rate:** 100% (20 / 20 Profile Tests, 795 / 795 Application Tests)  

---

## 1. Test Suite Summary

The Step 67 test suite (`src/features/profiles/__tests__/workspaceProfiles.test.ts`) verifies all behavioral, security, and persistence invariants for workspace profiles and preference presets.

```
▶ Step 67 — Local Workspace Profiles & Preference Presets
  ▶ 1. Built-in Presets Integrity (4 tests) - PASS
  ▶ 2. Profile Name & Description Sanitization (3 tests) - PASS
  ▶ 3. Diff Computation Between Profiles and Settings (1 test) - PASS
  ▶ 4. Zero Secrets & Strict Allowlist JSON Export (2 tests) - PASS
  ▶ 5. Untrusted Import Validation & Protection (5 tests) - PASS
  ▶ 6. Atomic Profile Activation & Rollback Safety (2 tests) - PASS
  ▶ 7. Custom Profile Management & Lifecycle Invariants (3 tests) - PASS
✔ Step 67 — Local Workspace Profiles & Preference Presets (20 tests, 0 failed, 0 skipped)
```

---

## 2. Detailed Test Matrix

| ID | Category | Test Case Description | Verified Behavior & Invariant |
| :--- | :--- | :--- | :--- |
| **TC-01** | Presets | Exactly 4 built-in presets | Verifies count is 4 and IDs match `prof_default`, `prof_focus`, `prof_compact`, `prof_accessibility`. |
| **TC-02** | Presets | Schema & metadata validation | Checks `isBuiltin: true`, `schemaVersion: 1`, non-empty names and descriptions within length bounds. |
| **TC-03** | Presets | Allowlist & domain validation | Ensures all preset preferences are in `EXPORTABLE_PREFERENCE_KEYS` and pass `validateSetting()`. |
| **TC-04** | Presets | Domain-specific preset values | Verifies specific theme, density, motion, text scale, and notification behaviors per preset. |
| **TC-05** | Sanitization | Control character stripping | Strips null bytes (`\u0000`), control codes, and collapses excessive whitespace. |
| **TC-06** | Sanitization | Name length enforcement | Enforces strict maximum length of 40 characters (`MAX_PROFILE_NAME_LENGTH`). |
| **TC-07** | Sanitization | Description length enforcement | Enforces strict maximum length of 120 characters (`MAX_PROFILE_DESC_LENGTH`). |
| **TC-08** | Diffs | Diff computation accuracy | Accurately compares active settings snapshot against target profile and flags `willChange`. |
| **TC-09** | Export | Schema envelope compliance | Validates exported JSON contains `nano-route-workspace-profile-v1`, `schemaVersion: 1`, and `appName`. |
| **TC-10** | Export | Zero secrets leakage | Injects fake API keys and passwords into profile; verifies they are strictly filtered out of export. |
| **TC-11** | Import | Malformed input rejection | Rejects non-JSON strings and invalid envelopes with syntax error descriptions. |
| **TC-12** | Import | Payload size ceiling | Rejects JSON payloads exceeding 16,384 bytes (16KB) prior to parsing. |
| **TC-13** | Import | Schema version protection | Rejects unsupported future schema versions (e.g. `schemaVersion: 999`). |
| **TC-14** | Import | Injected key filtering | Automatically removes unknown or non-whitelisted keys on import while preserving valid keys. |
| **TC-15** | Import | Value validation rejection | Rejects payloads containing invalid enum values or out-of-bounds numbers. |
| **TC-16** | Activation | Full atomic activation | Applies all profile settings to mock database and updates `workspace.active_profile_id`. |
| **TC-17** | Rollback | Rollback checkpoint safety | Simulates mid-activation failure; verifies original preference snapshot is completely restored. |
| **TC-18** | Lifecycle | Built-in non-deletable invariant| Confirms built-in presets cannot be deleted by user actions or API calls. |
| **TC-19** | Lifecycle | Active profile deletion fallback| When an active custom profile is deleted, safely resets active profile to `"prof_default"`. |
| **TC-20** | Storage | SQLite JSON persistence roundtrip| Verifies custom profiles array serializes and deserializes accurately in mock settings store. |

---

## 3. Global Regression Verification

- **Total Suites Executed:** 376
- **Total Tests Executed:** 795
- **Passed:** 795 (100%)
- **Failed:** 0
- **Duration:** ~15.0 seconds
- **Production Build:** Vite production build completed in 20.50s with zero errors (`dist/assets/index-*.js`, `dist/assets/index-*.css`).

