import React, { useState } from "react";
import { CheckCircle2, Activity, ShieldCheck } from "lucide-react";
import type { SystemReadinessReport } from "../types";
import type { ProviderCredentialStatus } from "../../../services/ipc";
import { checkProviderHealth } from "../../../services/ipc/provider_health";

export interface TestReadinessStepProps {
  report: SystemReadinessReport;
  credentialStatuses: ProviderCredentialStatus[];
  onRefreshReadiness: () => Promise<void>;
}

export const TestReadinessStep: React.FC<TestReadinessStepProps> = ({
  report,
  credentialStatuses,
  onRefreshReadiness,
}) => {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<{ providerId: string; status: string; latencyMs?: number } | null>(null);
  const configuredProviders = credentialStatuses.filter((c) => c.isConfigured);

  const handleTestProvider = async (providerId: string) => {
    try {
      setTestingProvider(providerId);
      setProbeResult(null);
      const res = await checkProviderHealth(providerId);
      setProbeResult({
        providerId,
        status: res.status === "ready" ? "Healthy (Endpoint reachable)" : `Status: ${res.status}`,
        latencyMs: res.latencyMs ?? undefined,
      });
      await onRefreshReadiness();
    } catch (err: unknown) {
      setProbeResult({
        providerId,
        status: `Probe failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3
          id="onboarding-step-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--nr-text-primary)",
          }}
        >
          Readiness Diagnostics & Verification
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          Confirm that local subsystems and configured provider endpoints are responsive. No user prompts or conversational data are sent during this diagnostic.
        </p>
      </div>

      {/* Local Subsystems Summary */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Local Core Health:</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.8125rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: report.database.status === "ready" ? "var(--nr-status-success)" : "var(--nr-status-error)" }}>
            <CheckCircle2 size={14} />
            <span>SQLite Database</span>
          </div>
          <span style={{ color: "var(--nr-text-disabled)" }}>•</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: report.localSlm.status === "ready" ? "var(--nr-status-success)" : "var(--nr-status-warning)" }}>
            <CheckCircle2 size={14} />
            <span>Local SLM Runtime</span>
          </div>
          <span style={{ color: "var(--nr-text-disabled)" }}>•</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--nr-accent-blue)" }}>
            <ShieldCheck size={14} />
            <span>DPAPI Key Vault</span>
          </div>
        </div>
      </div>

      {/* Optional Provider Endpoint Diagnostic */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Optional Network Health Probe:</span>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
            Sends an explicit, empty ping to verify connectivity. (Makes an outbound HTTPS network request).
          </p>
        </div>

        {configuredProviders.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", fontStyle: "italic" }}>
            No cloud providers configured yet. Nano Route is operating in local routing mode.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {configuredProviders.map((c) => (
              <button
                key={c.providerId}
                type="button"
                onClick={() => handleTestProvider(c.providerId)}
                disabled={testingProvider !== null}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--nr-radius-md)",
                  border: "1px solid var(--nr-border-default)",
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  color: "var(--nr-text-primary)",
                  cursor: testingProvider !== null ? "not-allowed" : "pointer",
                }}
              >
                <Activity size={13} style={{ color: "var(--nr-accent-blue)" }} />
                <span style={{ textTransform: "capitalize" }}>Test {c.providerId}</span>
              </button>
            ))}
          </div>
        )}

        {probeResult && (
          <div
            role="status"
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--nr-radius-md)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2 size={14} style={{ color: "var(--nr-status-success)" }} />
            <span>
              {probeResult.providerId}: {probeResult.status} {probeResult.latencyMs ? `(${probeResult.latencyMs}ms)` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
