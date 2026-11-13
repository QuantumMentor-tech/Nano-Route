# Nano Route Setup Recovery & Fault Handling Guide

## 1. Overview
Setup recovery ensures that users are never trapped in an unusable state if a subsystem encounters an unexpected failure, permission restriction, network timeout, or abnormal process termination during onboarding.

---

## 2. Failure Scenarios & Recovery Workflows

### 2.1 Database Unavailable / Locked (SQLite Failure)
- **Symptom:** `evaluateSystemReadiness()` reports `database.status: "unavailable"`.
- **Impact:** Mandatory prerequisite blocked. Onboarding transitions to `BLOCKED`.
- **Recovery Action:**
  1. Displays `OnboardingRecoveryCard` with clear message: *"SQLite persistence layer is unavailable or locked."*
  2. Guides user to check disk space and permissions in `%LOCALAPPDATA%\Nano Route\`.
  3. Provides a "Re-test Subsystems" button that calls `loadData()` to re-probe database status without restarting the app.
  4. Advance button is disabled until database readiness is restored.

### 2.2 Local SLM Unavailable / Offline
- **Symptom:** Local SLM runtime returns `state: "error"` or `modelStatus: "unloaded"`.
- **Impact:** **Non-blocking.** Local routing can fall back to cloud providers or balanced fallback.
- **Recovery Action:**
  1. Screen 3 highlights that the local model is offline.
  2. Recommends adding a frontier provider API key (Screen 4) so the application remains fully functional.
  3. Setup is permitted to continue; does not block completion.

### 2.3 Provider Setup Interruption / Invalid API Key
- **Symptom:** User enters an invalid or expired API key.
- **Impact:** `saveProviderCredential` throws `INVALID_INPUT` or probe fails.
- **Recovery Action:**
  1. Plaintext error message rendered inline: *"Please enter a valid API key."*
  2. Plaintext key input is retained for editing or user can click "Skip for now" to postpone configuration.
  3. No secrets are logged or leaked.

### 2.4 Interrupted Process / Crash During Onboarding
- **Symptom:** Windows reboot, power outage, or process termination occurs midway through setup.
- **Impact:** Application re-opens with partial state.
- **Recovery Action:**
  1. `getStoredOnboardingProgress()` validates the version and retrieves `currentStepId`.
  2. If the shutdown marker indicates an abnormal prior termination, state transitions to `RECOVERY_REQUIRED`.
  3. Onboarding resumes at the exact step where the user left off, with an option to restart from Step 1 or jump to Settings.

