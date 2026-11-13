/**
 * Nano Route — Onboarding State Storage & First-Run Detection Adapter
 * File: src/features/onboarding/onboardingStorage.ts
 *
 * Implements persistent progress saving, first-run detection, and safe recovery
 * without storing credentials, tokens, or private conversational data.
 */

import type { OnboardingProgressRecord } from "./types.ts";
import {
  createInitialOnboardingProgress,
  CURRENT_ONBOARDING_VERSION,
} from "./stateMachine.ts";

export const ONBOARDING_STORAGE_KEY = "nr_onboarding_progress_v1";

// In-memory fallback for non-browser/test environments
const memoryStore = new Map<string, string>();

export function getInMemoryStore(): Map<string, string> {
  return memoryStore;
}

export function clearInMemoryStore(): void {
  memoryStore.clear();
}

function getSafeStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
} {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage && typeof globalThis.localStorage.getItem === "function") {
      return globalThis.localStorage;
    }
  } catch {
    // Fall through to memory store
  }

  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
  };
}

/**
 * Retrieves the stored onboarding progress record from client storage,
 * validating version and falling back to clean initial state if missing or corrupted.
 */
export function getStoredOnboardingProgress(): OnboardingProgressRecord {
  const storage = getSafeStorage();
  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return createInitialOnboardingProgress();
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingProgressRecord>;
    if (parsed.version !== CURRENT_ONBOARDING_VERSION || !parsed.state || !parsed.currentStepId) {
      // Incompatible version or corrupted record; safely reset
      return createInitialOnboardingProgress();
    }
    return {
      version: CURRENT_ONBOARDING_VERSION,
      state: parsed.state,
      currentStepId: parsed.currentStepId,
      completedStepIds: Array.isArray(parsed.completedStepIds) ? parsed.completedStepIds : [],
      skippedStepIds: Array.isArray(parsed.skippedStepIds) ? parsed.skippedStepIds : [],
      activeSubstates: Array.isArray(parsed.activeSubstates) ? parsed.activeSubstates : [],
      startedAt: parsed.startedAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      completedAt: parsed.completedAt,
      recoveryReason: parsed.recoveryReason,
    };
  } catch {
    return createInitialOnboardingProgress();
  }
}

/**
 * Saves onboarding progress into client storage.
 * CRITICAL SECURITY INVARIANT: No credentials, API keys, or prompt texts are stored.
 */
export function saveOnboardingProgress(progress: OnboardingProgressRecord): void {
  const storage = getSafeStorage();
  try {
    const payload = JSON.stringify({
      version: progress.version,
      state: progress.state,
      currentStepId: progress.currentStepId,
      completedStepIds: progress.completedStepIds,
      skippedStepIds: progress.skippedStepIds,
      activeSubstates: progress.activeSubstates,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      completedAt: progress.completedAt,
      recoveryReason: progress.recoveryReason,
    });
    storage.setItem(ONBOARDING_STORAGE_KEY, payload);
  } catch {
    // Graceful handling of restricted or quota-exceeded environments
  }
}

/**
 * Evaluates whether the application is experiencing its first run.
 * If user already has existing chat messages or configured credentials,
 * they are NOT treated as a fresh install (to prevent trapping existing users).
 */
export function isFirstRun(hasExistingConfigOrHistory: boolean): boolean {
  if (hasExistingConfigOrHistory) {
    return false;
  }
  const progress = getStoredOnboardingProgress();
  return progress.state === "NOT_STARTED";
}

/**
 * Marks onboarding as formally completed and persists the completion marker.
 */
export function markOnboardingCompleted(): OnboardingProgressRecord {
  const current = getStoredOnboardingProgress();
  const now = new Date().toISOString();
  const completed: OnboardingProgressRecord = {
    ...current,
    state: "COMPLETED",
    currentStepId: "complete",
    completedAt: now,
    updatedAt: now,
  };
  saveOnboardingProgress(completed);
  return completed;
}

/**
 * Resets the onboarding progress record back to initial state (e.g. for re-running onboarding).
 */
export function resetOnboardingProgress(): OnboardingProgressRecord {
  const fresh = createInitialOnboardingProgress();
  saveOnboardingProgress(fresh);
  return fresh;
}
