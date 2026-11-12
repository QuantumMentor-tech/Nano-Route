import React from "react";
import {
  DashboardHeader,
  RuntimeStatusCard,
  QuickActions,
  CapabilityOverview,
  DiagnosticDisclosure,
} from "../features/dashboard";
import { TelemetryDashboard } from "../features/telemetry";

export const DashboardPage: React.FC = () => {
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
      <DashboardHeader />

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
    </div>
  );
};

DashboardPage.displayName = "DashboardPage";
