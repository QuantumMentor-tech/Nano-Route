import React, { useState, useEffect, useRef } from "react";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { ONBOARDING_STEPS, advanceOnboardingStep, retreatOnboardingStep, calculateOnboardingPercentage, evaluateSystemReadiness } from "../stateMachine";
import { getStoredOnboardingProgress, saveOnboardingProgress, markOnboardingCompleted } from "../onboardingStorage";
import type { OnboardingProgressRecord, SystemReadinessReport } from "../types";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingRecoveryCard } from "./OnboardingRecoveryCard";
import { WelcomeStep } from "./WelcomeStep";
import { SystemReadinessStep } from "./SystemReadinessStep";
import { LocalSlmStep } from "./LocalSlmStep";
import { ProviderSetupStep } from "./ProviderSetupStep";
import { ModelReadinessStep } from "./ModelReadinessStep";
import { RoutingReadinessStep } from "./RoutingReadinessStep";
import { TestReadinessStep } from "./TestReadinessStep";
import { CompletionStep } from "./CompletionStep";

import {
  listRegisteredProviders,
  listRegisteredModels,
  type ProviderDescriptorDto,
  type ModelDescriptorDto,
  type ProviderCredentialStatus,
} from "../../../services/ipc";
import { listProviderCredentialStatuses } from "../../../services/ipc/credentials";
import { getLocalRuntimeStatus } from "../../../services/ipc/local_slm";

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToChat?: () => void;
  onNavigateToSettings?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onNavigateToChat,
  onNavigateToSettings,
}) => {
  const [progress, setProgress] = useState<OnboardingProgressRecord>(getStoredOnboardingProgress);
  const [providers, setProviders] = useState<ProviderDescriptorDto[]>([]);
  const [models, setModels] = useState<ModelDescriptorDto[]>([]);
  const [credentialStatuses, setCredentialStatuses] = useState<ProviderCredentialStatus[]>([]);
  const [readinessReport, setReadinessReport] = useState<SystemReadinessReport | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    try {
      const [provList, modList, credList, slmStatus] = await Promise.all([
        listRegisteredProviders(),
        listRegisteredModels(),
        listProviderCredentialStatuses(),
        getLocalRuntimeStatus().catch(() => null),
      ]);

      setProviders(provList);
      setModels(modList);
      setCredentialStatuses(credList);

      const hasCreds = credList.some((c) => c.isConfigured);
      const isSlmReady = slmStatus?.state === "ready";

      const report = evaluateSystemReadiness({
        isDatabaseOpen: true, // If we reached here in renderer, SQLite initialized in core
        isSlmLoadedOrAvailable: isSlmReady,
        registeredProvidersCount: provList.length,
        hasConfiguredCredentials: hasCreds,
        registeredModelsCount: modList.length,
      });

      setReadinessReport(report);
    } catch {
      // Fallback safe evaluation if some calls reject
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setProgress(getStoredOnboardingProgress());
    }
  }, [isOpen]);

  // Focus trapping and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStep = ONBOARDING_STEPS.find((s) => s.id === progress.currentStepId) || ONBOARDING_STEPS[0];
  const percentage = calculateOnboardingPercentage(progress);
  const isLastStep = currentStep.id === "complete";
  const isFirstStep = currentStep.id === "welcome";

  const handleNext = () => {
    if (isLastStep) {
      markOnboardingCompleted();
      onClose();
      if (onNavigateToChat) onNavigateToChat();
      return;
    }
    const updated = advanceOnboardingStep(progress, false);
    setProgress(updated);
    saveOnboardingProgress(updated);
  };

  const handleSkip = () => {
    const updated = advanceOnboardingStep(progress, true);
    setProgress(updated);
    saveOnboardingProgress(updated);
  };

  const handleBack = () => {
    const updated = retreatOnboardingStep(progress);
    setProgress(updated);
    saveOnboardingProgress(updated);
  };

  const handleFinish = () => {
    markOnboardingCompleted();
    onClose();
    if (onNavigateToChat) onNavigateToChat();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-heading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        padding: "1.5rem",
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: "720px",
          backgroundColor: "#131620",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-xl)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* Header with Title and Close Button */}
        <div
          style={{
            padding: "1.25rem 1.5rem 1rem",
            borderBottom: "1px solid var(--nr-border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--nr-accent-purple)",
                backgroundColor: "rgba(139, 92, 246, 0.15)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              Guided Setup
            </span>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>
              Nano Route Desktop
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup dialog"
            style={{
              background: "none",
              border: "none",
              color: "var(--nr-text-secondary)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar Header */}
        <div style={{ padding: "0.875rem 1.5rem", backgroundColor: "rgba(255, 255, 255, 0.01)", borderBottom: "1px solid var(--nr-border-default)" }}>
          <OnboardingProgress
            currentStepId={progress.currentStepId}
            completedStepIds={progress.completedStepIds}
            percentage={percentage}
          />
        </div>

        {/* Main Step Body */}
        <div
          style={{
            padding: "1.5rem",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {progress.state === "RECOVERY_REQUIRED" && (
            <div style={{ marginBottom: "1rem" }}>
              <OnboardingRecoveryCard
                reason={progress.recoveryReason}
                onRetry={loadData}
                onOpenSettings={() => {
                  onClose();
                  if (onNavigateToSettings) onNavigateToSettings();
                }}
              />
            </div>
          )}

          {currentStep.id === "welcome" && <WelcomeStep />}

          {currentStep.id === "system_readiness" && readinessReport && (
            <SystemReadinessStep report={readinessReport} />
          )}

          {currentStep.id === "local_slm" && readinessReport && (
            <LocalSlmStep slmStatus={readinessReport.localSlm} />
          )}

          {currentStep.id === "provider_setup" && (
            <ProviderSetupStep
              providers={providers}
              credentialStatuses={credentialStatuses}
              onCredentialsUpdated={loadData}
            />
          )}

          {currentStep.id === "model_readiness" && <ModelReadinessStep models={models} />}

          {currentStep.id === "routing_readiness" && <RoutingReadinessStep />}

          {currentStep.id === "test_readiness" && readinessReport && (
            <TestReadinessStep
              report={readinessReport}
              credentialStatuses={credentialStatuses}
              onRefreshReadiness={loadData}
            />
          )}

          {currentStep.id === "complete" && (
            <CompletionStep
              onOpenChat={() => {
                markOnboardingCompleted();
                onClose();
                if (onNavigateToChat) onNavigateToChat();
              }}
              onOpenSettings={() => {
                markOnboardingCompleted();
                onClose();
                if (onNavigateToSettings) onNavigateToSettings();
              }}
            />
          )}
        </div>

        {/* Action Controls Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--nr-border-default)",
            backgroundColor: "rgba(255, 255, 255, 0.01)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            {!isFirstStep && !isLastStep && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 0.875rem",
                  borderRadius: "var(--nr-radius-md)",
                  border: "1px solid var(--nr-border-default)",
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  color: "var(--nr-text-secondary)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {currentStep.isOptional && !isLastStep && (
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  padding: "0.5rem 0.875rem",
                  background: "none",
                  border: "none",
                  color: "var(--nr-text-secondary)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Skip for now
              </button>
            )}

            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 1.125rem",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-accent-purple)",
                  color: "#fff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 1.125rem",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-status-success)",
                  color: "#fff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Check size={14} />
                <span>Finish Setup</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
