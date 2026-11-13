/**
 * Nano Route — Onboarding State Machine & System Readiness Evaluator
 * File: src/features/onboarding/stateMachine.ts
 *
 * Implements deterministic onboarding state transitions, readiness evaluations,
 * and recovery state resolution without duplicating underlying service logic.
 */

import type {
  OnboardingProgressRecord,
  OnboardingStepDefinition,
  OnboardingStepId,
  OnboardingSubstate,
  SystemReadinessReport,
} from "./types.ts";

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = [
  {
    id: "welcome",
    stepNumber: 1,
    title: "Welcome to Nano Route",
    shortDescription: "Overview of local SLM routing and privacy-first desktop architecture.",
    isOptional: false,
  },
  {
    id: "system_readiness",
    stepNumber: 2,
    title: "System Readiness",
    shortDescription: "Verification of runtime, SQLite, and DPAPI credential systems.",
    isOptional: false,
  },
  {
    id: "local_slm",
    stepNumber: 3,
    title: "Local SLM Setup",
    shortDescription: "On-device model for prompt evaluation and zero-latency routing.",
    isOptional: false,
  },
  {
    id: "provider_setup",
    stepNumber: 4,
    title: "Provider Credentials",
    shortDescription: "Configure frontier model API keys protected via Windows DPAPI.",
    isOptional: true, // Can operate with local SLM only or configure later
  },
  {
    id: "model_readiness",
    stepNumber: 5,
    title: "Model Capabilities",
    shortDescription: "Inspect authoritative catalog of local and cloud models.",
    isOptional: true,
  },
  {
    id: "routing_readiness",
    stepNumber: 6,
    title: "Routing Configuration",
    shortDescription: "Understand automatic multi-factor routing and manual overrides.",
    isOptional: true,
  },
  {
    id: "test_readiness",
    stepNumber: 7,
    title: "Readiness Diagnostics",
    shortDescription: "Validate end-to-end component readiness before starting chat.",
    isOptional: false,
  },
  {
    id: "complete",
    stepNumber: 8,
    title: "Setup Complete",
    shortDescription: "Review configured capabilities and launch the Chat Studio.",
    isOptional: false,
  },
];

export const CURRENT_ONBOARDING_VERSION = 1;

/**
 * Initializes a clean onboarding progress record.
 */
export function createInitialOnboardingProgress(): OnboardingProgressRecord {
  const now = new Date().toISOString();
  return {
    version: CURRENT_ONBOARDING_VERSION,
    state: "NOT_STARTED",
    currentStepId: "welcome",
    completedStepIds: [],
    skippedStepIds: [],
    activeSubstates: [],
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Resolves the next step ID given the current step and step list.
 */
export function getNextStepId(currentId: OnboardingStepId): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentId);
  if (currentIndex === -1 || currentIndex >= ONBOARDING_STEPS.length - 1) {
    return null;
  }
  return ONBOARDING_STEPS[currentIndex + 1].id;
}

/**
 * Resolves the previous step ID given the current step.
 */
export function getPreviousStepId(currentId: OnboardingStepId): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentId);
  if (currentIndex <= 0) {
    return null;
  }
  return ONBOARDING_STEPS[currentIndex - 1].id;
}

/**
 * Advances the onboarding state machine forward to the next step.
 */
export function advanceOnboardingStep(
  progress: OnboardingProgressRecord,
  isSkipped = false
): OnboardingProgressRecord {
  const now = new Date().toISOString();
  const nextId = getNextStepId(progress.currentStepId);

  const completedStepIds = [...progress.completedStepIds];
  const skippedStepIds = [...progress.skippedStepIds];

  if (isSkipped) {
    if (!skippedStepIds.includes(progress.currentStepId)) {
      skippedStepIds.push(progress.currentStepId);
    }
  } else {
    if (!completedStepIds.includes(progress.currentStepId)) {
      completedStepIds.push(progress.currentStepId);
    }
  }

  // If there are no more steps, transition to READY_TO_USE or COMPLETED
  if (!nextId) {
    return {
      ...progress,
      state: "READY_TO_USE",
      completedStepIds,
      skippedStepIds,
      updatedAt: now,
    };
  }

  return {
    ...progress,
    state: "IN_PROGRESS",
    currentStepId: nextId,
    completedStepIds,
    skippedStepIds,
    updatedAt: now,
  };
}

/**
 * Moves the onboarding state machine backward to the previous step.
 */
