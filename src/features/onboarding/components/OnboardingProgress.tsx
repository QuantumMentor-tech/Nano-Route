import React from "react";
import { ONBOARDING_STEPS } from "../stateMachine";
import type { OnboardingStepId } from "../types";

export interface OnboardingProgressProps {
  currentStepId: OnboardingStepId;
  completedStepIds: OnboardingStepId[];
  percentage: number;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStepId,
  percentage,
}) => {
  const currentStep = ONBOARDING_STEPS.find((s) => s.id === currentStepId);
  const stepNumber = currentStep ? currentStep.stepNumber : 1;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.8125rem",
          color: "var(--nr-text-secondary)",
          fontFamily: "var(--nr-font-mono)",
        }}
      >
        <span>
          Step {stepNumber} of {totalSteps}: {currentStep?.title}
        </span>
        <span>{percentage}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Onboarding progress: step ${stepNumber} of ${totalSteps}`}
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          borderRadius: "9999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: "var(--nr-accent-purple)",
            borderRadius: "9999px",
            transition: "width 250ms ease-out",
          }}
        />
      </div>
    </div>
  );
};

