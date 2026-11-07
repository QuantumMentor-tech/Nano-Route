import React from "react";
import {
  DashboardHeader,
  RuntimeStatusCard,
  QuickActions,
  CapabilityOverview,
  MetricsOverview,
  RecentActivity,
  DiagnosticDisclosure,
} from "../features/dashboard";

export const DashboardPage: React.FC = () => {
  return (
    <div
      className="nr-dashboard-page"
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: "960px",
        paddingBottom: "3rem",
      }}
    >
      {/* 1. Header with Title & Quick CTA */}
      <DashboardHeader />

      {/* 2. Runtime Application Core Status */}
      <RuntimeStatusCard />

      {/* 3. Primary Quick Actions */}
      <QuickActions />

      {/* 4. Truthful System Capability Overview */}
      <CapabilityOverview />

      {/* 5. Metrics Overview (Truthful Empty State) */}
      <MetricsOverview />

      {/* 6. Recent Activity (Truthful Empty State) */}
      <RecentActivity />

      {/* 7. Diagnostic Baseline Disclosure (Step 2-7 Continuity) */}
      <DiagnosticDisclosure />
    </div>
  );
};

DashboardPage.displayName = "DashboardPage";
