/**
 * Step 61 — First-Run Experience & Guided Onboarding Lifecycle Test Suite
 * File: src/features/maintenance/__tests__/firstRunOnboardingLifecycle.test.ts
 *
 * Validates deterministic onboarding state transitions, step advances, optional step skipping,
 * system readiness evaluation, first-run detection, storage resilience, and documentation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createInitialOnboardingProgress,
  advanceOnboardingStep,
  retreatOnboardingStep,
  evaluateSystemReadiness,
  calculateOnboardingPercentage,
  canCompleteOnboarding,
  ONBOARDING_STEPS,
} from "../../onboarding/stateMachine.ts";

import {
  getStoredOnboardingProgress,
  saveOnboardingProgress,
  isFirstRun,
  markOnboardingCompleted,
  resetOnboardingProgress,
  clearInMemoryStore,
  getInMemoryStore,
  ONBOARDING_STORAGE_KEY,
} from "../../onboarding/onboardingStorage.ts";

describe("Step 61 First-Run Experience & Guided Onboarding Lifecycle", () => {
  beforeEach(() => {
    clearInMemoryStore();
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      try {
        globalThis.localStorage.clear();
      } catch {
        // Ignore in Node without localstorage file
      }
    }
  });

  // ==========================================================================
  // 1. STATE MACHINE STEP ADVANCEMENT & RETREAT
  // ==========================================================================
  describe("1. Onboarding State Transitions", () => {
    it("initializes a clean progress record in NOT_STARTED state at welcome step", () => {
      const progress = createInitialOnboardingProgress();
      assert.equal(progress.state, "NOT_STARTED");
      assert.equal(progress.currentStepId, "welcome");
      assert.equal(progress.completedStepIds.length, 0);
      assert.equal(progress.skippedStepIds.length, 0);
    });

    it("advances sequentially from welcome to system_readiness and marks completed", () => {
      let progress = createInitialOnboardingProgress();
      progress = advanceOnboardingStep(progress, false);

      assert.equal(progress.state, "IN_PROGRESS");
      assert.equal(progress.currentStepId, "system_readiness");
      assert.ok(progress.completedStepIds.includes("welcome"));
      assert.equal(progress.skippedStepIds.length, 0);
    });

    it("retreats backward to previous step when user activates Back", () => {
      let progress = createInitialOnboardingProgress();
      progress = advanceOnboardingStep(progress, false); // -> system_readiness
      progress = advanceOnboardingStep(progress, false); // -> local_slm
      assert.equal(progress.currentStepId, "local_slm");

      progress = retreatOnboardingStep(progress);
      assert.equal(progress.currentStepId, "system_readiness");
    });

    it("cannot retreat past the first welcome step", () => {
      let progress = createInitialOnboardingProgress();
      progress = retreatOnboardingStep(progress);
      assert.equal(progress.currentStepId, "welcome");
    });

    it("records skipped step in skippedStepIds when user chooses to skip optional step", () => {
      let progress = createInitialOnboardingProgress();
      // Fast forward to step 4: provider_setup
      progress.currentStepId = "provider_setup";
      progress = advanceOnboardingStep(progress, true); // Skip

      assert.equal(progress.currentStepId, "model_readiness");
      assert.ok(progress.skippedStepIds.includes("provider_setup"));
      assert.ok(!progress.completedStepIds.includes("provider_setup"));
    });

    it("transitions to READY_TO_USE when advancing from the final step", () => {
      let progress = createInitialOnboardingProgress();
      progress.currentStepId = "complete";
      progress = advanceOnboardingStep(progress, false);

      assert.equal(progress.state, "READY_TO_USE");
      assert.ok(progress.completedStepIds.includes("complete"));
    });
  });

  // ==========================================================================
  // 2. SYSTEM READINESS EVALUATIONS
  // ==========================================================================
  describe("2. System Readiness Evaluations", () => {
    it("evaluates overallReady true when database is open and local SLM is ready", () => {
      const report = evaluateSystemReadiness({
        isDatabaseOpen: true,
        isSlmLoadedOrAvailable: true,
        registeredProvidersCount: 7,
        hasConfiguredCredentials: false,
        registeredModelsCount: 15,
      });

      assert.equal(report.database.status, "ready");
      assert.equal(report.localSlm.status, "ready");
      assert.equal(report.credentialsVault.status, "not_configured");
      assert.equal(report.overallReady, true);
      assert.equal(report.blockingReasons.length, 0);
    });

    it("blocks overallReady when SQLite database persistence is unavailable", () => {
      const report = evaluateSystemReadiness({
        isDatabaseOpen: false,
        isSlmLoadedOrAvailable: true,
        registeredProvidersCount: 7,
        hasConfiguredCredentials: true,
        registeredModelsCount: 15,
      });

      assert.equal(report.database.status, "unavailable");
      assert.equal(report.overallReady, false);
      assert.ok(report.blockingReasons[0].includes("SQLite persistence layer is unavailable"));

      const progress = createInitialOnboardingProgress();
      const completionCheck = canCompleteOnboarding(progress, report);
      assert.equal(completionCheck.allowed, false);
      assert.ok(completionCheck.reason?.includes("Database persistence engine is not ready"));
    });
  });

  // ==========================================================================
  // 3. FIRST-RUN DETECTION & STORAGE RESILIENCE
  // ==========================================================================
  describe("3. First-Run Detection & Storage Resilience", () => {
    it("detects first run only when there is no existing history and state is NOT_STARTED", () => {
      assert.equal(isFirstRun(false), true);
    });

    it("protects existing users: does NOT flag first run if user has existing configuration", () => {
      assert.equal(isFirstRun(true), false);
    });

    it("marks onboarding completed and persists completion state", () => {
      const completed = markOnboardingCompleted();
      assert.equal(completed.state, "COMPLETED");
      assert.ok(completed.completedAt !== undefined);

      const retrieved = getStoredOnboardingProgress();
      assert.equal(retrieved.state, "COMPLETED");
      assert.equal(retrieved.currentStepId, "complete");

      // Test resetOnboardingProgress back to NOT_STARTED
      const reset = resetOnboardingProgress();
      assert.equal(reset.state, "NOT_STARTED");
      assert.equal(reset.currentStepId, "welcome");
    });

    it("safely resets to initial progress if storage contains invalid or corrupted JSON", () => {
      getInMemoryStore().set(ONBOARDING_STORAGE_KEY, "invalid-json-structure-***");
      const progress = getStoredOnboardingProgress();
      assert.equal(progress.state, "NOT_STARTED");
      assert.equal(progress.currentStepId, "welcome");
    });

    it("verifies saved storage payload contains zero credential secrets or keys", () => {
      let progress = createInitialOnboardingProgress();
      progress = advanceOnboardingStep(progress, false);
      saveOnboardingProgress(progress);

      const raw = getInMemoryStore().get(ONBOARDING_STORAGE_KEY) || "";
      assert.ok(raw.length > 0);
      assert.ok(!raw.includes("sk-"));
      assert.ok(!raw.includes("apiKey"));
      assert.ok(!raw.includes("secret"));
      assert.ok(!raw.includes("password"));
    });
  });

  // ==========================================================================
  // 4. PROGRESS PERCENTAGE & CANONICAL STEPS
  // ==========================================================================
  describe("4. Progress Calculation & Canonical Steps", () => {
    it("has exactly 8 canonical onboarding steps", () => {
      assert.equal(ONBOARDING_STEPS.length, 8);
    });

    it("computes 0% at start, increases progressively, and reaches 100% on completion", () => {
      const progress = createInitialOnboardingProgress();
      assert.equal(calculateOnboardingPercentage(progress), 0);

      progress.currentStepId = "model_readiness"; // step 5
      const midPct = calculateOnboardingPercentage(progress);
      assert.ok(midPct > 40 && midPct < 60);

      progress.state = "COMPLETED";
      assert.equal(calculateOnboardingPercentage(progress), 100);
    });
  });

  // ==========================================================================
  // 5. ONBOARDING DOCUMENTATION INTEGRITY
  // ==========================================================================
  describe("5. Onboarding Documentation Consistency", () => {
    const expectedDocs = [
      "NANO_ROUTE_STEP_61_ONBOARDING_ARCHITECTURE.md",
      "NANO_ROUTE_FIRST_RUN_STATE_MACHINE.md",
      "NANO_ROUTE_ONBOARDING_RECOVERY.md",
      "NANO_ROUTE_ONBOARDING_TEST_MATRIX.md",
      "NANO_ROUTE_ONBOARDING_ACCESSIBILITY.md",
      "NANO_ROUTE_STEP_61_COMPLETION_REPORT.md",
    ];

    it("ensures all 6 authoritative onboarding documents exist in docs/onboarding/", () => {
      const onbDir = path.resolve(process.cwd(), "docs/onboarding");
      assert.ok(fs.existsSync(onbDir), "docs/onboarding/ directory must exist");

      for (const doc of expectedDocs) {
        const filePath = path.join(onbDir, doc);
        assert.ok(fs.existsSync(filePath), `Document ${doc} must exist in docs/onboarding/`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.length > 200, `Document ${doc} must contain meaningful content`);
      }
    });
  });
});
