import { Card, Badge } from "../components/ui";
import { History } from "lucide-react";

export function HistoryPage() {
  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "800px" }}>
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <History style={{ width: "24px", height: "24px", color: "var(--nr-accent-purple)" }} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--nr-text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Session History
          </h1>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
          Audit trail of past prompts, model selections, and routing decisions
        </p>
      </header>

      <Card variant="elevated" padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Badge variant="purple">Architecture Boundary</Badge>
          <Badge variant="default">Step 8 Navigation Target</Badge>
        </div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
          History & Audit Records
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.6, margin: 0 }}>
          This page is a verified navigation destination mounted inside the Step 7 Desktop Shell.
          SQLite-backed conversation persistence, routing trace inspection, and export utilities
          will be connected in subsequent storage and telemetry steps.
        </p>
      </Card>
    </div>
  );
}

