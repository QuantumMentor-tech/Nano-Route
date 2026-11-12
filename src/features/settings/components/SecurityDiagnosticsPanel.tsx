/**
//! Nano Route — Step 46 Security & Diagnostics Panel
//! File: src/features/settings/components/SecurityDiagnosticsPanel.tsx
//!
//! Exposes cryptographic DPAPI storage disclosures, local architecture guarantees,
//! system diagnostic summaries, and safe secret-redacted configuration export.
*/

import React, { useState } from "react";
import {
  CheckCircle2,
  Download,
  HardDrive,
  Lock,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  type AppSettingsSnapshot,
  type ModelSettingsSummaryDto,
  type ProviderSettingsSummaryDto,
  type SecurityStatusSummaryDto,
} from "../../../services/ipc";

interface SecurityDiagnosticsPanelProps {
  appSettings: AppSettingsSnapshot;
  providers: ProviderSettingsSummaryDto[];
  models: ModelSettingsSummaryDto[];
  securityStatus: SecurityStatusSummaryDto;
}

export const SecurityDiagnosticsPanel: React.FC<SecurityDiagnosticsPanelProps> = ({
  appSettings,
  providers,
  models,
  securityStatus,
}) => {
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Safe secret-redacted settings export (Section 90 & 91)
  const handleExportConfiguration = () => {
    try {
      const safePayload = {
        exportedAt: new Date().toISOString(),
        application: "Nano Route Desktop SLM Router",
        version: "0.1.0",
        appSettings: {
          routingPreferenceMode: appSettings.routingPreferenceMode,
          telemetryEnabled: appSettings.telemetryEnabled,
          historyRetentionDays: appSettings.historyRetentionDays,
          windowStartMaximized: appSettings.windowStartMaximized,
          manualOverrideEnabled: appSettings.manualOverrideEnabled,
          manualOverrideProvider: appSettings.manualOverrideProvider,
          manualOverrideModel: appSettings.manualOverrideModel,
        },
        providers: providers.map((p) => ({
          providerId: p.providerId,
          displayName: p.displayName,
          isConfigured: p.isConfigured,
          isActive: p.isActive,
          priorityWeight: p.priorityWeight,
          configuredBaseUrl: p.configuredBaseUrl,
          defaultModelId: p.defaultModelId,
          // CRITICAL SECURITY INVARIANT:
          // Plaintext API keys and encrypted DPAPI BLOBs are STRICTLY EXCLUDED.
        })),
        modelsCount: models.length,
        securityGuarantees: {
          dpapiProtection: true,
          localStorageOnly: true,
          plaintextKeysProhibited: true,
          cloudSyncDisabled: true,
        },
      };

      const blob = new Blob([JSON.stringify(safePayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nano-route-config-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice("Redacted configuration exported successfully. (Zero secrets included)");
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: unknown) {
      setExportNotice(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {exportNotice && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#4ade80",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle2 style={{ width: "16px", height: "16px" }} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Security Architecture & Storage Invariants */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <ShieldCheck style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Security & Credential Protection
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1.25rem 0" }}>
          Nano Route is engineered around strict local-first and zero-leakage security boundaries.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
          {/* DPAPI Disclosure Card */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <Lock style={{ width: "16px", height: "16px", color: "#4ade80" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Windows DPAPI Protection
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0, lineHeight: 1.4 }}>
              API credentials are protected using Windows Data Protection API (DPAPI) and are never stored as plaintext application data.
            </p>
          </div>

          {/* Local-Only Disclosure Card */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <HardDrive style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Local-Only Architecture
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0, lineHeight: 1.4 }}>
              Zero cloud account sync, zero remote settings backup, and zero external telemetry servers. All data remains exclusively on this workstation.
            </p>
          </div>

          {/* Secret Sanitization Card */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <CheckCircle2 style={{ width: "16px", height: "16px", color: "var(--nr-accent-purple)" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Plaintext Keys Prohibited
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0, lineHeight: 1.4 }}>
              Plaintext API keys never leave the secure native Rust core back to the frontend. Web storage and browser caches never retain keys.
            </p>
          </div>
        </div>
      </section>

      {/* Diagnostics & Runtime Information */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Server style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            System Diagnostics
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Operational metadata and desktop application runtime configuration.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Storage Engine</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
              {securityStatus.localStorageType}
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Registered Providers</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
              {providers.length} Providers ({providers.filter((p) => p.isConfigured).length} Configured)
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Catalog Models</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
              {models.length} Canonical Models
            </div>
          </div>
        </div>
      </section>

      {/* Safe Redacted Configuration Export */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
            Export Configuration (Redacted)
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
            Generate a JSON backup of your application settings, provider preferences, and model configurations.
            <strong> API credentials and cryptographic ciphertext are strictly excluded.</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportConfiguration}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            background: "var(--nr-surface-raised)",
            border: "1px solid var(--nr-border-subtle)",
            color: "var(--nr-text-primary)",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Download style={{ width: "16px", height: "16px" }} />
          <span>Export JSON</span>
        </button>
      </section>
    </div>
  );
};
