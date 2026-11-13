import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DashboardHeader,
  RuntimeStatusCard,
  QuickActions,
  CapabilityOverview,
  DiagnosticDisclosure,
} from "../features/dashboard";
import { TelemetryDashboard } from "../features/telemetry";
import { OnboardingModal, getStoredOnboardingProgress } from "../features/onboarding";
import { ROUTE_PATHS } from "../routes/routePaths";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      const progress = getStoredOnboardingProgress();
      return progress.state === "NOT_STARTED";
    } catch {
      return false;
    }
  });

  return (
    <div
      className="nr-dashboard-page"
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: "1280px",
        paddingBottom: "3rem",
      }}
    >
      {/* 1. Header with Title & Quick CTA */}
      <DashboardHeader onOpenOnboarding={() => setIsOnboardingOpen(true)} />

      {/* 2. Runtime Application Core Status */}
      <RuntimeStatusCard />

      {/* 3. Primary Quick Actions */}
      <QuickActions />

      {/* 4. Step 42 Operational Telemetry & Local Routing Analytics Workspace */}
      <div style={{ marginBottom: "2.25rem" }}>
        <TelemetryDashboard />
      </div>

      {/* 5. Truthful System Capability Overview */}
      <CapabilityOverview />

      {/* 6. Diagnostic Baseline Disclosure (Step 2-7 Continuity) */}
      <DiagnosticDisclosure />

      {/* Guided Onboarding & First-Run Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onNavigateToChat={() => navigate(ROUTE_PATHS.CHAT)}
        onNavigateToSettings={() => navigate(ROUTE_PATHS.SETTINGS)}
      />
    </div>
  );
};

DashboardPage.displayName = "DashboardPage";
