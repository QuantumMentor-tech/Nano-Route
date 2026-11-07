import { Card, Badge } from "../components/ui";
import { FileKey } from "lucide-react";

export function LicensePage() {
  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "800px" }}>
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <FileKey style={{ width: "24px", height: "24px", color: "var(--nr-accent-purple)" }} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--nr-text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            License & Entitlements
          </h1>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
          Product activation, license verification, and feature entitlements
        </p>
      </header>

      <Card variant="elevated" padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Badge variant="purple">Architecture Boundary</Badge>
          <Badge variant="default">Step 8 Navigation Target</Badge>
        </div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
          License Management
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.6, margin: 0 }}>
          This page is a verified navigation destination mounted inside the Step 7 Desktop Shell.
          Cryptographic offline license validation and tier verification will be wired in
          subsequent licensing steps.
        </p>
      </Card>
    </div>
  );
}

