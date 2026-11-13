/**
 * Nano Route — Guided Onboarding & First-Run Experience Types
 * File: src/features/onboarding/types.ts
 *
 * Implements Step 61 deterministic onboarding state machine types,
 * system readiness schemas, and progress persistence records.
 */

export type OnboardingState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_USE"
  | "COMPLETED"
  | "SKIPPED"
  | "BLOCKED"
  | "RECOVERY_REQUIRED";

export type OnboardingSubstate =
  | "DATABASE_READY"
  | "SLM_READY"
  | "PROVIDER_REGISTRY_READY"
  | "PROVIDER_CREDENTIALS_READY"
  | "MODEL_SELECTION_READY"
  | "ROUTING_READY";

export type OnboardingStepId =
  | "welcome"
  | "system_readiness"
  | "local_slm"
  | "provider_setup"
  | "model_readiness"
  | "routing_readiness"
  | "test_readiness"
  | "complete";

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  stepNumber: number;
  title: string;
  shortDescription: string;
  isOptional: boolean;
}

export interface SubsystemReadinessItem {
  id: string;
  displayName: string;
  status: "ready" | "not_configured" | "initializing" | "unavailable" | "needs_attention";
  details: string;
  isMandatory: boolean;
  actionRequired?: string;
}

export interface SystemReadinessReport {
  database: SubsystemReadinessItem;
  localSlm: SubsystemReadinessItem;
  providerRegistry: SubsystemReadinessItem;
  credentialsVault: SubsystemReadinessItem;
  modelRegistry: SubsystemReadinessItem;
  routingEngine: SubsystemReadinessItem;
  overallReady: boolean;
  blockingReasons: string[];
}

export interface OnboardingProgressRecord {
  version: number;
  state: OnboardingState;
  currentStepId: OnboardingStepId;
  completedStepIds: OnboardingStepId[];
  skippedStepIds: OnboardingStepId[];
  activeSubstates: OnboardingSubstate[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  recoveryReason?: string;
}

export interface OnboardingActionPayloads {
  START: undefined;
  NEXT: undefined;
  BACK: undefined;
  SKIP: { stepId: OnboardingStepId };
  COMPLETE_STEP: { stepId: OnboardingStepId };
  FAIL: { reason: string };
  ENTER_RECOVERY: { reason: string };
  RESUME: undefined;
  COMPLETE_ALL: undefined;
  RESET: undefined;
}

