import { Card, Badge } from "../components/ui";
import { Info } from "lucide-react";

export function AboutPage() {
  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "800px" }}>
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <Info style={{ width: "24px", height: "24px", color: "var(--nr-accent-purple)" }} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--nr-text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            About Nano Route
          </h1>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
          System diagnostics, build metadata, and architecture overview
        </p>
      </header>

      <Card variant="elevated" padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Badge variant="purple">Architecture Boundary</Badge>
          <Badge variant="default">Step 8 Navigation Target</Badge>
        </div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
          System & Build Information
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-muted)" }}>Application:</span>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-primary)", fontWeight: 500 }}>Nano Route Desktop</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-muted)" }}>Version:</span>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-primary)", fontWeight: 500 }}>0.1.0 (Core v1 Baseline)</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-muted)" }}>Architecture:</span>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-primary)", fontWeight: 500 }}>Tauri v2 + Rust Core + React 18 / TypeScript</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-muted)" }}>Platform:</span>
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-primary)", fontWeight: 500 }}>Windows Desktop (x86_64)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

