/**
//! Nano Route — Step 46 Settings & Provider Management Workspace
//! File: src/features/settings/components/SettingsWorkspace.tsx
//!
//! Central desktop settings workspace orchestrating General settings,
//! Provider management, Models & Routing override, Privacy & Data lifecycle (Step 45),
//! and Security & Diagnostics disclosures.
*/

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import {
  getSettingsWorkspaceSnapshot,
  type SettingsWorkspaceSnapshotDto,
} from "../../../services/ipc";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { ProviderManagementPanel } from "./ProviderManagementPanel";
import { ModelsAndRoutingPanel } from "./ModelsAndRoutingPanel";
import { PrivacyDataLifecyclePanel } from "./PrivacyDataLifecyclePanel";
import { SecurityDiagnosticsPanel } from "./SecurityDiagnosticsPanel";

export type SettingsTabId = "general" | "providers" | "models" | "privacy" | "security";

export const SettingsWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as SettingsTabId | null;
  const activeTab: SettingsTabId =
    rawTab && ["general", "providers", "models", "privacy", "security"].includes(rawTab)
      ? rawTab
      : "general";

  const [snapshot, setSnapshot] = useState<SettingsWorkspaceSnapshotDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      const data = await getSettingsWorkspaceSnapshot();
      setSnapshot(data);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleTabChange = (tabId: SettingsTabId) => {
    setSearchParams({ tab: tabId });
  };

  const navItems: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Sliders style={{ width: "16px", height: "16px" }} /> },
    { id: "providers", label: "Providers", icon: <Server style={{ width: "16px", height: "16px" }} /> },
    { id: "models", label: "Models & Routing", icon: <Cpu style={{ width: "16px", height: "16px" }} /> },
    { id: "privacy", label: "Privacy & Data", icon: <HardDrive style={{ width: "16px", height: "16px" }} /> },
    { id: "security", label: "Security & Diagnostics", icon: <ShieldCheck style={{ width: "16px", height: "16px" }} /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Settings Navigation Tabs Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--nr-border-subtle)",
          paddingBottom: "0.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }} role="tablist">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => handleTabChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.625rem 1rem",
                  borderRadius: "0.5rem 0.5rem 0 0",
                  background: isActive ? "var(--nr-surface-card)" : "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--nr-accent-purple)" : "2px solid transparent",
                  color: isActive ? "var(--nr-text-primary)" : "var(--nr-text-secondary)",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Refresh Button */}
        <button
          type="button"
          onClick={() => loadSnapshot(true)}
          disabled={loading || refreshing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.75rem",
            borderRadius: "0.375rem",
            background: "transparent",
            border: "1px solid var(--nr-border-subtle)",
            color: "var(--nr-text-secondary)",
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
          title="Reload configuration snapshot"
        >
          <RefreshCw
            style={{
              width: "14px",
              height: "14px",
              animation: refreshing ? "spin 1s linear infinite" : undefined,
            }}
          />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            fontSize: "0.875rem",
          }}
        >
          <AlertCircle style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{loadError}</span>
          <button
            type="button"
            onClick={() => loadSnapshot()}
            style={{
              padding: "0.25rem 0.625rem",
              borderRadius: "0.25rem",
              background: "#ef4444",
              border: "none",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab Panels */}
      {loading && !snapshot ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "3rem 1rem",
            color: "var(--nr-text-secondary)",
            fontSize: "0.875rem",
            gap: "0.5rem",
          }}
        >
          <RefreshCw style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
          <span>Loading configuration snapshot...</span>
        </div>
      ) : snapshot ? (
        <div style={{ marginTop: "0.5rem" }}>
          {activeTab === "general" && (
            <GeneralSettingsPanel
              appSettings={snapshot.appSettings}
              onSettingsChanged={() => loadSnapshot()}
              onNavigateTab={(tab) => handleTabChange(tab as SettingsTabId)}
            />
          )}

          {activeTab === "providers" && (
            <ProviderManagementPanel
              providers={snapshot.providers}
              models={snapshot.models}
              onRefresh={() => loadSnapshot()}
            />
          )}

          {activeTab === "models" && (
            <ModelsAndRoutingPanel
              appSettings={snapshot.appSettings}
              providers={snapshot.providers}
              models={snapshot.models}
              routingPolicy={snapshot.routingPolicy}
              onRefresh={() => loadSnapshot()}
            />
          )}

          {activeTab === "privacy" && <PrivacyDataLifecyclePanel />}

          {activeTab === "security" && (
            <SecurityDiagnosticsPanel
              appSettings={snapshot.appSettings}
              providers={snapshot.providers}
              models={snapshot.models}
              securityStatus={snapshot.securityStatus}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};

