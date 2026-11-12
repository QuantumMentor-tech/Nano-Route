import { Settings } from "lucide-react";
import { SettingsWorkspace } from "../features/settings";

export function SettingsPage() {
  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "1080px", paddingBottom: "2rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.25rem",
          }}
        >
          <Settings
            style={{
              width: "24px",
              height: "24px",
              color: "var(--nr-accent-purple)",
            }}
          />
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--nr-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Settings & Provider Management
          </h1>
        </div>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--nr-text-secondary)",
            marginTop: "0.25rem",
          }}
        >
          Application preferences, Windows DPAPI credential vault, provider endpoints, manual routing overrides, and local data lifecycle controls.
        </p>
      </header>

      <SettingsWorkspace />
    </div>
  );
}
