import React from "react";
import { RefreshCw, Settings, ShieldAlert } from "lucide-react";

export interface OnboardingRecoveryCardProps {
  reason?: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const OnboardingRecoveryCard: React.FC<OnboardingRecoveryCardProps> = ({
  reason,
  onRetry,
  onOpenSettings,
}) => {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1.25rem",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: "var(--nr-radius-lg)",
        color: "var(--nr-text-primary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <ShieldAlert size={22} style={{ color: "var(--nr-status-error)", flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
            Setup Action Required
          </h4>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
            {reason || "An essential subsystem requires user attention before setup can proceed."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.875rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--nr-border-default)",
              borderRadius: "var(--nr-radius-md)",
              color: "var(--nr-text-primary)",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            Re-test Subsystems
          </button>
        )}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 0.875rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--nr-border-default)",
              borderRadius: "var(--nr-radius-md)",
              color: "var(--nr-text-primary)",
              cursor: "pointer",
            }}
          >
            <Settings size={14} />
            Open Settings Workspace
          </button>
        )}
      </div>
    </div>
  );
};
