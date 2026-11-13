# Nano Route Onboarding Test Matrix (Step 61)

## 1. Scope & Execution Matrix
This matrix details the automated, integration, and user-flow tests executed for the Guided Onboarding and First-Run Experience.

| Test ID | Area / Workflow | Test Scenario | Expected Outcome | Execution Result |
|:---|:---|:---|:---|:---|
| **ONB-TM-01** | First-Run Detection | Application launch with zero existing chats and zero credentials. | `isFirstRun(false)` returns `true`; onboarding initiates in `NOT_STARTED`. | **PASS** |
| **ONB-TM-02** | Existing User Protection| Application launch with existing chat history or credentials. | `isFirstRun(true)` returns `false`; user is NOT trapped or forced to onboard. | **PASS** |
| **ONB-TM-03** | State Step Advance | User activates "Continue" across steps 1 through 8. | `currentStepId` advances sequentially; percentage updates linearly (0% to 100%). | **PASS** |
| **ONB-TM-04** | State Step Retreat | User activates "Back" button on step 3. | `currentStepId` retreats to step 2; previously completed steps are preserved. | **PASS** |
| **ONB-TM-05** | Optional Step Skipping | User activates "Skip for now" on Provider Setup (Step 4). | Step 4 is recorded in `skippedStepIds`; does not fake credential completion. | **PASS** |
| **ONB-TM-06** | System Readiness Check | Evaluates readiness report when SQLite database is open and SLM is ready. | Subsystems marked "ready"; `overallReady` evaluates to `true`. | **PASS** |
| **ONB-TM-07** | Database Failure Block | Evaluates readiness report when SQLite database is unavailable. | Database marked "unavailable"; `canCompleteOnboarding` returns `allowed: false`. | **PASS** |
| **ONB-TM-08** | DPAPI Secret Isolation | Provider credential entry in Step 4 form. | API key is encrypted directly via DPAPI; zero plaintext keys stored in React or local storage. | **PASS** |
| **ONB-TM-09** | Version Incompatibility | Storage contains invalid or legacy onboarding schema version. | Safely resets to clean `createInitialOnboardingProgress()`; no crash or corruption. | **PASS** |
| **ONB-TM-10** | Crash Recovery Resume | Application re-launches after process interruption on Step 4. | Retrieves saved `currentStepId: "provider_setup"`; resumes at Step 4 without data loss. | **PASS** |
| **ONB-TM-11** | Keyboard Traversal | Traversal of complete onboarding modal via `Tab`, `Enter`, `Escape`. | All controls reachable; Escape dismisses; Enter activates primary CTA. | **PASS** |
| **ONB-TM-12** | Documentation Set | Verification of all 6 authoritative onboarding documents in `docs/onboarding/`. | All 6 files exist, contain substantive specifications, and align with code. | **PASS** |