export function retreatOnboardingStep(progress: OnboardingProgressRecord): OnboardingProgressRecord {
  const prevId = getPreviousStepId(progress.currentStepId);
  if (!prevId) return progress;

  return {
    ...progress,
    currentStepId: prevId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates system readiness across core subsystems.
 */
export function evaluateSystemReadiness(params: {
  isDatabaseOpen: boolean;
  isSlmLoadedOrAvailable: boolean;
  registeredProvidersCount: number;
  hasConfiguredCredentials: boolean;
  registeredModelsCount: number;
}): SystemReadinessReport {
  const blockingReasons: string[] = [];
  const activeSubstates: OnboardingSubstate[] = [];

  // 1. Database check
  const dbReady = params.isDatabaseOpen;
  if (!dbReady) {
    blockingReasons.push("SQLite persistence layer is unavailable or locked.");
  } else {
    activeSubstates.push("DATABASE_READY");
  }

  // 2. SLM check
  const slmReady = params.isSlmLoadedOrAvailable;
  if (slmReady) {
    activeSubstates.push("SLM_READY");
  }

  // 3. Provider registry check
  const provRegReady = params.registeredProvidersCount > 0;
  if (provRegReady) {
    activeSubstates.push("PROVIDER_REGISTRY_READY");
  }

  // 4. Credentials check
  const credsReady = params.hasConfiguredCredentials;
  if (credsReady) {
    activeSubstates.push("PROVIDER_CREDENTIALS_READY");
  }

  // 5. Models check
  const modelsReady = params.registeredModelsCount > 0;
  if (modelsReady) {
    activeSubstates.push("MODEL_SELECTION_READY");
  }

  // 6. Routing engine ready if DB is ready and at least one model/provider (local or cloud) is usable
  const routingReady = dbReady && (slmReady || credsReady);
  if (routingReady) {
    activeSubstates.push("ROUTING_READY");
  }

  // Overall readiness: Database must be open, and either local SLM or cloud credentials configured
  const overallReady = dbReady && (slmReady || credsReady);

  return {
    database: {
      id: "database",
      displayName: "SQLite Persistence Engine",
      status: dbReady ? "ready" : "unavailable",
      details: dbReady
        ? "Protected SQLite database is open with WAL journaling enabled."
        : "Failed to open or lock local database in %LOCALAPPDATA%.",
      isMandatory: true,
      actionRequired: dbReady ? undefined : "Check disk space and filesystem permissions in LocalAppData.",
    },
    localSlm: {
      id: "local_slm",
      displayName: "Local SLM Engine (Llama 3.2)",
      status: slmReady ? "ready" : "needs_attention",
      details: slmReady
        ? "Local model ready for zero-latency prompt evaluation."
        : "Local model runtime offline; cloud provider fallback will be used if configured.",
      isMandatory: false,
    },
    providerRegistry: {
      id: "provider_registry",
      displayName: "Frontier Provider Registry",
      status: provRegReady ? "ready" : "unavailable",
      details: `${params.registeredProvidersCount} frontier providers registered (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Local).`,
      isMandatory: true,
    },
    credentialsVault: {
      id: "credentials_vault",
      displayName: "Windows DPAPI Credential Vault",
      status: credsReady ? "ready" : "not_configured",
      details: credsReady
        ? "At least one provider credential securely stored via Windows DPAPI."
        : "No frontier provider API keys stored yet. You can add keys now or use local routing.",
      isMandatory: false,
      actionRequired: credsReady ? undefined : "Add at least one API key in Provider Setup if cloud routing is desired.",
    },
    modelRegistry: {
      id: "model_registry",
      displayName: "Authoritative Model Catalog",
      status: modelsReady ? "ready" : "unavailable",
      details: `${params.registeredModelsCount} models registered with capabilities and context contracts.`,
      isMandatory: true,
    },
    routingEngine: {
      id: "routing_engine",
      displayName: "Intelligent Hybrid Router",
      status: routingReady ? "ready" : "needs_attention",
      details: routingReady
        ? "Router ready to evaluate complexity, latency, and cost."
        : "Router requires either local SLM or one configured cloud provider to handle queries.",
      isMandatory: true,
      actionRequired: routingReady ? undefined : "Configure either local SLM or one cloud provider credential.",
    },
    overallReady,
    blockingReasons,
  };
}

/**
 * Calculates current completion percentage based on step progress.
 */
export function calculateOnboardingPercentage(progress: OnboardingProgressRecord): number {
  if (progress.state === "COMPLETED") return 100;
  const currentStep = ONBOARDING_STEPS.find((s) => s.id === progress.currentStepId);
  if (!currentStep) return 0;
  return Math.round(((currentStep.stepNumber - 1) / ONBOARDING_STEPS.length) * 100);
}

/**
 * Determines whether onboarding can be formally completed.
 */
export function canCompleteOnboarding(
  progress: OnboardingProgressRecord,
  readiness: SystemReadinessReport
): {
  allowed: boolean;
  reason?: string;
} {
  if (!readiness.database.status.includes("ready")) {
    return {
      allowed: false,
      reason: "Cannot complete setup: Database persistence engine is not ready.",
    };
  }

  // Must have completed or visited the essential steps
  if (!progress.completedStepIds.includes("welcome")) {
    return {
      allowed: false,
      reason: "Welcome step must be completed.",
    };
  }

  return { allowed: true };
}

