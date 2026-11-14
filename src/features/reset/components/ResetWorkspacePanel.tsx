/**
 * Nano Route — Application Reset & Factory Defaults Settings Panel
 * File: src/features/reset/components/ResetWorkspacePanel.tsx
 *
 * Implements Step 69 settings workspace interface organizing the 8 reset operations
 * into distinct impact categories with clear visual hierarchy, consequence disclosure,
 * and guarded modal triggers.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  Download,
  Key,
  Layers,
  Palette,
  RotateCcw,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import {
  type ResetOperationType,
  type ResetExecutionResult,
} from "../types.ts";
import { RESET_CATALOG } from "../catalog.ts";
import { ResetModal } from "./ResetModal.tsx";
import { listProviderCredentialStatuses } from "../../../services/ipc/credentials.ts";
import { type ProviderCredentialStatus } from "../../../services/ipc/types.ts";
import { useNotifications } from "../../notifications";
import { usePreferences } from "../../settings/PreferencesContext.tsx";

export const ResetWorkspacePanel: React.FC = () => {
  const { publish } = useNotifications();
  const { reloadPreferences } = usePreferences();

  const [activeModalOp, setActiveModalOp] = useState<ResetOperationType | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [providers, setProviders] = useState<ProviderCredentialStatus[]>([]);
  const [lastResult, setLastResult] = useState<ResetExecutionResult | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const list = await listProviderCredentialStatuses();
      setProviders(list.filter((p) => p.isConfigured));
      if (list.length > 0 && !selectedProviderId) {
        setSelectedProviderId(list[0].providerId);
      }
    } catch {
      // Non-fatal
    }
  }, [selectedProviderId]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleModalSuccess = async (result: ResetExecutionResult) => {
    setLastResult(result);
    await reloadPreferences();
    await loadProviders();

    publish({
      title: "Reset Operation Completed",
      message: result.verificationMessage,
      severity: result.verified ? "success" : "warning",
      source: "System",
    });

    if (result.operation === "FACTORY_RESET" && typeof window !== "undefined") {
      // Force clean navigation to Dashboard to trigger fresh onboarding lifecycle
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Overview Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <RotateCcw style={{ width: "24px", height: "24px", color: "var(--nr-accent-purple, #a855f7)", flexShrink: 0, marginTop: "0.2rem" }} />
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary, #f3f4f6)" }}>
            Application Reset & Factory Defaults
          </h3>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--nr-text-secondary, #9ca3af)", lineHeight: 1.5 }}>
            Restore application configuration, interface preferences, workspace profiles, or local data to defined baselines.
            Destructive operations require explicit confirmation and never affect unselected data categories.
          </p>
        </div>
      </div>

      {/* Completion Notification */}
      {lastResult && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: lastResult.verified ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            border: `1px solid ${lastResult.verified ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            color: lastResult.verified ? "#34d399" : "#fbbf24",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>{lastResult.operation.replace(/_/g, " ")}: </strong>
            {lastResult.verificationMessage}
            {lastResult.backupPath && (
              <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--nr-text-secondary, #9ca3af)" }}>
                Safety backup created: {lastResult.backupPath}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group 1: Preferences & Presentation */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Palette style={{ width: "18px", height: "18px", color: "#38bdf8" }} />
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Interface Preferences</h4>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.RESET_PREFERENCES.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.RESET_PREFERENCES.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("RESET_PREFERENCES")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-subtle, #2d2d35)",
              color: "var(--nr-text-primary, #f3f4f6)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset Preferences
          </button>
        </div>
      </div>

      {/* Group 2: Workspace Profiles & Session State */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Layers style={{ width: "18px", height: "18px", color: "#818cf8" }} />
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Workspace Profiles & Navigation</h4>
        </div>

        {/* Reset Workspace Profiles */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--nr-border-subtle, #2d2d35)", paddingBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.RESET_WORKSPACE.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.RESET_WORKSPACE.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("RESET_WORKSPACE")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-subtle, #2d2d35)",
              color: "var(--nr-text-primary, #f3f4f6)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset Profiles
          </button>
        </div>

        {/* Reset Session State */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.RESET_SESSION_STATE.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.RESET_SESSION_STATE.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("RESET_SESSION_STATE")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-subtle, #2d2d35)",
              color: "var(--nr-text-primary, #f3f4f6)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset Session State
          </button>
        </div>
      </div>

      {/* Group 3: Provider Credentials */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Key style={{ width: "18px", height: "18px", color: "#fbbf24" }} />
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Windows DPAPI Provider Credentials</h4>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.REMOVE_PROVIDER_CREDENTIAL.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.REMOVE_PROVIDER_CREDENTIAL.shortDescription}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {providers.length > 0 ? (
              <>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--nr-surface-base, #121216)",
                    border: "1px solid var(--nr-border-subtle, #2d2d35)",
                    color: "#fff",
                    fontSize: "0.8125rem",
                  }}
                >
                  {providers.map((p) => (
                    <option key={p.providerId} value={p.providerId}>
                      {p.providerId.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setActiveModalOp("REMOVE_PROVIDER_CREDENTIAL")}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    color: "#fbbf24",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Remove Key
                </button>
              </>
            ) : (
              <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)" }}>
                No active provider credentials configured.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Group 4: Application Configuration & Data */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sliders style={{ width: "18px", height: "18px", color: "#a855f7" }} />
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Application Configuration & Data</h4>
        </div>

        {/* Reset App Config */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--nr-border-subtle, #2d2d35)", paddingBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("RESET_APPLICATION_CONFIGURATION")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-subtle, #2d2d35)",
              color: "var(--nr-text-primary, #f3f4f6)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset Configuration
          </button>
        </div>

        {/* Clear Selected User Data */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--nr-border-subtle, #2d2d35)", paddingBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.CLEAR_SELECTED_USER_DATA.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.CLEAR_SELECTED_USER_DATA.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("CLEAR_SELECTED_USER_DATA")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              color: "#fbbf24",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Clear Selected Data
          </button>
        </div>

        {/* Full Local Data Reset */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary, #f3f4f6)" }}>
              {RESET_CATALOG.FULL_LOCAL_DATA_RESET.displayName}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              {RESET_CATALOG.FULL_LOCAL_DATA_RESET.shortDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveModalOp("FULL_LOCAL_DATA_RESET")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Erase Local Data
          </button>
        </div>
      </div>

      {/* Group 5: Factory Reset Baseline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldAlert style={{ width: "20px", height: "20px", color: "#ef4444" }} />
          <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "#f87171" }}>
            Factory Reset Baseline
          </h4>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary, #9ca3af)", lineHeight: 1.5 }}>
          {RESET_CATALOG.FACTORY_RESET.shortDescription}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.8125rem", color: "#fca5a5" }}>
            Requires typed confirmation. Backup archives on disk are safely preserved.
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                window.location.search = "?tab=export";
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "var(--nr-text-secondary, #9ca3af)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              <Download style={{ width: "14px", height: "14px" }} />
              <span>Export Data First</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModalOp("FACTORY_RESET")}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "0.375rem",
                backgroundColor: "#ef4444",
                border: "none",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Factory Reset Nano Route
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modal Dialog */}
      <ResetModal
        operation={activeModalOp}
        providerId={selectedProviderId}
        onClose={() => setActiveModalOp(null)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

